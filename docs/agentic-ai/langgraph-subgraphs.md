---
id: langgraph-subgraphs
title: "LangGraph Subgraphs"
sidebar_position: 4
description: Subgraphs compose multiple LangGraph graphs into one — each subgraph is an independent agent that becomes a node in a parent graph, enabling modularity, team boundaries, and the supervisor pattern.
tags: [Agentic AI, LangGraph, Multi-Agent]
---

# LangGraph Subgraphs

<div class="tldr">
<strong>TL;DR</strong>

- **Subgraphs** let you compile a `StateGraph` and drop it into a parent graph as a single node — each subgraph is an independent agent.
- **State mapping** controls what the parent passes in and what it gets back — subgraphs don't need to share the parent's full schema.
- The **supervisor pattern** uses a parent graph that routes tasks to specialist subgraphs and merges their results.
</div>

Once your agent has more than a few responsibilities, a single flat graph becomes hard to
reason about. Subgraphs solve this — each specialist is its own compiled graph, and the parent
graph orchestrates them like function calls. You get modularity, testability, and clean team
boundaries — one team owns the researcher, another owns the writer, and the parent ties them
together.
One submodule per idea, ending with a cheat sheet.

## Why subgraphs

A flat graph with 15 nodes and 20 edges is unreadable. Subgraphs give you:

- **Modularity** — build, test, and iterate on each agent independently.
- **Team boundaries** — one team owns the research agent, another owns the writing agent. They agree on input/output schemas and work in parallel.
- **Reuse** — the same subgraph can appear in multiple parent graphs without copy-pasting nodes.
- **Encapsulation** — a subgraph's internal state stays internal. The parent only sees what you explicitly map out.

Think of it like functions in programming — each subgraph has a clear interface (input state → output state) and hides its implementation.

## Creating a subgraph

A subgraph is just a regular `StateGraph` that you compile. The compiled graph object is then
added as a node in a parent graph.

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

# ── Researcher subgraph ──────────────────────────────────
class ResearchState(TypedDict):
    topic: str
    sources: list[str]
    findings: str

def search_sources(state: ResearchState) -> dict:
    # Simulate searching multiple sources
    sources = [
        f"Paper on {state['topic']} from arxiv",
        f"Blog post about {state['topic']} from medium",
        f"Documentation on {state['topic']}",
    ]
    return {"sources": sources}

def synthesize_findings(state: ResearchState) -> dict:
    summary = f"Key findings on '{state['topic']}':\n"
    summary += "\n".join(f"- From {s}" for s in state["sources"])
    return {"findings": summary}

# Build and compile the researcher as a standalone graph
researcher_builder = StateGraph(ResearchState)
researcher_builder.add_node("search", search_sources)
researcher_builder.add_node("synthesize", synthesize_findings)
researcher_builder.add_edge(START, "search")
researcher_builder.add_edge("search", "synthesize")
researcher_builder.add_edge("synthesize", END)

researcher_graph = researcher_builder.compile()  # this is the subgraph

# You can test it independently
result = researcher_graph.invoke({"topic": "LangGraph subgraphs", "sources": [], "findings": ""})
print(result["findings"])
```

The compiled `researcher_graph` works on its own — you can invoke it, stream it, test it.
That same object now becomes a node in a parent graph.

## Adding a subgraph as a node

Drop a compiled graph into a parent graph with `add_node`. LangGraph treats it like any other
node — it receives state, runs its internal graph, and returns updated state.

```python
# ── Writer subgraph ──────────────────────────────────────
class WriterState(TypedDict):
    findings: str
    draft: str

def write_draft(state: WriterState) -> dict:
    draft = f"Article draft based on research:\n\n{state['findings']}\n\n"
    draft += "This comprehensive analysis shows that..."
    return {"draft": draft}

def polish_draft(state: WriterState) -> dict:
    polished = state["draft"] + "\n\n[Edited for clarity and flow]"
    return {"draft": polished}

