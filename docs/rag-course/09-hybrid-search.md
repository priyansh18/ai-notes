---
id: 09-hybrid-search
title: "Hybrid Search Strategies"
sidebar_position: 9
description: Combining dense (vector) and sparse (BM25) retrieval with an ensemble, then sharpening results with cross-encoder reranking and diversifying them with MMR.
tags: [RAG, Retrieval, Hybrid]
---

# Hybrid Search Strategies

<div class="tldr">
<strong>TL;DR</strong>

- **Hybrid search** = dense (vector) + sparse (BM25) retrieval, fused with an ensemble.
- **Reranking** runs a slower, more accurate cross-encoder over the top-k to reorder them.
- **MMR** picks results that are both relevant _and_ diverse (no near-duplicates).
</div>

Plain vector search misses exact terms; keyword search misses paraphrases. This section
combines them, then adds two precision/diversity layers. One submodule per technique,
ending with a cheat sheet.

![Hybrid search pipeline: dense + sparse → ensemble → rerank → LLM](/img/hybrid-search.svg)

## Dense + sparse = hybrid

- **Dense (vectors)** is strong on meaning and paraphrases.
- **Sparse (BM25)** is strong on exact tokens — codes, names, acronyms.

Combine them with an **EnsembleRetriever**, weighting each:

```python
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever

# dense retriever (FAISS + embeddings)
emb = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
dense_retriever = FAISS.from_documents(docs, emb).as_retriever(search_kwargs={"k": 3})

# sparse retriever (BM25 keyword)
sparse_retriever = BM25Retriever.from_documents(docs)
sparse_retriever.k = 3

# fuse — dense weighted higher here
hybrid_retriever = EnsembleRetriever(
    retrievers=[dense_retriever, sparse_retriever],
    weights=[0.7, 0.3],
)

results = hybrid_retriever.invoke("How can I build an application using LLMs?")
```

The ensemble merges both ranked lists, so a chunk strong in either method surfaces.

## Reranking (cross-encoder, second stage)

Retrieval is fast but approximate. **Reranking** is a second stage: fetch a wide
top-k cheaply, then re-score each candidate against the query with a slower, more
accurate **cross-encoder**, and keep the best few.

![Reranking: retrieve wide with a bi-encoder, then a cross-encoder rescores and reorders the shortlist](/img/reranking.svg)

Reading the diagram: stage 1 pulls 8 candidates fast (the true answer, **doc B**, is
only ranked #2). Stage 2's cross-encoder reads each _(query, doc)_ pair together,
re-scores them, and **doc B jumps to #1** while the off-topic doc C is dropped.

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

candidates = retriever.invoke(query)          # e.g. top-8
scored = reranker.predict([(query, d.page_content) for d in candidates])
ranked = [d for _, d in sorted(zip(scored, candidates), key=lambda x: x[0], reverse=True)]
top = ranked[:3]                              # the small, precise set the LLM sees
```

Bi-encoder embeds query and doc separately (fast, scalable); cross-encoder reads them
**together** (slow, precise). Retrieve wide and cheap, then rerank narrow and precise.

## MMR — relevance _and_ diversity

Top-k often returns near-duplicate chunks. **Maximal Marginal Relevance** balances
relevance against novelty so the context covers more ground instead of repeating
itself.

![MMR vs plain top-k: plain top-k returns four near-duplicates; MMR returns one plus three diverse angles](/img/mmr.svg)

Reading the diagram: plain top-k grabs the 4 closest points — but they're all
near-copies of **A**, so the LLM sees the same fact four times. MMR scores each
candidate by _relevance to the query **minus** similarity to docs already picked_, so
after choosing A it skips A′ and reaches for B, C, D — different, useful angles. It's a
one-argument switch on the retriever:

```python
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 3, "fetch_k": 20},   # fetch 20, return the 3 most diverse
)
```

```
 plain top-k: [A] [A'] [A''] [B]   ← three near-copies of A
 MMR:         [A] [B]  [C]   [D]   ← relevant AND varied
```

Use MMR when your corpus has lots of similar passages and you want the LLM to see
_different_ angles, not the same fact four times.

## Putting it together

A strong retrieval stack stacks all three:

```
 query ─▶ hybrid (dense + BM25) ─▶ MMR for diversity ─▶ cross-encoder rerank ─▶ top 3 ─▶ LLM
```

## Cheat sheet

| Technique        | Code                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| Dense retriever  | `FAISS.from_documents(docs, emb).as_retriever(search_kwargs={"k": 3})`          |
| Sparse retriever | `BM25Retriever.from_documents(docs)`                                            |
| Hybrid (fuse)    | `EnsembleRetriever(retrievers=[dense, sparse], weights=[0.7, 0.3])`             |
| Rerank           | `CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2").predict([(query, doc)…])` |
| MMR              | `as_retriever(search_type="mmr", search_kwargs={"k": 3, "fetch_k": 20})`        |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Skipping BM25 — pure vector search fails on exact codes, IDs, and rare names.
- Reranking the whole corpus — cross-encoders are slow; only rerank a small shortlist
  (20–50 candidates).
- Setting MMR's `fetch_k` too low — it can't diversify if it only fetched `k` candidates.
- Mismatched ensemble weights — start near 0.7 dense / 0.3 sparse and tune on your eval set.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why combine dense and sparse retrieval?</summary>
<p>Dense catches meaning/paraphrases; sparse (BM25) catches exact terms like codes and names. Together they cover each other's blind spots.</p>
</details>

<details>
<summary>Bi-encoder vs cross-encoder — when is each used?</summary>
<p>Bi-encoder (fast, separate embeddings) for first-pass retrieval; cross-encoder (slow, reads query+doc together) for reranking a small shortlist.</p>
</details>

<details>
<summary>What problem does MMR solve?</summary>
<p>Near-duplicate results — it balances relevance with diversity so the context covers more ground.</p>
</details>

<details>
<summary>What does fetch_k do in MMR?</summary>
<p>It's the wide candidate pool MMR diversifies down to k — too low and there's nothing to diversify from.</p>
</details>
</div>

**Related:** [Vector stores](/docs/rag-course/07-vector-stores) · [Glossary](/docs/glossary)

Next: [Query Enhancement →](/docs/rag-course/10-query-enhancement)
