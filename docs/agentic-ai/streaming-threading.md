---
id: streaming-threading
title: "Streaming & Chat Threading"
sidebar_position: 6
description: Two production concerns — token-by-token streaming with astream_events and FastAPI integration, plus thread_id-based conversation isolation for multi-user chat applications.
tags: [Agentic AI, LangGraph, Streaming, Threading]
---

# Streaming & Chat Threading

<div class="tldr">
<strong>TL;DR</strong>

- **Streaming** shows progress live — `astream_events` gives token-by-token output, tool call starts/ends, and node transitions.
- **Threading** isolates conversations — each `thread_id` is a separate chat history, enabling multi-user agents without cross-talk.
- Combine both in a **FastAPI endpoint** that streams agent responses per-user via `StreamingResponse`.
</div>

Users hate staring at a spinner for 10 seconds. Streaming fixes that — they see tokens arrive
in real time, watch tool calls happen, and feel like the agent is thinking out loud. Threading
fixes the other production problem: keeping Alice's conversation separate from Bob's, even
when both hit the same server at the same time.
One submodule per idea, ending with a cheat sheet.

## Streaming basics

LangGraph gives you three ways to stream, each with different granularity:

```python
from langgraph.prebuilt import create_react_agent
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.memory import MemorySaver

llm = init_chat_model("openai:gpt-4o")
agent = create_react_agent(llm, tools=[], checkpointer=MemorySaver())
config = {"configurable": {"thread_id": "demo"}}

# 1. stream_mode="updates" — only what each node changed
for chunk in agent.stream(
    {"messages": [("user", "What is 2+2?")]},
    config,
    stream_mode="updates",
):
    for node_name, node_output in chunk.items():
        print(f"[{node_name}] {node_output}")

# 2. stream_mode="values" — full state after each node
for chunk in agent.stream(
    {"messages": [("user", "What is 2+2?")]},
    config,
    stream_mode="values",
):
    print(chunk["messages"][-1])  # latest message in full state

# 3. stream_mode="messages" — message-level streaming (tokens)
for msg, metadata in agent.stream(
    {"messages": [("user", "What is 2+2?")]},
    config,
    stream_mode="messages",
):
    print(msg.content, end="", flush=True)
```

Use `updates` for debugging (what changed?), `values` for state snapshots, and `messages`
for chat UIs that need token-by-token display.

## Token-by-token with astream_events

For the finest granularity — individual tokens, tool call arguments as they're generated,
and lifecycle events — use `astream_events`. This is the async API that production UIs need.

```python
async def stream_agent_tokens(agent, query: str, thread_id: str):
    """Stream every event from the agent — tokens, tool calls, node transitions."""
    config = {"configurable": {"thread_id": thread_id}}

    async for event in agent.astream_events(
        {"messages": [("user", query)]},
        config,
        version="v2",
    ):
        kind = event["event"]

        if kind == "on_chat_model_stream":
            # Token-by-token LLM output
            token = event["data"]["chunk"].content
            if token:
                print(token, end="", flush=True)

        elif kind == "on_tool_start":
            # A tool is about to be called
            tool_name = event["name"]
            tool_input = event["data"].get("input", {})
            print(f"\n🔧 Calling {tool_name}({tool_input})...")

        elif kind == "on_tool_end":
            # Tool finished — show the result
            tool_output = event["data"]["output"]
            print(f"\n✅ Result: {tool_output}")

    print()  # final newline

# Usage
import asyncio
asyncio.run(stream_agent_tokens(agent, "Search for recent AI news", "user-1"))
```

The `version="v2"` parameter is required — it gives you the stable event format. Key event
types you'll use:

- `on_chat_model_stream` — individual tokens from the LLM
- `on_tool_start` / `on_tool_end` — tool lifecycle
- `on_chain_start` / `on_chain_end` — node transitions

## Streaming tool progress

When a tool takes a while (web search, database query), you want to show progress. Emit
intermediate updates from inside the tool:

