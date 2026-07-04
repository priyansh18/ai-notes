---
id: 06-embeddings
title: "Vector Embedding & Vector Databases"
sidebar_position: 6
description: What embeddings are and how to create them — the meaning-vector intuition, cosine similarity, HuggingFace and OpenAI embedding models, embedding single queries vs batches of documents, and choosing a model.
tags: [RAG, Embeddings]
---

# Vector Embedding & Vector Databases

<div class="tldr">
<strong>TL;DR</strong>

- An embedding is a vector that captures **meaning**; similar texts sit close together.
- Use `embed_query` for the question, `embed_documents` for your chunks — **same model**.
- Rank by cosine similarity; MiniLM = 384-dim (free, local), OpenAI small = 1536.
</div>

Embeddings are how RAG turns text into something a computer can compare. This section
covers the intuition, the similarity math, and how to actually generate embeddings
with HuggingFace and OpenAI models. One submodule per topic, ending with a cheat sheet.

## What an embedding is

An **embedding** translates text into numbers — a fixed-length vector that captures
_meaning_. Texts about similar things land close together in this number-space; unrelated
texts land far apart.

![Text becomes a vector; similar meanings sit close in space](/img/embedding-space.svg)

A tiny 2-D example makes it concrete. Notice the animal words cluster on one side and
the vehicle words on the other:

```python
import numpy as np
import matplotlib.pyplot as plt

# Real embeddings have hundreds of dimensions; this is just 2D to visualize.
word_embeddings = {
    "cat":    [0.8, 0.6],
    "kitten": [0.75, 0.65],
    "dog":    [0.7, 0.3],
    "puppy":  [0.65, 0.35],
    "car":    [-0.5, 0.2],
    "truck":  [-0.45, 0.15],
}
```

`cat`/`kitten` sit together, `car`/`truck` sit together, and the two groups are far
apart — that spatial closeness _is_ semantic similarity.

## Measuring similarity (cosine)

To compare two vectors we use **cosine similarity** — it measures the angle between
them, ignoring length:

- close to **1** → very similar
- close to **0** → unrelated
- close to **−1** → opposite meaning

```python
def cosine_similarity(vec1, vec2):
    dot_product = np.dot(vec1, vec2)
    norm_a = np.linalg.norm(vec1)
    norm_b = np.linalg.norm(vec2)
    return dot_product / (norm_a * norm_b)

cat_vector    = [0.8, 0.6, 0.3]
kitten_vector = [0.75, 0.65, 0.35]
car_vector    = [-0.5, 0.2, 0.1]

cosine_similarity(cat_vector, kitten_vector)   # ≈ 0.99  → very similar
cosine_similarity(cat_vector, car_vector)      # ≈ 0.30  → unrelated
```

The big gap between the two scores is exactly what retrieval relies on to rank chunks.

## Your first embeddings — HuggingFace

`HuggingFaceEmbeddings` runs an open model locally — **no API key needed**. The classic
starter model is `all-MiniLM-L6-v2`, which outputs a **384-dimension** vector.

```python
from langchain_huggingface import HuggingFaceEmbeddings

# Local, free, no API key
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

text = "Hello, I am learning about embeddings!"
embedding = embeddings.embed_query(text)

print(len(embedding))   # 384  → the model's fixed vector size
```

## Embedding a query vs a batch of documents

Two methods, and the difference matters:

- **`embed_query(text)`** — one string → one vector. Use for the user's question.
- **`embed_documents([...])`** — a list of strings → a list of vectors. Use to embed
  all your chunks at once (much faster than looping one at a time).

```python
sentences = [
    "The cat sat on the mat",
    "The dog played in the yard",
    "I love programming in Python",
    "Python is my favorite programming language",
]

doc_vectors = embeddings.embed_documents(sentences)   # one vector per sentence
print(len(doc_vectors), len(doc_vectors[0]))          # 4 vectors, each 384-dim
```

## OpenAI embeddings (the API alternative)

When you want a hosted, higher-quality model instead of a local one, swap in
`OpenAIEmbeddings` — same `embed_query` / `embed_documents` interface, but it calls the
API (needs a key).

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")   # 1536-dim
vector = embeddings.embed_query("Hello, embeddings!")
```

The interface is identical, so you can switch providers without rewriting your
pipeline — just don't mix models between indexing and querying.

## Choosing an embedding model

Different models trade size (quality/storage) against speed. Common open choices:

| Model                                   | Dim | Best for                         |
| --------------------------------------- | --- | -------------------------------- |
| `all-MiniLM-L6-v2`                      | 384 | fast, general purpose, real-time |
| `all-MiniLM-L12-v2`                     | 384 | slightly better, a bit slower    |
| `all-mpnet-base-v2`                     | 768 | best quality, slower             |
| `multi-qa-MiniLM-L6-cos-v1`             | 384 | Q&A / semantic search            |
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | 50+ languages                    |

Start with `all-MiniLM-L6-v2`; move up to `mpnet` only if your eval set shows it's worth
the extra cost and latency.

## Cheat sheet

| Task                 | Code                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| Local model (no key) | `HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")` |
| Hosted model         | `OpenAIEmbeddings(model="text-embedding-3-small")`                           |
| Embed one query      | `embeddings.embed_query(text)`                                               |
| Embed many chunks    | `embeddings.embed_documents([...])`                                          |
| Compare two vectors  | `cosine_similarity(a, b)` → 1 = same, 0 = unrelated                          |
| MiniLM size          | 384 dimensions · OpenAI small = 1536                                         |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Embedding queries and documents with **different models** → incomparable vectors.
- Re-embedding only new docs after switching models — you must re-embed **everything**.
- Confusing `embed_query` (one string) with `embed_documents` (a list); using the wrong
  one breaks shapes or wastes calls.
- Comparing raw distances without knowing the metric (cosine: higher = closer; L2:
lower = closer).
</div>

<div class="takeaway">
Embeddings = meaning as a vector; cosine similarity ranks them. Use <code>embed_query</code> for the question and <code>embed_documents</code> for your chunks, with the <strong>same</strong> model on both sides. Start with all-MiniLM-L6-v2 (384-dim, free, local).
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What does an embedding represent?</summary>
<p>The meaning of a piece of text as a fixed-length vector — similar meanings land close together.</p>
</details>

<details>
<summary>embed_query vs embed_documents?</summary>
<p><code>embed_query</code> embeds one string (the question); <code>embed_documents</code> embeds a list (your chunks) in one batch.</p>
</details>

<details>
<summary>How many dimensions does all-MiniLM-L6-v2 output?</summary>
<p>384. (OpenAI text-embedding-3-small = 1536.)</p>
</details>

<details>
<summary>What does cosine similarity of ~0.9 vs ~0.1 mean?</summary>
<p>~0.9 = very similar meaning; ~0.1 = basically unrelated. That gap is what retrieval uses to rank chunks.</p>
</details>
</div>

**Related:** [Cosine similarity (Glossary)](/docs/glossary) · [Vector Stores →](/docs/rag-course/07-vector-stores)

Next: Vector Stores & Vector Databases — _coming soon (studying next)._
