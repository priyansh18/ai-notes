---
id: 15-agents-architecture
title: "Agents Architecture"
sidebar_position: 16
description: The ReAct agent pattern — reason, act, observe in a loop — built with create_react_agent, plus adding memory with a checkpointer, streaming techniques (stream modes, astream, stream_events), and debugging with LangGraph Studio and LangSmith.
tags: [RAG, Agents, LangGraph]
---

# Agents Architecture

<div class="tldr">
<strong>TL;DR</strong>

- **ReAct** = the agent loop: *reason → act (call a tool) → observe → repeat* until it can answer.
- `create_react_agent(llm, tools)` gives you the whole loop; add a **checkpointer** for memory across turns.
- **Streaming** (`stream_mode`, `astream`, `stream_events`) shows progress live; **LangGraph Studio + LangSmith** let you debug and trace every step.
</div>

An agent is an LLM that can *decide to use tools* and loop until it has enough to answer.
This section covers the standard **ReAct** architecture and the production concerns around it.
One submodule per idea, ending with a cheat sheet.

![ReAct loop: reason, act on a tool, observe the result, repeat until a grounded final answer](/img/react-loop.svg)

Reading the diagram: the model **reasons** about which tool it needs, **acts** by calling it,
**observes** the result, and loops — thinking again on each result until no more tools are
needed, then gives a grounded final answer. A checkpointer keeps memory across turns.

## What ReAct is

**ReAct (Reasoning + Acting)** interleaves thinking and tool use:

1. **Act** — the model calls a specific tool.
2. **Observe** — the tool's output is passed back to the model.
3. **Reason** — the model reflects on that output and decides what to do next (call another
   tool, or answer).

This is exactly what makes an agent more than a single LLM call — it can gather what it needs
step by step instead of answering blind.

## Building a ReAct agent

LangGraph ships a prebuilt ReAct agent, so you give it an LLM and a list of tools and it runs
the loop for you.

```python
from langgraph.prebuilt import create_react_agent
from langchain_community.tools import ArxivQueryRun, WikipediaQueryRun
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain.chat_models import init_chat_model

# custom function tools work too — the docstring becomes the tool description
def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b

tools = [ArxivQueryRun(...), WikipediaQueryRun(...), TavilySearchResults(), multiply]
llm = init_chat_model("openai:gpt-4o")

agent = create_react_agent(llm, tools)          # the whole reason/act/observe loop
agent.invoke({"messages": [("user", "Recent AI news, and what is 12*4?")]})
```

You can also drop this agent node into a bigger `StateGraph` when you need surrounding steps:

```python
from langgraph.graph import StateGraph, END

builder = StateGraph(AgentState)
builder.add_node("react_agent", agent)
builder.set_entry_point("react_agent")
builder.add_edge("react_agent", END)
graph = builder.compile()
```

## Adding memory (checkpointer)

By default each call is stateless. A **checkpointer** plus a `thread_id` gives the agent
memory — it remembers earlier turns in the same thread.

```python
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()
graph = builder.compile(checkpointer=memory)

config = {"configurable": {"thread_id": "1"}}
graph.invoke({"messages": "Hi, my name is Krish and I like cricket"}, config)
graph.invoke({"messages": "What do I like?"}, config)   # remembers "cricket"
```

Same `thread_id` = same conversation; a new id starts fresh.

## Streaming techniques

Instead of waiting for the whole run, stream intermediate output. Two dimensions matter — the
**stream mode** (what you get) and **sync vs async**.

```python
config = {"configurable": {"thread_id": "3"}}

# stream_mode="updates" → only what each node changed
for chunk in graph.stream({"messages": "I like football"}, config, stream_mode="updates"):
    print(chunk)

# stream_mode="values" → the full state after each node
for chunk in graph.stream({"messages": "I like football"}, config, stream_mode="values"):
    print(chunk)
```

- **`updates`** streams only the delta each node produced; **`values`** streams the whole
  state after each step.
- **`.astream(...)`** is the async version, and **`.astream_events(...)`** emits fine-grained
  events (token-by-token, tool starts/ends) — useful for building live UIs.

## Debugging: LangGraph Studio + LangSmith

Agents are non-deterministic, so you need to *see* what happened.

- **LangGraph Studio** runs your graph locally from a `langgraph.json` that points at your
  compiled graph, giving a visual view of nodes firing and state changing — you step through
  runs instead of guessing.
- **LangSmith** traces every step (prompts, tool calls, latency, cost). Turn it on with env
  vars — no code changes:

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"]   = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_PROJECT"]   = "ReAct-agent"
```

```json
// langgraph.json — tells LangGraph Studio which graph to load
{
  "dependencies": ["."],
  "graphs": { "openai_agent": "./openai_agent.py:agent" },
  "env": "../.env"
}
```

Together: Studio to watch the graph, LangSmith to trace and compare runs.

## Cheat sheet

| Task | Code |
| --- | --- |
| ReAct agent | `create_react_agent(llm, tools)` |
| Function as a tool | plain `def` with a docstring → passed in `tools` |
| Memory | `builder.compile(checkpointer=MemorySaver())` + `thread_id` |
| Stream deltas | `graph.stream(..., stream_mode="updates")` |
| Stream full state | `graph.stream(..., stream_mode="values")` |
| Async / events | `graph.astream(...)` · `graph.astream_events(...)` |
| Tracing | `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- No checkpointer but expecting memory — without a `thread_id` + checkpointer the agent
  forgets everything between calls.
- Tools without clear docstrings — the model uses the description to decide when to call a
  tool; vague descriptions mean wrong tool choices.
- Confusing `updates` and `values` stream modes — `updates` is the delta, `values` is the
  whole state; pick based on what your UI needs.
- Forgetting to set the tracing env vars — LangSmith shows nothing until `LANGCHAIN_TRACING_V2`
  is on.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What are the three steps of the ReAct loop?</summary>
<p>Act (call a tool), Observe (feed the result back), Reason (decide the next step) — repeated until the model can answer.</p>
</details>

<details>
<summary>How do you give a LangGraph agent memory?</summary>
<p>Compile with a checkpointer (e.g. MemorySaver) and pass a thread_id in the config — same thread = same remembered conversation.</p>
</details>

<details>
<summary>Difference between stream_mode "updates" and "values"?</summary>
<p>"updates" streams only what each node changed; "values" streams the full graph state after each node.</p>
</details>

<details>
<summary>What do LangGraph Studio and LangSmith each give you?</summary>
<p>Studio: a local visual run of your graph (nodes firing, state changing). LangSmith: traces of every step — prompts, tool calls, latency, cost — for debugging and evaluation.</p>
</details>
</div>

**Related:** [LangGraph Basics](/docs/rag-course/14-langgraph-basics) · [Lang* Compared](/docs/rag-course/14b-lang-ecosystem) · [Glossary](/docs/glossary)

Next: [Agentic RAG →](/docs/rag-course/16-agentic-rag)