```python
from langchain.tools import tool
from langchain.callbacks import dispatch_custom_event

@tool
async def deep_research(query: str) -> str:
    """Research a topic across multiple sources."""
    sources = ["arxiv", "wikipedia", "web"]
    results = []

    for source in sources:
        # Emit progress so the UI can show "Searching arxiv..."
        dispatch_custom_event("tool_progress", {"source": source, "status": "searching"})
        result = await search_source(source, query)
        results.append(result)
        dispatch_custom_event("tool_progress", {"source": source, "status": "done"})

    return "\n".join(results)

# Catch these events in astream_events
async for event in agent.astream_events(input, config, version="v2"):
    if event["event"] == "on_custom_event" and event["name"] == "tool_progress":
        data = event["data"]
        print(f"  Searching {data['source']}... {data['status']}")
```

## FastAPI StreamingResponse integration

The real payoff — a FastAPI endpoint that streams agent responses to a frontend:

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langchain.chat_models import init_chat_model
import json
import os

app = FastAPI()

llm = init_chat_model("openai:gpt-4o")

async def get_agent():
    """Create an agent with persistent checkpointer."""
    checkpointer = AsyncPostgresSaver.from_conn_string(os.environ["DATABASE_URL"])
    await checkpointer.setup()
    return create_react_agent(llm, tools=[], checkpointer=checkpointer)

async def generate_stream(agent, query: str, thread_id: str):
    """Async generator that yields SSE-formatted events."""
    config = {"configurable": {"thread_id": thread_id}}

    async for event in agent.astream_events(
        {"messages": [("user", query)]},
        config,
        version="v2",
    ):
        kind = event["event"]

        if kind == "on_chat_model_stream":
            token = event["data"]["chunk"].content
            if token:
                # Server-Sent Events format
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        elif kind == "on_tool_start":
            yield f"data: {json.dumps({'type': 'tool_start', 'name': event['name']})}\n\n"

        elif kind == "on_tool_end":
            yield f"data: {json.dumps({'type': 'tool_end', 'name': event['name']})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"

@app.post("/chat/{thread_id}")
async def chat(thread_id: str, query: str):
    """Stream agent response for a specific conversation thread."""
    agent = await get_agent()
    return StreamingResponse(
        generate_stream(agent, query, thread_id),
        media_type="text/event-stream",
    )
```

The frontend opens an `EventSource` connection and renders tokens as they arrive. Each
`thread_id` in the URL maps to an isolated conversation.

## Thread-based conversation isolation

Threading is how you run a multi-user agent on a single server. Each `thread_id` is a
completely separate conversation — different message history, different state.

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def handle_user_message(agent, user_id: str, session_id: str, message: str):
    """Handle a message from a specific user in a specific session."""
    # Thread ID = user + session → unique conversation
    thread_id = f"{user_id}:{session_id}"
    config = {"configurable": {"thread_id": thread_id}}

    result = await agent.ainvoke(
        {"messages": [("user", message)]},
        config,
    )
    return result["messages"][-1].content

# Alice and Bob chat at the same time — completely isolated
import asyncio

async def main():
    agent = await get_agent()

    # These run concurrently, no cross-talk
    alice_response, bob_response = await asyncio.gather(
        handle_user_message(agent, "alice", "s1", "My favorite color is blue"),
        handle_user_message(agent, "bob", "s1", "My favorite color is red"),
    )

    # Later — each user's history is preserved
    alice_followup = await handle_user_message(agent, "alice", "s1", "What's my color?")
    print(alice_followup)  # "blue" — Alice's thread only

    bob_followup = await handle_user_message(agent, "bob", "s1", "What's my color?")
    print(bob_followup)  # "red" — Bob's thread only

asyncio.run(main())
```

## Multi-user patterns

In production, you typically need to manage threads — list them, resume them, or start
new ones:

