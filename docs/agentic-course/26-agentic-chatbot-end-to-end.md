---
id: 26-agentic-chatbot-end-to-end
title: "End-to-End Agentic Chatbot: The Full Build"
sidebar_position: 26
description: "The whole LangGraph chatbot in one map: message state, checkpoints and threads, streaming, SQLite persistence, LangSmith, tools, RAG as a tool, human-in-the-loop, then CI/CD."
tags: [Agentic AI, LangGraph, Capstone]
---

# End-to-End Agentic Chatbot: The Full Build

<div class="tldr">
<strong>TL;DR</strong>

- One graph grows from a single chat node into an agent: **chat node plus ToolNode** joined by `tools_condition`, with a **checkpointer** so every conversation thread survives restarts.
- Every feature is either a **state concern** (the `add_messages` reducer, the checkpointer, `thread_id`) or a **tool** (web search, calculator, stock price, weather, a RAG retriever, and a purchase tool that pauses with `interrupt()`).
- The finished code ships unchanged in a Docker image: GitHub Actions to EC2, or Render's free tier.
</div>

This video is the full series stitched together, about eight hours from an empty notebook to a live URL.
Every part starts by breaking the previous version: the bot forgets your name, a refresh wipes the threads,
the model cannot see today's news, an agent buys stock without asking. This page maps those fixes.

## The spine: one node and a reducer

The first graph has a single `chat_node`: take the messages from state, call the model, return the reply.
The state is not a string. It is `Annotated[list[BaseMessage], add_messages]`, and that reducer is the
first design decision. Without it each node return would *replace* the list; with it, user turns and AI
turns are appended, so the node always sees the whole conversation.

Then the catch: wrap the graph in a `while` loop, say "my name is Bappy", ask "what is my name?", and the
bot does not know. Each `invoke` is a fresh run whose state ends at `END`. Memory is a persistence feature.

## Persistence: checkpointer, threads, resume

A **checkpointer** saves a snapshot of the state after every super-step (each edge traversal), keyed by a
`thread_id` passed in `config={"configurable": {"thread_id": ...}}`. Two threads are two separate
histories, like two chats in a sidebar. `InMemorySaver` keeps snapshots in RAM and dies with the process;
the video moves to `SqliteSaver` over a `chatbot.db` file so threads outlive restarts, with
`check_same_thread=False` because one process serves many threads. Four things then come for free:

- `get_state(config)` returns the latest snapshot, `get_state_history(config)` every intermediate one.
- **Fault tolerance**: crash mid-graph, then `invoke(None, config)` resumes from the last checkpoint
  instead of the start (demonstrated with a deliberate keyboard interrupt).
- **Time travel**: pass a `checkpoint_id` to `get_state` to inspect a past step, or `update_state` to
  fork from it with a changed value.
- **The thread sidebar**: `checkpointer.list(None)` yields every checkpoint; the thread ids go into a
  `set`, and each becomes a button that reloads its messages via `get_state`.

## Streaming and the interface

`invoke` waits for the whole answer. `stream(input, config, stream_mode="messages")` yields
`(chunk, metadata)` pairs as tokens arrive; printing `chunk.content` with `end=""` gives the ChatGPT
typing effect in a terminal, and Streamlit's `st.write_stream` does the same in the browser. The UI keeps
its own `session_state` list for rendering and generates a `uuid` per new thread; the graph did not change.

## Tools, RAG and the conditional edge

A tool is any function the model may decide to call. `TavilySearch` is already a tool; a custom one is a
Python function with the `@tool` decorator and a docstring. The video adds a calculator, a stock-price
lookup over an HTTP API, a weather lookup, and later a RAG retriever. Wiring them in takes four lines:

1. `llm_with_tools = llm.bind_tools(tools)`, and the chat node must call **this** object, not `llm`.
2. `ToolNode(tools)` is a pre-built node that executes whichever tool the model asked for.
3. `add_conditional_edges("chat_node", tools_condition)` routes to the tool node on a tool call, else `END`.
4. `add_edge("tools", "chat_node")` returns the raw tool result to the model for rewriting; without it the
   user sees JSON.

RAG is just another tool. Documents are loaded with `PyPDFLoader`, split by `RecursiveCharacterTextSplitter`
(chunk size 1000, overlap 200), embedded, and stored in a FAISS index on disk. A retriever with `k=4` is
wrapped in `@tool` as `rag_tool`; a system prompt says which tool fits which question and forbids inventing.

```
START ──► chat_node  (llm_with_tools + system prompt)
               │
         tools_condition
          │           │
     no tool call   tool call
          │           ▼
         END      ToolNode: tavily_search | calculator | get_stock_price
                            | get_weather | rag_tool | purchase_stock (interrupt)
                      │
                      └────────► chat_node   (rewrite the raw tool output)

checkpointer = SqliteSaver(chatbot.db): one snapshot per super-step, keyed by thread_id
```

## Human-in-the-loop inside a tool

