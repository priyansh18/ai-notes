---
id: agent-persistence
title: "Agent Persistence"
sidebar_position: 5
description: DB-backed memory for LangGraph agents — conversations survive restarts with SqliteSaver and PostgresSaver, replacing the dev-only MemorySaver with production-grade checkpointers.
tags: [Agentic AI, LangGraph, Persistence, Database]
---

# Agent Persistence

<div class="tldr">
<strong>TL;DR</strong>

- **MemorySaver** is dev-only — it stores checkpoints in memory, so everything vanishes on restart.
- **SqliteSaver** and **PostgresSaver** persist checkpoints to a database — conversations survive crashes, deploys, and scaling.
- Every checkpoint is keyed by `thread_id` + step number, so you get full conversation history, time-travel debugging, and multi-user isolation for free.
</div>

The first thing that breaks when you move an agent to production is memory. `MemorySaver`
works great in a notebook — until you restart the process and your agent forgets every
conversation it ever had. DB-backed checkpointers fix this permanently.
One submodule per idea, ending with a cheat sheet.

## Why MemorySaver isn't enough

`MemorySaver` stores checkpoints in a Python dictionary. That means:

- **Restart the process** → all conversations gone.
- **Scale to multiple workers** → each worker has its own memory, users get routed to different workers and lose context.
- **Deploy a new version** → every user starts from scratch.

```python
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()  # fine for prototyping
graph = builder.compile(checkpointer=memory)

# Works in this process...
config = {"configurable": {"thread_id": "user-123"}}
graph.invoke({"messages": [("user", "My name is Alice")]}, config)
graph.invoke({"messages": [("user", "What's my name?")]}, config)  # "Alice" ✓

# Restart the process → MemorySaver is empty → agent forgets everything
```

For anything beyond local development, you need a persistent checkpointer.

## SqliteSaver — the simplest persistent option

`SqliteSaver` writes checkpoints to a SQLite file. Zero configuration, no server to run,
and your conversations survive restarts.

```python
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class ChatState(TypedDict):
    messages: Annotated[list, add]

def echo_node(state: ChatState) -> dict:
    last_msg = state["messages"][-1]
    return {"messages": [f"Echo: {last_msg}"]}

builder = StateGraph(ChatState)
builder.add_node("echo", echo_node)
builder.add_edge(START, "echo")
builder.add_edge("echo", END)

# --- Switch from MemorySaver to SqliteSaver ---
# Use as a context manager so the DB connection closes cleanly
with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "user-123"}}
    graph.invoke({"messages": [("user", "Hello")]}, config)
    graph.invoke({"messages": [("user", "Remember this")]}, config)

# Restart the process, reconnect to the same file
with SqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "user-123"}}
    # The conversation history is still there
    result = graph.invoke({"messages": [("user", "What did I say?")]}, config)
    print(result["messages"])  # includes all previous messages
```

SQLite is single-writer, so it works for single-process deployments. For multi-worker
production, use PostgresSaver.

## PostgresSaver — production-grade persistence

PostgresSaver connects to a Postgres database — the same kind you're probably already running
in production. It handles concurrent reads/writes from multiple workers.

```python
from langgraph.checkpoint.postgres import PostgresSaver

# Connection string — use environment variables in production
DB_URI = "postgresql://user:password@localhost:5432/agent_db"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    # Create the checkpoint tables if they don't exist
    checkpointer.setup()

    graph = builder.compile(checkpointer=checkpointer)

    # User 1 — thread "alice-001"
    config_alice = {"configurable": {"thread_id": "alice-001"}}
    graph.invoke({"messages": [("user", "I'm Alice, I like hiking")]}, config_alice)

    # User 2 — thread "bob-001" — completely isolated
    config_bob = {"configurable": {"thread_id": "bob-001"}}
    graph.invoke({"messages": [("user", "I'm Bob, I like chess")]}, config_bob)

    # Each thread has its own conversation history
    graph.invoke({"messages": [("user", "What do I like?")]}, config_alice)
    # → "hiking" (Alice's thread)

    graph.invoke({"messages": [("user", "What do I like?")]}, config_bob)
    # → "chess" (Bob's thread)
```

The `setup()` call creates the necessary tables (`checkpoints`, `checkpoint_writes`, etc.)
the first time you run it. After that, it's a no-op.

## Async checkpointers

For async agents (FastAPI, async LangGraph), use the async variants. They don't block the
event loop during database I/O.

```python
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

# --- Async SQLite ---
async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "user-123"}}
    result = await graph.ainvoke({"messages": [("user", "Hello")]}, config)

# --- Async Postgres ---
DB_URI = "postgresql://user:password@localhost:5432/agent_db"

async with AsyncPostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "user-456"}}
    result = await graph.ainvoke({"messages": [("user", "Hello")]}, config)
```

Rule of thumb: if your graph uses `ainvoke` / `astream`, use the async checkpointer.
Mixing sync checkpointers with async agents blocks the event loop on every checkpoint write.

## Thread management

Every conversation is isolated by `thread_id`. You control the threading — typically one
thread per user session or per conversation.

