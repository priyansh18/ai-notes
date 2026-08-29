---
id: 14b-lang-ecosystem
title: "LangChain vs LangGraph vs LangSmith vs Langflow"
sidebar_position: 15
description: The four Lang* tools in one place — what each is, how they differ, and when to use which. LangChain builds it, LangGraph orchestrates it, LangSmith watches it, Langflow lets you draw it.
tags: [RAG, LangChain, LangGraph, LangSmith]
---

# LangChain vs LangGraph vs LangSmith vs Langflow

<div class="tldr">
<strong>TL;DR</strong>

- **LangChain** builds it · **LangGraph** orchestrates it · **LangSmith** watches it · **Langflow** lets you draw it.
- They don't compete — they **layer**. Most real apps use LangChain + LangGraph together, with LangSmith on top.
</div>

These four names sound alike and get confused constantly, but they solve different problems.
The key realization: they're **complementary layers**, not alternatives.

![The Lang stack: Langflow prototypes, LangChain builds, LangGraph orchestrates, LangSmith observes across all](/img/lang-ecosystem.svg)

Reading the diagram: a typical flow moves left to right — sketch a flow visually (Langflow),
write the real components in code (LangChain), wire them into a stateful graph (LangGraph) —
while LangSmith sits underneath tracing and evaluating all of it.

## What each one is

**LangChain** — the framework. It gives you the building blocks of an LLM app: model
wrappers, prompts, document loaders, text splitters, embeddings, vector stores, retrievers,
tools, and chains, all behind consistent interfaces. This is what you import and write code
against.

**LangGraph** — the orchestration layer. When your app stops being a straight line and needs
loops, branching, and persistent state (i.e. **agents**), LangGraph models it as a graph of
nodes and edges with a shared state object. Built by the same team, it sits on top of / beside
LangChain.

**LangSmith** — the observability platform. It traces every step of a run, so you can debug
why an agent did something, evaluate outputs against a dataset, and monitor cost and latency
in production. It's framework-agnostic — it can watch LangChain, LangGraph, or even plain API
calls.

**Langflow** — a visual, drag-and-drop builder. You assemble a flow on a canvas instead of
writing code, which is great for prototyping and demos. It's a **separate open-source project**
built on LangChain (not made by LangChain Inc).

## Quick comparison

| | LangChain | LangGraph | LangSmith | Langflow |
| --- | --- | --- | --- | --- |
| **Type** | Framework / library | Orchestration library | Observability platform (SaaS) | Visual builder (open-source app) |
| **Job** | Build the pieces | Control the flow | See & test what runs | Draw a flow, no code |
| **You work in** | Code | Code | Dashboard + SDK | Browser canvas |
| **Best at** | Integrations, chains, RAG | Stateful, multi-step agents | Debugging, eval, monitoring | Fast prototypes / demos |
| **Made by** | LangChain Inc | LangChain Inc | LangChain Inc | 3rd-party (on LangChain) |

## When to use which

- **Reach for LangChain** whenever you're writing an LLM app in code — it's the default
  toolkit for RAG, tool use, and chaining calls together.
- **Add LangGraph** the moment you need branching, loops, retries, or memory across steps —
  i.e. a real agent rather than a fixed pipeline. Simple linear RAG doesn't need it.
- **Add LangSmith** as soon as "why did it do that?" or "is this change better?" comes up —
  tracing in development and monitoring/eval in production. Turn it on early; it's just an
  API key and a wrapper.
- **Use Langflow** to prototype visually, teach, or hand a non-developer a canvas. For a
  production codebase you'll usually graduate to writing LangChain/LangGraph directly.

<div class="gotcha">
<strong>⚠ Common confusions</strong>

- Thinking you must *choose* one — you don't. LangChain + LangGraph + LangSmith commonly run
  together in the same app.
- Reaching for LangGraph on a simple linear pipeline — if there's no branching or loop, a
  plain LangChain chain is simpler.
- Assuming LangSmith only works with LangChain — it can trace any LLM code.
- Treating Langflow as a production runtime — it's best for prototyping; export/rewrite in
  code for production.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>One-line role of each?</summary>
<p>LangChain builds it, LangGraph orchestrates it, LangSmith watches it, Langflow lets you draw it.</p>
</details>

<details>
<summary>When do you add LangGraph over plain LangChain?</summary>
<p>When the app needs control flow — branching, loops, retries, or state across steps (agents). Linear pipelines don't need it.</p>
</details>

<details>
<summary>Does LangSmith require LangChain?</summary>
<p>No — it's framework-agnostic and can trace LangGraph or plain API calls too.</p>
</details>
</div>

**Related:** [Updated LangChain (v1)](/docs/rag-course/13-langchain-v1) · [LangGraph Basics](/docs/rag-course/14-langgraph-basics) · [Glossary](/docs/glossary)

Next: [Agents Architecture →](/docs/rag-course/15-agents-architecture)