Fetching a stock price is harmless; buying shares is not. The video shows the unguarded agent placing an
order the moment it is asked, then adds `interrupt(...)` **inside the purchase tool**. The graph pauses,
the question surfaces as `result["__interrupt__"]`, and the run resumes only when the caller sends
`Command(resume="yes")` (or "no") with the same `thread_id`. It works because the checkpointer saved the
state at the pause point, so the run continues from the tool, not from `START`. The video's rule: put the
interrupt in the tool that performs the sensitive action, not in the chat node.

## Observability and shipping

Four environment variables (`LANGSMITH_TRACING`, `LANGSMITH_ENDPOINT`, `LANGSMITH_API_KEY`,
`LANGSMITH_PROJECT`) turn on LangSmith tracing with no code change; adding `metadata` and a `run_name` to
the `config` groups runs by thread, so the dashboard shows which tool the model picked, the prompt, latency
and tokens per step. Deployment is the two previous pages: Docker, GitHub Actions to EC2, or Render.

## Code that matters

A compressed sketch of the final graph. Tool bodies, the model object and the UI are omitted.

```python
import sqlite3
from langchain_core.tools import tool
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Command, interrupt


@tool
def purchase_stock(symbol: str, quantity: int) -> str:
    """Buy shares. Pauses for human approval before acting."""
    decision = interrupt(f"Approve buying {quantity} shares of {symbol}? yes/no")
    if str(decision).lower() == "yes":
        return f"Order placed for {quantity} shares of {symbol}."
    return f"Purchase of {quantity} shares of {symbol} was declined by the human."


tools = [purchase_stock]  # plus search, calculator, stock price, weather, rag_tool
llm_with_tools = llm.bind_tools(tools)  # llm is the chat model created earlier (sketch)


def chat_node(state: MessagesState) -> dict:
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


graph = StateGraph(MessagesState)
graph.add_node("chat_node", chat_node)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "chat_node")
graph.add_conditional_edges("chat_node", tools_condition)
graph.add_edge("tools", "chat_node")

conn = sqlite3.connect("chatbot.db", check_same_thread=False)
chatbot = graph.compile(checkpointer=SqliteSaver(conn))

config = {"configurable": {"thread_id": "demo"}}
result = chatbot.invoke({"messages": [("user", "purchase 10 stock of Apple")]}, config)
if result.get("__interrupt__"):
    result = chatbot.invoke(Command(resume="yes"), config)  # resumes inside the tool
```

## Failure modes and gotchas

- **Calling `llm` instead of `llm_with_tools` in the node.** The graph compiles and chats, and never uses a
  tool. The video names this as the most common mistake.
- **No edge from tools back to chat.** The user gets raw tool output with metadata instead of a sentence.
- **A tool defined but not in the list.** The weather tool did nothing until it was added before `bind_tools`.
- **`InMemorySaver` in a web app.** Refresh or restart, and every thread is gone; and SQLite without
  `check_same_thread=False` fails as soon as the UI touches more than one thread.
- **HITL without a checkpointer** cannot resume; `interrupt` depends on the saved snapshot.
- **Provider churn.** OpenAI credits ran out mid-series and `gemini-1.5-flash` was already retired; each
  fix was a one-line model swap, the case for creating the model in one place.

## Takeaways

- Worth remembering: the graph shape barely changes across eight hours. Almost everything is either a
  reducer, a checkpointer, or a tool.
- Memory across turns comes from persistence keyed by `thread_id`, not from the model; tools plus
  `tools_condition` plus the return edge is the entire recipe for "the agent decides".
- `interrupt` belongs inside the action that needs approval, and it is only resumable because state is
  checkpointed; tracing and deployment are configuration, not code.

## Test yourself

<details>
<summary>Why does the bot forget the user's name before persistence is added?</summary>
<p>Each <code>invoke</code> is a fresh run whose state lives only until <code>END</code>. A checkpointer keyed by <code>thread_id</code> saves the state after every step, so the next invoke on the same thread starts with the full history.</p>
</details>

<details>
<summary>What do the three edges around the tool node do?</summary>
<p><code>tools_condition</code> sends the run to the tool node when the model's reply contains a tool call and to <code>END</code> otherwise; the edge from tools back to the chat node feeds the raw result to the model so it can answer in plain language.</p>
</details>

<details>
<summary>How does the purchase tool wait for a human, and why must there be a checkpointer?</summary>
<p><code>interrupt()</code> pauses the graph and exposes the question; the caller resumes with <code>Command(resume=...)</code> on the same thread. The pause point is a saved snapshot, so without a checkpointer there is nothing to resume from.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/uK-OqJobFZw"
    title="Build End-to-End Agentic Chatbot with LangGraph, Database, LangSmith, Tools, RAG, HITL, AWS & Render"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [Build End-to-End Agentic Chatbot with LangGraph, Database, LangSmith, Tools, RAG, HITL, AWS & Render](https://www.youtube.com/watch?v=uK-OqJobFZw).

**Related:** [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Loop Engineering](/docs/agentic-ai/loop-engineering) · [Agentic RAG](/docs/rag-course/16-agentic-rag)

Next: [Build Your Own ChatGPT with FastAPI and LangGraph](./27-build-your-own-chatgpt.md)
