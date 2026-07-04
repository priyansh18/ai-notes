---
id: 13-langchain-v1
title: "Updated LangChain (v1) Hands-On"
sidebar_position: 13
description: The LangChain v1 essentials — create_agent, one init_chat_model call across OpenAI/Gemini/Groq, the message types, tool binding and the tool-calling loop, structured output with Pydantic/TypedDict, and middleware like summarization.
tags: [RAG, LangChain, Agents]
---

# Updated LangChain (v1) Hands-On

<div class="tldr">
<strong>TL;DR</strong>

- **`create_agent(model, tools, system_prompt)`** is the v1 one-liner for a working agent.
- **`init_chat_model`** swaps OpenAI / Gemini / Groq behind one interface; everything flows as **Messages**.
- **`bind_tools`** gives the model callable tools; **`with_structured_output`** returns typed objects; **middleware** adds cross-cutting control (summarization, guardrails, logging).
</div>

LangChain v1 tightens the core into a few composable pieces. This page walks the essentials
from the updated hands-on, one submodule per idea, ending with a cheat sheet.

![LangChain v1: create_agent wraps a model + tools, middleware wraps that, everything flows as messages](/img/langchain-v1-agent.svg)

Reading the diagram: `create_agent` composes a model with tools and runs the tool-calling
loop; `with_structured_output` types the result; middleware is the outer band that wraps the
whole agent with logging, summarization, and guardrails. Everything moving through it is a
Message.

## Agents in one call: `create_agent`

The v1 headline: a functioning tool-using agent in a single call.

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"The weather in {city} is sunny."

agent = create_agent(
    model="gpt-5",
    tools=[get_weather],
    system_prompt="You are a helpful assistant.",
)

response = agent.invoke({"messages": [{"role": "user", "content": "Weather in New York?"}]})
response["messages"]
```

The agent decides when to call `get_weather`, runs the loop, and returns the message trail.

## One interface for every provider: `init_chat_model`

`init_chat_model` gives you the same object regardless of provider — you just change the
string. Provider-specific classes (`ChatOpenAI`, `ChatGoogleGenerativeAI`, `ChatGroq`) still
exist when you need them.

```python
from langchain.chat_models import init_chat_model

openai_model = init_chat_model("gpt-4.1")
gemini_model = init_chat_model("google_genai:gemini-2.5-flash")
groq_model   = init_chat_model("groq:qwen/qwen3-32b")

groq_model.invoke("Why do parrots talk?")            # single call
for chunk in groq_model.stream("Write 200 words on AI"):   # streaming
    print(chunk.text, end="|", flush=True)
groq_model.batch(["q1", "q2", "q3"])                 # parallel batch
```

Same `invoke` / `stream` / `batch` API across all three — swap the model, keep your code.

## Messages — the unit of context

Every input and output is a **Message** with a role, content, and metadata. Four types
matter:

- **SystemMessage** — standing rules / persona.
- **HumanMessage** — user input (text or multimodal).
- **AIMessage** — the model's reply, including any tool calls.
- **ToolMessage** — the result of one tool execution, fed back to the model.

```python
from langchain.messages import SystemMessage, HumanMessage

messages = [
    SystemMessage("You are a concise poet."),
    HumanMessage("Write one line about retrieval."),
]
model.invoke(messages)
```

A plain string is fine for a one-off; use the message list when you need a system prompt or
conversation history.

## Tools & the tool-calling loop

Decorate a function with `@tool`, bind it, and the model can *request* a call. Your code runs
it and passes the result back — the model never executes anything itself.

```python
from langchain.tools import tool

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return f"It's sunny in {location}"

model_with_tools = model.bind_tools([get_weather])

# 1. model generates tool calls
messages = [{"role": "user", "content": "What's the weather in Boston?"}]
ai_msg = model_with_tools.invoke(messages)
messages.append(ai_msg)