```python
import uuid

def create_new_conversation(user_id: str) -> dict:
    """Start a new conversation thread for a user."""
    thread_id = f"{user_id}-{uuid.uuid4().hex[:8]}"
    return {"configurable": {"thread_id": thread_id}}

# User starts a new chat
config = create_new_conversation("alice")
# config = {"configurable": {"thread_id": "alice-a1b2c3d4"}}

graph.invoke({"messages": [("user", "Start a new project plan")]}, config)
graph.invoke({"messages": [("user", "Add a deadline for next Friday")]}, config)

# Same user, different conversation
config2 = create_new_conversation("alice")
graph.invoke({"messages": [("user", "What's the weather today?")]}, config2)
# This thread knows nothing about the project plan
```

## Checkpoint metadata and history

Each checkpoint stores metadata — the step number, timestamp, and which node produced it.
You can inspect the full history of a thread.

```python
# Get the latest checkpoint for a thread
config = {"configurable": {"thread_id": "alice-001"}}
checkpoint = checkpointer.get(config)

print(checkpoint["ts"])         # timestamp
print(checkpoint["channel_values"])  # the full state at this point

# Get all checkpoints for a thread (time-travel debugging)
history = list(checkpointer.list(config))
for cp in history:
    print(f"Step {cp['metadata']['step']}: {cp['ts']}")
```

This is incredibly useful for debugging — you can see exactly what the state looked like
at every step of the conversation, and even replay from a specific checkpoint.

## Putting it all together — a persistent chatbot

Here's a complete example: a chatbot with Postgres-backed memory that survives restarts
and handles multiple users.

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.prebuilt import create_react_agent
from langchain.chat_models import init_chat_model
from langchain.tools import tool
import os

@tool
def get_user_preferences(user_id: str) -> str:
    """Look up stored preferences for a user."""
    # In production, query a database
    prefs = {"alice": "likes hiking, prefers bullet points", "bob": "likes chess, prefers detailed explanations"}
    return prefs.get(user_id, "No preferences found")

llm = init_chat_model("openai:gpt-4o")
tools = [get_user_preferences]

DB_URI = os.environ["DATABASE_URL"]

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()

    agent = create_react_agent(llm, tools, checkpointer=checkpointer)

    # Alice's conversation — persists across restarts
    alice_config = {"configurable": {"thread_id": "alice-main"}}
    agent.invoke(
        {"messages": [("user", "Hi, I'm Alice. Look up my preferences.")]},
        alice_config,
    )
    agent.invoke(
        {"messages": [("user", "Based on my prefs, suggest a weekend activity.")]},
        alice_config,
    )
    # Agent remembers Alice said hi, knows her preferences from the tool call,
    # and uses that context to suggest hiking
```

## Cheat sheet

| Task | Code |
| --- | --- |
| Dev-only memory | `MemorySaver()` |
| SQLite persistence | `SqliteSaver.from_conn_string("file.db")` |
| Postgres persistence | `PostgresSaver.from_conn_string(DB_URI)` |
| Async SQLite | `AsyncSqliteSaver.from_conn_string("file.db")` |
| Async Postgres | `AsyncPostgresSaver.from_conn_string(DB_URI)` |
| Create tables | `checkpointer.setup()` |
| Thread isolation | `{"configurable": {"thread_id": "unique-id"}}` |
| Get checkpoint | `checkpointer.get(config)` |
| List history | `checkpointer.list(config)` |
| Use with agent | `create_react_agent(llm, tools, checkpointer=cp)` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **Using MemorySaver in production** — it's in-memory only. One restart and all user conversations are gone. Use SqliteSaver or PostgresSaver.
- **Forgetting `checkpointer.setup()`** — PostgresSaver needs its tables created. Call `setup()` once before first use or you'll get a "table not found" error.
- **Mixing sync checkpointer with async agent** — a sync `PostgresSaver` blocks the event loop during every checkpoint write. Use `AsyncPostgresSaver` with `ainvoke`/`astream`.
- **Not using context managers** — `SqliteSaver` and `PostgresSaver` manage database connections. Without `with`, connections may leak. Always use `with ... as checkpointer:`.
- **Reusing thread_id across users** — two users with the same thread_id share a conversation. Generate unique IDs per user-session pair.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why is MemorySaver insufficient for production?</summary>
<p>It stores checkpoints in a Python dict — they vanish on restart, can't be shared across workers, and are lost on every deploy.</p>
</details>

<details>
<summary>When should you use SqliteSaver vs PostgresSaver?</summary>
<p>SqliteSaver for single-process deployments (simple servers, scripts). PostgresSaver for multi-worker production (handles concurrent reads/writes from multiple processes).</p>
</details>

<details>
<summary>What does <code>checkpointer.setup()</code> do?</summary>
<p>Creates the checkpoint tables in the database if they don't already exist. It's idempotent — safe to call every time you start the app.</p>
</details>

<details>
<summary>How do you isolate conversations between users?</summary>
<p>Give each conversation a unique <code>thread_id</code> in the config. Different thread_ids = completely separate conversation histories.</p>
</details>
</div>

**Related:** [Agents Architecture](/docs/rag-course/15-agents-architecture) · [LangGraph Subgraphs](/docs/agentic-ai/langgraph-subgraphs) · [Glossary](/docs/glossary)

Next: [Streaming & Chat Threading →](/docs/agentic-ai/streaming-threading)
