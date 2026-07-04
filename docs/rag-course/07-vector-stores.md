---
id: 07-vector-stores
title: "Vector Stores & Vector Databases"
sidebar_position: 7
description: Vector store vs vector database, then building a full traditional RAG pipeline with ChromaDB and LangChain — load, split, embed, store, similarity search, and answer with the modern chain and LCEL.
tags: [RAG, VectorDB, ChromaDB]
---

# Vector Stores & Vector Databases

<div class="tldr">
<strong>TL;DR</strong>

- **Store** (Chroma/FAISS) = lightweight, &lt;1M vectors, prototyping. **Database**
  (Pinecone/Qdrant/Weaviate) = production scale + filters + CRUD.
- Pipeline: load → split → embed → **store in Chroma** → retrieve → answer.
- Build the answer step with the modern chain (`create_retrieval_chain`) or **LCEL**.
- Chroma defaults to **L2 distance** — lower score = more similar.
</div>

Where embeddings actually live, and how to build a complete RAG pipeline on top of
them. This section covers the vector-store-vs-database distinction, then builds
traditional RAG end-to-end with **ChromaDB** and LangChain. One submodule per topic,
ending with a cheat sheet.

## Vector store vs vector database

Both store embeddings and do similarity search — the difference is scale and features.

**Vector store** — a lightweight library/tool focused on storing and searching vectors
efficiently. Simple **K-nearest-neighbour** similarity search; usually runs in-memory
or as a local file on a single machine. Best for prototypes, research, and apps with
**under ~1M vectors**.

**Vector database** — a full database system designed for vectors at scale. Adds
advanced search with **filters, metadata queries, and full CRUD**; a distributed
architecture with replication, sharding, and high availability. Best for production
systems and **billions** of vectors.

![Vector store vs vector database — side by side](/img/vector-store-vs-db.svg)

|             | Vector store                              | Vector database                                    |
| ----------- | ----------------------------------------- | -------------------------------------------------- |
| Scale       | ~1M vectors                               | billions+                                          |
| Setup time  | minutes                                   | hours/days                                         |
| Cost        | free / \$                                 | \$\$\$ / \\\\$\\\\$\\\\\$\$                        |
| Query speed | microseconds                              | milliseconds                                       |
| Features    | basic search                              | full CRUD + filters                                |
| Deployment  | local                                     | cloud                                              |
| Examples    | FAISS, Annoy, **ChromaDB**, ScaNN, NMSLIB | Pinecone, Weaviate, Qdrant, Milvus, DataStax Astra |

**The simple rule:** start with a vector **store** for prototyping and learning;
graduate to a vector **database** when you need production-scale features, reliability,
and advanced querying.

## The full RAG pipeline (overview)

Everything in this section assembles into one flow — indexing happens once offline,
querying runs per question and reuses the stored vectors:

![Full RAG pipeline — indexing and querying](/img/rag-pipeline.svg)

Benefits, restated: fewer hallucinations, up-to-date info, citable sources, and it
works on domain-specific knowledge.

## Load and split

Load a folder of `.txt` files, then split into ~500-char chunks with overlap (covered
in the ingestion section).

```python
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

documents = DirectoryLoader(
    "data", glob="*.txt", loader_cls=TextLoader,
    loader_kwargs={"encoding": "utf-8"},
).load()

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,            # keep context across boundaries
    length_function=len,
)
chunks = text_splitter.split_documents(documents)
```

## Build the ChromaDB vector store

`Chroma.from_documents` embeds every chunk and stores it. `persist_directory` writes it
to disk so you don't re-embed next run; `collection_name` groups the vectors.

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=OpenAIEmbeddings(),
    persist_directory="./chroma_db",
    collection_name="rag_collection",
)

print(vectorstore._collection.count())   # number of vectors stored
```

## Similarity search

Query the store directly to see what retrieval returns — `k` is how many chunks.

```python
similar_docs = vectorstore.similarity_search("What are the types of machine learning?", k=3)
```

To see _how_ close each match is, use the scored variant:

```python
results = vectorstore.similarity_search_with_score("What is deep learning?", k=3)
```

**Reading the score (important gotcha):** ChromaDB defaults to **L2 (Euclidean)
distance**, where **lower = more similar** (0 = identical). If you configure it for
cosine instead, **higher = more similar** (range −1 to 1). Always know which metric
your store uses before interpreting scores.

## The modern RAG chain

LangChain assembles retrieval + prompt + LLM into one chain. Turn the store into a
**retriever**, write a prompt with a `{context}` slot, then combine.

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

llm = ChatOpenAI(model_name="gpt-3.5-turbo")
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

system_prompt = (
    "You are an assistant for question-answering tasks. Use the retrieved context "
    "to answer. If you don't know, say so. Keep it to three sentences.\n\n"
    "Context: {context}"
)
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{input}"),
])

# "stuff" = put all retrieved docs into the {context} slot in one prompt
document_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, document_chain)

response = rag_chain.invoke({"input": "What is deep learning?"})
print(response["answer"])
```

