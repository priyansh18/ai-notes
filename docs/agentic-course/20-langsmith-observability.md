---
id: 20-langsmith-observability
title: "Tracing the Chatbot with LangSmith"
sidebar_position: 20
description: "Add LangSmith tracing to a LangGraph chatbot with four environment variables, read a trace node by node, and group runs into threads with metadata and run_name in the config."
tags: [Agentic AI, LangSmith, Observability]
---

# Tracing the Chatbot with LangSmith

<div class="tldr">
<strong>TL;DR</strong>

- Every LLM app has **hidden steps** between the user's question and the answer: prompt construction, the model call, tool calls, checkpointer reads. LangSmith records each run of those steps as a **trace** you can open and inspect.
- Wiring it in takes **no code changes**: set `LANGSMITH_TRACING=true`, the endpoint, an API key and a project name in `.env`, re-run the app, and a project with traces appears in the dashboard.
- By default every invoke is a separate flat trace. To see conversations grouped as **threads**, pass `metadata` (with the thread ID) and a `run_name` in the same `config` you already pass to `invoke`.
</div>

Part 6 of the chatbot build adds observability. The chatbot already has persistence, streaming,
threads and a database, but when it runs there is no way to see which node executed, what prompt
reached the model, how many tokens it cost, or why a node failed. LangSmith, the tracing platform
from the LangChain team, fills that gap. It works with LangChain and LangGraph out of the box and
can also be used with other frameworks.

## What a trace records

A chatbot run is a chain of operations you never see from the outside: the user sends a question,
the app builds a prompt, calls the LLM, maybe calls a tool or a database, reads or writes the
checkpointer, and returns a response. If you only have the code, this middle part is invisible.

LangSmith records the complete execution as a trace. For each step it stores the inputs, outputs,
errors, execution time, token usage, tool calls and model behaviour. The lesson lists what that
buys you for a LangGraph agent:

- find out **why an agent picked the wrong tool** (you can see the prompt and the decision);
- inspect the **exact prompt** sent to the model;
- debug a **failed node** in the workflow;
- measure **latency and token cost** per call;
- review **conversations and multi-turn threads**;
- compare prompts or model versions, and evaluate quality before and after deployment.

## Wiring: four environment variables, zero code

The setup is entirely configuration. On the LangSmith site, create an account, open Settings, and
generate an API key. Then add to `.env`:

| Variable | Value | Meaning |
| --- | --- | --- |
| `LANGSMITH_TRACING` | `true` | turn tracing on for this process |
| `LANGSMITH_ENDPOINT` | the LangSmith API URL | where trace data is sent |
| `LANGSMITH_API_KEY` | your key | authenticates uploads to your workspace |
| `LANGSMITH_PROJECT` | e.g. `agentic-chatbot` | the project traces are filed under |

The first three stay the same across projects; only the project name changes. The app already calls
`load_dotenv()`, so the LangChain and LangGraph libraries pick these up and start reporting. Restart
the Streamlit app, send one message, refresh the dashboard: a project with that name now exists,
created seconds ago, containing one trace.

## Reading a trace

Open the trace and you first see the conversation view: the input message and the AI output. Click
**Details** and the run tree appears. For this chatbot it shows the LangGraph run, inside it the
`chat_node`, and inside that the model call (the lesson's default model showed up as GPT-3.5 Turbo,
which is how the author discovered which model the default `ChatOpenAI()` was using). Each level
exposes inputs, outputs, attributes and metadata. Hovering a step shows input, output and total
tokens with an estimated cost. Zooming out lists start time, latency, tokens, cost and the endpoint
per run.

```
Project: agentic-chatbot
  Trace #1 (run name: LangGraph)         latency 1.9s   tokens 412
    chat_node
      ChatOpenAI  (input: messages[]  output: AIMessage  tokens in/out)
  Trace #2 (run name: LangGraph)         latency 2.4s   tokens 530
    chat_node
      ChatOpenAI
```

Send a second message and a second trace appears. Every invoke is one trace, named `LangGraph` by
default.

## Grouping runs into threads

