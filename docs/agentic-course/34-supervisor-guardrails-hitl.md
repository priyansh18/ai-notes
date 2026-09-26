---
id: 34-supervisor-guardrails-hitl
title: "Multi-Agent System with MCP, Supervisor, Guardrails and HITL"
sidebar_position: 34
description: "Final capstone: the travel planner rebuilt with MCP tool servers (remote, local, custom), a supervisor that picks agents, a model-based input guard and a human-approval interrupt."
tags: [Agentic AI, MCP, Guardrails]
---

# Multi-Agent System with MCP, Supervisor, Guardrails and HITL

<div class="tldr">
<strong>TL;DR</strong>

- Part 2 replaces hand-written tool functions with **three MCP servers**: a remote one over streamable HTTP (Tavily), a local community one over stdio (AviationStack), and a **custom one written with FastMCP** (weather).
- Part 3 adds a **supervisor node** that first runs a **model-based input guardrail**, then selects only the agents the request needs, and a **human-in-the-loop interrupt** before the final plan is produced.
- Routing becomes dynamic: the graph walks the supervisor's `selected_agents` list in a canonical order, always ending with the itinerary agent, then pauses for approval.
</div>

This is the course's closing build and it deliberately reuses the TripMate problem so every new idea shows up as a diff against a system you already know. The lesson is long because it does three things in sequence: the plain pipeline, the same pipeline with tools moved behind MCP, and the same pipeline with a control layer on top. The control layer is the part most people ask for and rarely see wired end to end: safety check, agent selection, and a pause for a human, all inside one LangGraph.

## Part 2: three flavours of MCP server in one client

One `MultiServerMCPClient` is configured with three servers, each chosen for a different reason.

| Server | Kind | Transport | Why |
| --- | --- | --- | --- |
| `tavily` | Remote, vendor-hosted | `streamable_http` with a URL and API key | The vendor maintains it; API changes never touch the agent |
| `aviationstack-mcp` | Local, community GitHub project | `stdio`, launched with a `uvx` command | No official remote server exists; the local one exposes flight tools |
| `weather` | Custom, written in the project | `stdio`, launched with a `python` command and the file path as args | No server existed for the chosen weather API |

`client.get_tools()` returns every tool from every server in one list. Helper functions then filter by name: the hotel agent wants only `tavily_search`; the flight agent wants only `list_airports` and `list_airlines` out of a dozen aviation tools; the weather agent wants `get_current_weather` and `get_forecast`. Each agent calls `tool.ainvoke(...)` on the filtered tool.

The custom server is the smallest piece of the lesson and the most reusable: a plain function that calls the weather API, decorated with `@mcp.tool()`, and `mcp.run()` at the bottom. That is a complete MCP server. One supporting detail: a small LLM call extracts the destination city from the free-text query before the weather tools are invoked, because a tool needs a clean argument, not a paragraph.

## Part 3: the supervisor node does two jobs

The first node after `START` is `supervisor_agent`, and it runs two LLM prompts back to back.

**Input guardrail (model-based).** The prompt asks whether the request belongs to travel planning, lists what counts as valid (destinations, flights, hotels, weather, budget, visas, packing), tells the model to block unrelated or harmful requests but not to block a valid request just because details are missing, and demands strict JSON with `allowed` and `reason`. A tiny helper extracts the first `{` to last `}` from the reply and parses it. If `allowed` is false the node writes a polite refusal into `final_response` and returns.

**Agent selection.** If allowed, a second prompt lists the specialised agents with one-line descriptions and asks for JSON containing `selected_agents`, `trip_constraints` (destination, origin, duration, budget, style, preferences) and `reasoning`. The code then normalises the list against a fixed `AGENT_ORDER` and appends `itinerary_agent` if the model forgot it, because every plan needs the itinerary step. On any parsing error the fallback is the full workflow.

```
START ─▶ supervisor_agent
            │  guard: allowed?
            ├─ no ──▶ guardrails_blocked ──▶ END
            └─ yes ─▶ selected_agents = [flight, hotel, budget, itinerary]   (example)
                          │
                          ▼   route_after_agent walks the list in AGENT_ORDER
                    flight_agent ─▶ hotel_agent ─▶ budget_agent ─▶ itinerary_agent
                                                                        ▼
                                                               human_approval (interrupt)
                                                                  │ approve │ feedback
                                                                  ▼         ▼
                                                               final_agent (polish or revise) ─▶ END
```

The demo makes the cost argument visible: "plan a 7-day Japan trip under a budget" selects flight, hotel, budget and itinerary and skips weather; "5-day Dubai trip with flights, hotels, sightseeing" skips both weather and budget. Fewer agents, fewer LLM and tool calls.

## Human-in-the-loop with interrupt and resume

The itinerary agent writes a draft and an `approval_request` string into state. The next node, `human_approval`, calls `interrupt(payload)` with the draft, the selected agents and the supervisor's reasoning. The graph pauses there; because it is compiled with the Postgres checkpointer, the paused state survives across HTTP requests. The UI shows the draft with two actions. When the user responds, a second FastAPI route calls the graph again with `Command(resume={"approved": ..., "feedback": ...})` on the same `thread_id`. The `human_approval` node receives that value, writes `approved` and `human_feedback` into state, and `final_agent` uses them: polish the draft as-is, or apply the feedback and revise before formatting the final sections.

## Code that matters

Reconstructed from what the lesson shows. Prompts are shortened; the control flow is the point.

