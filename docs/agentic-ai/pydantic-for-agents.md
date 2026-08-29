---
id: pydantic-for-agents
title: "Pydantic for Agents"
sidebar_position: 1
description: Pydantic is the backbone of reliable agent I/O — typed, validated models for tool inputs, structured LLM outputs, and agent state schemas that catch bad data before it breaks your agent.
tags: [Agentic AI, Pydantic, Structured Output]
---

# Pydantic for Agents

<div class="tldr">
<strong>TL;DR</strong>

- **Pydantic BaseModel** gives you typed, validated data structures — agents need these for tool inputs, LLM outputs, and state.
- **Structured output** (`with_structured_output(MyModel)`) forces the LLM to return a Pydantic model instead of raw text — no more parsing regex.
- **Field validators** catch bad data before it reaches your agent logic — fail fast, not halfway through a tool call.
</div>

Agents pass data between components constantly — the LLM produces output, a tool consumes
it, the tool returns a result, the agent updates its state. If any of that data is malformed,
the agent silently breaks or hallucinates downstream. Pydantic makes every hand-off typed and
validated, so bad data fails loud and early.
One submodule per idea, ending with a cheat sheet.

## Why agents need typed data

Without Pydantic, agent I/O looks like this:

```python
# Untyped — the agent's tool gets a raw dict from the LLM
def search_flights(args: dict):
    origin = args["origin"]        # KeyError if LLM forgot it
    destination = args["dest"]     # or was it "destination"? who knows
    date = args["date"]            # "tomorrow" or "2025-03-15"? no validation
    max_price = args["max_price"]  # string "500" or int 500?
    ...
```

Every line is a landmine. The LLM might spell a key differently, omit a field, or return a
string where you need an int. Pydantic eliminates all of this.

## BaseModel basics

A **BaseModel** is a class where each attribute has a type annotation. Pydantic validates data
on construction — if the types don't match, it raises `ValidationError` immediately.

```python
from pydantic import BaseModel, Field
from datetime import date

class FlightSearch(BaseModel):
    """Input schema for the flight search tool."""
    origin: str = Field(description="IATA airport code, e.g. 'SFO'")
    destination: str = Field(description="IATA airport code, e.g. 'JFK'")
    departure_date: date = Field(description="Departure date in YYYY-MM-DD format")
    max_price: float = Field(default=1000.0, ge=0, description="Maximum ticket price in USD")

# Valid — works fine
search = FlightSearch(origin="SFO", destination="JFK", departure_date="2025-06-15", max_price=500)
print(search.departure_date)  # date(2025, 6, 15) — auto-coerced from string

# Invalid — raises ValidationError instantly
FlightSearch(origin="SFO", destination="JFK", departure_date="not-a-date", max_price=-50)
# ValidationError: departure_date → invalid date format, max_price → >= 0
```

Key things to notice: Pydantic **coerces** `"2025-06-15"` into a `date` object automatically,
and `ge=0` on `max_price` rejects negative values. The `Field(description=...)` is critical
for agents — the LLM reads these descriptions to understand what each field expects.

## Field validators and constraints

Beyond basic types, you can add custom validation logic with `field_validator`:

```python
from pydantic import BaseModel, Field, field_validator

class AgentAction(BaseModel):
    """Represents a single action the agent wants to take."""
    tool_name: str = Field(description="Name of the tool to call")
    arguments: dict = Field(default_factory=dict, description="Tool arguments")
    reasoning: str = Field(description="Why the agent chose this action")

    @field_validator("tool_name")
    @classmethod
    def tool_must_be_allowed(cls, v):
        allowed = {"search", "calculator", "weather", "send_email"}
        if v not in allowed:
            raise ValueError(f"Unknown tool '{v}'. Allowed: {allowed}")
        return v

    @field_validator("reasoning")
    @classmethod
    def reasoning_not_empty(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Reasoning must be at least 10 characters — make the agent explain itself")
        return v.strip()

# This passes
action = AgentAction(
    tool_name="search",
    arguments={"query": "latest AI news"},
    reasoning="The user asked about recent developments in AI"
)

# This fails — unknown tool
AgentAction(tool_name="hack_pentagon", arguments={}, reasoning="Just curious")
# ValidationError: Unknown tool 'hack_pentagon'
```

Validators act as **guardrails** — they constrain what the agent can do before any action is
executed. Think of them as the cheapest, fastest safety layer you can add.

## Structured LLM output

This is where Pydantic becomes essential for agents. Instead of parsing free-text LLM
responses with fragile regex, you tell the model to return a specific Pydantic schema:

```python
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model

class MovieRecommendation(BaseModel):
    """A movie recommendation with reasoning."""
    title: str = Field(description="Movie title")
    year: int = Field(description="Release year")
    genre: str = Field(description="Primary genre")
    reason: str = Field(description="Why this movie fits the user's request")
    confidence: float = Field(ge=0, le=1, description="How confident the model is (0-1)")

llm = init_chat_model("openai:gpt-4o")
structured_llm = llm.with_structured_output(MovieRecommendation)

result = structured_llm.invoke("Suggest a sci-fi movie for someone who loved Arrival")
print(type(result))       # <class 'MovieRecommendation'> — not a string!
print(result.title)       # "Interstellar"
print(result.confidence)  # 0.92
```

