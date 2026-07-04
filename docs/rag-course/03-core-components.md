---
id: 03-core-components
title: "Core Components in RAG"
sidebar_position: 3
description: The building blocks every RAG system is made of — loaders, splitters, embeddings, vector store, retriever, and the LLM — and how they connect.
tags: [RAG, Architecture]
---

# Core Components in RAG

<div class="tldr">
<strong>TL;DR</strong>

- Six pieces: **loader → splitter → embedding model → vector store → retriever → LLM**.
- The embedding model is **shared** by indexing and querying — it must be the same one.
- The whole course is mastering each piece, then orchestrating them.
</div>

This section names the pieces every RAG pipeline is assembled from, so the rest of the
course is just going deep on each one.

## The components

- **Document loader** — reads source files (PDF, text, web, CSV, DB) into a common
  document format.
- **Text splitter (chunker)** — breaks documents into retrievable pieces. Chunk size
  and overlap have an outsized effect on quality.
- **Embedding model** — turns each chunk (and the query) into a vector that captures
  meaning. The _same_ model must embed both documents and queries.
- **Vector store / database** — holds the chunk vectors and finds the nearest ones to a
  query vector fast (FAISS, Chroma, Pinecone, Weaviate, …).
- **Retriever** — embeds the incoming question and returns the closest chunks.
- **LLM** — writes the final answer from the retrieved context.

## How they connect

![How the six RAG components connect](/img/rag-components.svg)

## The detail that trips people up

The **embedding model is shared** across indexing and querying. If documents and
questions are embedded by different models, their vectors aren't comparable and
retrieval returns nonsense.

## Cheat sheet

| Component       | Job                                          |
| --------------- | -------------------------------------------- |
| Loader          | source files → Documents                     |
| Splitter        | Documents → chunks                           |
| Embedding model | text → vectors (same model for docs + query) |
| Vector store    | hold vectors, fast nearest-neighbour search  |
| Retriever       | query → closest chunks                       |
| LLM             | chunks + question → grounded answer          |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Using a different embedding model for documents vs queries — vectors become
  incomparable and retrieval returns junk.
- Treating the vector store as just storage; its real job is **fast nearest-neighbour
  search**, which is what makes retrieval possible at scale.
- Skipping metadata at chunk time — you can't filter or cite later without it.
</div>

<div class="takeaway">
Six pieces: loader → splitter → embeddings → vector store → retriever → LLM. The whole course is mastering each one, then orchestrating them.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Name the six components in order.</summary>
<p>Loader → splitter → embedding model → vector store → retriever → LLM.</p>
</details>

<details>
<summary>Why must the embedding model be the same for docs and queries?</summary>
<p>Vectors from different models live in different spaces, so their distances are meaningless — retrieval would return irrelevant chunks.</p>
</details>

<details>
<summary>What does the retriever actually do?</summary>
<p>Embeds the incoming question and returns the closest chunks from the vector store.</p>
</details>
</div>

**Related:** [Embeddings](/docs/rag-course/06-embeddings) · [Vector Stores](/docs/rag-course/07-vector-stores) · [Next: VS Code & Anaconda Setup →](/docs/rag-course/04-setup)