writer_builder = StateGraph(WriterState)
writer_builder.add_node("write", write_draft)
writer_builder.add_node("polish", polish_draft)
writer_builder.add_edge(START, "write")
writer_builder.add_edge("write", "polish")
writer_builder.add_edge("polish", END)

writer_graph = writer_builder.compile()
```

Now wire them into a parent graph:

```python
# ── Parent graph — orchestrates researcher + writer ──────
class ParentState(TypedDict):
    topic: str
    sources: list[str]
    findings: str
    draft: str

parent_builder = StateGraph(ParentState)

# Add compiled subgraphs as nodes
parent_builder.add_node("researcher", researcher_graph)
parent_builder.add_node("writer", writer_graph)

parent_builder.add_edge(START, "researcher")
parent_builder.add_edge("researcher", "writer")
parent_builder.add_edge("writer", END)

parent_graph = parent_builder.compile()

# Run the full pipeline
result = parent_graph.invoke({
    "topic": "multi-agent systems",
    "sources": [],
    "findings": "",
    "draft": "",
})
print(result["draft"])
```

The parent passes its state to each subgraph. The subgraph reads the fields it knows about,
runs its internal nodes, and returns updated fields back to the parent.

## State passing between parent and child

The parent and subgraph don't need identical state schemas. LangGraph passes **overlapping
fields** — fields that exist in both schemas flow naturally.

```python
# Parent has: topic, sources, findings, draft, metadata
# Researcher has: topic, sources, findings
# Writer has: findings, draft

# What happens:
# 1. Parent passes {topic, sources, findings} to researcher (overlapping fields)
# 2. Researcher returns updated {sources, findings}
# 3. Parent passes {findings, draft} to writer (overlapping fields)
# 4. Writer returns updated {draft}
```

If you need explicit control — say the parent calls a field `research_output` but the
subgraph expects `findings` — you wrap the subgraph in a regular function node that maps
the fields:

```python
def call_researcher(state: ParentState) -> dict:
    """Adapter that maps parent state to researcher state and back."""
    research_input = {
        "topic": state["topic"],
        "sources": [],
        "findings": "",
    }
    result = researcher_graph.invoke(research_input)
    return {"research_output": result["findings"]}  # map back to parent's field name

parent_builder.add_node("researcher", call_researcher)  # function node, not subgraph
```

This adapter pattern is the cleanest way to handle mismatched schemas.

## The supervisor pattern

The most common multi-agent architecture: a **supervisor** agent decides which specialist to
call, delegates the task, reviews the result, and either routes to another specialist or
finishes.

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Literal

class SupervisorState(TypedDict):
    task: str
    sources: list[str]
    findings: str
    draft: str
    review_notes: str
    next_step: str

def supervisor_decide(state: SupervisorState) -> dict:
    """The supervisor looks at current state and decides what to do next."""
    if not state.get("findings"):
        return {"next_step": "research"}
    elif not state.get("draft"):
        return {"next_step": "write"}
    elif not state.get("review_notes"):
        return {"next_step": "review"}
    else:
        return {"next_step": "done"}

def review_output(state: SupervisorState) -> dict:
    """Supervisor reviews the draft and adds notes."""
    notes = f"Review of draft: looks good. Findings covered {len(state['sources'])} sources."
    return {"review_notes": notes}

def route_next(state: SupervisorState) -> str:
    return state["next_step"]

# Build the supervisor graph
supervisor_builder = StateGraph(SupervisorState)

supervisor_builder.add_node("supervisor", supervisor_decide)
supervisor_builder.add_node("researcher", researcher_graph)  # subgraph
supervisor_builder.add_node("writer", writer_graph)           # subgraph
supervisor_builder.add_node("reviewer", review_output)

supervisor_builder.add_edge(START, "supervisor")

# Conditional routing from supervisor to specialists
supervisor_builder.add_conditional_edges("supervisor", route_next, {
    "research": "researcher",
    "write": "writer",
    "review": "reviewer",
    "done": END,
})

# After each specialist, go back to supervisor for next decision
supervisor_builder.add_edge("researcher", "supervisor")
supervisor_builder.add_edge("writer", "supervisor")
supervisor_builder.add_edge("reviewer", "supervisor")

supervisor_graph = supervisor_builder.compile()

result = supervisor_graph.invoke({
    "task": "Write a blog post about async Python",
    "sources": [],
    "findings": "",
    "draft": "",
    "review_notes": "",
    "next_step": "",
})
print(result["draft"])
print(result["review_notes"])
```

