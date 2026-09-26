---
id: 28-tripmate-multi-agent-planner
title: "TripMate AI: a Sequential Multi-Agent Pipeline"
sidebar_position: 28
description: "How the TripMate AI capstone chains four LangGraph agents over one shared state, calls tools directly inside nodes, checkpoints to Postgres and ships behind FastAPI."
tags: [Agentic AI, LangGraph, Multi-Agent]
---

# TripMate AI: a Sequential Multi-Agent Pipeline

<div class="tldr">
<strong>TL;DR</strong>

- The lesson builds a travel planner as **four LangGraph nodes in a fixed order**: flight, hotel, itinerary, final response. Each node reads and writes one shared `TypedDict` state.
- Only two of the four nodes call an LLM. The flight and hotel nodes call **plain Python functions directly** (AviationStack, Tavily) instead of exposing them as LLM tools, which keeps the pipeline deterministic and cheap.
- State is persisted with a **Postgres checkpointer** keyed by `thread_id`, the graph is wrapped in a FastAPI route, and the whole thing is containerised and deployed.
</div>

A "multi-agent system" does not have to mean agents negotiating with each other. TripMate AI is the simplest useful shape: a pipeline where every stage is a specialist node and the state is the contract between them. This lesson matters because it shows the boundary between "tool the LLM decides to call" and "function the code calls", and because it wires the boring parts (persistence, API, deployment) that most tutorials skip.

## The shared state is the whole design

Every node receives the same `TravelState` and returns a partial update. The `messages` field uses a reducer (`operator.add`) so each node appends instead of overwriting; every other field is plain replacement. An `llm_calls` counter is bumped by each node so the cost of a run is visible in the state itself.

```
START
  │
  ▼
flight_agent   ── AviationStack API (no LLM) ──▶ flight_result
  │
  ▼
hotel_agent    ── Tavily search (no LLM)     ──▶ hotel_result
  │
  ▼
itinerary_agent ── LLM (Groq, Llama 3.3 70B)  ──▶ itinerary_result
  │
  ▼
final_agent    ── LLM, formats all results    ──▶ final_response
  │
  ▼
END            (every step checkpointed to Postgres under thread_id)
```

Because the edges are unconditional, the run is fully predictable: same input shape, same four steps, exactly two LLM calls.

## Tools as functions, not as LLM tools

The lesson deliberately does not use the `@tool` decorator. `search_flights(query)` and `tavily_search(query)` are ordinary functions imported into `backend.py` and called inside the node body. The reasoning: when a step *always* needs the flight data, letting the LLM decide whether to call the tool adds latency, tokens and a failure mode for nothing. Tool-calling is for optional, model-chosen actions; direct calls are for mandatory pipeline steps.

The Tavily helper trims each snippet to about 300 characters before returning it. That is a token-budget decision, not a quality one: the LLM provider's free tier has tight input limits, so the node feeds it short evidence.

## Two LLM nodes, two different prompts

`itinerary_agent` gets the user query plus the flight and hotel results and is asked for a "practical, budget-aware, easy to follow" day-by-day plan. `final_agent` gets everything, including the itinerary, and is asked to format a fixed set of sections: trip summary, flights, hotels, day-by-day itinerary, estimated budget, final recommendation, important notes. Splitting "plan" from "format" is what makes the output stable enough to render in a UI and export as PDF.

## Persistence and the API layer

The graph is compiled with `PostgresSaver`, connected to a hosted Postgres instance. Two details from the lesson are worth keeping:

- The connection string must end in `sslmode=require` for a remote Postgres, so a small `get_database_url()` helper appends it if missing.
- `checkpointer.setup()` must run once to create the checkpoint tables before the first invoke.

`run_travel_agent(user_input, thread_id)` generates a UUID thread when none is supplied, invokes the graph with `config={"configurable": {"thread_id": ...}}`, and returns a dict the FastAPI route can serialise. The route is `async` and validates the request with a Pydantic model before calling the graph. A `/health` route exists for the hosting platform.

## Code that matters

Reconstructed from what the lesson shows. The state and graph wiring are close to verbatim; the node bodies are a sketch.

