---
id: 27-build-your-own-chatgpt
title: "Build Your Own ChatGPT with FastAPI and LangGraph"
sidebar_position: 27
description: "A ChatGPT-style app from scratch: HTML/JS front end, FastAPI routes streaming over SSE, a LangGraph agent with search, calculator, document and memory tools, then CI/CD to AWS ECR."
tags: [Agentic AI, FastAPI, LangGraph]
---

# Build Your Own ChatGPT with FastAPI and LangGraph

<div class="tldr">
<strong>TL;DR</strong>

- Four layers: a browser UI, a **FastAPI** back end, a **LangGraph** agent, and a set of tools. Each layer only talks to the one below it.
- The back end keeps three stores: `SqliteSaver` checkpoints for graph state per thread, SQLAlchemy tables for conversations, messages and long-term memory, and a Chroma index for uploaded PDFs. The agent reaches memory and documents **only through tools**.
- Streaming is an async generator behind FastAPI's `StreamingResponse`: it forwards the model's text chunks as server-sent events and drops the tool chatter.
</div>

The video calls it "BappyGPT": a recreation of the ChatGPT interface with threads in a sidebar, a model
selector, document upload, a voice button and quick prompts, built on the same LangGraph concepts as the
earlier series but with a real HTTP back end instead of Streamlit. What is new is the plumbing between a
browser and an agent: routes, streaming, and where each kind of state lives.

