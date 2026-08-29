---
id: langgraph-workflows
title: "LangGraph Workflows"
sidebar_position: 3
description: The four workflow patterns in LangGraph — sequential, parallel, conditional, and iterative — with complete code examples for each. Every agent is a combination of these four patterns.
tags: [Agentic AI, LangGraph, Workflows]
---

# LangGraph Workflows

<div class="tldr">
<strong>TL;DR</strong>

- **Sequential** — nodes run one after another: A then B then C then END.
- **Parallel** — fan-out from one node to many, fan-in to collect results.
- **Conditional** — `add_conditional_edges` routes to different nodes based on state.
- **Iterative** — a node edges back to itself or an earlier node, creating a loop with a break condition.
</div>

Every LangGraph agent — no matter how complex — is built from just four workflow patterns.
Understanding these patterns means you can look at any graph and immediately see what it does.
The trick is knowing which pattern to reach for and how to combine them.
One submodule per idea, ending with a cheat sheet.

## The building blocks

Before the patterns, a quick reminder of the LangGraph API:

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

# 1. Define state — a TypedDict or Pydantic model
class MyState(TypedDict):
    value: str
    count: int

# 2. Define nodes — plain functions that receive and return state
def my_node(state: MyState) -> dict:
    return {"value": state["value"].upper()}  # partial update

# 3. Build the graph
builder = StateGraph(MyState)
builder.add_node("my_node", my_node)
builder.add_edge(START, "my_node")
builder.add_edge("my_node", END)

# 4. Compile and run
graph = builder.compile()
result = graph.invoke({"value": "hello", "count": 0})
```

Every pattern below uses this same API — the difference is how you wire the edges.

## Pattern 1: Sequential

The simplest pattern. Nodes execute one after another in a fixed order. Use this for
linear pipelines — data processing, multi-step transforms, or a straightforward
retrieve-then-generate RAG chain.

```
START → gather_data → analyze → format_output → END
```

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class PipelineState(TypedDict):
    raw_text: str
    analysis: str
    report: str

def gather_data(state: PipelineState) -> dict:
    # Step 1: fetch or clean raw data
    cleaned = state["raw_text"].strip().lower()
    return {"raw_text": cleaned}

def analyze(state: PipelineState) -> dict:
    # Step 2: run analysis on cleaned data
    word_count = len(state["raw_text"].split())
    return {"analysis": f"Word count: {word_count}. Text is {'short' if word_count < 50 else 'long'}."}

def format_output(state: PipelineState) -> dict:
    # Step 3: produce final report
    return {"report": f"Report:\n- Input: {state['raw_text'][:50]}...\n- {state['analysis']}"}

builder = StateGraph(PipelineState)
builder.add_node("gather_data", gather_data)
builder.add_node("analyze", analyze)
builder.add_node("format_output", format_output)

# Sequential edges — each node feeds the next
builder.add_edge(START, "gather_data")
builder.add_edge("gather_data", "analyze")
builder.add_edge("analyze", "format_output")
builder.add_edge("format_output", END)

graph = builder.compile()
result = graph.invoke({"raw_text": "  LangGraph makes building agents easy.  ", "analysis": "", "report": ""})
print(result["report"])
```

Sequential is the default you should start with. Only add complexity when the problem
requires it.

## Pattern 2: Parallel (fan-out / fan-in)

Multiple nodes run at the same time, then their results merge into a single node. Use this
when you have independent tasks — searching multiple sources, running different analyses on
the same data, or calling multiple LLMs for consensus.

```
                ┌─→ search_web ──────┐
START → prepare ├─→ search_arxiv ────┼─→ combine → END
                └─→ search_wikipedia ┘
```

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from operator import add
from typing import Annotated

class ParallelState(TypedDict):
    query: str
    results: Annotated[list[str], add]  # "add" reducer — lists from parallel nodes get concatenated

def prepare(state: ParallelState) -> dict:
    return {"query": state["query"].strip()}

def search_web(state: ParallelState) -> dict:
    return {"results": [f"Web result for: {state['query']}"]}

def search_arxiv(state: ParallelState) -> dict:
    return {"results": [f"Arxiv result for: {state['query']}"]}

def search_wikipedia(state: ParallelState) -> dict:
    return {"results": [f"Wikipedia result for: {state['query']}"]}

