---
id: what-is-an-llm
title: "What is an LLM?"
sidebar_label: "What is an LLM?"
sidebar_position: 1
description: An accurate working model of what an LLM does when you call it — a stateless next-token predictor — and the two behaviours that fall straight out of that definition.
tags: [LLM, Fundamentals]
---

# What is an LLM? (how to think about it)

A large language model is, mechanically, a **next-token predictor**. You give it a
sequence of text; it outputs a probability distribution over what the next token
should be; it picks one; it appends it; it repeats. Everything an LLM appears to "do"
— answer questions, write code, reason — is that loop running thousands of times.

The most useful mental model: an LLM is a **function from text to a probability
distribution over the next token**, wrapped in a loop. It has no memory between calls,
no live access to the world, and no notion of "truth" — only what token is statistically
likely to come next given everything it was trained on plus the text you just gave it.

Two consequences fall straight out of that definition and explain most LLM behaviour:

- **It only knows its training data.** Anything after its cutoff, or anything private,
  it has never seen — this is _why RAG exists_ (Part 4).
- **It will always produce a plausible next token**, even when it has no real basis —
  this is _why hallucinations happen_. The model isn't lying; it's doing exactly what
  it was built to do.

<div class="takeaway">
An LLM is a stateless next-token predictor. Keep that picture in mind and most of its strengths and failure modes stop being surprising.
</div>

Next: [Tokens & Tokenization →](/docs/llm-basics/tokens)
