---
id: loop-engineering
title: "Loop Engineering"
sidebar_position: 8
description: Building agents that think, check, and retry — self-reflection loops, Pydantic validation loops, human-in-the-loop, escalation loops, and max-iteration guards, all wired with LangGraph conditional edges.
tags: [Agentic AI, Loops, Self-Correction]
---

# Loop Engineering

<div class="tldr">
<strong>TL;DR</strong>

- **Loops** are the difference between a chatbot and an agent — the agent can check its own work and retry if it's wrong.
- Four loop types: **self-reflection** (LLM judges itself), **validation** (Pydantic/code checks), **human-in-the-loop** (a person approves), and **escalation** (hand off when stuck).
- Always add a **max-iteration guard** — without one, a broken loop runs forever and burns your API budget.
</div>

A single LLM call is a guess. A loop turns that guess into a reliable result — the agent
generates, checks, and retries until the output meets a quality bar. This is the core
engineering pattern behind self-correcting code generators, data extraction pipelines, and
any agent that needs to get things right, not just get things fast.
One submodule per idea, ending with a cheat sheet.

## Why loops matter

Without a loop, an agent that generates bad output just... returns bad output. The user
sees it and asks again. With a loop, the agent catches its own mistakes:

```
No loop:    User → Agent → bad output → user complains → agent tries again
With loop:  User → Agent → bad output → agent checks → agent retries → good output → user
```

The loop moves quality assurance from the user to the agent. It costs more tokens, but
the output is dramatically better — especially for structured tasks like code generation,
data extraction, and report writing.

## The think → act → check → retry pattern

Every agent loop follows the same skeleton:

```
START → think → act → check ──┐
                    ↑          │ (failed check)
                    └──────────┘
                    │ (passed check)
                    ↓
                   END
```

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class LoopState(TypedDict):
    task: str
    output: str
    feedback: str
    attempt: int
    passed: bool

def think(state: LoopState) -> dict:
    """Plan the approach based on the task and any previous feedback."""
    if state.get("feedback"):
        plan = f"Retrying '{state['task']}' — previous feedback: {state['feedback']}"
    else:
        plan = f"First attempt at '{state['task']}'"
    return {"output": plan}

def act(state: LoopState) -> dict:
    """Execute the plan and produce output."""
    output = f"Generated output for: {state['task']} (attempt {state['attempt'] + 1})"
    return {"output": output, "attempt": state["attempt"] + 1}

def check(state: LoopState) -> dict:
    """Evaluate the output quality."""
    # In production, this would be an LLM call or code execution
    if state["attempt"] >= 3:
        return {"passed": True, "feedback": "Approved after revisions."}
    return {"passed": False, "feedback": "Needs more detail and examples."}

def should_retry(state: LoopState) -> str:
    if state["passed"]:
        return "done"
    return "retry"

builder = StateGraph(LoopState)
builder.add_node("think", think)
builder.add_node("act", act)
builder.add_node("check", check)

builder.add_edge(START, "think")
builder.add_edge("think", "act")
builder.add_edge("act", "check")

builder.add_conditional_edges("check", should_retry, {
    "retry": "think",  # loop back
    "done": END,
})

loop_graph = builder.compile()
result = loop_graph.invoke({
    "task": "Write a function to merge two sorted lists",
    "output": "",
    "feedback": "",
    "attempt": 0,
    "passed": False,
})
print(f"Finished in {result['attempt']} attempts")
```

## Self-reflection loops

The most common agent loop — the LLM generates output, then a second LLM call (or the same
one) judges whether it's good enough.

```python
from langchain.chat_models import init_chat_model
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

llm = init_chat_model("openai:gpt-4o")

class QualityCheck(BaseModel):
    """LLM's self-assessment of its own output."""
    is_good: bool = Field(description="Whether the output meets quality standards")
    issues: list[str] = Field(default_factory=list, description="List of specific issues found")
    suggestions: list[str] = Field(default_factory=list, description="How to improve")

class CodeGenState(TypedDict):
    task: str
    code: str
    review: str
    attempt: int
    max_attempts: int
    approved: bool

