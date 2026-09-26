---
id: 15-langgraph-chatbot-skeleton
title: "Chatbot Skeleton in LangGraph"
sidebar_position: 15
description: "Build the first version of an agentic chatbot in LangGraph, one chat node with an add_messages reducer, a MemorySaver checkpointer with thread IDs, a Streamlit UI and token streaming."
tags: [Agentic AI, LangGraph, Chatbots]
---

# Chatbot Skeleton in LangGraph

<div class="tldr">
<strong>TL;DR</strong>

- The smallest chatbot graph is **one node**: `START` to `chat_node` to `END`, with a state whose `messages` field uses the `add_messages` reducer so history appends instead of being overwritten.
- The bot still forgets your name between turns, because state dies when the graph reaches `END`. A **checkpointer** (`MemorySaver`) plus a `thread_id` in the config fixes that and gives you separate conversations per thread.
- The same compiled graph object is imported into a **Streamlit** app; `st.session_state` keeps the visible history across reruns and `chatbot.stream(..., stream_mode="messages")` gives token-by-token output.
</div>

This lesson starts a multi-part build of one agentic chatbot in LangGraph. The video lays out the
full roadmap (persistence, streaming, resumable threads, a database, a UI, tools, LangSmith
observability, RAG, human-in-the-loop, memory) and then builds only the skeleton: a one-node graph,
a checkpointer, and a Streamlit front end. Everything later in the series is bolted onto this
skeleton, so the state design here matters more than it looks.

## One node, one reducer

A chat workflow needs exactly one node. The user's message goes in, the node calls the LLM, the
reply comes out. The interesting design decision is the state.

The state has a single key, `messages`. It is not a string, because a conversation is a list of
turns: human messages and AI messages together, which LangChain types as `BaseMessage`. And it is
annotated with the `add_messages` reducer. Without a reducer, every node return **replaces** the
field; with `add_messages`, each return is **appended**. So the node only has to return the new AI
message and LangGraph keeps the whole transcript.

The node reads `state["messages"]`, sends the list to `llm.invoke`, and returns
`{"messages": [response]}`. The result then holds both the `HumanMessage` you sent and the
`AIMessage` that came back; the answer text is `result["messages"][-1].content`.

## Why the bot forgets, and what a checkpointer fixes

The video wraps `invoke` in a `while` loop so you can type messages until you say `exit`. Tell it
your name, ask a question, then ask "what is my name?" and it says it has no access to personal
information. That looks like a bug: the state stores every message, so the node should have seen
the earlier turn.

The reason: state lives only for one run. When execution reaches `END`, that run is over and the
state is gone; the next `invoke` starts from `START` with a fresh state holding only the new message.

**Persistence** is the fix. A checkpointer saves the state after each step, and on the next invoke
the saved state is loaded and the new message appended to it. `MemorySaver` keeps this in RAM (until
the kernel restarts); a database checkpointer makes it permanent and is covered in a later part. You
create the checkpointer before compiling and pass it as `graph.compile(checkpointer=...)`.

## Threads: one conversation per thread_id

Once a checkpointer exists, every invoke must carry a config:
`{"configurable": {"thread_id": "1"}}`. The thread ID is the key under which the checkpointer
stores that conversation. Thread `1` can know your name is one thing while thread `2` learns a
different name, and switching back to thread `1` restores the first memory. This is the same idea
as "new chat" in a hosted chat product: each chat is its own thread, and you can jump between them.

`chatbot.get_state(config)` returns a snapshot of the saved state for a thread (messages, metadata,
token counts, thread ID), the quickest way to confirm what the checkpointer actually stored.

```
Without checkpointer:
  invoke #1: START -> chat_node -> END   (state discarded)
  invoke #2: START -> chat_node -> END   (fresh state, no memory)

With checkpointer + thread_id:
  invoke #1: load(thread) -> START -> chat_node -> END -> save(thread)
  invoke #2: load(thread) -> [old msgs + new msg] -> chat_node -> save(thread)
```

## From notebook to backend file to Streamlit

The notebook is for experimenting. The video then moves the graph into `agentic_chatbot_backend.py`
and exposes one object, `chatbot`; any front end imports it, and the backend never changes when the UI does.

