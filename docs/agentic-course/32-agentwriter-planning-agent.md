---
id: 32-agentwriter-planning-agent
title: "AgentWriter AI: Planner, Fan-Out Workers and a Subgraph"
sidebar_position: 32
description: "AgentWriter capstone: a router decides if research is needed, an orchestrator plans sections as structured output, Send fans out one worker per section, and a reducer subgraph merges the post."
tags: [Agentic AI, LangGraph, Multi-Agent]
---

# AgentWriter AI: Planner, Fan-Out Workers and a Subgraph

<div class="tldr">
<strong>TL;DR</strong>

- A **planning agent** does not answer straight away. It produces a structured plan first, then executes it. Here the plan is a list of blog sections, each with a goal and bullet points.
- LangGraph's `Send` turns that list into **N parallel workers**, one per section. The count is decided at runtime by the plan, not hardcoded.
- A **router** decides whether web research is needed before planning, and the final merge step is a **subgraph** that combines sections and places images.
</div>

The earlier capstones ran a fixed number of agents in a fixed order. AgentWriter AI is the first build in the course where the number of agents is decided by the model at runtime and they run concurrently. The lesson is the orchestrator-worker pattern in LangGraph plus two refinements the instructor adds step by step: an evidence-gathering router in front, and a subgraph at the back. It also contains the clearest demonstration in the course of how much output quality depends on the metadata you ask the planner for.

## The workflow, built in four notebooks

The instructor grows the graph incrementally, and the order is instructive:

1. **Orchestrator, workers, reducer.** Topic in, plan out, one worker per section, merge to markdown.
2. **Same graph, richer schema and prompts.** The plan now carries audience, tone, per-section goals, bullet points and target word counts. Same topic, visibly better blog.
3. **Router and research in front.** A router classifies the topic as closed-book, hybrid or open-book and decides `need_research`. If true, a research node generates search queries, runs them through Tavily, and packs the results as evidence for the planner.
4. **Reducer becomes a subgraph.** Merge, decide which images the post needs, generate and place them. The subgraph is compiled on its own and added to the main graph as the reducer node.

```
topic
  │
  ▼
router ── need_research? ──┬── no ──────────────────────┐
                           │                            ▼
                           └── yes ──▶ research ──▶ orchestrator (Plan)
                                        (Tavily,          │
                                         EvidencePack)    │ Send() per task
                                                          ▼
                                     worker_1  worker_2 ... worker_N   (parallel)
                                          └──────┬────────┘
                                                 ▼   sections: Annotated[list, operator.add]
                                        reducer SUBGRAPH
                                        merge ─▶ decide_images ─▶ generate_and_place
                                                 │
                                                 ▼
                                            final markdown
```

## The plan is a Pydantic object, and its fields are the quality lever

The orchestrator calls the LLM with `with_structured_output(Plan)`. Version one of `Plan` had a title and a list of tasks with an id, title and brief. Version two added `audience`, `tone`, and per-task `goal`, `bullets` (three to five non-overlapping sub-points), `target_words` and `section_type`. Nothing else in the graph changed, and the generated post went from thin paragraphs to sectioned, bulleted, code-bearing content. The metadata you demand from the planner is what the workers get to write from.

## Fan-out with Send

The orchestrator returns the plan into state. A routing function then reads `state["plan"].tasks` and returns one `Send("worker", payload)` per task. LangGraph runs each as a separate invocation of the `worker` node with its own payload, in parallel. Workers return `{"sections": [markdown]}`; because `sections` is declared with `operator.add`, the results accumulate instead of overwriting. The reducer node then sees all of them.

## The router and the evidence pack

The router prompt is a classifier: return `need_research`, `mode` (closed_book, hybrid, open_book) and `queries`. A conditional edge sends the topic straight to the orchestrator when research is not needed. When it is, the research node runs each query through Tavily, keeps title, URL, snippet, published date and source, and returns an `EvidencePack`. The orchestrator and workers both receive that pack, which is why the finished post carries source links.

## Code that matters

Schemas and graph wiring are close to what the video shows; node bodies are sketches.

