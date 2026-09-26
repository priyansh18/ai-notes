---
id: 10-langgraph-core-components
title: "LangGraph Core Components"
sidebar_position: 10
description: "The five LLM workflow patterns, then LangGraph's building blocks, graph, nodes, edges, shared state, reducers and the Pregel-style execution model, explained through an essay-grading example."
tags: [Agentic AI, LangGraph, State]
---

# LangGraph Core Components

<div class="tldr">
<strong>TL;DR</strong>

- A LangGraph app is a **graph**: each task is a **node** (a Python function), each "what runs next" is an **edge**, and every node reads and writes one shared **state** object.
- A **reducer** decides how a node's update is applied to a state key: replace the old value, or append to it. Chat histories and feedback lists need append; scores can replace.
- Execution is Pregel-style: define the state schema, add nodes and edges, **compile**, then **invoke** once. Nodes activate in rounds (super-steps) as data flows along edges, and the run halts when nothing is left to activate.
</div>

The previous lesson argued for graphs over chains. This one names the parts. It starts with the
five shapes an LLM workflow can take, then walks one problem, an essay grader for a UPSC-style
exam, from goal, to task list, to graph, to state schema, to the rules that update that state.

## Five LLM workflow shapes

An **LLM workflow** is a step-by-step process where at least one step calls a model. Steps can be
prompting, reasoning, tool calls, memory access or decisions, arranged five ways:

| Pattern | Shape | Video's example |
| --- | --- | --- |
| Prompt chaining | input, LLM, check, LLM, LLM, output | topic, draft, reject if over 5,000 words, review, write to file |
| Routing | one router LLM sends the input to one of several specialist LLMs | edtech support: service questions, technical questions, interview prep |
| Parallelization | several independent LLM calls at once, then an aggregator | video upload checks: inappropriate, sexual, abusive content, averaged against a threshold |
| Orchestrator-worker | an orchestrator LLM decides which workers get the task, then a synthesizer combines | same as parallel, but the assignment is decided at runtime, possibly to one worker |
| Evaluator-optimizer | generator LLM, evaluator LLM, loop with feedback until accepted | generate a job description, evaluate it, regenerate with feedback |

## Graph, nodes, edges

Take the essay system: generate a topic, collect the student's essay, evaluate it in parallel on
depth of analysis, language quality and clarity of thought, combine the three scores, then either
approve or send feedback. Break the goal into tasks; each task becomes a node. The order in which
they run becomes the edges.

```
[generate_topic] -> [write_essay] -+-> [evaluate_depth]    -+
                                   +-> [evaluate_language] -+-> [aggregate] -> total >= 9.5 ? -> success
                                   +-> [evaluate_clarity]  -+                       |
                                                                                    no
                                                                                    v
                                                                              [give_feedback] (student may resubmit)
```

A node is nothing more than a Python function; if you can write the function that does the task,
you can make it a node. Edges are the flowchart arrows: the three evaluators fan out from
`write_essay` and fan back into `aggregate`, and the decision after `aggregate` is a conditional
edge.

## State: the shared memory

Nodes do not call each other. They communicate through one **state** object that flows through
the graph. For the essay grader it holds the topic, the essay text, the three scores, the total,
the feedback and the evaluation round. Three properties matter:

- **Shared**: every node receives the whole state as its input.
- **Mutable**: a node returns the keys it changed, and the framework writes them back immediately.
- **Declared up front**: the schema is defined once, as a `TypedDict` or a Pydantic model, before any node is written. Choosing the keys is the first design step for any LangGraph app.

## Reducers: replace or accumulate

By default a node's update **replaces** the old value of a key. For a running total that is what
you want: 5 + 6 gives 11, times 3 gives 33, and the old 11 should be gone. For other keys it is a
bug. The video's example is a chatbot whose state has one `message` key: "Hi, I am Bappy" is
replaced by "I like football", and when the user then asks "what is my name?" the name is gone.

A **reducer** is attached per key and says how updates combine: replace, merge, or add. The essay
grader's `feedback` key uses add, so each round's feedback is appended and the next evaluation can
see what was already said instead of repeating it. Reducers only exist alongside state; you
declare them in the schema.

## The execution model

LangGraph runs graphs the way Google's **Pregel** system processes large graphs, in rounds:

1. **Define**: state schema, nodes, edges.
2. **Compile**: check the structure. A node with no edges into it is caught here, not mid-run.
3. **Invoke**: pass the initial state to the entry node.
4. **Super-steps**: a node runs, its update is written to state, and the state is passed along its outgoing edges. Every node that now has input activates in the next round. Nodes on parallel branches run in the same round.
5. **Halt**: when no node is active and no update is in transit, the run ends and the final state is returned.