## Architecture: four layers, three stores

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Front end | One `index.html` with CSS and JavaScript (generated with ChatGPT's help) | Sidebar of threads, chat box, upload button, model dropdown, voice via the browser `SpeechRecognition` API |
| Back end | FastAPI with Uvicorn and Jinja templates | Routes, saving every message, streaming the reply |
| Agent | LangGraph `MessagesState`, chat node, `ToolNode`, `tools_condition` | Decide whether to answer directly or call a tool |
| Tools | Tavily search, calculator, remember and recall, document search | The only way the agent touches the outside world |

The stores are split by purpose. `data/langgraph_checkpoints.sqlite` holds the graph state the agent needs
to continue a thread. `data/chatbot_memory.db` (SQLAlchemy) holds what the UI needs: a `conversations`
table with a title made from the first 40 characters of the first message, a `chat_messages` table, and a
`long_term_memory` table. `chroma_db/` holds embeddings of uploaded files. Gemini serves both chat and
embeddings because the video wants every service on a free tier.

## The agent: allowlist, cache, graph

`agent.py` starts with a dictionary of allowed model ids and a default read from the environment.
`normalize_model_name` strips the incoming string and falls back to the default when it is not in the
allowlist, because the front end can send anything. `build_agent(model_name)` creates the model with
`streaming=True`, binds the tools, defines the chat node with a system prompt that lists what each tool is
for, adds `ToolNode`, wires `tools_condition` and the tools-to-chat edge, and compiles with `SqliteSaver`.
Building that per request is wasteful, so `get_agent(model_name)` keeps a module-level dictionary: build
once per model id, reuse on every later call.

## Tools: search, calculator, memory, documents

- `TavilySearch(max_results=5, search_depth="advanced")` is already a tool; no decorator needed.
- `calculator(expression)` is a custom `@tool` that evaluates a math expression and returns the result.
- `remember_this(text)` and `recall_memory(query)` wrap `save_memory` and `search_memory` from
  `database.py`. When a user says "my favourite colour is red", the model calls the first; when asked
  "what is my favourite colour?", the second. Both use the `long_term_memory` table for the current thread.
- `search_uploaded_documents(query)` wraps `retrieve_from_rag`: a similarity search with `k=4` over the
  Chroma collection, filtered to the current thread.

Tools need to know which thread is active, so the back end calls `set_current_thread_id` before each turn
and the tools read it. Loading, chunking (`RecursiveCharacterTextSplitter`) and embedding happen in
`rag.py`, which raises on unsupported file types instead of failing later.

## FastAPI routes and SSE streaming

```
browser: index.html  (fetch, EventSource, SpeechRecognition)
   │   GET /            GET /conversations      GET /history/{thread_id}
   │   POST /upload     POST /chat/stream
   ▼
FastAPI app.py ── Jinja templates/ ── uploads/ ── data/
   │                        │
   │ get_agent(model)       │ SQLAlchemy: conversations, chat_messages, long_term_memory
   ▼
LangGraph agent   chat_node ──► tools_condition ──► ToolNode ──► chat_node
   │ SqliteSaver checkpoints keyed by thread_id
   ▼
tools: web_search | calculator | remember_this | recall_memory | search_uploaded_documents
```

Every route is `async def`, so slow model calls do not block other users. `GET /` renders the template.
`GET /conversations` returns the thread list for the sidebar; `GET /history/{thread_id}` returns that
thread's messages. `POST /upload` saves the file under `uploads/`, records it in the conversation, and
calls `add_documents_to_rag`. `POST /chat/stream` is the core: it saves the user message, fetches the cached
agent for the selected model, sets the thread, and returns a `StreamingResponse` over an async generator.

The generator iterates `agent.stream(..., stream_mode="messages")`. Only `AIMessageChunk` objects with
text content are forwarded, wrapped as `data: ...` lines, so tool inputs and raw tool outputs never reach
the page. Voice input is pure JavaScript (`SpeechRecognition`); the back end only ever sees text.

## Shipping it: ECR instead of Docker Hub

The deployment follows the AWS lesson with two differences. The IAM user gets both
`AmazonEC2FullAccess` and `AmazonEC2ContainerRegistryFullAccess`, and the image is pushed to an **ECR**
repository (AWS's own registry) instead of Docker Hub. The CI job configures AWS credentials from secrets,
logs in to ECR, builds and pushes; the CD job on the self-hosted EC2 runner pulls and runs the container
with every environment variable passed through `-e`. The Dockerfile exposes 8080 and starts
`uvicorn app:app --host 0.0.0.0 --port 8080`, so the security group rule is for 8080.

## Code that matters

Two sketches carry the page: the cached agent factory and the streaming route.

```python
import os

AGENT_CACHE: dict = {}
ALLOWED_MODELS = {"gemini-2.5-flash", "gemini-2.5-pro"}
DEFAULT_MODEL = os.environ.get("GOOGLE_MODEL", "gemini-2.5-flash")


def get_agent(model_name: str | None):
    """Never trust the front end; build once per model id, reuse afterwards (sketch)."""
    selected = (model_name or "").strip()
    if selected not in ALLOWED_MODELS:
        selected = DEFAULT_MODEL
    if selected not in AGENT_CACHE:
        AGENT_CACHE[selected] = build_agent(selected)  # compiles the LangGraph graph
    return AGENT_CACHE[selected]
```

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk, HumanMessage

app = FastAPI()


@app.post("/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    thread_id = body["thread_id"]
    agent = get_agent(body.get("model"))
    save_chat_message(thread_id, "user", body["message"])  # SQLAlchemy history (sketch)
    set_current_thread_id(thread_id)
    config = {"configurable": {"thread_id": thread_id}}

    async def event_generator():
        inputs = {"messages": [HumanMessage(content=body["message"])]}
        for chunk, _meta in agent.stream(inputs, config, stream_mode="messages"):
            if isinstance(chunk, AIMessageChunk) and chunk.content:
                yield f"data: {chunk.content}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

## Failure modes and gotchas

- **Unknown model id from the dropdown** crashes model creation; normalising to the allowlist keeps the
  back end robust against whatever the client sends.
- **Rebuilding the agent per request** makes every message pay the compile cost. Cache by model id.
- **Tool chatter leaking into the stream.** Without the `AIMessageChunk` filter the page shows tool call
  JSON and raw search results between sentences.
- **SQLite and many threads.** The checkpoint connection needs `check_same_thread=False`.
- **Committed data files.** The `data/` databases were pushed with the code, so the live server started
  with the developer's old threads. Generated state belongs in `.gitignore` and `.dockerignore`.
- **No accounts.** The video skips login on purpose; anyone with the URL sees every thread. Fine for
  learning, not for a public deployment. Free-tier quotas on Gemini and Tavily also end a demo quickly.

## Takeaways

- Worth remembering: the browser never talks to the agent. It talks to routes, and routes talk to a cached,
  compiled graph.
- Three stores, three jobs: checkpoints let the agent continue a thread, SQLAlchemy lets the UI list and
  replay it, the vector index lets a tool search uploads.
- Memory and documents are tools with docstrings; the system prompt is what makes the model pick the right
  one.
- Streaming to a browser is an async generator plus a filter on chunk type; swapping Docker Hub for ECR
  changes two IAM policies and two login steps, nothing in the app.

## Test yourself

<details>
<summary>Why cache the agent by model name instead of building it in the route?</summary>
<p>Building the agent compiles a LangGraph graph, opens the checkpoint database and binds tools. Doing that on every message is slow; a dictionary keyed by the normalised model id builds each once and reuses it.</p>
</details>

<details>
<summary>What is filtered out of the streamed response, and how?</summary>
<p>The generator only yields chunks that are <code>AIMessageChunk</code> instances with text content, so tool call arguments and raw tool results are dropped and the page receives just the model's words as server-sent events.</p>
</details>

<details>
<summary>How does the "remember that" feature work?</summary>
<p>The model calls a <code>remember_this</code> tool that writes to a long-term memory table for the thread; a later question triggers <code>recall_memory</code>, which searches that table and returns the stored text for the model to answer with.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/g-RJq2KzsAo"
    title="Build Your Own ChatGPT Agent with LLMs, LangGraph, FastAPI, LangSmith, ChromaDB, SQLAlchemy & AWS"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [Build Your Own ChatGPT Agent with LLMs, LangGraph, FastAPI, LangSmith, ChromaDB, SQLAlchemy & AWS](https://www.youtube.com/watch?v=g-RJq2KzsAo).

**Related:** [Streaming and Threading](/docs/agentic-ai/streaming-threading) · [Async Programming](/docs/agentic-ai/async-programming) · Tool Calling
