---
id: harness-engineering
title: "Harness Engineering"
sidebar_position: 7
description: The harness is everything around the LLM — system prompt, tools, guardrails, output parsers, memory, retry logic, and context window management. Building a good harness turns a raw model into a reliable agent.
tags: [Agentic AI, Harness, System Design]
---

# Harness Engineering

<div class="tldr">
<strong>TL;DR</strong>

- The **harness** is everything around the LLM — system prompt, tool registry, validation, error handling, retry logic, context window management.
- A well-designed harness makes the model **swappable** — change from GPT-4o to Claude without touching agent logic.
- Bare LLM calls are fragile. A harnessed agent validates inputs, catches errors, retries gracefully, and enforces guardrails on every call.
</div>

The LLM is the engine, but the harness is the car. Nobody drives an engine bolted to a
chair — you need steering, brakes, a dashboard, and a seatbelt. Harness engineering is about
building that wrapper: the system prompt that shapes behaviour, the tools that extend
capability, the validators that catch bad output, the retry logic that handles failures, and
the context management that keeps the window from overflowing.
One submodule per idea, ending with a cheat sheet.

## What a harness is

A **harness** wraps a raw LLM and adds the infrastructure an agent needs:

```
┌─────────────────────────────────────────────────┐
│  HARNESS                                        │
│                                                 │
│  ┌───────────────┐                              │
│  │ System Prompt  │  ← shapes behaviour         │
│  └───────────────┘                              │
│  ┌───────────────┐                              │
│  │ Tool Registry  │  ← what the agent can do    │
│  └───────────────┘                              │
│  ┌───────────────┐                              │
│  │ Input Guards   │  ← reject bad/unsafe input  │
│  └───────────────┘                              │
│  ┌───────────────┐                              │
│  │    LLM Call    │  ← the actual model call     │
│  └───────────────┘                              │
│  ┌───────────────┐                              │
│  │ Output Parser  │  ← validate & structure      │
│  └───────────────┘                              │
│  ┌───────────────┐                              │
│  │ Error Handler  │  ← retry, fallback, escalate │
│  └───────────────┘                              │
│  ┌───────────────┐                              │
│  │ Context Mgmt   │  ← trim/summarize history    │
│  └───────────────┘                              │
└─────────────────────────────────────────────────┘
```

Each component is independent and composable. That's the point — you can swap the LLM, add
a tool, tighten a guardrail, or change the retry strategy without rewriting anything else.

## Bare LLM vs harnessed agent

The difference is dramatic. Here's the same task — extract order info from a customer
message — done two ways.

```python
from langchain.chat_models import init_chat_model

llm = init_chat_model("openai:gpt-4o")

# ── Bare LLM call ──────────────────────────────────────
response = llm.invoke("Extract the order number from: 'Where is order #12345?'")
print(response.content)  # "The order number is #12345."
# ^ A string. No structure. No validation. No error handling.
# What if the user says "hack the system"? No guardrails.
# What if the API times out? Unhandled exception.
# What if the response is "I don't see an order number"? No retry.
```

```python
# ── Harnessed agent ────────────────────────────────────
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model
import time

class OrderInfo(BaseModel):
    order_number: str = Field(description="The order number, e.g. '#12345'")
    intent: str = Field(description="What the customer wants: 'track', 'cancel', 'return'")

class OrderHarness:
    def __init__(self, model_name: str = "openai:gpt-4o"):
        self.llm = init_chat_model(model_name)
        self.structured_llm = self.llm.with_structured_output(OrderInfo)
        self.system_prompt = (
            "You are a customer support agent. Extract the order number and intent. "
            "Only respond about order-related queries. Refuse unrelated requests."
        )
        self.max_retries = 3

    def validate_input(self, message: str) -> str:
        """Input guardrail — reject obviously bad input."""
        if len(message) > 5000:
            raise ValueError("Message too long — possible injection attack")
        if any(word in message.lower() for word in ["ignore previous", "system prompt"]):
            raise ValueError("Suspicious input detected")
        return message.strip()

    def invoke(self, user_message: str) -> OrderInfo:
        """The full harnessed call — validate, call, parse, retry."""
        clean_message = self.validate_input(user_message)

        messages = [
            ("system", self.system_prompt),
            ("user", clean_message),
        ]

        for attempt in range(self.max_retries):
            try:
                result = self.structured_llm.invoke(messages)
                return result  # validated OrderInfo — guaranteed structure
            except Exception as e:
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)  # exponential backoff
                    continue
                raise RuntimeError(f"Failed after {self.max_retries} attempts: {e}")

harness = OrderHarness()
result = harness.invoke("Where is order #12345?")
print(result.order_number)  # "#12345"
print(result.intent)        # "track"
```

