---
id: 01-course-plan
title: "Course Plan and Prerequisites"
sidebar_position: 1
description: "The 12-phase plan behind the Complete Agentic AI Course, why the phases sit in that order, and the Python, generative AI, software and hardware prerequisites it expects."
tags: [Agentic AI, Course Plan, Prerequisites]
---

# Course Plan and Prerequisites

<div class="tldr">
<strong>TL;DR</strong>

- The course runs in **12 phases**: introduction, async plus Pydantic, LangChain agent basics, LangGraph, CrewAI, AutoGen, n8n, MCP, memory, safety and evaluation, deployment, then projects. Every phase ends with a project.
- Two hard prerequisites: **advanced Python** (OOP, inheritance, modular code) and **generative AI basics** (LLMs, prompting, RAG). Agentic AI is treated as the advanced layer of generative AI, not a separate subject.
- Expected setup: Anaconda, VS Code, Git and GitHub, Docker Desktop, Postman, free-tier model provider accounts, **8 GB RAM minimum** (16 GB recommended), a Core i5 class CPU and about 20 GB of free disk.
</div>

This lesson answers the questions learners keep asking: what will the course cover, in what order, and
what do you need before starting?
It matters because the phase order encodes dependencies. Each phase assumes the ones before it, so
knowing the map tells you what you cannot skip and where a gap in your background will bite.

## Why the phases sit in this order

The plan is not a list of frameworks. It is a dependency chain, and the lesson explains each link.

1. **Introduction** (phases 1) establishes what an agent is: goal in, plan, actions, minimal human guidance.
2. **Async programming and Pydantic** (phase 2) come before any framework because every orchestrator
   relies on them. Multi-agent systems run concurrently, so `asyncio` is unavoidable. LLM output is
   unstructured text, so validation with Pydantic is how you turn it into something code can trust.
3. **LangChain for agents** (phase 3) is taught as the "before orchestrators" baseline. You can build agents
   with it, but you assemble them by hand and complex workflows get awkward. Seeing that limitation is what
   makes LangGraph make sense later.
4. **LangGraph** (phase 4) is the first real orchestrator. The stated goal: after this phase you can implement
   any multi-agent system, learned through in-depth projects rather than API tours.
5. **CrewAI** (phase 5) adds role-based collaborative agents, then **AutoGen** (phase 6) covers the Microsoft
   framework and its protocols. Same concepts, different framework, so these go faster.
6. **n8n** (phase 7) is the no-code path: drag nodes onto a canvas, connect them, set configuration, and the
   agent exists without code. Useful even for coders, because it is what many teams actually deploy.
7. **MCP** (phase 8) replaces manual tool wiring. Tools live behind a server and any agent connects to them
   through the protocol instead of custom integration code.
8. **Memory** (phase 9) gets its own phase even though every project uses memory, so short-term and
   long-term memory get a detailed treatment rather than incidental mentions.
9. **Safety and evaluation** (phase 10) covers guardrails, prompt injection and evaluation. The lesson's
   position: do not ship an agent without this.
10. **Deployment** (phase 11) is CI/CD plus MLOps-style practices for a scalable agent service.
11. **Projects** (phase 12) closes with portfolio-grade end-to-end builds.

```
Python (OOP)  +  Generative AI (LLMs, prompting, RAG)
        |
        v
 [1] Intro -> [2] Async + Pydantic -> [3] LangChain agents
                                            |
                                            v
        [4] LangGraph -> [5] CrewAI -> [6] AutoGen -> [7] n8n
                                            |
                                            v
        [8] MCP -> [9] Memory -> [10] Safety + Eval -> [11] Deploy -> [12] Projects
```

## What the course assumes you already know

| Prerequisite | What "know it" means here | Why the course needs it |
| --- | --- | --- |
| Python | Not basics: classes, inheritance, modular project layout | Every build in the course is written as OOP, modular code |
| Generative AI | LLM calls, prompting, simple chatbots, RAG | Agentic AI is presented as the next step after RAG-style apps |
| Tooling habits | Virtual environments, Git, Docker, testing APIs | Installation is not taught; it is assumed done |