Streamlit gives a chat UI without HTML or CSS: `st.chat_input` for the box and
`st.chat_message("user")` / `st.chat_message("assistant")` for the icons. Run it with
`streamlit run app.py` (not `python app.py`); it serves on `localhost:8501`.

Streamlit re-executes the whole script on every interaction, so a plain list of messages is wiped
each time and you only see the latest exchange. `st.session_state` is a dictionary that survives
reruns: create `message_history` there if missing, replay it at the top of the script, append the
user turn before calling the graph and the assistant turn after. This is the UI-side twin of the
checkpointer: the graph remembers via the thread, the page remembers via session state.

## Streaming tokens

`invoke` waits for the whole reply, which is a poor experience for long outputs. Replace it with
`chatbot.stream(input, config=config, stream_mode="messages")`, which yields
`(message_chunk, metadata)` pairs as tokens arrive, and hand a generator of `chunk.content` to
`st.write_stream`. `write_stream` renders the tokens live and returns the full text, which you then
store in session state.

## Code that matters

```python
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

llm = ChatOpenAI()


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def chat_node(state: ChatState) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}


graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)

checkpointer = MemorySaver()
chatbot = graph.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "1"}}
result = chatbot.invoke(
    {"messages": [HumanMessage(content="What is Python?")]}, config=config
)
print(result["messages"][-1].content)
```

Streamlit side, the two lines that carry the idea (sketch):

```python
import streamlit as st

if "message_history" not in st.session_state:  # survives script reruns
    st.session_state["message_history"] = []

user_input = st.chat_input("Type here")
if user_input:
    with st.chat_message("assistant"):
        ai_message = st.write_stream(
            chunk.content
            for chunk, metadata in chatbot.stream(
                {"messages": [HumanMessage(content=user_input)]},
                config=config,
                stream_mode="messages",
            )
        )
    st.session_state["message_history"].append({"role": "assistant", "content": ai_message})
```

## Failure modes and gotchas

- **Forgetting `add_messages`.** With a plain `list[BaseMessage]` the node's return replaces the list and you lose the human turn. The reducer is what makes `messages` accumulate.
- **No checkpointer, no memory.** Storing messages in state is not persistence. State ends with the run. If "what is my name?" fails across turns, look at compile, not at the node.
- **Checkpointer without `thread_id`.** Once a checkpointer is attached, invoking without `config` errors. The `app.py` test in the video failed for exactly this reason.
- **`MemorySaver` is RAM.** Restart the kernel or the process and every thread is gone. Fine for learning, wrong for anything users rely on.
- **Streamlit reruns the script.** Any Python variable not in `st.session_state` resets on each interaction, and an old Streamlit has no `write_stream`; upgrade before debugging your generator.

## Takeaways

- Worth remembering: the whole later series (tools, RAG, HITL, memory) reuses this exact state shape. Get `messages: Annotated[list[BaseMessage], add_messages]` right once.
- A checkpointer plus a thread ID is the minimum for a bot that remembers anything; the thread is the unit of conversation.
- Two memories exist in this app and they are different: the checkpointer (graph state per thread) and `st.session_state` (what the page displays). Both must be updated each turn.

## Test yourself

<details>
<summary>The state stores every message, yet the bot cannot recall your name on the next invoke. Why?</summary>
<p>State only lives for one run. When the graph hits END the run is over and its state is discarded; the next invoke starts from START with only the new message. A checkpointer is what carries state across runs.</p>
</details>

<details>
<summary>What does <code>add_messages</code> change about how a node's return value is applied?</summary>
<p>Without it the returned list replaces the <code>messages</code> field. With it the returned messages are appended, so the node only returns the new AI message and history accumulates.</p>
</details>

<details>
<summary>Why does the Streamlit app need <code>st.session_state</code> if the graph already has a checkpointer?</summary>
<p>They remember different things. The checkpointer holds graph state per thread on the backend. Streamlit re-runs the script on every interaction, so the visible chat history must live in session state or the page shows only the latest exchange.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/_BVsXOC46wQ"
    title="13. Build Your First Agentic Chatbot with LangGraph / Part 1"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [13. Build Your First Agentic Chatbot with LangGraph / Part 1](https://www.youtube.com/watch?v=_BVsXOC46wQ).

**Related:** [LangGraph Workflows](/docs/agentic-ai/langgraph-workflows) · [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Streaming and Threading](/docs/agentic-ai/streaming-threading)