Same task, wildly different reliability. The harness gives you typed output, input
validation, retries with backoff, and a system prompt that constrains behaviour.

## Component 1: System prompt

The system prompt is the cheapest, most impactful part of the harness. It shapes every
response the model produces.

```python
SYSTEM_PROMPTS = {
    "customer_support": (
        "You are a customer support agent for an e-commerce platform.\n"
        "Rules:\n"
        "1. Only answer questions about orders, shipping, and returns.\n"
        "2. Never reveal internal pricing or inventory data.\n"
        "3. If unsure, say 'Let me connect you with a human agent.'\n"
        "4. Always confirm the order number before taking action.\n"
        "5. Be concise — customers are busy."
    ),
    "code_reviewer": (
        "You are a senior code reviewer.\n"
        "Rules:\n"
        "1. Focus on correctness, readability, and security.\n"
        "2. Cite specific line numbers when pointing out issues.\n"
        "3. Suggest fixes, don't just describe problems.\n"
        "4. Be constructive — assume the author is competent."
    ),
}
```

Design principles for system prompts:
- **Be specific** — "you are a helpful assistant" is useless. State the role, the rules, and the boundaries.
- **Use numbered rules** — LLMs follow numbered lists more reliably than prose.
- **Include negative constraints** — "never do X" is as important as "always do Y".

## Component 2: Tool registry

The tool registry defines what the agent can do. Keep it clean — each tool has a clear
name, description, and typed input schema.

```python
from langchain.tools import tool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="Search query")
    max_results: int = Field(default=5, ge=1, le=20, description="Max results to return")

class EmailInput(BaseModel):
    to: str = Field(description="Recipient email address")
    subject: str = Field(description="Email subject line")
    body: str = Field(description="Email body text")

@tool(args_schema=SearchInput)
def search_knowledge_base(query: str, max_results: int = 5) -> str:
    """Search the internal knowledge base for relevant articles."""
    # ... implementation
    return f"Found {max_results} results for '{query}'"

@tool(args_schema=EmailInput)
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a customer. Use only for confirmed actions."""
    # ... implementation
    return f"Email sent to {to}"

# The registry — add or remove tools without changing agent logic
TOOL_REGISTRY = [search_knowledge_base, send_email]
```

The key insight: the LLM reads tool descriptions to decide when to call them. Bad
descriptions → wrong tool choices. This is part of the harness, not the model.

## Component 3: Error handling and retries

LLM calls fail — rate limits, timeouts, malformed output. A good harness handles this
gracefully.

```python
import time
from pydantic import ValidationError

class ResilientHarness:
    def __init__(self, llm, max_retries: int = 3, fallback_llm=None):
        self.llm = llm
        self.max_retries = max_retries
        self.fallback_llm = fallback_llm  # cheaper model as backup

    def invoke_with_retry(self, messages: list, output_schema=None) -> any:
        """Call the LLM with retries, backoff, and optional fallback."""
        model = self.llm
        last_error = None

        for attempt in range(self.max_retries):
            try:
                if output_schema:
                    result = model.with_structured_output(output_schema).invoke(messages)
                else:
                    result = model.invoke(messages)
                return result

            except ValidationError as e:
                # Structured output didn't match schema — retry with error context
                messages.append(("assistant", f"My previous response was invalid: {e}"))
                messages.append(("user", "Please try again, following the schema exactly."))
                last_error = e

            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    wait = 2 ** attempt  # 1s, 2s, 4s
                    time.sleep(wait)

                    # On last retry with primary model, switch to fallback
                    if attempt == self.max_retries - 2 and self.fallback_llm:
                        model = self.fallback_llm

        raise RuntimeError(f"All {self.max_retries} attempts failed. Last error: {last_error}")
```

Notice the `ValidationError` handling — when structured output fails, the harness feeds
the error back to the model and retries. This is a **self-correction loop** built into
the harness.

## Component 4: Context window management

Long conversations overflow the context window. The harness needs to manage this — trim
old messages, summarize history, or use a sliding window.

```python
from langchain.chat_models import init_chat_model

class ContextManager:
    def __init__(self, max_messages: int = 50, summary_threshold: int = 40):
        self.max_messages = max_messages
        self.summary_threshold = summary_threshold
        self.summarizer = init_chat_model("openai:gpt-4o-mini")  # cheap model for summaries

    def manage(self, messages: list) -> list:
        """Keep the conversation within context limits."""
        if len(messages) <= self.summary_threshold:
            return messages  # no trimming needed

        # Split into system prompt + old messages + recent messages
        system = [m for m in messages if m[0] == "system"]
        non_system = [m for m in messages if m[0] != "system"]

        # Keep last 10 messages verbatim, summarize the rest
        recent = non_system[-10:]
        old = non_system[:-10]

        if old:
            old_text = "\n".join(f"{role}: {content}" for role, content in old)
            summary = self.summarizer.invoke(
                f"Summarize this conversation history in 3-5 bullet points:\n{old_text}"
            ).content
            summary_msg = ("system", f"Previous conversation summary:\n{summary}")
            return system + [summary_msg] + recent

        return system + recent
```