The LLM's response is **guaranteed** to match your schema — or it raises an error. No more
`json.loads()` inside a `try/except` hoping the model returned valid JSON.

## Tool input validation

When an agent calls a tool, the tool's input should be a Pydantic model. This way, if the LLM
passes garbage arguments, you catch it before executing anything:

```python
from pydantic import BaseModel, Field
from langchain.tools import tool

class WeatherInput(BaseModel):
    """Input for the weather lookup tool."""
    city: str = Field(description="City name")
    units: str = Field(default="celsius", description="Temperature units: 'celsius' or 'fahrenheit'")

    @field_validator("units")
    @classmethod
    def validate_units(cls, v):
        if v not in ("celsius", "fahrenheit"):
            raise ValueError(f"Units must be 'celsius' or 'fahrenheit', got '{v}'")
        return v

@tool(args_schema=WeatherInput)
def get_weather(city: str, units: str = "celsius") -> str:
    """Get the current weather for a city."""
    # By the time we get here, city is a valid string and units is celsius/fahrenheit
    return f"Weather in {city}: 22 degrees {units}"
```

The `args_schema=WeatherInput` tells LangChain to validate the LLM's tool-call arguments
against this model before invoking the function. Bad arguments never reach your code.

## Defining agent state schemas

In LangGraph, agent state flows between nodes. Define it as a Pydantic model so every node
can trust the shape of the data:

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from langchain.schema import Document

class ResearchAgentState(BaseModel):
    """State for a research agent that gathers and synthesizes information."""
    query: str = Field(description="The user's research question")
    search_results: List[Document] = Field(default_factory=list)
    current_summary: str = Field(default="")
    sources_checked: int = Field(default=0, ge=0)
    is_sufficient: bool = Field(default=False)
    final_answer: Optional[str] = Field(default=None)

# Every node receives and returns this typed state
def search_node(state: ResearchAgentState) -> dict:
    docs = retriever.invoke(state.query)
    return {
        "search_results": docs,
        "sources_checked": state.sources_checked + len(docs),
    }

def evaluate_node(state: ResearchAgentState) -> dict:
    # The agent can check: do I have enough sources?
    if state.sources_checked >= 10 or state.is_sufficient:
        return {"is_sufficient": True}
    return {"is_sufficient": False}
```

With a typed state, you get autocompletion in your editor, clear documentation of what data
flows through the graph, and instant errors if a node returns malformed data.

## How bad data breaks agents — a real example

Here's what happens without Pydantic in a multi-step agent:

```python
# Step 1: LLM returns {"action": "search", "query": "AI papers"}   — fine
# Step 2: Tool returns {"results": [...]}                           — fine
# Step 3: LLM returns {"action": "summarize", "text": None}        — uh oh
# Step 4: Summarize tool does text.split() → AttributeError: NoneType has no attribute 'split'
#          But the error is in step 4, caused by step 3. Good luck debugging.
```

With Pydantic, step 3 would have raised `ValidationError: text → none is not an allowed value`
immediately. The error points to the exact problem, at the exact moment it happens.

## Cheat sheet

| Task | Code |
| --- | --- |
| Define a model | `class MyModel(BaseModel): field: type = Field(...)` |
| Add constraints | `Field(ge=0, le=100)`, `Field(min_length=1)` |
| Custom validator | `@field_validator("field")` classmethod |
| Structured LLM output | `llm.with_structured_output(MyModel)` |
| Tool input schema | `@tool(args_schema=MyModel)` |
| Serialize to dict | `model.model_dump()` |
| Serialize to JSON | `model.model_dump_json()` |
| Parse from dict | `MyModel.model_validate({"field": "value"})` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Forgetting `Field(description=...)` — the LLM uses these descriptions to fill in the schema correctly. No description = guessing.
- Using `dict` instead of a Pydantic model for tool args — you lose validation and the agent silently passes bad data.
- Overcomplicating schemas — deeply nested models confuse LLMs. Keep tool input schemas flat when possible.
- Not handling `ValidationError` — in production, catch it and feed the error back to the agent so it can retry with corrected arguments.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why do agents need typed data more than normal programs?</summary>
<p>Because agents pass data between non-deterministic components (LLMs, tools, state). Any hand-off can produce malformed data, and without types you won't catch it until something breaks downstream.</p>
</details>

<details>
<summary>What does <code>with_structured_output(MyModel)</code> do?</summary>
<p>It forces the LLM to return a response that matches your Pydantic model's schema — you get a validated Python object instead of raw text.</p>
</details>

<details>
<summary>How does <code>args_schema</code> protect a tool?</summary>
<p>It validates the LLM's tool-call arguments against the Pydantic model before invoking the function. Bad arguments raise a ValidationError instead of reaching your code.</p>
</details>

<details>
<summary>What's the benefit of using Pydantic for agent state in LangGraph?</summary>
<p>Every node can trust the shape and types of the state — you get autocompletion, clear documentation, and instant errors if a node returns malformed data.</p>
</details>
</div>

**Related:** [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Agentic RAG](/docs/rag-course/16-agentic-rag) · [Glossary](/docs/glossary)

Next: [Async Programming for Agents →](/docs/agentic-ai/async-programming)