```python
import json
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command
from mcp.server.fastmcp import FastMCP

# --- custom MCP server (its own file) ---
mcp = FastMCP("weather-mcp-server")

@mcp.tool()
def get_current_weather(city: str) -> dict:
    """Current weather for a city."""
    return fetch_weather(city)            # sketch: HTTP call to the weather API

# --- supervisor node: guard, then select ---
AGENT_ORDER = ["flight_agent", "hotel_agent", "weather_agent",
               "budget_agent", "itinerary_agent"]

def json_from_llm(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1])

def supervisor_agent(state: dict) -> dict:
    guard = json_from_llm(llm_text(GUARD_SYSTEM, GUARD_PROMPT + state["user_query"]))
    if not guard.get("allowed", False):
        return {"guardrail_allowed": False, "guardrail_reason": guard.get("reason", ""),
                "selected_agents": [],
                "final_response": "TripMate AI can only help with travel planning requests."}

    sup = json_from_llm(llm_text(SUP_SYSTEM, SUP_PROMPT + state["user_query"]))
    chosen = [a for a in AGENT_ORDER if a in sup.get("selected_agents", [])]
    if "itinerary_agent" not in chosen:
        chosen.append("itinerary_agent")   # the plan always needs the itinerary step
    return {"guardrail_allowed": True, "selected_agents": chosen,
            "trip_constraints": sup.get("trip_constraints", {}),
            "supervisor_reasoning": sup.get("reasoning", "")}

def route_from_supervisor(state: dict) -> str:
    if not state["guardrail_allowed"]:
        return "guardrails_blocked"
    return state["selected_agents"][0]

def route_after_agent(current: str):
    def _route(state: dict) -> str:
        chain = state["selected_agents"]
        i = chain.index(current)
        return chain[i + 1] if i + 1 < len(chain) else "human_approval"
    return _route

# --- human in the loop ---
def human_approval(state: dict) -> dict:
    answer = interrupt({
        "question": "Do you approve this itinerary?",
        "draft_itinerary": state["itinerary_result"],
        "selected_agents": state["selected_agents"],
        "supervisor_reasoning": state["supervisor_reasoning"],
    })
    return {"approved": bool(answer.get("approved")),
            "human_feedback": answer.get("feedback", "")}

def resume_travel_agent(thread_id: str, approved: bool, feedback: str) -> dict:
    config = {"configurable": {"thread_id": thread_id}}
    return travel_graph.invoke(Command(resume={"approved": approved,
                                               "feedback": feedback}), config)

# --- wiring (sketch; nodes added with add_node as usual) ---
g.add_edge(START, "supervisor_agent")
g.add_conditional_edges("supervisor_agent", route_from_supervisor)
for name in AGENT_ORDER[:-1]:
    g.add_conditional_edges(name, route_after_agent(name))
g.add_edge("itinerary_agent", "human_approval")
g.add_edge("human_approval", "final_agent")
g.add_edge("final_agent", END)
g.add_edge("guardrails_blocked", END)
travel_graph = g.compile(checkpointer=checkpointer)   # persistence is required for interrupt
```

## Failure modes and gotchas

- **`asyncio.run() cannot be called from a running event loop`.** Seen live in the lesson the first time an MCP tool was called from a FastAPI route. Fix: `nest_asyncio.apply()` once at startup, or make the nodes async end to end.
- **Local stdio servers are path-bound.** The custom weather server config holds the Python interpreter path and the absolute file path. Moving the project to a new folder broke it until the path was updated; every machine needs its own values.
- **Model-based guards can be over- or under-strict.** The prompt explicitly says not to block valid requests with missing details. Without that line, "plan a trip to Nepal" (no dates, no budget) gets refused.
- **LLM JSON is a string, not JSON.** Models wrap JSON in prose. Always extract and parse in a try/except, and fall back to a safe default (here: run the full workflow).
- **The supervisor can return agents out of order or omit the one that matters.** Normalise against `AGENT_ORDER` and force-append `itinerary_agent`; never trust the model's ordering for a dependency chain.
- **Interrupt needs a checkpointer and the same thread.** Resume goes through `Command(resume=...)` on the original `thread_id`; a new thread starts a new run instead of continuing the paused one.

## Takeaways

- One MCP client can mix remote, local and custom servers; the transport is a per-server setting, not a global one.
- A custom MCP server is one decorator away from a plain function; the cost is that you now maintain it. Guardrail then supervisor in one node keeps the safety check ahead of every agent and tool call.
- Worth remembering: dynamic routing works by storing the chosen chain in state and walking it, with a canonical order and a mandatory final step enforced in code.
- Human-in-the-loop is `interrupt` plus `Command(resume=...)` plus persistence; without the checkpointer the pause cannot survive a request boundary.

## Test yourself

<details>
<summary>What are the three MCP servers in the build and how does each connect?</summary>
<p>Tavily is a vendor-hosted remote server over <code>streamable_http</code> with a URL and API key. AviationStack is a community local server launched by a <code>uvx</code> command over <code>stdio</code>. The weather server is custom, written with FastMCP, launched with a <code>python</code> command and the file path over <code>stdio</code>.</p>
</details>

<details>
<summary>Why does the supervisor code append <code>itinerary_agent</code> even when the model did not select it?</summary>
<p>Because every travel plan ends with the itinerary step that combines whatever the other agents produced. The model's selection is advisory; the dependency that the plan must be assembled is enforced in code, along with a fixed agent order.</p>
</details>

<details>
<summary>How does the graph continue after the human approves or gives feedback?</summary>
<p>The <code>human_approval</code> node paused on <code>interrupt(...)</code>. A resume route invokes the graph on the same <code>thread_id</code> with <code>Command(resume=...)</code> carrying <code>approved</code> and <code>feedback</code>. The node returns those into state and <code>final_agent</code> either polishes the draft or revises it using the feedback.</p>
</details>

**Related:** [Guardrails](/docs/rag-course/24-guardrails) · [Loop Engineering](/docs/agentic-ai/loop-engineering) · [Glossary](/docs/glossary)