def combine(state: ParallelState) -> dict:
    summary = "Combined results:\n" + "\n".join(f"- {r}" for r in state["results"])
    return {"results": [summary]}

builder = StateGraph(ParallelState)
builder.add_node("prepare", prepare)
builder.add_node("search_web", search_web)
builder.add_node("search_arxiv", search_arxiv)
builder.add_node("search_wikipedia", search_wikipedia)
builder.add_node("combine", combine)

# Fan-out: prepare → three parallel nodes
builder.add_edge(START, "prepare")
builder.add_edge("prepare", "search_web")
builder.add_edge("prepare", "search_arxiv")
builder.add_edge("prepare", "search_wikipedia")

# Fan-in: all three → combine
builder.add_edge("search_web", "combine")
builder.add_edge("search_arxiv", "combine")
builder.add_edge("search_wikipedia", "combine")
builder.add_edge("combine", END)

graph = builder.compile()
result = graph.invoke({"query": "transformer architecture", "results": []})
```

The **`Annotated[list[str], add]`** reducer is critical — without it, the last parallel node
to finish would overwrite the others. The `add` reducer concatenates lists from all branches.

## Pattern 3: Conditional

A routing function inspects the state and returns the name of the next node. This is your
if/else — the agent decides which path to take at runtime.

```
              ┌─→ handle_simple → END
START → route ┤
              └─→ handle_complex → review → END
```

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class TicketState(TypedDict):
    question: str
    complexity: str
    answer: str

def route(state: TicketState) -> dict:
    # Classify the question
    is_complex = len(state["question"].split()) > 10 or "?" in state["question"]
    return {"complexity": "complex" if is_complex else "simple"}

def handle_simple(state: TicketState) -> dict:
    return {"answer": f"Quick answer: Here's a short response to '{state['question']}'"}

def handle_complex(state: TicketState) -> dict:
    return {"answer": f"Detailed analysis of '{state['question']}'... (multi-paragraph response)"}

def review(state: TicketState) -> dict:
    return {"answer": state["answer"] + "\n[Reviewed by senior agent]"}

# The routing function — returns the next node name
def decide_path(state: TicketState) -> str:
    if state["complexity"] == "simple":
        return "handle_simple"
    return "handle_complex"

builder = StateGraph(TicketState)
builder.add_node("route", route)
builder.add_node("handle_simple", handle_simple)
builder.add_node("handle_complex", handle_complex)
builder.add_node("review", review)

builder.add_edge(START, "route")

# Conditional edge — decide_path returns "handle_simple" or "handle_complex"
builder.add_conditional_edges("route", decide_path, {
    "handle_simple": "handle_simple",
    "handle_complex": "handle_complex",
})

builder.add_edge("handle_simple", END)
builder.add_edge("handle_complex", "review")
builder.add_edge("review", END)

graph = builder.compile()

# Simple question → fast path
result = graph.invoke({"question": "Hi", "complexity": "", "answer": ""})
print(result["answer"])  # Quick answer: ...

# Complex question → detailed path + review
result = graph.invoke({"question": "Can you explain how attention mechanisms work in transformers?", "complexity": "", "answer": ""})
print(result["answer"])  # Detailed analysis... [Reviewed by senior agent]
```

The `add_conditional_edges` call takes: the source node, a routing function, and a mapping
from return values to node names. The routing function can use LLM calls, rule-based logic,
or anything else — it just returns a string.

## Pattern 4: Iterative (loops)

A node conditionally edges back to itself or an earlier node, creating a loop. This is the
**agent loop** — the core of ReAct. The key: always include a break condition so it doesn't
loop forever.

```
START → draft → evaluate ──┐
                  ↑         │ (not good enough)
                  └─────────┘
                  │ (good enough)
                  ↓
                 END
```

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class WriterState(TypedDict):
    topic: str
    draft: str
    feedback: str
    iteration: int
    is_approved: bool

def draft(state: WriterState) -> dict:
    iteration = state.get("iteration", 0) + 1
    if iteration == 1:
        text = f"First draft about {state['topic']}: This is a basic overview..."
    else:
        text = f"Revised draft (v{iteration}) about {state['topic']}: Improved based on feedback: {state.get('feedback', '')}"
    return {"draft": text, "iteration": iteration}