def generate_code(state: CodeGenState) -> dict:
    """Generate or revise code based on the task and any review feedback."""
    prompt = f"Write Python code for: {state['task']}"
    if state.get("review"):
        prompt += f"\n\nPrevious attempt had these issues:\n{state['review']}"
        prompt += "\n\nFix these issues and return the improved code."

    response = llm.invoke(prompt)
    return {"code": response.content, "attempt": state["attempt"] + 1}

def review_code(state: CodeGenState) -> dict:
    """LLM reviews its own generated code."""
    review_prompt = (
        f"Review this Python code for correctness, edge cases, and readability.\n\n"
        f"Task: {state['task']}\n\n"
        f"Code:\n{state['code']}\n\n"
        f"Be critical. List any bugs, missing edge cases, or style issues."
    )

    checker = llm.with_structured_output(QualityCheck)
    result = checker.invoke(review_prompt)

    if result.is_good:
        return {"approved": True, "review": "Code passes review."}

    review_text = "Issues:\n" + "\n".join(f"- {i}" for i in result.issues)
    review_text += "\nSuggestions:\n" + "\n".join(f"- {s}" for s in result.suggestions)
    return {"approved": False, "review": review_text}

def should_continue(state: CodeGenState) -> str:
    if state["approved"]:
        return "done"
    if state["attempt"] >= state["max_attempts"]:
        return "done"  # give up — don't loop forever
    return "retry"

builder = StateGraph(CodeGenState)
builder.add_node("generate", generate_code)
builder.add_node("review", review_code)

builder.add_edge(START, "generate")
builder.add_edge("generate", "review")
builder.add_conditional_edges("review", should_continue, {
    "retry": "generate",
    "done": END,
})

code_gen = builder.compile()

result = code_gen.invoke({
    "task": "merge two sorted lists into one sorted list",
    "code": "",
    "review": "",
    "attempt": 0,
    "max_attempts": 3,
    "approved": False,
})
print(f"Code (attempt {result['attempt']}, approved={result['approved']}):")
print(result["code"])
```

The self-reflection loop works because the reviewer prompt is different from the generator
prompt — it explicitly asks for criticism, which the model is good at.

## Validation loops with Pydantic

For structured output, you don't need an LLM to check — Pydantic validates automatically.
If the output doesn't match the schema, feed the validation error back and retry.

```python
from pydantic import BaseModel, Field, field_validator, ValidationError
from langchain.chat_models import init_chat_model

class ExtractedData(BaseModel):
    """Structured data extracted from customer text."""
    customer_name: str = Field(min_length=2, description="Customer's full name")
    email: str = Field(description="Customer's email address")
    order_id: str = Field(pattern=r"^ORD-\d{6}$", description="Order ID in format ORD-XXXXXX")
    issue_type: str = Field(description="One of: shipping, billing, product, other")

    @field_validator("issue_type")
    @classmethod
    def validate_issue_type(cls, v):
        allowed = {"shipping", "billing", "product", "other"}
        if v.lower() not in allowed:
            raise ValueError(f"Must be one of {allowed}, got '{v}'")
        return v.lower()

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError(f"Invalid email format: '{v}'")
        return v.lower()

def extract_with_validation(text: str, max_retries: int = 3) -> ExtractedData:
    """Extract structured data with automatic retry on validation failure."""
    llm = init_chat_model("openai:gpt-4o")
    messages = [
        ("system", "Extract customer information from the message. Follow the schema exactly."),
        ("user", text),
    ]

    for attempt in range(max_retries):
        try:
            structured_llm = llm.with_structured_output(ExtractedData)
            result = structured_llm.invoke(messages)
            return result  # validation passed

        except ValidationError as e:
            # Feed the exact error back to the model
            error_msg = f"Your response failed validation:\n{e}\n\nFix these issues and try again."
            messages.append(("assistant", "I made an error in the extraction."))
            messages.append(("user", error_msg))
            print(f"Attempt {attempt + 1} failed: {e.error_count()} validation errors. Retrying...")

    raise RuntimeError(f"Failed to extract valid data after {max_retries} attempts")