```python
import operator
from typing import Annotated, TypedDict
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send


class Task(BaseModel):
    id: int
    title: str
    goal: str
    bullets: list[str] = Field(description="3-5 concrete non-overlapping sub-points")
    target_words: int


class Plan(BaseModel):
    blog_title: str
    audience: str
    tone: str
    tasks: list[Task]


class RouterDecision(BaseModel):
    need_research: bool
    queries: list[str]


class State(TypedDict):
    topic: str
    need_research: bool
    queries: list[str]
    evidence: dict
    plan: Plan
    sections: Annotated[list[str], operator.add]
    final: str


def router(state: State) -> dict:
    d = llm.with_structured_output(RouterDecision).invoke(ROUTER_PROMPT + state["topic"])
    return {"need_research": d.need_research, "queries": d.queries}


def router_next(state: State) -> str:
    return "research" if state["need_research"] else "orchestrator"


def orchestrator(state: State) -> dict:
    plan = llm.with_structured_output(Plan).invoke(PLANNER_PROMPT + state["topic"])
    return {"plan": plan}


def fan_out(state: State) -> list[Send]:
    # one worker per planned section, decided at runtime
    return [Send("worker", {"task": t, "topic": state["topic"],
                            "plan": state["plan"], "evidence": state.get("evidence")})
            for t in state["plan"].tasks]


def worker(payload: dict) -> dict:
    md = llm.invoke(WORKER_PROMPT.format(**payload)).content     # sketch
    return {"sections": [md]}


def build_reducer_subgraph():
    sg = StateGraph(State)
    sg.add_node("merge", merge_content)                 # sketch
    sg.add_node("decide_images", decide_images)         # sketch
    sg.add_node("place_images", generate_and_place)     # sketch
    sg.add_edge(START, "merge")
    sg.add_edge("merge", "decide_images")
    sg.add_edge("decide_images", "place_images")
    sg.add_edge("place_images", END)
    return sg.compile()


g = StateGraph(State)
g.add_node("router", router)
g.add_node("research", research)                        # sketch: Tavily per query
g.add_node("orchestrator", orchestrator)
g.add_node("worker", worker)
g.add_node("reducer", build_reducer_subgraph())         # a compiled graph as a node
g.add_edge(START, "router")
g.add_conditional_edges("router", router_next, {"research": "research",
                                                "orchestrator": "orchestrator"})
g.add_edge("research", "orchestrator")
g.add_conditional_edges("orchestrator", fan_out, ["worker"])
g.add_edge("worker", "reducer")
g.add_edge("reducer", END)
app = g.compile(checkpointer=checkpointer)
```

## Failure modes and gotchas

- **Token limits on free LLM tiers.** Adding the evidence pack to prompts made inputs large enough that the free hosted model started rejecting calls. The instructor swapped to a local Llama 3.1 8B via Ollama to finish the demo, and was explicit that the local model writes noticeably weaker sections. Budget for a paid model if the output matters.
- **Free image-generation quotas.** The image step is wired to Gemini's image model, which stopped after a handful of images on the free tier. The subgraph is written so that a failed image call does not fail the post; the placeholder is simply left out.
- **Local models cannot be deployed as-is.** Ollama runs on the developer's machine; before deploying, swap the model binding back to a hosted provider. The FastAPI layer, which streams progress over server-sent events, also needed an Ollama restart and a certificate bundle fix on Windows before it ran.

## Takeaways

- Planning agent means: plan as data first, execute second. The plan schema is where quality is decided.
- `Send` is how a graph spawns a runtime-determined number of parallel workers; `operator.add` is how their outputs come back together.
- Route research conditionally. Evergreen topics do not need web search; recency-dependent ones do, and the evidence should flow to both planner and writers.
- Worth remembering: when a node grows its own multi-step pipeline (here: merge, decide images, place images), make it a subgraph and mount the compiled graph as a node. Free tiers shaped parts of this design (small local model, capped images); note that before copying it.

## Test yourself

<details>
<summary>How does the graph know how many worker agents to run?</summary>
<p>It does not know in advance. After the orchestrator writes a <code>Plan</code> into state, a routing function returns one <code>Send("worker", payload)</code> per task in <code>plan.tasks</code>. LangGraph runs that many worker invocations in parallel.</p>
</details>

<details>
<summary>What changed between the first and second notebook, and why did the output improve so much?</summary>
<p>Only the schema and prompts changed. The <code>Plan</code> gained audience and tone, and each <code>Task</code> gained a goal, three to five bullets, a target word count and a section type. Workers wrote from that richer brief, so sections became structured and detailed.</p>
</details>

<details>
<summary>What is the reducer subgraph and why is it a subgraph?</summary>
<p>It is a small compiled graph with three nodes: merge sections, decide which images are needed, generate and place them. It is mounted on the main graph as the <code>reducer</code> node so the main graph stays readable and the image pipeline can be developed and tested on its own.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/izqlwiGMys4"
    title="Build AgentWriter AI: Real-Time Multi-Agent Blog Writing Platform with LangGraph, SubGraph & FastAPI"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [Build AgentWriter AI: Real-Time Multi-Agent Blog Writing Platform with LangGraph, SubGraph & FastAPI](https://www.youtube.com/watch?v=izqlwiGMys4).

**Related:** [LangGraph Subgraphs](/docs/agentic-ai/langgraph-subgraphs) · [Pydantic for Agents](/docs/agentic-ai/pydantic-for-agents) · [Glossary](/docs/glossary)
