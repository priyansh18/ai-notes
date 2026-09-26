---
id: 09-langchain-vs-langgraph
title: "LangChain vs LangGraph"
sidebar_position: 9
description: "Why LangChain's linear chains break down on real agent workflows, the seven gaps LangGraph fills (branching, loops, state, pausing, fault recovery, human-in-the-loop, subgraphs, tracing), and when to use which."
tags: [Agentic AI, LangGraph, LangChain]
---

# LangChain vs LangGraph

<div class="tldr">
<strong>TL;DR</strong>

- LangChain's core abstraction is the **chain**: a straight line of prompt, model, parser blocks. Great for linear jobs; every branch, loop or jump has to be hand-written as glue code around it.
- LangGraph models the job as a **graph of nodes and edges** with a shared **state** object. Branching, loops, pausing, resuming after failure, human approval and nested graphs are built in.
- LangGraph is built on LangChain. You still use LangChain for models, prompts, tools and retrievers; LangGraph only replaces the orchestration layer.
</div>

This lesson is the bridge between the two LangChain agent builds and the rest of the course. It
takes one realistic workflow, a recruitment pipeline from the course's intro session, and shows
what it costs to implement in LangChain versus LangGraph. The point is not that LangChain is bad;
it is that a chain is the wrong data structure for anything with a decision in it.

## What LangChain is good at

LangChain gives you interchangeable building blocks: a **model** interface for any provider, a
**prompt** component for templates, a **retriever** for vector stores, and **tools**. Its big idea
is the **chain**: connect blocks so each one's output is the next one's input.

```
prompt -> model -> output parser -> prompt -> model -> parser -> ...
```

You can chain as many blocks as you like, which covers chatbots, summarisers, translators,
multi-step prompt pipelines, RAG, and the simple agents from lessons 5 and 6. What every one of
these has in common: execution goes left to right, once, with no decisions about where to go next.

## Workflow vs agent

The video borrows Anthropic's distinction. A **workflow** is a predefined code path where LLM
calls and tools are orchestrated in a fixed order. An **agent** is a system where the LLM
dynamically decides its own path and tool use. The recruitment example is drawn as a workflow so
the mechanics are visible:

```
hiring request -> create JD -> JD approved? --no--> create JD (loop)
                                    |
                                   yes
                                    v
                              post JD -> wait 7 days -> monitor applications
                                                              |
                                          enough? --no--> modify JD -> wait 48h --jump back--> monitor
                                                              |
                                                             yes
                                                              v
                                       shortlist -> interview -> selected? -> offer / regret
                                                                     |
                                                       accepted? --no--> renegotiate -> offer
                                                                     |
                                                                    yes -> onboard -> end
```

Three shapes appear that a chain cannot express: **conditional branches** (approved?),
**loops** (regenerate until approved) and **jumps** (go back to an earlier node after a wait).

## Gap 1: branching, loops and jumps mean glue code

Implementing even the first four boxes in LangChain means writing a `while not approved:` loop
in plain Python around a chain, calling an approval function by hand, and then calling a posting
function. That works, but everything outside the chain is **glue code**: untyped, untraced,
and growing with every extra box. Scale that to the full diagram and most of the codebase is
control flow that LangChain knows nothing about.

LangGraph treats each box as a **node** (a Python function) and each arrow as an **edge**. A
decision becomes `add_conditional_edges` with a routing function that returns a label; a loop is
just an edge that points backwards. The control flow lives in the graph definition, not in ad-hoc
Python.

## Gap 2: state

Every box in the diagram produces data the later boxes depend on: the JD text, whether it was
approved, whether it was posted, how many applications arrived, who was shortlisted. That bundle
is the **state**. LangChain is **stateless**: it has conversation memory for chat history, but no
key-value structure that every step reads and writes. You would keep a dict yourself and update it
by hand after each call, which is more glue.

LangGraph is **stateful**. You declare the state schema once, as a `TypedDict` or a Pydantic
model, every node receives the current state as input and returns the fields it changed, and the
framework merges the update. The rest of the gaps all follow from this one.

## Gaps 3 to 7: what state makes possible

| Need | LangChain | LangGraph |
| --- | --- | --- |
| Pause for an external trigger (wait 7 days, wait for a webhook) | Split the chain, sleep or poll, re-run manually | Event-driven: the graph pauses on a node and resumes when the trigger arrives |
| Survive a failure (API down mid-run, server restart) | Re-run from the start; earlier work repeats | State snapshots after each node; retry or resume from the failed node |
| Human approval before a risky action | `input()` blocks the chain and burns compute while waiting | Human-in-the-loop is a first-class middleware: pause, wait for a decision, continue |
| A step that is itself a whole workflow (run interviews: questions, rounds 1 to 3) | Not expressible | Subgraphs: a node can be another compiled graph |
| See what ran and why | LangSmith traces the chain, but not your glue code | Every node execution is traced in LangSmith |