```python
import operator
from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage, AIMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver

class TravelState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    flight_result: str
    hotel_result: str
    itinerary_result: str
    final_response: str
    llm_calls: int

def flight_agent(state: TravelState) -> dict:
    # direct function call, no LLM, no @tool
    flights = search_flights(state["user_query"])          # sketch
    return {
        "flight_result": flights,
        "messages": [AIMessage(content="Flight results fetched.")],
        "llm_calls": state.get("llm_calls", 0),
    }

def itinerary_agent(state: TravelState) -> dict:
    prompt = (
        f"Create a complete travel itinerary.\nUser query: {state['user_query']}\n"
        f"Flights: {state['flight_result']}\nHotels: {state['hotel_result']}\n"
        "Make it practical, budget-aware and easy to follow."
    )
    resp = llm.invoke([SystemMessage(content="You are an expert travel planner."),
                       HumanMessage(content=prompt)])
    return {"itinerary_result": resp.content,
            "messages": [resp],
            "llm_calls": state.get("llm_calls", 0) + 1}

graph = StateGraph(TravelState)
graph.add_node("flight_agent", flight_agent)
graph.add_node("hotel_agent", hotel_agent)          # sketch, same shape
graph.add_node("itinerary_agent", itinerary_agent)
graph.add_node("final_agent", final_agent)           # sketch, formats sections
graph.add_edge(START, "flight_agent")
graph.add_edge("flight_agent", "hotel_agent")
graph.add_edge("hotel_agent", "itinerary_agent")
graph.add_edge("itinerary_agent", "final_agent")
graph.add_edge("final_agent", END)

checkpointer = PostgresSaver(conn)   # conn: psycopg connection, autocommit=True
checkpointer.setup()
travel_graph = graph.compile(checkpointer=checkpointer)

def run_travel_agent(user_input: str, thread_id: str | None = None) -> dict:
    import uuid
    thread_id = thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    result = travel_graph.invoke(
        {"messages": [HumanMessage(content=user_input)], "user_query": user_input,
         "flight_result": "", "hotel_result": "", "itinerary_result": "",
         "final_response": "", "llm_calls": 0},
        config,
    )
    return {"thread_id": thread_id, "answer": result["final_response"],
            "llm_calls": result["llm_calls"]}
```

## Failure modes and gotchas

- **Third-party API drift.** Both tools hit versioned REST endpoints from inside the code. When the provider changes the URL or schema, the node silently returns nothing and the final plan just has an empty flights section. The lesson uses exactly this weakness to motivate MCP in the next lesson.
- **Unpinned dependencies.** The lesson insists on pinning every version in `requirements.txt`; agent libraries move fast and an unpinned install months later will break.
- **Internal vs external database URL.** Hosted Postgres gives two URLs. Use the external one from a laptop and the internal one when the app and the database run on the same platform, or the connection fails.
- **Free-tier token limits.** Llama on the free provider tier rejects long inputs; that is why evidence is truncated and why the final prompt is lean.
- **Default origin.** If the user does not state where they are travelling from, the flight function falls back to a `DEFAULT_ORIGIN` env var. Forgetting to set it produces confidently wrong flights.
- **Missing env vars fail late.** The backend raises at import time if the LLM key or database URL is absent; keep that check, it is cheaper than a runtime 500.

## Takeaways

- A linear LangGraph with unconditional edges is a legitimate "multi-agent" design when every step is mandatory. Worth remembering: predictability is a feature.
- Decide per step whether the model chooses the tool or the code does. Mandatory data fetches belong in code.
- A counter in the state (`llm_calls`) is the cheapest observability there is.
- Persistence needs three things: a checkpointer, a `thread_id` in the config, and a one-time `setup()`.
- Separate "generate the plan" from "format the plan" into two nodes so the UI gets a stable structure.

## Test yourself

<details>
<summary>Why are the flight and hotel searches not registered as LLM tools?</summary>
<p>Because those steps are mandatory. Calling the functions directly inside the node avoids an extra LLM round trip, saves tokens, and removes the chance that the model skips the call. Tool-calling is reserved for actions the model should choose.</p>
</details>

<details>
<summary>What does <code>operator.add</code> on the <code>messages</code> field change?</summary>
<p>It turns that field into an append-only list: each node's returned messages are added to the existing ones instead of replacing them. Every other field in the state is overwritten on update.</p>
</details>

<details>
<summary>What three things are required for the Postgres checkpointer to actually persist a run?</summary>
<p>Compile the graph with <code>checkpointer=PostgresSaver(conn)</code>, call <code>checkpointer.setup()</code> once to create tables, and pass a <code>thread_id</code> under <code>configurable</code> in the invoke config.</p>
</details>

**Related:** [LangGraph Workflows](/docs/agentic-ai/langgraph-workflows) · [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Glossary](/docs/glossary)

Next: [What is MCP and why agents need it →](/docs/agentic-course/29-what-is-mcp)