## Design principle: model-swappable harness

A well-built harness is model-agnostic. You should be able to swap GPT-4o for Claude or
Llama without changing any harness code.

```python
from langchain.chat_models import init_chat_model

class AgentHarness:
    """A model-agnostic agent harness."""

    def __init__(
        self,
        model_name: str,
        system_prompt: str,
        tools: list,
        output_schema=None,
        max_retries: int = 3,
    ):
        self.llm = init_chat_model(model_name)
        self.system_prompt = system_prompt
        self.tools = tools
        self.output_schema = output_schema
        self.max_retries = max_retries
        self.context_manager = ContextManager()

    def invoke(self, user_message: str, history: list = None) -> any:
        messages = [("system", self.system_prompt)]
        if history:
            messages.extend(history)
        messages.append(("user", user_message))

        # Context management
        messages = self.context_manager.manage(messages)

        # Retry-wrapped call
        for attempt in range(self.max_retries):
            try:
                if self.output_schema:
                    return self.llm.with_structured_output(self.output_schema).invoke(messages)
                return self.llm.invoke(messages)
            except Exception:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(2 ** attempt)

# Same harness, different models — zero code changes
gpt_agent = AgentHarness("openai:gpt-4o", SYSTEM_PROMPTS["customer_support"], TOOL_REGISTRY)
claude_agent = AgentHarness("anthropic:claude-sonnet-4-20250514", SYSTEM_PROMPTS["customer_support"], TOOL_REGISTRY)
llama_agent = AgentHarness("groq:llama-3.3-70b", SYSTEM_PROMPTS["customer_support"], TOOL_REGISTRY)

# All three behave the same way — same prompt, same tools, same validation
result_gpt = gpt_agent.invoke("Where is my order #12345?")
result_claude = claude_agent.invoke("Where is my order #12345?")
result_llama = llama_agent.invoke("Where is my order #12345?")
```

This is the payoff of harness engineering — the model is a configuration parameter, not a
hard dependency. When a new model launches, you test it by changing one string.

## Cheat sheet

| Component | Purpose | Key pattern |
| --- | --- | --- |
| System prompt | Shape behaviour | Numbered rules, negative constraints |
| Tool registry | Define capabilities | `@tool(args_schema=Model)`, clear descriptions |
| Input guards | Reject bad input | Length checks, keyword filters, rate limits |
| Output parser | Structure response | `with_structured_output(Model)` |
| Error handler | Retry gracefully | Exponential backoff, fallback model |
| Context manager | Fit the window | Summarize old messages, sliding window |
| Model swap | Avoid lock-in | `init_chat_model(model_name)` — one-line swap |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **No system prompt** — the model defaults to generic "helpful assistant" behaviour. Always set explicit role, rules, and boundaries.
- **Hardcoding the model** — using `ChatOpenAI(model="gpt-4o")` directly ties your agent to one provider. Use `init_chat_model()` for swappability.
- **No retry logic** — LLM APIs have rate limits and transient failures. Without retries, your agent crashes on the first 429 error.
- **Ignoring context limits** — long conversations silently truncate. The model loses early context and starts hallucinating. Manage the window explicitly.
- **Overstuffed tool registry** — 20+ tools confuse the model. It picks the wrong one or hallucinates tool names. Keep it under 10, or use a tool-selection layer.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What is a "harness" in the context of AI agents?</summary>
<p>Everything around the LLM — system prompt, tools, input validation, output parsing, error handling, retry logic, and context management. It turns a raw model into a reliable agent.</p>
</details>

<details>
<summary>Why should the harness be model-agnostic?</summary>
<p>So you can swap models (GPT-4o → Claude → Llama) by changing a single config string, without rewriting any agent logic. This avoids vendor lock-in and lets you benchmark easily.</p>
</details>

<details>
<summary>How does a harness handle structured output failures?</summary>
<p>It catches the ValidationError, feeds the error message back to the model as context, and retries — giving the model a chance to self-correct and match the schema.</p>
</details>

<details>
<summary>What's the simplest way to manage context window overflow?</summary>
<p>A sliding window — keep recent messages verbatim and summarize older ones with a cheap model. This preserves recent context while staying within token limits.</p>
</details>
</div>

**Related:** [Pydantic for Agents](/docs/agentic-ai/pydantic-for-agents) · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)

Next: [Loop Engineering →](/docs/agentic-ai/loop-engineering)