```python
import uuid
from datetime import datetime

class ThreadManager:
    """Manage conversation threads for a multi-user agent."""

    def __init__(self, checkpointer):
        self.checkpointer = checkpointer
        self.thread_registry: dict[str, dict] = {}  # in production, use a database

    def create_thread(self, user_id: str, title: str = "New chat") -> str:
        """Start a new conversation thread."""
        thread_id = f"{user_id}-{uuid.uuid4().hex[:8]}"
        self.thread_registry[thread_id] = {
            "user_id": user_id,
            "title": title,
            "created_at": datetime.now().isoformat(),
        }
        return thread_id

    def list_threads(self, user_id: str) -> list[dict]:
        """List all threads for a user."""
        return [
            {"thread_id": tid, **info}
            for tid, info in self.thread_registry.items()
            if info["user_id"] == user_id
        ]

    def get_config(self, thread_id: str) -> dict:
        """Get the LangGraph config for a thread."""
        return {"configurable": {"thread_id": thread_id}}

# Usage
manager = ThreadManager(checkpointer)

# User opens the app — list their conversations
threads = manager.list_threads("alice")

# User clicks "New Chat"
thread_id = manager.create_thread("alice", title="Travel planning")
config = manager.get_config(thread_id)

# User sends a message
result = await agent.ainvoke({"messages": [("user", "Plan a trip to Japan")]}, config)
```

## Cheat sheet

| Task | Code |
| --- | --- |
| Stream node updates | `agent.stream(input, config, stream_mode="updates")` |
| Stream full state | `agent.stream(input, config, stream_mode="values")` |
| Stream tokens | `agent.stream(input, config, stream_mode="messages")` |
| Fine-grained events | `async for e in agent.astream_events(input, config, version="v2"):` |
| Token event | `event["event"] == "on_chat_model_stream"` |
| Tool lifecycle | `"on_tool_start"` / `"on_tool_end"` |
| Custom progress | `dispatch_custom_event("name", data)` |
| SSE response | `StreamingResponse(generator, media_type="text/event-stream")` |
| Thread isolation | `{"configurable": {"thread_id": "unique-per-conversation"}}` |
| Multi-user pattern | `thread_id = f"&#123;user_id&#125;-&#123;session_id&#125;"` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **Forgetting `version="v2"` in `astream_events`** — the default version emits a different event format. Always pass `version="v2"` for the stable API.
- **Blocking inside an async stream generator** — a sync database call or `time.sleep()` inside `generate_stream` freezes the SSE connection for all concurrent users.
- **Same thread_id for different users** — if Alice and Bob both get `thread_id="main"`, they share a conversation. Always include the user ID in the thread ID.
- **Not handling `StreamingResponse` errors** — if the agent raises mid-stream, the SSE connection drops silently. Wrap the generator in a try/except and yield an error event.
- **Confusing `stream_mode` options** — `updates` gives deltas, `values` gives full state, `messages` gives tokens. Pick based on what your UI renders.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What's the difference between <code>stream_mode="updates"</code> and <code>astream_events</code>?</summary>
<p><code>stream_mode="updates"</code> streams what each node changed (coarse). <code>astream_events</code> streams fine-grained events — individual tokens, tool starts/ends, and custom events.</p>
</details>

<details>
<summary>How do you isolate conversations between users?</summary>
<p>Give each conversation a unique <code>thread_id</code> that includes the user ID — e.g., <code>f"&#123;user_id&#125;-&#123;session_id&#125;"</code>. Different thread IDs = completely separate state.</p>
</details>

<details>
<summary>How do you stream an agent's response in FastAPI?</summary>
<p>Create an async generator that yields SSE-formatted events from <code>astream_events</code>, and return it wrapped in <code>StreamingResponse(generator, media_type="text/event-stream")</code>.</p>
</details>

<details>
<summary>What event type gives you individual tokens?</summary>
<p><code>on_chat_model_stream</code> — the token is in <code>event["data"]["chunk"].content</code>.</p>
</details>
</div>

**Related:** [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Async Programming](/docs/agentic-ai/async-programming) · [Glossary](/docs/glossary)

Next: [Harness Engineering →](/docs/agentic-ai/harness-engineering)