- **`create_stuff_documents_chain`** stuffs all retrieved docs into the prompt's
  `{context}` placeholder and sends it to the LLM.
- **`create_retrieval_chain`** wires the retriever to that document chain — the
  complete RAG pipeline. Its result has `answer` and the retrieved `context`.

## Building the pipeline with LCEL

LCEL (LangChain Expression Language) builds the same pipeline as a composable chain
with the `|` operator — more flexible and explicit.

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

custom_prompt = ChatPromptTemplate.from_template(
    "Use the context to answer. If it's not in the context, say you don't know.\n\n"
    "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
)

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain_lcel = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | custom_prompt
    | llm
    | StrOutputParser()
)

answer = rag_chain_lcel.invoke("What is deep learning?")
```

Read the chain left to right: the question fans out — `retriever | format_docs` builds
the context while `RunnablePassthrough` carries the question through — then both fill the
prompt, the LLM answers, and `StrOutputParser` returns a clean string.

## Swapping the backend — same interface, different store

The best part of LangChain: every vector store exposes the **same three methods** —
`add_documents()`, `similarity_search()`, and `as_retriever()`. So you can switch from a
local store to a cloud database without rewriting your pipeline.

![All vector stores and databases converge through the retriever to the LLM](/img/vector-stores-converge.svg)

### FAISS (fast local store)

FAISS is a library for very fast similarity search over dense vectors (GPU-capable,
handles millions of vectors). Great local alternative to Chroma.

```python
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

vectorstore = FAISS.from_documents(chunks, OpenAIEmbeddings())
vectorstore.save_local("faiss_index")          # persist to disk
# later:
vectorstore = FAISS.load_local("faiss_index", OpenAIEmbeddings(),
                               allow_dangerous_deserialization=True)
```

### InMemory vector store (simplest)

Backed by a plain dict, with cosine similarity computed in NumPy. Zero setup — perfect
for tiny demos and tests. Nothing persists when the process ends.

```python
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import OpenAIEmbeddings

vector_store = InMemoryVectorStore(embedding=OpenAIEmbeddings())
vector_store.add_documents(documents)
vector_store.similarity_search("how's the weather forecast", k=2)
```

### Pinecone (managed cloud database)

A fully-managed serverless vector database. You create an index (set its **dimension**
to match your embedding model and a **metric** like cosine), then wrap it.

```python
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings

pc = Pinecone(api_key="YOUR_PINECONE_KEY")     # use an env var, never hard-code
if not pc.has_index("rag"):
    pc.create_index(name="rag", dimension=1024, metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"))

embeddings = OpenAIEmbeddings(model="text-embedding-3-small", dimensions=1024)
vector_store = PineconeVectorStore(index=pc.Index("rag"), embedding=embeddings)
vector_store.add_documents(documents)
```

### DataStax Astra DB (managed, Cassandra-based)

Another managed database — connect with an API endpoint + token and a collection name.

```python
from langchain_astradb import AstraDBVectorStore
from langchain_openai import OpenAIEmbeddings

vector_store = AstraDBVectorStore(
    embedding=OpenAIEmbeddings(model="text-embedding-3-small", dimensions=1024),
    api_endpoint="YOUR_ASTRA_ENDPOINT",        # from env vars
    token="YOUR_ASTRA_TOKEN",
    collection_name="astra_vector_langchain",
)
vector_store.add_documents(documents)
```

<div class="gotcha">
<strong>⚠ Keep your keys out of code</strong>

Load API keys and DB tokens from environment variables (or a secret manager) — never
paste them into a notebook or commit them to git. If a key ever lands in a file you
shared, rotate it immediately. Also: a Pinecone/Astra index's <code>dimension</code>
must match your embedding model exactly (e.g. 1024 or 1536), or inserts fail.

</div>

## Cheat sheet

| Task                    | Code                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Build + persist store   | `Chroma.from_documents(documents=chunks, embedding=OpenAIEmbeddings(), persist_directory="./chroma_db")`         |
| Plain similarity search | `vectorstore.similarity_search(query, k=3)`                                                                      |
| With scores             | `vectorstore.similarity_search_with_score(query, k=3)`                                                           |
| Make a retriever        | `vectorstore.as_retriever(search_kwargs={"k": 3})`                                                               |
| Modern chain            | `create_retrieval_chain(retriever, create_stuff_documents_chain(llm, prompt))`                                   |
| LCEL chain              | `{"context": retriever \| format_docs, "question": RunnablePassthrough()} \| prompt \| llm \| StrOutputParser()` |
| Chroma default metric   | L2 distance — **lower = more similar**                                                                           |
| FAISS (local)           | `FAISS.from_documents(chunks, emb)` · `save_local` / `load_local`                                                |
| InMemory (demo)         | `InMemoryVectorStore(embedding=emb)`                                                                             |
| Pinecone (cloud)        | `PineconeVectorStore(index=pc.Index("rag"), embedding=emb)`                                                      |
| Astra DB (cloud)        | `AstraDBVectorStore(embedding=emb, api_endpoint=…, token=…, collection_name=…)`                                  |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Misreading Chroma scores — it uses **L2 distance** (lower = more similar), the
  opposite of cosine. Don't assume "higher = better."
- Forgetting `persist_directory` — your store vanishes when the process ends and you
  re-embed (and re-pay) every run.
- Setting `k` too high — you stuff irrelevant chunks into the prompt; too low and you
  miss the answer. Start at 3–5.
- Reaching for a vector database (Pinecone/Qdrant) for a tiny prototype — a local
store is faster and free.
</div>

<div class="takeaway">
A vector <strong>store</strong> (ChromaDB, FAISS) is for prototyping and &lt;1M vectors; a vector <strong>database</strong> (Pinecone, Qdrant, Weaviate) is for production scale. The full pipeline: load → split → embed → store in Chroma → retrieve → answer via the modern chain or LCEL. Watch the distance metric when reading similarity scores.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Vector store vs vector database — one-line difference?</summary>
<p>A store is a lightweight library for &lt;1M vectors (prototyping); a database adds filters, CRUD, sharding, and HA for production scale.</p>
</details>

<details>
<summary>How do you interpret a Chroma similarity score?</summary>
<p>Chroma defaults to L2 distance, so <strong>lower = more similar</strong> (0 = identical) — the opposite of cosine.</p>
</details>

<details>
<summary>What do create_stuff_documents_chain and create_retrieval_chain each do?</summary>
<p>The first stuffs retrieved docs into the prompt's context slot; the second wires the retriever to that document chain to form the full RAG pipeline.</p>
</details>

<details>
<summary>Why persist the store to disk?</summary>
<p>So you don't re-embed (and re-pay) on every run — reopen the saved index instead.</p>
</details>
</div>

---

## Which vector DB should I pick?

Three tiers — pick the column that matches your situation, then the row that fits.

![Decision tree for choosing a vector store or database](/img/vector-db-decision.svg)

### At a glance

| Tool         | Type            | Hosting               | Best for                                           | Watch out for                                          |
| ------------ | --------------- | --------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| **FAISS**    | store (library) | local                 | fast in-memory search, research, &lt;1–10M vectors | no persistence/CRUD out of the box; you manage storage |
| **Chroma**   | store           | local / embedded      | prototyping, learning, small apps                  | not built for huge scale; default metric is **L2**     |
| **Pinecone** | database        | fully managed (cloud) | production, hands-off scaling                      | pay-per-vector cost grows; vendor lock-in              |
| **Qdrant**   | database        | open-source / cloud   | best self-hosted perf per \$, rich filtering       | you run the infra (or pay for cloud)                   |
| **Weaviate** | database        | open-source / cloud   | strong hybrid search + filtering, modules          | heavier to operate                                     |
| **Milvus**   | database        | open-source / cloud   | very large scale, GPU options                      | heavier ops; overkill for small apps                   |
| **pgvector** | extension       | your Postgres         | already on Postgres, transactional + vectors       | tune indexes; not as fast as dedicated DBs at scale    |

### Pick by constraint

- _Just want it managed, don't mind cost_ → **Pinecone**.
- _Self-hosted, best performance per dollar_ → **Qdrant**.
- _Open-source with strong hybrid search_ → **Weaviate**.
- _Already run Postgres, modest scale_ → **pgvector**.
- _Local prototype / course work_ → **Chroma** or **FAISS**.

<div class="gotcha">
<strong>⚠ Distance metric gotcha</strong>

- **Chroma** defaults to **L2 (lower = closer)**.
- **Cosine** similarity is **higher = closer**.
- Always confirm which metric your store uses before reading scores.
- Switching embedding models means **re-indexing the whole store**.
- Managed cost scales with **stored vectors**, not just queries — estimate before committing.
</div>

**Related:** [Embeddings](/docs/rag-course/06-embeddings) · [Glossary](/docs/glossary)

Next: Advanced Chunking & Preprocessing — _coming soon (studying next)._
