---
id: 02-introduction-to-rag
title: "Introduction to RAG"
sidebar_position: 2
description: What RAG is and why it exists — grounding an LLM in external data at query time to fix stale knowledge, missing private data, and hallucination.
tags: [RAG, Fundamentals]
---

# Introduction to RAG

<div class="tldr">
<strong>TL;DR</strong>

- RAG = retrieve relevant context at query time, then let the LLM answer from it.
- Fixes a bare LLM's three limits: stale knowledge, no private data, hallucination.
- Two phases: **indexing** (offline) and **querying** (per request).
</div>

This section establishes what RAG is and the problem it solves before any code.

## What RAG is

**Retrieval-Augmented Generation** gives a language model knowledge it wasn't trained
on by _retrieving_ relevant text at question time and placing it into the prompt. The
model then answers from that supplied context instead of relying only on what's baked
into its weights.

A plain LLM is a closed-book exam; RAG turns it into an open-book one — the model still
writes the answer, but it can look up the right page first.

## Why RAG exists

It fixes three limits of a bare LLM:

- **Stale knowledge** — the model only knows its training data up to a cutoff; it can't
  see your latest or private documents.
- **No private data** — your company wiki, PDFs, and tickets were never in training.
- **Hallucination** — asked something it doesn't know, the model confidently invents an
  answer. Grounding it in retrieved sources curbs this and makes answers citable.

## The two phases

![RAG's two phases — indexing once, querying per question](/img/rag-two-phase.svg)

Everything later in the course improves one of these steps — better parsing, chunking,
retrieval, or agentic control over the loop.

## Cheat sheet

- **RAG =** retrieve relevant context at query time → LLM answers from it.
- **Fixes:** stale knowledge, private data, hallucination; enables citations.
- **Two phases:** indexing (offline) and querying (per request).

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Thinking RAG "trains" the model — it doesn't; it only adds context to the prompt.
- Expecting RAG to fix a _reasoning_ gap. RAG fixes a _knowledge_ gap; if the model
  can't reason over the context, retrieval won't help.
- Forgetting retrieval can fail — if the right chunk isn't retrieved, the model can't
answer (or will hallucinate). Most "RAG bugs" are retrieval bugs.
</div>

<div class="takeaway">
RAG grounds an LLM in retrieved context. It fixes stale knowledge, private data, and hallucination — and makes answers traceable to a source.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What three problems does RAG solve?</summary>
<p>Stale knowledge (training cutoff), no access to private data, and hallucination — plus it makes answers citable.</p>
</details>

<details>
<summary>What are the two phases of RAG?</summary>
<p>Indexing (offline: load → chunk → embed → store) and querying (per question: embed → retrieve → augment prompt → generate).</p>
</details>

<details>
<summary>Does RAG change the model's weights?</summary>
<p>No. It only supplies context in the prompt at query time. Changing weights is fine-tuning.</p>
</details>
</div>

**Related:** [Core Components →](/docs/rag-course/03-core-components) · [Glossary](/docs/glossary)