The lesson is explicit that traditional generative AI work (a chatbot, a RAG system) is the floor.
If that is unfamiliar, the advice is to finish a generative AI course first and come back.

## Setup: software, accounts, hardware

- **Software**: Anaconda, VS Code, Git and GitHub, Docker Desktop, Postman.
- **Accounts**: at least GitHub, Hugging Face, a vector database provider, Google AI Studio, plus optionally
  OpenAI and Anthropic. Free tiers are enough to learn; they hit limits that only matter in production.
- **Any provider works.** OpenRouter, Groq, a local model through Ollama, all fine. The integration point
  is always the same: obtain a key, write the model configuration, and the rest of the agent code does
  not care which model sits behind it.
- **Hardware**: 8 GB RAM minimum, 16 GB recommended because agents juggle a lot of data; Core i5 or Ryzen 5
  class CPU (an i3 will struggle); roughly 20 GB free disk on SSD.

## How the lesson expects you to learn

Two pieces of advice run through the Q and A. First, do every exercise and reimplement each project on a
different problem statement instead of copying it; the concept transfers, the exact project does not.
Second, explain what you learn to someone else. Teaching exposes the gaps you cannot see while consuming.

## Code that matters

No code is written in this session. The one technical point worth pinning down is the "provider does not
matter" claim, which in practice looks like this (sketch, not from the lesson):

```python
# sketch: keep the provider-specific part of an agent in one place
import os
from langchain.chat_models import init_chat_model

PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

# the API key is read from the provider's own env var, never written in code
llm = init_chat_model(f"{PROVIDER}:{MODEL}", temperature=0)

# everything downstream only sees `llm`, so swapping providers is a config change
```

## Failure modes and gotchas

- **Jumping straight to LangGraph.** Without the async and Pydantic phase, framework internals look like
  magic and debugging turns into guesswork.
- **Skipping generative AI.** The course does not re-teach prompting or RAG; those are assumed at phase 1.
- **Blaming code for free-tier limits.** Rate limits and quota errors on free plans are expected. Read the
  error before rewriting the agent.
- **Under-powered machines.** Local models and multi-agent runs on 8 GB with an i3 class CPU will stall.
- **Copying projects verbatim.** Thousands of learners share the same source; the value is in rebuilding
  the idea on a new problem.

## Takeaways

- The phase order is a dependency graph, worth respecting even when a later topic looks more exciting.
- Async and Pydantic are the two "boring" phases that make every framework phase readable.
- Provider choice is a configuration detail. Learn on free tiers, move to paid plans only for production.
- Hardware matters less than expected: 16 GB RAM and a mid-range CPU cover the whole course.

## Test yourself

<details>
<summary>Why does the course teach async programming and Pydantic before any agent framework?</summary>
<p>Because every orchestrator depends on them: multi-agent systems execute concurrently (asyncio), and LLM output is unstructured text that has to be validated into typed data (Pydantic) before code can act on it.</p>
</details>

<details>
<summary>What role does LangChain play in the plan if LangGraph is the real orchestrator?</summary>
<p>It is the baseline. The course shows how agents were built with LangChain alone, including its limits (hand-assembled agents, awkward complex workflows), so the reason for LangGraph is understood rather than assumed.</p>
</details>

<details>
<summary>Does it matter which model provider you use to follow along?</summary>
<p>No. Any provider (OpenAI, OpenRouter, Groq, Google AI Studio, a local Ollama model) works because the only provider-specific step is collecting a key and writing the model configuration; the agent code stays the same.</p>
</details>

**Related:** [Async Programming](/docs/agentic-ai/async-programming) · [Pydantic for Agents](/docs/agentic-ai/pydantic-for-agents) · [Glossary](/docs/glossary)

Next: [Agentic AI Learning Roadmap →](./02-learning-roadmap.md)
