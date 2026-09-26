---
id: 02-learning-roadmap
title: "Agentic AI Learning Roadmap"
sidebar_position: 2
description: "The three-layer roadmap (Python, generative AI, agentic AI), what each layer contributes to an agent, what skipping a layer costs, and the beginner, intermediate and advanced paths."
tags: [Agentic AI, Roadmap, Foundations]
---

# Agentic AI Learning Roadmap

<div class="tldr">
<strong>TL;DR</strong>

- Agentic AI sits on **two foundations**: Python gives an agent the ability to **execute** (tools, APIs, files, async, validation) and generative AI gives it the ability to **think** (LLMs, prompting, tokens, embeddings, function calling, limits).
- Agentic AI is **not a starting point, it is an integration point**. Skipping the foundations produces weak prompting, poor RAG quality, no debugging skill and unsafe automation.
- Three paths: **beginner** does all three layers in order, **intermediate** (knows Python) does generative AI then agentic AI, **advanced** (knows both) starts directly on agentic AI.
</div>

This lesson answers the most common question about the course: in what order should the material be
watched, given that learners arrive with very different backgrounds? The answer is a three-layer model
that explains why Python and generative AI come first, then maps three entry points onto it. It matters
because the biggest failure mode in learning agents is not difficulty, it is arriving at LangGraph with
too many unfamiliar concepts at once.

## The three layers and what each one contributes

The video's framing is anatomical: Python is the hands and legs, generative AI is the brain, agentic AI is
the nervous system that makes them act together.

| Layer | What you learn | What it gives an agent |
| --- | --- | --- |
| Python | Core language, OOP, files and errors; requests, JSON, auth, response handling; `asyncio`, `await`, event loop, streaming; Pydantic validation and structured output; FastAPI, env vars, project structure | The body: an agent must call tools, APIs, databases and backends, and Python is what connects all of them |
| Generative AI | Tokens, context window, temperature, model behaviour; connecting to providers; prompt engineering (system prompts, templates, structured responses); function calling; RAG (embeddings, vector store, retrieval); limits: hallucination, bias, cost, latency, evaluation | The brain: agents are powered by LLMs, so you must know how a model reads, reasons and responds |
| Agentic AI | Tools, memory, planning, reflection; LangGraph, CrewAI, AutoGen; guardrails, MCP; deployment | The control layer: autonomous workflows, planning, tool use, memory and control logic on top of the other two |

```
                +--------------------------------------+
                |  Agentic AI  (integration point)     |
                |  workflows, planning, tools, memory  |
                +-------------------+------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
+---------v-----------+                          +------------v-----------+
| Python  (execution) |                          | Generative AI (thinking)|
| APIs, async, data,  |                          | LLMs, prompting,        |
| validation, backend |                          | embeddings, tool calls  |
+---------------------+                          +-------------------------+
```

## Why the order is not negotiable for beginners

The argument is about debugging, not about permission. You can build an agent right after learning Python,
and the practical steps will even work. What breaks is everything around the happy path: choosing the right
workflow for a product, understanding why an agent misbehaves, and fixing it. Agentic AI is described as
the extended version of generative AI, not a separate technology. The LLM, the prompting, the memory ideas
are all inherited, so a gap there becomes a gap in every agent you build.

Skipping the foundations, according to the video, leads to:

- **Concept overload**: LangGraph, memory and tools all appear at once with nothing to attach them to.
- **Weak prompting** and **poor RAG quality**, because the mechanics were never studied in isolation.
- **No debugging skill**, because you cannot reason about what the model is doing.
- **Unsafe automation**, because limits like hallucination were never internalised.

Learning foundation-first gives the mirror image: clear architecture, better tool design, reliable agents,
faster debugging, and a production mindset.

## Three entry points

| Learner | Already knows | Path |
| --- | --- | --- |
| Beginner | Nothing relevant yet | Python, then generative AI, then agentic AI |
| Intermediate | Python | Generative AI, then agentic AI |
| Advanced | Python and generative AI | Agentic AI only |

One more expectation is stated plainly: machine learning and deep learning are assumed background for the
generative AI layer. They are the "hello world" of AI and the video does not offer a shortcut around them.