# Usage
result = extract_with_validation(
    "Hi, I'm Jane Smith (jane@example.com). My order ORD-123456 hasn't shipped yet."
)
print(result.model_dump())
# {"customer_name": "Jane Smith", "email": "jane@example.com",
#  "order_id": "ORD-123456", "issue_type": "shipping"}
```

This is powerful because the validation is deterministic — Pydantic catches exactly what's
wrong and the error message tells the model exactly how to fix it.

## Human-in-the-loop

Some actions are too consequential for an agent to do alone — sending emails, deleting data,
spending money. A human-in-the-loop pattern pauses the agent and asks for approval.

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional

class ApprovalState(TypedDict):
    task: str
    proposed_action: str
    human_approved: Optional[bool]
    result: str

def plan_action(state: ApprovalState) -> dict:
    """Agent plans what it wants to do."""
    return {"proposed_action": f"Send email to customer about: {state['task']}"}

def request_approval(state: ApprovalState) -> dict:
    """Pause and ask for human approval."""
    print(f"\n🔔 Agent wants to: {state['proposed_action']}")
    approval = input("Approve? (yes/no): ").strip().lower()
    return {"human_approved": approval == "yes"}

def execute_action(state: ApprovalState) -> dict:
    """Execute the approved action."""
    return {"result": f"Executed: {state['proposed_action']}"}

def skip_action(state: ApprovalState) -> dict:
    """Human rejected — skip the action."""
    return {"result": "Action skipped by human reviewer."}

def route_approval(state: ApprovalState) -> str:
    if state["human_approved"]:
        return "execute"
    return "skip"

builder = StateGraph(ApprovalState)
builder.add_node("plan", plan_action)
builder.add_node("approve", request_approval)
builder.add_node("execute", execute_action)
builder.add_node("skip", skip_action)

builder.add_edge(START, "plan")
builder.add_edge("plan", "approve")
builder.add_conditional_edges("approve", route_approval, {
    "execute": "execute",
    "skip": "skip",
})
builder.add_edge("execute", END)
builder.add_edge("skip", END)

approval_graph = builder.compile()
```

In LangGraph, you can also use the built-in `interrupt` mechanism to pause the graph and
resume it later — useful for web apps where approval happens asynchronously.

## Escalation loops

When the agent tries N times and still can't produce good output, escalate to a different
strategy — a more powerful model, a human, or a graceful error message.

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class EscalationState(TypedDict):
    task: str
    output: str
    attempt: int
    model_tier: str  # "fast", "powerful", "human"
    resolved: bool

def attempt_task(state: EscalationState) -> dict:
    """Try to solve the task with the current model tier."""
    model_map = {
        "fast": "openai:gpt-4o-mini",
        "powerful": "openai:gpt-4o",
    }
    model_name = model_map.get(state["model_tier"], "openai:gpt-4o")
    llm = init_chat_model(model_name)

    response = llm.invoke(f"Solve this task:\n{state['task']}")
    return {"output": response.content, "attempt": state["attempt"] + 1}

def evaluate_and_escalate(state: EscalationState) -> dict:
    """Check output quality and decide whether to escalate."""
    # Simple quality check — in production, use an LLM judge
    if len(state["output"]) > 100:
        return {"resolved": True}

    # Escalation ladder
    if state["model_tier"] == "fast":
        return {"resolved": False, "model_tier": "powerful"}
    elif state["model_tier"] == "powerful":
        return {"resolved": False, "model_tier": "human"}
    else:
        return {"resolved": False}  # already at human tier

def route_escalation(state: EscalationState) -> str:
    if state["resolved"]:
        return "done"
    if state["model_tier"] == "human":
        return "escalate_to_human"
    return "retry"

def handle_human_escalation(state: EscalationState) -> dict:
    return {"output": f"[Escalated to human] Task: {state['task']}"}

builder = StateGraph(EscalationState)
builder.add_node("attempt", attempt_task)
builder.add_node("evaluate", evaluate_and_escalate)
builder.add_node("human", handle_human_escalation)

builder.add_edge(START, "attempt")
builder.add_edge("attempt", "evaluate")
builder.add_conditional_edges("evaluate", route_escalation, {
    "retry": "attempt",
    "escalate_to_human": "human",
    "done": END,
})
builder.add_edge("human", END)

escalation_graph = builder.compile()