def evaluate(state: WriterState) -> dict:
    # In a real agent, an LLM would judge quality here
    if state["iteration"] >= 3:
        return {"is_approved": True, "feedback": "Looks good after revisions."}
    return {"is_approved": False, "feedback": f"Draft v{state['iteration']} needs more detail and examples."}

# Routing function for the loop
def should_continue(state: WriterState) -> str:
    if state["is_approved"]:
        return "end"
    return "revise"  # loop back

builder = StateGraph(WriterState)
builder.add_node("draft", draft)
builder.add_node("evaluate", evaluate)

builder.add_edge(START, "draft")
builder.add_edge("draft", "evaluate")

# Conditional edge — loop or exit
builder.add_conditional_edges("evaluate", should_continue, {
    "revise": "draft",   # loop back to draft
    "end": END,          # exit
})

graph = builder.compile()
result = graph.invoke({
    "topic": "async programming",
    "draft": "",
    "feedback": "",
    "iteration": 0,
    "is_approved": False,
})
print(f"Final draft (after {result['iteration']} iterations):\n{result['draft']}")
```

The `should_continue` function is the break condition. Common patterns:
- **Counter-based**: stop after N iterations (`state["iteration"] >= max_iter`)
- **Quality-based**: stop when an LLM evaluator says the output is good enough
- **Convergence-based**: stop when the output stops changing between iterations

## Combining patterns

Real agents combine all four. Here's a sketch of an agent that sequentially prepares a query,
conditionally picks a strategy, fans out to multiple tools in parallel, and iteratively
refines the answer:

```
START → prepare → decide_strategy ──┬─→ simple_search → answer → END
                                    │
                                    └─→ deep_research ──┬─→ search_web ──┐
                                                        ├─→ search_db ───┤
                                                        └─→ search_docs ─┘
                                                              ↓
                                                           combine → evaluate ──┐
                                                              ↑                 │ (retry)
                                                              └─────────────────┘
                                                              │ (done)
                                                              ↓
                                                             END
```

This is sequential + conditional + parallel + iterative — all four patterns in one graph.

## Cheat sheet

| Pattern | Edges | Use when |
| --- | --- | --- |
| Sequential | `add_edge(A, B)` | Fixed pipeline, each step depends on the last |
| Parallel | `add_edge(A, B1)`, `add_edge(A, B2)`, fan-in to C | Independent tasks, search multiple sources |
| Conditional | `add_conditional_edges(A, router_fn, {val: node})` | Runtime branching, if/else logic |
| Iterative | Conditional edge back to earlier node | Agent loops, self-refinement, retries |
| Reducer (parallel) | `Annotated[list, add]` in state | Merge results from parallel branches |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **No reducer for parallel state** — without `Annotated[list, add]`, the last branch to finish overwrites earlier results. Always use a reducer for fan-in fields.
- **Infinite loops** — every iterative pattern needs a break condition. Add a counter, a quality check, or both.
- **Overcomplicating with conditional edges** — if you only have two paths and one is rare, a simple `if` inside a single node is often clearer than a conditional edge.
- **Forgetting that parallel nodes share state** — they all read the same state snapshot from before the fan-out. They can't see each other's writes until fan-in.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What are the four LangGraph workflow patterns?</summary>
<p>Sequential (A → B → C), Parallel (fan-out/fan-in), Conditional (routing based on state), and Iterative (loops with a break condition).</p>
</details>

<details>
<summary>How do you merge results from parallel nodes?</summary>
<p>Use a reducer in the state definition — <code>Annotated[list[str], add]</code> concatenates lists from all parallel branches automatically.</p>
</details>

<details>
<summary>What does the routing function in <code>add_conditional_edges</code> return?</summary>
<p>A string — the name of the next node to execute. The mapping dict translates these strings to actual node names.</p>
</details>

<details>
<summary>How do you prevent infinite loops in the iterative pattern?</summary>
<p>Add a break condition in the routing function — a counter limit, a quality threshold, or a convergence check that returns END instead of looping back.</p>
</details>
</div>

**Related:** [LangGraph Basics](/docs/rag-course/14-langgraph-basics) · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)

Next: [LangGraph Subgraphs →](/docs/agentic-ai/langgraph-subgraphs)