Fault tolerance is the one to internalise: because LangGraph checkpoints the state after each
node, a crash at "post JD" does not throw away the approved JD. Rerun, and execution resumes at
the posting node.

## When to use which

Use **LangChain** alone for linear jobs: prompt chaining, summarisation, a basic retriever, a
chatbot. Use **LangGraph** when the use case has conditional paths, loops, human approval,
multi-agent coordination, or asynchronous and event-driven steps.

And do not read this as "LangChain is deprecated". LangGraph handles orchestration; LangChain
still supplies the parts inside each node: `ChatOpenAI`, prompt templates, retrievers, document
loaders, tools. You install and use both.

## Code that matters

Both snippets are sketches of the video's slides for the first four boxes of the workflow.

```python
# LangChain: the loop and the branch are glue code around a chain
jd_chain = jd_prompt | llm | StrOutputParser()

approved, jd = False, None
while not approved:                       # hand-written loop
    jd = jd_chain.invoke({"request": "Hire a backend engineer"})
    approved = approve_jd(jd) == "approved"   # hand-written branch
post_jd(jd)
```

```python
# LangGraph: the loop and the branch are edges on a graph
from langgraph.graph import END, START, StateGraph

graph = StateGraph(HiringState)              # HiringState: TypedDict with jd, approved, posted...
graph.add_node("hiring_request", hiring_request)   # each node is a plain Python function
graph.add_node("create_jd", create_jd)
graph.add_node("check_approval", check_approval)
graph.add_node("post_jd", post_jd)

graph.add_edge(START, "hiring_request")
graph.add_edge("hiring_request", "create_jd")
graph.add_edge("create_jd", "check_approval")
graph.add_conditional_edges(
    "check_approval",
    lambda state: "approved" if state["approved"] else "rejected",
    {"approved": "post_jd", "rejected": "create_jd"},   # "rejected" is the loop back
)
graph.add_edge("post_jd", END)
app = graph.compile()
```

## Failure modes and gotchas

- **Glue code grows without bound**: the four-box sketch already needs a loop and two helper calls. The full recruitment diagram would be mostly Python control flow, none of it visible to LangSmith.
- **Manual state is easy to desync**: with a hand-rolled dict, forgetting to update one key after one step silently breaks a later decision. Declared state with per-node updates removes that class of bug.
- **Blocking on human input**: a chain that calls `input()` mid-run holds the process (and the bill) until someone answers, possibly days later. Long-running agents need pause and resume, not a blocked thread.
- **Restart from zero after a fault**: re-running a chain after a failed LinkedIn post regenerates and re-approves the JD, and may double-post. Checkpointed state avoids repeating side effects.
- **Treating LangGraph as a LangChain replacement**: the nodes still need LangChain components. Dropping LangChain means rewriting model and prompt plumbing for no gain.

## Takeaways

- Chains are lines; agent workflows are graphs. Pick the data structure that matches the shape of the problem.
- The single feature that unlocks the rest is declared, shared state. Branching, resuming, pausing and human approval are all operations on state.
- LangGraph adds orchestration on top of LangChain; it does not remove the need for it.
- Worth remembering the decision rule: no conditions and no loops, chain it; anything else, graph it.

## Test yourself

<details>
<summary>What three control-flow shapes in the recruitment workflow cannot be expressed as a chain?</summary>
<p>Conditional branches (is the JD approved?), loops (regenerate until approved) and jumps (after modifying the JD and waiting, go back to the monitoring node).</p>
</details>

<details>
<summary>How does LangGraph resume after a failure instead of restarting?</summary>
<p>It snapshots the state after every node. If a node fails, the state up to that point is already saved, so a retry starts at the failed node with the earlier results intact.</p>
</details>

<details>
<summary>Why is LangChain still required once you adopt LangGraph?</summary>
<p>LangGraph is built on LangChain and only handles orchestration. Models, prompt templates, retrievers, loaders and tools inside each node are still LangChain components.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/8YDJmN1WHWo"
    title="7. What is LangGraph &amp; Why It's Required? / LangChain vs LangGraph"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [7. What is LangGraph & Why It’s Required? / LangChain vs LangGraph](https://www.youtube.com/watch?v=8YDJmN1WHWo).

**Related:** [LangGraph Basics](/docs/rag-course/14-langgraph-basics) · [Loop Engineering](/docs/agentic-ai/loop-engineering) · [Agent Persistence](/docs/agentic-ai/agent-persistence)

Next: [LangGraph Core Components →](./10-langgraph-core-components.md)
