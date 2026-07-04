---
id: 14-langgraph-basics
title: "LangGraph Basics"
sidebar_position: 14
description: Building workflows as graphs — the State schema, nodes as functions, edges and conditional (router) edges, compiling and invoking a StateGraph, the add_messages reducer, and a tool-calling chatbot with ToolNode + tools_condition.
tags: [RAG, LangGraph, Agents]
---

# LangGraph Basics

<div class="tldr">
<strong>TL;DR</strong>

- LangGraph models a workflow as a **graph**: a shared **State**, **nodes** (functions), and **edges** (flow).
- **Conditional edges** branch — that's how you build routers and agent loops.
- A tool-calling chatbot is just `LLM node ⇄ ToolNode`, with **`tools_condition`** deciding when to stop.
</div>

Chains run in a straight line; **LangGraph** lets flow branch, loop, and hold state — which is
what agents need. This page builds it up from a toy graph to a tool-using chatbot, one
submodule per idea, ending with a cheat sheet.

![LangGraph: a simple conditional graph on top, a tool-calling chatbot graph below, both over a shared State](/img/langgraph-basics.svg)

Reading the diagram: **top** — a simple graph where a conditional edge randomly routes to
`cricket` or `badminton`. **Bottom** — a chatbot where `tools_condition` routes to a `ToolNode`
when the LLM asks for a tool, then loops the result back. Both share one **State** object.

## State — the shared data

State is a `TypedDict` that every node reads and updates. It's the graph's memory.

```python
from typing_extensions import TypedDict

class State(TypedDict):
    graph_info: str
```

Each node receives the state and returns a partial update; by default the returned value
**overrides** that key.

## Nodes — just Python functions

A node takes the state and returns a dict updating one or more keys.

```python
def start_play(state: State):
    return {"graph_info": state["graph_info"] + " I am planning to play"}

def cricket(state: State):
    return {"graph_info": state["graph_info"] + " Cricket"}

def badminton(state: State):
    return {"graph_info": state["graph_info"] + " Badminton"}
```

## Edges & conditional edges (routing)

Normal edges connect nodes in order. A **conditional edge** calls a function that returns the
*name* of the next node — this is branching / routing.

```python
import random
from typing import Literal

def random_play(state: State) -> Literal["cricket", "badminton"]:
    return "cricket" if random.random() > 0.5 else "badminton"
```

The router function decides the path at runtime based on the state.

## Build, compile, invoke

Wire nodes and edges onto a `StateGraph`, mark `START` and `END`, then `compile()`.

```python
from langgraph.graph import StateGraph, START, END

graph = StateGraph(State)
graph.add_node("start_play", start_play)
graph.add_node("cricket", cricket)
graph.add_node("badminton", badminton)

graph.add_edge(START, "start_play")
graph.add_conditional_edges("start_play", random_play)   # branch here
graph.add_edge("cricket", END)
graph.add_edge("badminton", END)

app = graph.compile()
app.invoke({"graph_info": "Hey My name is Krish"})
```

`START` feeds input in, `END` terminates, and `compile()` validates the structure. You can
render it as a Mermaid diagram with `app.get_graph().draw_mermaid_png()`.

## The `add_messages` reducer

For chat, state holds a *growing* list of messages — you want new messages **appended**, not
overwritten. The `add_messages` reducer does exactly that.

```python
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]   # append, don't replace
```

The `Annotated[..., add_messages]` part is the key difference from the toy graph — it tells
LangGraph to *merge* updates into the list.

## A tool-calling chatbot

Put it together: an LLM bound to tools (arxiv, wikipedia, Tavily), a `ToolNode` to run them,
and `tools_condition` to route — call tools when the LLM requests them, otherwise finish.

```python
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_community.tools import ArxivQueryRun, WikipediaQueryRun
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_groq import ChatGroq

tools = [ArxivQueryRun(...), WikipediaQueryRun(...), TavilySearchResults()]
llm_with_tools = ChatGroq(model="qwen-qwq-32b").bind_tools(tools)

def tool_calling_llm(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}

builder = StateGraph(State)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges("tool_calling_llm", tools_condition)  # tool call? → tools : END
builder.add_edge("tools", "tool_calling_llm")   # loop the tool result back to the LLM
graph = builder.compile()

graph.invoke({"messages": HumanMessage(content="Recent AI news for March 3rd 2025")})
```

`tools_condition` is the prebuilt router: if the last AI message contains a tool call it goes
to the `ToolNode`, otherwise to `END`. The edge from `tools` back to the LLM is what makes it
a loop — the model sees each tool result and decides what to do next.

## Cheat sheet

| Concept | Code |
| --- | --- |
| State | `class State(TypedDict): ...` |
| Message state | `messages: Annotated[list[AnyMessage], add_messages]` |
| Add node | `graph.add_node("name", fn)` |
| Straight edge | `graph.add_edge("a", "b")` |
| Branch / router | `graph.add_conditional_edges("node", router_fn)` |
| Tool loop | `ToolNode(tools)` + `tools_condition` + edge back to the LLM |
| Run | `graph.compile().invoke({...})` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Forgetting `add_messages` on the messages key — new messages overwrite the list instead of
  appending, and the conversation resets every step.
- No edge from `tools` back to the LLM — the tool result never reaches the model, so it can't
  answer.
- A conditional-edge function that returns something other than a valid node name — the graph
  won't know where to go.
- Forgetting to `compile()` before `invoke` — you run the compiled app, not the builder.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What are the three building blocks of a LangGraph?</summary>
<p>State (shared TypedDict), nodes (functions that update state), and edges (flow between nodes, including conditional edges for branching).</p>
</details>

<details>
<summary>Why use add_messages on the messages key?</summary>
<p>It's a reducer that appends new messages to the list instead of overwriting it — so conversation history accumulates across steps.</p>
</details>

<details>
<summary>What does tools_condition do?</summary>
<p>It's a prebuilt router: if the latest AI message has a tool call it routes to the ToolNode, otherwise to END.</p>
</details>

<details>
<summary>What makes the chatbot a loop rather than a straight line?</summary>
<p>The edge from the tools node back to the LLM node — the model sees each tool result and can decide to call another tool or finish.</p>
</details>
</div>

**Related:** [Updated LangChain (v1)](/docs/rag-course/13-langchain-v1) · [Hybrid Search](/docs/rag-course/09-hybrid-search) · [Glossary](/docs/glossary)

Next: [LangChain vs LangGraph vs LangSmith vs Langflow →](/docs/rag-course/14b-lang-ecosystem)