# 2. execute each requested tool, append results
for tool_call in ai_msg.tool_calls:
    messages.append(get_weather.invoke(tool_call))

# 3. model uses the results to answer
final = model_with_tools.invoke(messages)
print(final.text)
```

`create_agent` runs exactly this loop for you; doing it by hand shows what's happening
underneath.

## Structured output (Pydantic & TypedDict)

Force the model to answer in a schema so the result is a typed object you can use directly —
no fragile string parsing.

```python
from pydantic import BaseModel, Field

class Movie(BaseModel):
    title: str = Field(description="The title of the movie")
    year: int = Field(description="The year it was released")
    director: str = Field(description="The director")
    rating: float = Field(description="Rating out of 10")

model_with_structure = model.with_structured_output(Movie)
movie = model_with_structure.invoke("Provide details about Inception")
movie.title, movie.year         # a real Movie object
```

Variations you'll use: **nested models** (`cast: list[Actor]`), **`include_raw=True`** to get
the parsed object *and* the raw message, and **`TypedDict`** with `Annotated` fields when you
want a lighter schema without Pydantic's runtime validation.

## Middleware (summarization & control)

Middleware wraps the agent to add behavior *around* each step — logging, retries, guardrails,
PII detection, and especially **summarization** to keep long chats under the context limit.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="gpt-4o-mini",
    checkpointer=InMemorySaver(),
    middleware=[
        SummarizationMiddleware(
            model="gpt-4o-mini",
            trigger=("messages", 10),   # once history hits 10 messages…
            keep=("messages", 4),       # …compress older ones, keep the last 4
        )
    ],
)

config = {"configurable": {"thread_id": "test-1"}}
agent.invoke({"messages": [HumanMessage("What is 2+2?")]}, config)
```

The summarizer compresses old turns automatically so a long-running conversation doesn't blow
the window — the recent messages stay intact.

## Cheat sheet

| Task | Code |
| --- | --- |
| One-call agent | `create_agent(model=..., tools=[...], system_prompt=...)` |
| Any provider | `init_chat_model("gpt-4.1" / "google_genai:..." / "groq:...")` |
| Bind tools | `model.bind_tools([my_tool])` |
| Typed output | `model.with_structured_output(PydanticSchema)` |
| Output + raw | `with_structured_output(Schema, include_raw=True)` |
| Summarize long chats | `SummarizationMiddleware(trigger=("messages",10), keep=("messages",4))` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Executing tools yourself and forgetting to append the `ToolMessage` back — the model needs
  the result to answer.
- Expecting the model to *run* a tool — it only emits a tool *call*; your code (or
  `create_agent`) executes it.
- Reaching for Pydantic when a `TypedDict` is enough — use Pydantic when you want validation,
  TypedDict when you just want typed keys.
- Skipping a `checkpointer`/`thread_id` with summarization middleware — it needs a thread to
  track and compress history.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What does create_agent give you in one call?</summary>
<p>A model composed with tools and a system prompt, running the full tool-calling loop — a working agent without wiring the loop yourself.</p>
</details>

<details>
<summary>Why use init_chat_model over ChatOpenAI directly?</summary>
<p>It gives one interface across OpenAI/Gemini/Groq — you change a string to switch providers while keeping the same invoke/stream/batch code.</p>
</details>

<details>
<summary>Pydantic vs TypedDict for structured output?</summary>
<p>Pydantic adds runtime validation, descriptions, and nested models; TypedDict is a lighter typed-dict schema when you don't need validation.</p>
</details>

<details>
<summary>What problem does SummarizationMiddleware solve?</summary>
<p>Long conversations exceeding the context window — it compresses older messages while keeping recent ones, automatically.</p>
</details>
</div>

**Related:** [Hybrid Search](/docs/rag-course/09-hybrid-search) · [LangGraph Basics](/docs/rag-course/14-langgraph-basics) · [Glossary](/docs/glossary)

Next: [LangGraph Basics →](/docs/rag-course/14-langgraph-basics)