The flat list has a problem. Start a new chat thread in the UI, say a different name, and the new
run still lands in the same trace list next to the old thread's runs. LangSmith is not separating
your threads because you have not told it which thread each run belongs to.

The fix is one change to the config dictionary you already pass on every invoke. Alongside
`configurable.thread_id`, add a `metadata` entry carrying the same thread ID and a `run_name` (the
lesson uses `chat_trace`). Now the dashboard's **Threads** view groups runs by thread: thread one
holds its two runs, the "Alex" thread holds its own, and each additional message inside a thread
appears as a new run under it. The lesson notes a lag of roughly 10 to 20 seconds before the threads
view updates, so an empty thread right after sending is normal.

## Code that matters

```python
# .env  (values come from the LangSmith settings page; never commit this file)
# LANGSMITH_TRACING=true
# LANGSMITH_ENDPOINT=https://api.smith.langchain.com
# LANGSMITH_API_KEY=...
# LANGSMITH_PROJECT=agentic-chatbot

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

load_dotenv()  # tracing is now on; no other code change needed

thread_id = "1"

# before: only the checkpointer knew the thread
config = {"configurable": {"thread_id": thread_id}}

# after: LangSmith can group runs by thread and label them
config = {
    "configurable": {"thread_id": thread_id},
    "metadata": {"thread_id": thread_id},
    "run_name": "chat_trace",
}

response = chatbot.invoke(  # sketch: chatbot and user_input come from the app
    {"messages": [HumanMessage(content=user_input)]},
    config=config,
)
```

The same `config` object is passed to `chatbot.stream(...)` in the Streamlit app, so streaming runs
are grouped identically.

## Failure modes and gotchas

- **Traces missing entirely.** `LANGSMITH_TRACING` not set to `true`, or `.env` edited but the app not restarted. The variables are read at process start.
- **Everything in one flat list.** No `metadata` thread ID in the config. `configurable.thread_id` is for the checkpointer; LangSmith needs the thread ID in `metadata` to build the Threads view.
- **Thread view looks stale.** There is a 10 to 20 second delay. Refresh before assuming the config is wrong.
- **Leaked API key.** The key grants write access to your workspace. Keep it in `.env`, keep `.env` out of version control, and rotate it if it was shown on screen.
- **Default model surprise.** The trace is the first place many people notice which model `ChatOpenAI()` actually used. Pin the model name explicitly.
- **Old project clutter.** Deleting a project from the tracing page and re-running gives a clean slate when you change the run name or config.

## Takeaways

- Worth remembering: observability is configuration, not code. Four environment variables trace every LangChain and LangGraph call in the process.
- A trace is a tree: graph run, node, model call. Token counts and latency live on the leaves; read them there when a response is slow or expensive.
- The `config` dict is shared infrastructure. The checkpointer reads `configurable`, LangSmith reads `metadata` and `run_name`. Build it once and pass it everywhere.
- Once tools are added in the next part, the same trace shows the routing decision and the tool call, which is where "why did it pick that tool" gets answered.

## Test yourself

<details>
<summary>What has to change in the Python code to start sending traces to LangSmith?</summary>
<p>Nothing. Set <code>LANGSMITH_TRACING=true</code>, the endpoint, the API key and a project name as environment variables; <code>load_dotenv()</code> already runs, and the libraries pick the values up automatically.</p>
</details>

<details>
<summary>Runs from different chat threads all appear in one flat list. What is missing?</summary>
<p>The thread ID in <code>config["metadata"]</code> (plus an optional <code>run_name</code>). The checkpointer's <code>configurable.thread_id</code> alone does not tell LangSmith how to group runs into threads.</p>
</details>

<details>
<summary>Name three things you can read off a single trace that the running app does not show you.</summary>
<p>The exact prompt sent to the model, the input and output token counts with estimated cost, and the per-node latency and any node error. The trace also reveals which model was actually called.</p>
</details>

**Related:** [Evaluation](/docs/rag-course/26-evaluation) · [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Glossary](/docs/glossary)

Next: [Tools in the Agentic Chatbot](./21-tools-in-agentic-chatbot.md)
