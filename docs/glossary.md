---
id: glossary
title: "Glossary"
sidebar_label: "📖 Glossary"
sidebar_position: 98
description: Plain-English definitions of the AI-engineering and RAG terms used across these notes — embeddings, chunking, vector stores, retrievers, LCEL, cosine vs L2, and more.
tags: [Glossary, Reference]
---

# Glossary

One-line, plain-English definitions for the terms used across these notes. Skim it
before an interview, or jump here whenever a word is unfamiliar.

## Core LLM terms

- **LLM (Large Language Model)** — a model that predicts the next token over and over;
  effectively a function from text to a probability distribution over the next token.
- **Token** — the unit a model reads; a word-piece. ~1 token ≈ 4 characters. Cost and
  context limits are counted in tokens.
- **Context window** — the max tokens a model can consider at once (prompt + output).
- **Temperature** — randomness of sampling; low = focused/deterministic, high = creative.
- **Top-p / top-k** — limit which tokens are eligible before sampling (nucleus / top-k).
- **Hallucination** — a confident but unsupported/false answer the model invents.
- **Reasoning model** — a model trained to "think" (long internal chain) before
  answering; better at multi-step problems, slower and pricier.
- **System / user / assistant** — message roles; system = standing rules, user = the
  request, assistant = the model's prior turns.

## RAG terms

- **RAG (Retrieval-Augmented Generation)** — retrieve relevant text at query time and
  put it in the prompt so the model answers from it.
- **Indexing** — the offline phase: load → chunk → embed → store.
- **Querying** — the live phase: embed question → retrieve → augment prompt → generate.
- **Document** — LangChain's common unit: `page_content` (text) + `metadata`.
- **Loader** — reads a source (PDF, CSV, SQL, …) into Documents.
- **Chunk** — a small, independently-retrievable piece of a document.
- **Chunk overlap** — shared text between neighbouring chunks so boundary facts survive.
- **Recursive splitting** — split on paragraph → line → sentence → word; the default.
- **Grounding** — tying the answer to retrieved source text (so it's citable).

## Embeddings & similarity

- **Embedding** — a fixed-length vector that captures the _meaning_ of text.
- **Dimension** — how many numbers in the vector (e.g. MiniLM = 384, OpenAI small = 1536).
- **`embed_query`** — embed one string (the question).
- **`embed_documents`** — embed a list of strings (your chunks) in one batch.
- **Cosine similarity** — angle between two vectors; 1 = same meaning, 0 = unrelated.
- **L2 (Euclidean) distance** — straight-line distance; **lower = more similar**
  (ChromaDB's default — opposite direction to cosine).
- **Normalization** — scaling a vector to length 1 so cosine == dot product (faster).

## Vector storage & retrieval

- **Vector store** — lightweight library for storing + KNN-searching vectors (FAISS,
  Chroma); great under ~1M vectors.
- **Vector database** — full system with filters, CRUD, sharding, HA for production
  scale (Pinecone, Qdrant, Weaviate, Milvus).
- **Retriever** — embeds a query and returns the closest chunks (`as_retriever`).
- **top-k** — how many chunks retrieval returns.
- **Similarity search** — `similarity_search` (plain) / `similarity_search_with_score`.
- **HNSW** — a graph index for fast approximate nearest-neighbour search; the common
  default. **IVF** — a cluster-based ANN index.

## Building & chaining

- **LangChain** — framework for composing LLM apps (loaders, splitters, chains).
- **LCEL (LangChain Expression Language)** — compose a pipeline with the `|` operator.
- **`create_stuff_documents_chain`** — "stuffs" retrieved docs into the prompt's
  `{context}` slot.
- **`create_retrieval_chain`** — wires a retriever to a document chain = the RAG pipeline.
- **History-aware retriever** — rewrites a follow-up into a standalone query using chat
  history before retrieving.

## Advanced RAG (coming up in the course)

- **Hybrid search** — combine dense (vector) + sparse (BM25/keyword) retrieval.
- **Reranking** — a cross-encoder re-scores the shortlist for precision.
- **RRF (Reciprocal Rank Fusion)** — merge ranked lists by rank, not score.
- **HyDE** — embed a _hypothetical answer_ instead of the question to retrieve better.
- **Multi-query** — generate several phrasings, retrieve for each, merge.
- **Corrective RAG (CRAG) / Self-RAG / Adaptive RAG** — agentic variants that check,
  correct, or decide when to retrieve.
- **Multimodal RAG** — retrieval over text _and_ images.
- **Guardrails** — input/output filtering and injection defense.
