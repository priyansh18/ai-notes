---
id: 08-advanced-chunking
title: "Advanced Chunking & Preprocessing"
sidebar_position: 8
description: Semantic chunking — splitting where the meaning shifts instead of at fixed sizes — how it works under the hood, the threshold knob, and building a RAG pipeline on top of it.
tags: [RAG, Chunking]
---

# Advanced Chunking & Preprocessing

<div class="tldr">
<strong>TL;DR</strong>

- **Semantic chunking** splits where the _meaning_ changes, not at a fixed character count.
- It embeds each sentence, then starts a new chunk when similarity to the previous one drops.
- More coherent chunks → better retrieval, but it costs extra embeddings at index time.
</div>

Fixed-size splitting cuts text mid-thought. **Semantic chunking** uses embedding
similarity between sentences to decide boundaries, so each chunk stays on one topic.
One submodule per idea, ending with a cheat sheet.

## How semantic chunking works

![Semantic chunking splits where sentence similarity drops](/img/semantic-chunking.svg)

The core idea, step by step:

```
 1. split the document into sentences
 2. embed every sentence
 3. walk neighbour pairs, measure similarity between consecutive sentences
 4. start a NEW chunk wherever similarity drops below a threshold (topic shift)
```

A worked feel for it — these sentences naturally fall into two groups (LangChain vs
Paris), and a semantic chunker would split right where the topic jumps:

```python
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = [
    "LangChain is a framework for building applications with LLMs.",
    "LangChain combines LLMs with tools like OpenAI and Pinecone.",
    "The Eiffel Tower is located in Paris.",       # ← big similarity drop here
    "France is a popular tourist destination.",
]
emb = model.encode(sentences)
# similarity between sentence i and i+1 — the drop marks the boundary
for i in range(len(sentences) - 1):
    print(round(float(cosine_similarity([emb[i]], [emb[i + 1]])[0][0]), 2))
```

## The built-in `SemanticChunker`

LangChain ships this so you don't hand-roll it. Give it an embedding model and a
breakpoint rule:

```python
# pip install langchain-experimental
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

splitter = SemanticChunker(
    embeddings=OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile",   # break at the biggest similarity drops
    breakpoint_threshold_amount=70,           # tune: higher = fewer, larger chunks
)
chunks = splitter.create_documents([text])
```

`breakpoint_threshold_amount` is the dial: raise it and only the sharpest topic
changes trigger a split (fewer, bigger chunks); lower it for more, smaller chunks.

## A custom threshold chunker (the idea, in code)

You can build the same logic yourself — embed sentences, then cut whenever the
neighbour similarity falls under a fixed threshold:

```python
def semantic_chunks(sentences, model, threshold=0.6):
    emb = model.encode(sentences)
    chunks, current = [], [sentences[0]]
    for i in range(1, len(sentences)):
        sim = float(cosine_similarity([emb[i - 1]], [emb[i]])[0][0])
        if sim < threshold:           # topic shifted → close the chunk
            chunks.append(" ".join(current)); current = []
        current.append(sentences[i])
    chunks.append(" ".join(current))
    return chunks
```

Then those chunks feed the normal pipeline: embed → store → retrieve → answer.

## When it's worth the cost

Semantic chunking embeds **every sentence** just to decide the splits, so indexing is
slower and pricier. Reach for it when:

- documents have loose structure (no clean headings/paragraphs),
- queries are very specific, or
- retrieval precision is critical (medical, legal).

For well-structured docs, recursive or document-aware splitting is usually enough.

## Cheat sheet

| Task                      | Code                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Built-in semantic chunker | `SemanticChunker(embeddings=…, breakpoint_threshold_type="percentile", breakpoint_threshold_amount=70)` |
| Tune split frequency      | raise `breakpoint_threshold_amount` → fewer, larger chunks                                              |
| Manual similarity         | `cosine_similarity([emb[i]], [emb[i+1]])` then cut below a threshold                                    |
| When to use               | loose structure · specific queries · precision-critical domains                                         |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Using semantic chunking on already well-structured docs — you pay the extra
  embedding cost for little gain.
- Setting the threshold blind — tune it on real data; too low fragments everything,
  too high merges unrelated topics.
- Forgetting it's an **index-time** cost — it doesn't slow down queries, just ingestion.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>How does semantic chunking decide a boundary?</summary>
<p>It embeds each sentence and starts a new chunk where the similarity to the previous sentence drops below a threshold (a topic shift).</p>
</details>

<details>
<summary>What does breakpoint_threshold_amount control?</summary>
<p>How big a similarity drop must be to trigger a split — higher = fewer, larger chunks; lower = more, smaller chunks.</p>
</details>

<details>
<summary>When is it NOT worth it?</summary>
<p>On well-structured documents where recursive/document-aware splitting already aligns with topic boundaries — semantic chunking just adds embedding cost.</p>
</details>
</div>

**Related:** [Chunking strategies (glossary)](/docs/glossary) · [Embeddings](/docs/rag-course/06-embeddings)

Next: [Hybrid Search Strategies →](/docs/rag-course/09-hybrid-search)