The supervisor pattern is powerful because the routing logic can be an LLM call — the
supervisor *reasons* about which specialist to call next based on the current state.

## Nested subgraphs

Subgraphs can contain subgraphs. The researcher might internally use a "search" subgraph
and a "summarize" subgraph:

```python
# search_graph = compiled StateGraph for searching
# summarize_graph = compiled StateGraph for summarizing

researcher_builder = StateGraph(ResearchState)
researcher_builder.add_node("search", search_graph)       # subgraph inside subgraph
researcher_builder.add_node("summarize", summarize_graph)  # another nested subgraph
researcher_builder.add_edge(START, "search")
researcher_builder.add_edge("search", "summarize")
researcher_builder.add_edge("summarize", END)

researcher_graph = researcher_builder.compile()

# This researcher_graph can still be used as a node in the parent
parent_builder.add_node("researcher", researcher_graph)
```

There's no depth limit, but keep it reasonable — two or three levels is usually enough.
Deeper nesting makes debugging harder.

## Cheat sheet

| Task | Code |
| --- | --- |
| Create subgraph | `sub = StateGraph(SubState)` → add nodes/edges → `sub.compile()` |
| Add subgraph as node | `parent.add_node("name", compiled_subgraph)` |
| State mapping (auto) | Overlapping field names pass automatically |
| State mapping (manual) | Wrap subgraph in a function node that maps fields |
| Supervisor routing | `add_conditional_edges("supervisor", route_fn, {...})` |
| Specialist → supervisor | `add_edge("specialist", "supervisor")` for each |
| Nested subgraphs | Add a compiled graph as a node inside another subgraph |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- **State schema mismatch** — if the parent and subgraph share no field names, nothing flows between them. Either align field names or use an adapter function.
- **Forgetting to compile** — you must call `.compile()` on the subgraph before adding it as a node. An uncompiled `StateGraph` is a builder, not a runnable.
- **Circular supervisor without a stop condition** — the supervisor routes to specialists who route back to the supervisor. Without a "done" path to END, the graph loops forever. Always include a termination condition.
- **Over-nesting** — three levels of subgraphs deep makes tracing and debugging painful. Flatten when you can.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What is a subgraph in LangGraph?</summary>
<p>A compiled StateGraph that is added as a node inside a parent graph. It runs its own internal nodes and edges but appears as a single step in the parent.</p>
</details>

<details>
<summary>How does state pass between a parent graph and a subgraph?</summary>
<p>Fields with the same name in both schemas pass automatically. For mismatched names, wrap the subgraph in an adapter function that maps fields explicitly.</p>
</details>

<details>
<summary>What is the supervisor pattern?</summary>
<p>A parent graph where a supervisor node decides which specialist subgraph to call next, delegates the task, reviews the result, and routes again — looping until done.</p>
</details>

<details>
<summary>Can subgraphs contain other subgraphs?</summary>
<p>Yes — a compiled subgraph can be added as a node inside another subgraph. There's no depth limit, but keep nesting shallow for debuggability.</p>
</details>
</div>

**Related:** [LangGraph Workflows](/docs/agentic-ai/langgraph-workflows) · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)

Next: Agent Persistence — _coming soon._
