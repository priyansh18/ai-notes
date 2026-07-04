---
id: 01-introduction
title: "Introduction"
sidebar_position: 1
description: What the Ultimate RAG Bootcamp covers and how it's structured — from traditional RAG to advanced, multimodal, and agentic RAG with LangChain, LangGraph, and LangSmith.
tags: [RAG, Course]
---

# Introduction

<div class="tldr">
<strong>TL;DR</strong>

- This course goes from **traditional RAG → advanced → multimodal → agentic**.
- Built on **LangChain** (pipelines), **LangGraph** (agents), **LangSmith** (tracing).
- Learn a concept → study a real project → rebuild it yourself.
</div>

The opening section sets the scope: this is an end-to-end RAG course that goes from
**traditional RAG** all the way to **advanced, multimodal, and agentic** systems,
built with **LangChain, LangGraph, and LangSmith**.

## What the course builds toward

- **Traditional RAG** — load → parse → chunk → embed → store → retrieve → generate.
- **Advanced retrieval** — hybrid search, query enhancement, advanced chunking.
- **Multimodal RAG** — retrieving over text and images.
- **Agentic RAG** — agents that decide when and how to retrieve, plus corrective,
  adaptive, autonomous, and multi-agent variants (LangGraph).
- **Evaluation & production** — LangSmith tracing, guardrails, LLM gateways, GraphDB,
  and a final end-to-end project.

## How I'm taking these notes

Each note maps to a course topic, in order, so I can study the video and reinforce it
here. I write the concept in my own words, keep the code I actually understand, and
note the pitfalls.

## Cheat sheet

- **Stack:** LangChain (pipelines) · LangGraph (agents) · LangSmith (tracing/eval).
- **Arc:** traditional RAG → advanced retrieval → multimodal → agentic → production.
- **Method:** learn the concept, study a real project, rebuild it yourself.

<div class="takeaway">
Master the traditional RAG pipeline first, then layer on advanced retrieval, then graduate to agentic RAG — the same order these notes follow.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What three layers does this course build through?</summary>
<p>Traditional RAG → advanced/multimodal RAG → agentic RAG.</p>
</details>

<details>
<summary>What does each tool in the stack do?</summary>
<p>LangChain builds the pipelines, LangGraph builds the agents, LangSmith traces and evaluates them.</p>
</details>
</div>

**Related:** [Glossary](/docs/glossary) · [Introduction to RAG →](/docs/rag-course/02-introduction-to-rag)