## Inside the agentic layer: the phase sequence as published

The roadmap video lists the agentic phases in the order they were actually released, which differs slightly
from the original plan: introduction; async and Pydantic; LangChain agent fundamentals (single and multi
agent); LangGraph (state, nodes, edges, conditional edges, checkpointer); memory, planning and monitoring
(persistence, short-term memory, chat history, streaming, human-in-the-loop, RAG and tool integration,
LangSmith); deployment (CI/CD, Docker, cloud); end-to-end projects; MCP; safety and evaluation (guardrails,
prompt injection, harmful input); then CrewAI, AutoGen and n8n. The point made about the last three:
the concepts do not change between frameworks, only the framework does.

## Which playlist to follow

The course has one main playlist that carries every concept, and companion playlists for specific uses:
a LangGraph-only series for revision if you already know the other frameworks, and a projects-only series.
For learning end to end, the main playlist is the one to follow; the others are supplements.

## Code that matters

No code is shown in this lesson. The three layers are easier to see when one agent step is annotated
with the layer each line belongs to (sketch):

```python
# sketch: one agent step, with the learning layer each line comes from
import asyncio                          # Python: async execution
from pydantic import BaseModel          # Python: validation


class Action(BaseModel):                # the shape the LLM must fill in
    tool: str
    args: dict


async def agent_step(goal: str, llm, tools: dict) -> str:
    prompt = f"Goal: {goal}. Choose one tool and its arguments as JSON."  # GenAI: prompting
    raw = await llm.ainvoke(prompt)                                        # GenAI: the LLM call
    action = Action.model_validate_json(raw.content)                       # Python: validation
    result = await tools[action.tool](**action.args)                       # Python: execution
    return str(result)                    # Agentic: what to do with this result is the control loop's job
```

Everything in the Python and GenAI rows can be learned and tested on its own. The agentic layer is the
loop, memory and control logic that decides what happens after `return`.

## Failure modes and gotchas

- **Treating agentic AI as a separate technology.** It reuses the LLM, prompting and memory ideas from
  generative AI; a weak foundation there shows up as an unreliable agent.
- **Learning a framework instead of the concepts.** Tools, memory, planning and guardrails are the same in
  LangGraph, CrewAI and AutoGen; if only one framework's API was learned, switching is a restart.
- **Picking the wrong playlist.** A LangGraph-only series is a revision aid, not a substitute for the full
  course.
- **Skipping ML and DL entirely.** They are assumed background for the generative AI layer.

## Takeaways

- Worth remembering as one line: Python executes, generative AI thinks, agentic AI integrates.
- The cost of skipping foundations is paid later, in debugging and safety, not up front.
- Choose the path by what is already known, not by what looks most interesting.
- Frameworks are swappable; the agent concepts are the durable part.

## Test yourself

<details>
<summary>Why is agentic AI called an integration point rather than a starting point?</summary>
<p>Because an agent combines Python execution (tools, APIs, data, async) with LLM thinking (prompting, embeddings, function calling) and adds control logic on top. There is nothing to integrate until both foundations exist.</p>
</details>

<details>
<summary>What goes wrong if someone learns Python and then jumps straight to agents?</summary>
<p>The practical steps still run, but they hit too many concepts at once, prompt badly, get poor RAG quality, cannot debug agent behaviour, and tend to build unsafe automation, because the generative AI layer was never studied.</p>
</details>

<details>
<summary>Which path should someone take who already knows Python but has never called an LLM?</summary>
<p>The intermediate path: complete the generative AI layer (LLM basics, prompting, function calling, RAG, limitations) first, then start the agentic AI course.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/sZLZsW74uQ0"
    title="Complete Agentic AI Learning Roadmap: From Beginner to Pro Level"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [Complete Agentic AI Learning Roadmap: From Beginner to Pro Level](https://www.youtube.com/watch?v=sZLZsW74uQ0).

**Related:** What is an LLM · Tool Calling · [Glossary](/docs/glossary)

Next: [From LLMs to Agentic AI →](./03-llms-to-agentic-ai.md)
