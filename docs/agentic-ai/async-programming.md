---
id: async-programming
title: "Async Programming for Agents"
sidebar_position: 2
description: Why agents need async — parallel tool calls, non-blocking I/O, concurrent agent execution — and how to use asyncio, gather, and async LangChain/LangGraph patterns without shooting yourself in the foot.
tags: [Agentic AI, Async, Python]
---

# Async Programming for Agents

<div class="tldr">
<strong>TL;DR</strong>

- **Async** lets an agent call multiple tools or LLMs at the same time instead of waiting one-by-one — massive speedup for I/O-bound work.
- **`async def` + `await`** is Python's syntax; **`asyncio.gather()`** runs multiple coroutines concurrently.
- LangChain/LangGraph have async variants for everything — `ainvoke`, `astream`, `abatch` — use them inside `async def` functions.
</div>

Agents spend most of their time waiting — for LLM responses, API calls, database lookups,
web searches. Synchronous code blocks on every wait. Async code lets the agent do other work
while it waits, which means parallel tool calls, concurrent sub-agent execution, and
responsive streaming — all on a single thread.
One submodule per idea, ending with a cheat sheet.

## Why agents specifically need async

Consider a ReAct agent that needs to search three different knowledge bases:

```python
# Synchronous — each call blocks until complete
result_1 = search_arxiv(query)       # 2 seconds
result_2 = search_wikipedia(query)   # 1.5 seconds
result_3 = search_web(query)         # 1 second
# Total: ~4.5 seconds — sequential
```

```python
# Async — all three run concurrently
result_1, result_2, result_3 = await asyncio.gather(
    search_arxiv(query),
    search_wikipedia(query),
    search_web(query),
)
# Total: ~2 seconds — limited by the slowest call
```

The async version is **2x faster** — and the more tools you have, the bigger the win. This
is why every serious agent framework supports async natively.

## async/await basics

An **`async def`** function returns a **coroutine** — a pausable function. You **`await`** it
to get the result. Nothing runs until you `await` it or schedule it on the event loop.

```python
import asyncio

async def fetch_data(source: str) -> str:
    """Simulate an API call that takes 1 second."""
    print(f"Starting {source}...")
    await asyncio.sleep(1)  # non-blocking sleep — other coroutines can run during this
    print(f"Done {source}")
    return f"Data from {source}"

async def main():
    # Sequential — takes 3 seconds
    a = await fetch_data("API-1")
    b = await fetch_data("API-2")
    c = await fetch_data("API-3")

    # Parallel — takes 1 second
    a, b, c = await asyncio.gather(
        fetch_data("API-1"),
        fetch_data("API-2"),
        fetch_data("API-3"),
    )
    print(a, b, c)

asyncio.run(main())  # entry point — starts the event loop
```

Key rules:
- **`async def`** defines a coroutine function
- **`await`** pauses the current coroutine until the awaited thing finishes
- **`asyncio.gather()`** runs multiple coroutines concurrently and returns all results
- **`asyncio.run()`** starts the event loop — call this once at the top level

## The event loop

The **event loop** is the scheduler. It runs one coroutine until it hits an `await`, then
switches to another coroutine that's ready. This is **concurrency, not parallelism** — it's
single-threaded, but it never wastes time waiting.

```
Event loop timeline:
─── coroutine A ──► await (I/O) ─── idle ─── resume A ──► done
─── coroutine B ──────────────► await (I/O) ─── idle ─── resume B ──► done
─── coroutine C ──────────────────────────► await (I/O) ─── resume C ──► done
                                                    ▲
                             all three overlap their wait times
```

For CPU-bound work (heavy computation), async doesn't help — use `concurrent.futures` or
multiprocessing instead. Agents are almost always I/O-bound, so async is the right choice.

## Async tool calls

When you define tools for an agent, make them async if they do I/O:

```python
import httpx
from langchain.tools import tool

@tool
async def search_weather(city: str) -> str:
    """Get the current weather for a city."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.weather.com/v1/{city}")
        data = resp.json()
    return f"{city}: {data['temp']}F, {data['condition']}"

@tool
async def search_news(topic: str) -> str:
    """Search recent news articles about a topic."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.news.com/search?q={topic}")
        articles = resp.json()["articles"][:3]
    return "\n".join(a["title"] for a in articles)
```

When a ReAct agent calls both tools in the same step, the framework can `gather` them
automatically — both HTTP requests fly out at the same time.

## Async LLM calls

LangChain model wrappers have async methods for every operation:

```python
from langchain.chat_models import init_chat_model

llm = init_chat_model("openai:gpt-4o")

# Sync
response = llm.invoke("What is the capital of France?")

# Async — use inside an async function
response = await llm.ainvoke("What is the capital of France?")

# Async batch — multiple prompts concurrently
responses = await llm.abatch([
    "What is the capital of France?",
    "What is the capital of Japan?",
    "What is the capital of Brazil?",
])
```

## Async streaming

For real-time UIs, stream tokens as they arrive. The async version lets you handle other
events (like user cancellation) while streaming:

```python
async def stream_response(query: str):
    """Stream an LLM response token by token."""
    async for chunk in llm.astream(query):
        print(chunk.content, end="", flush=True)  # print each token as it arrives

# With a LangGraph agent — stream node updates
async def stream_agent(agent, query: str):
    config = {"configurable": {"thread_id": "1"}}
    async for event in agent.astream({"messages": [("user", query)]}, config):
        for node_name, output in event.items():
            print(f"[{node_name}]", output)
```

## Running multiple agents concurrently

The real power shows when you have multiple agents and want to run them in parallel — for
example, a researcher agent and a fact-checker agent that work at the same time:

```python
async def run_research_pipeline(question: str):
    # Run researcher and fact-checker concurrently on the same question
    research_task = researcher_agent.ainvoke(
        {"messages": [("user", f"Research: {question}")]}
    )
    factcheck_task = factchecker_agent.ainvoke(
        {"messages": [("user", f"Find common misconceptions about: {question}")]}
    )

    research_result, factcheck_result = await asyncio.gather(
        research_task, factcheck_task
    )

    # Combine results in a synthesis step
    synthesis = await synthesizer_agent.ainvoke({
        "messages": [("user", f"""
            Research: {research_result}
            Fact-check: {factcheck_result}
            Synthesize a final answer.
        """)]
    })
    return synthesis
```

## asyncio.gather vs asyncio.create_task

Two ways to run coroutines concurrently — `gather` for when you want all results together,
`create_task` for fire-and-forget:

```python
async def main():
    # gather — waits for ALL to finish, returns results in order
    results = await asyncio.gather(
        fetch_data("A"),
        fetch_data("B"),
        fetch_data("C"),
    )
    # results = ["Data from A", "Data from B", "Data from C"]

    # create_task — schedule and continue immediately
    task = asyncio.create_task(background_sync())  # runs in background
    # ... do other work ...
    result = await task  # get result when you need it

    # gather with error handling — return_exceptions=True avoids one failure killing all
    results = await asyncio.gather(
        fetch_data("A"),
        fetch_data("B"),  # even if this raises, A and C still return
        fetch_data("C"),
        return_exceptions=True,  # exceptions become return values instead of propagating
    )
```

## Cheat sheet

| Task | Code |
| --- | --- |
| Define async function | `async def my_func():` |
| Call async function | `result = await my_func()` |
| Run concurrently | `results = await asyncio.gather(a(), b(), c())` |
| Start event loop | `asyncio.run(main())` |
| Async LLM call | `await llm.ainvoke(prompt)` |
| Async streaming | `async for chunk in llm.astream(prompt):` |
| Async batch | `await llm.abatch([prompt1, prompt2])` |
| Async agent invoke | `await agent.ainvoke({"messages": ...})` |
| Async agent stream | `async for event in agent.astream(...):` |
| Background task | `task = asyncio.create_task(my_func())` |
| Non-blocking sleep | `await asyncio.sleep(1)` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **Blocking calls inside async functions** — calling `requests.get()` or `time.sleep()` inside an `async def` blocks the entire event loop. Use `httpx.AsyncClient` and `asyncio.sleep()` instead.
- **Forgetting to `await`** — `llm.ainvoke(prompt)` without `await` returns a coroutine object, not the result. Your agent silently uses `<coroutine object>` as a string.
- **Calling `asyncio.run()` inside an already-running loop** — this crashes. In Jupyter notebooks, use `await main()` directly (the notebook already has a loop). In scripts, use `asyncio.run()` only at the top level.
- **Using sync tools with async agents** — a sync tool blocks the event loop while it runs, killing all the concurrency benefits. Make I/O tools async.
- **Not using `return_exceptions=True`** in `gather` — one failed task raises an exception and cancels the others. Use `return_exceptions=True` when you want partial results.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why is async better than threading for agents?</summary>
<p>Agents are I/O-bound (waiting for APIs/LLMs), not CPU-bound. Async handles thousands of concurrent I/O operations on a single thread without the overhead and complexity of thread synchronization.</p>
</details>

<details>
<summary>What does <code>asyncio.gather()</code> do?</summary>
<p>It runs multiple coroutines concurrently and returns all their results as a list, in the same order they were passed in.</p>
</details>

<details>
<summary>What's wrong with <code>time.sleep(1)</code> inside an <code>async def</code>?</summary>
<p>It blocks the entire event loop for 1 second — no other coroutine can run during that time. Use <code>await asyncio.sleep(1)</code> instead, which yields control back to the loop.</p>
</details>

<details>
<summary>What's the async equivalent of <code>llm.invoke()</code>?</summary>
<p><code>await llm.ainvoke()</code> — the <code>a</code> prefix is the LangChain convention for async methods.</p>
</details>
</div>

**Related:** [Pydantic for Agents](/docs/agentic-ai/pydantic-for-agents) · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)

Next: [LangGraph Workflows →](/docs/agentic-ai/langgraph-workflows)