## Code that matters

A sketch of the essay grader as a graph. Grader bodies are stubs; in the video they are LLM
calls that return a score.

```python
from operator import add
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


class EssayState(TypedDict):
    topic: str
    essay_text: str
    depth_score: float
    language_score: float
    clarity_score: float
    total_score: float
    feedback: Annotated[list[str], add]   # reducer: append each round, never replace
    evaluation_round: int


def generate_topic(state: EssayState) -> dict:
    return {"topic": "Is technology making us less human?"}   # sketch: LLM call


def write_essay(state: EssayState) -> dict:
    return {"essay_text": "..."}                               # sketch: collect from student

# sketch: each grader is an LLM call that returns a score
def evaluate_depth(state: EssayState) -> dict: return {"depth_score": 9.5}
def evaluate_language(state: EssayState) -> dict: return {"language_score": 9.8}
def evaluate_clarity(state: EssayState) -> dict: return {"clarity_score": 8.5}


def aggregate(state: EssayState) -> dict:
    total = (state["depth_score"] + state["language_score"] + state["clarity_score"]) / 3
    return {"total_score": total, "evaluation_round": state["evaluation_round"] + 1}


def give_feedback(state: EssayState) -> dict:
    return {"feedback": [f"Round {state['evaluation_round']}: improve clarity of thought."]}


def route(state: EssayState) -> str:
    return "success" if state["total_score"] >= 9.5 else "feedback"


builder = StateGraph(EssayState)
for name, fn in [("generate_topic", generate_topic), ("write_essay", write_essay),
                 ("evaluate_depth", evaluate_depth), ("evaluate_language", evaluate_language),
                 ("evaluate_clarity", evaluate_clarity), ("aggregate", aggregate),
                 ("give_feedback", give_feedback)]:
    builder.add_node(name, fn)

builder.add_edge(START, "generate_topic")
builder.add_edge("generate_topic", "write_essay")
for grader in ("evaluate_depth", "evaluate_language", "evaluate_clarity"):
    builder.add_edge("write_essay", grader)   # fan out: three graders in one super-step
    builder.add_edge(grader, "aggregate")     # fan in
builder.add_conditional_edges("aggregate", route, {"success": END, "feedback": "give_feedback"})
builder.add_edge("give_feedback", END)

app = builder.compile()
final_state = app.invoke({"feedback": [], "evaluation_round": 0})
```

## Failure modes and gotchas

- **Replace where you meant append**: the single-`message` chatbot forgets the user's name after one turn. Any key that represents history (messages, feedback, tool results) needs an add reducer.
- **Parallel writers to one key**: the three graders each write their *own* score key. If they all wrote to `score`, updates from the same super-step would collide, and without a reducer to combine them one would win or the run would error.
- **Missing keys in the initial state**: the graph is invoked with a dict matching the schema. Keys read on the first round (`feedback`, `evaluation_round` above) need starting values.
- **Unbounded feedback loops**: if `give_feedback` is wired back to `write_essay` for resubmission, cap `evaluation_round` in the routing function, or the graph loops until the recursion limit.

## Takeaways

- Goal to tasks to nodes; run order to edges; data between them to state. That translation works for any problem the course throws at LangGraph later.
- State is declared once and shared by every node. Worth remembering that choosing the state keys *is* the design.
- Reducers are a property of keys, not nodes. Ask per key: should the new value replace or accumulate?
- Compile, then invoke once. Activation after that is automatic and round-based, which is what allows parallel branches with no extra code.

## Test yourself

<details>
<summary>What is a node in LangGraph, concretely?</summary>
<p>A Python function that receives the shared state, does one task (an LLM call, a tool call, a check) and returns a dict of the state keys it changed.</p>
</details>

<details>
<summary>Why does the chatbot with a single message key forget the user's name?</summary>
<p>Without a reducer, each node update replaces the key's value. The second message overwrites the first, so the name is no longer anywhere in state. An add reducer on that key keeps the whole conversation.</p>
</details>

<details>
<summary>What is the difference between parallelization and the orchestrator-worker pattern?</summary>
<p>In parallelization the set of worker tasks is fixed in code and they all run. In orchestrator-worker an LLM decides at runtime which workers get the task, possibly only one, before a synthesizer combines the results.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/l3cMKkLxSAU"
    title="8. Understanding LangGraph Core Components"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [8. Understanding LangGraph Core Components](https://www.youtube.com/watch?v=l3cMKkLxSAU).

**Related:** [LangGraph Workflows](/docs/agentic-ai/langgraph-workflows) · [Pydantic for Agents](/docs/agentic-ai/pydantic-for-agents) · [LangGraph Subgraphs](/docs/agentic-ai/langgraph-subgraphs)
