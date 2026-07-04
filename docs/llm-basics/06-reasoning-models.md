---
id: reasoning-models
title: "What are Reasoning Models?"
sidebar_label: "What are Reasoning Models?"
sidebar_position: 6
description: Models trained to think before answering — when their extra latency and token cost pay off, when a standard model is the better choice, and the routing pattern that uses both.
tags: [LLM, Reasoning]
---

# What are Reasoning Models?

Standard models answer in one pass. **Reasoning models** (the "thinking" family) are
trained to first generate a long internal chain of thought — exploring, checking,
backtracking — _before_ producing the final answer. They trade latency and token cost
for much stronger performance on math, logic, planning, and multi-step problems.

When to reach for one:

- **Use a reasoning model** for hard multi-step problems: complex code, math proofs,
  planning, careful analysis where a wrong step ruins the answer.
- **Use a standard model** for most chat, summarization, extraction, and RAG, where the
  reasoning model's extra latency and cost buy you nothing.

A good production pattern is **routing**: a cheap fast model handles easy requests, and
you escalate to a reasoning model only for the queries that need it. This is one of the
biggest cost levers in an LLM app.

Next: [2026 Model Landscape & Comparing Models →](/docs/llm-basics/model-landscape)