result = escalation_graph.invoke({
    "task": "Generate a complex financial report",
    "output": "",
    "attempt": 0,
    "model_tier": "fast",
    "resolved": False,
})
```

The escalation ladder: fast model (cheap) → powerful model (expensive) → human (most
expensive). Most tasks resolve at the first tier; only hard ones escalate.

## Max-iteration guards

Every loop needs a safety valve. Without one, a bug in the check function creates an
infinite loop that burns your API budget.

```python
MAX_ITERATIONS = 5

def should_continue_safe(state: LoopState) -> str:
    """Route with a hard iteration cap."""
    if state["passed"]:
        return "done"
    if state["attempt"] >= MAX_ITERATIONS:
        print(f"⚠ Hit max iterations ({MAX_ITERATIONS}). Returning best effort.")
        return "done"  # force exit
    return "retry"

# You can also use LangGraph's built-in recursion limit
graph = builder.compile()
try:
    result = graph.invoke(
        {"task": "...", "attempt": 0, "passed": False},
        {"recursion_limit": 25},  # hard limit on total graph steps
    )
except Exception as e:
    print(f"Graph hit recursion limit: {e}")
```

Two layers of protection:
1. **State-based counter** — your `should_continue` function checks `state["attempt"]`.
2. **`recursion_limit`** — LangGraph's built-in safeguard on total steps (default is 25).

Use both. The state counter gives you graceful degradation (return best effort). The
recursion limit is the hard crash barrier.

## Cheat sheet

| Loop type | Check method | Use when |
| --- | --- | --- |
| Self-reflection | LLM judges own output | Creative tasks, code gen, reports |
| Validation | Pydantic / code execution | Structured output, data extraction |
| Human-in-the-loop | Person approves | High-stakes actions (email, delete, pay) |
| Escalation | Quality threshold + tier | Cost optimization, graceful degradation |
| Max-iteration | Counter + recursion_limit | Every loop (safety valve) |

| Task | Code |
| --- | --- |
| Conditional retry | `add_conditional_edges("check", route_fn, {"retry": "gen", "done": END})` |
| State counter | `state["attempt"] + 1` in action node |
| Recursion limit | `graph.invoke(input, {"recursion_limit": 25})` |
| Feed error back | Append `ValidationError` to messages, retry |
| Interrupt for human | `interrupt()` in LangGraph node |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **No max-iteration guard** — the most dangerous mistake. A loop without a cap will run forever and cost you hundreds of dollars in API calls before you notice.
- **Same prompt for generation and review** — the generator prompt should create; the reviewer prompt should criticize. Using the same prompt for both just produces the same output.
- **Feeding back raw errors** — "ValidationError at line 42" isn't helpful to the model. Format the error as "Your output had these specific issues: [list]. Fix them." to get better retries.
- **Tight loops without backoff** — retrying immediately after a failure (especially rate limits) makes things worse. Add `time.sleep(2 ** attempt)` for exponential backoff.
- **Over-looping** — if the output is good enough after one attempt, don't waste tokens on unnecessary review cycles. Check quality first, loop only when needed.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What are the four types of agent loops?</summary>
<p>Self-reflection (LLM judges itself), validation (Pydantic/code checks), human-in-the-loop (person approves), and escalation (hand off when stuck).</p>
</details>

<details>
<summary>Why feed validation errors back to the model?</summary>
<p>The error tells the model exactly what's wrong — "field X must be one of {A, B, C}, got 'D'" — so it can fix the specific issue instead of regenerating blindly.</p>
</details>

<details>
<summary>What are the two layers of loop protection?</summary>
<p>A state-based counter in the routing function (graceful degradation) and LangGraph's <code>recursion_limit</code> in the config (hard crash barrier). Use both.</p>
</details>

<details>
<summary>When should you use human-in-the-loop vs self-reflection?</summary>
<p>Human-in-the-loop for high-stakes irreversible actions (sending emails, spending money). Self-reflection for quality improvement on creative or analytical tasks where the agent can judge its own work.</p>
</details>
</div>

**Related:** [Harness Engineering](/docs/agentic-ai/harness-engineering) · [LangGraph Workflows](/docs/agentic-ai/langgraph-workflows) · [Glossary](/docs/glossary)

Next: Evaluation & Tracing — _coming soon._
