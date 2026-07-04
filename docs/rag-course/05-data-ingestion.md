---
id: 05-data-ingestion
title: "Data Ingestion & Parsing"
sidebar_position: 5
description: Loading and parsing every source type into LangChain Documents — text, PDF, Word, CSV/Excel, JSON, and SQL — plus project setup, the Document structure, and text splitting. One submodule per topic, ending with a cheat sheet.
tags: [RAG, Ingestion]
---

# Data Ingestion & Parsing

<div class="tldr">
<strong>TL;DR</strong>

- Every source (text, PDF, Word, CSV/Excel, JSON, SQL) becomes a LangChain
  **Document** via its loader, then gets split into overlapping chunks.
- `Document` = `page_content` (text) + `metadata` (source, page, row).
- PDFs lose the most data — use a layout/OCR-aware loader for scans and tables.
</div>

The longest foundational section — and the one that quietly decides retrieval quality.
The job: get **any** source (text, PDF, Word, CSV/Excel, JSON, SQL) cleanly into the
pipeline as LangChain **Documents**, then split them. Garbage in here means garbage
retrieval downstream.

Each topic below is its own submodule with the loader/function for that source. The
last submodule is a **cheat sheet** you can scan at a glance.

![Every source converges into one Document format, then chunks](/img/ingestion-loaders.svg)

## Project setup with `uv`

`uv` is a fast Python package + environment manager. Pattern: init the project, add
dependencies, run inside the managed environment.

```bash
uv init rag-project
cd rag-project
uv add langchain langchain-community langchain-text-splitters \
       pypdf docx2txt unstructured openpyxl jq
uv run python ingest.py
```

A clean project layout keeps loaders, splitters, and index code separate so the
pipeline stays readable as it grows.

## The `Document` structure

Every loader, whatever the source, returns the same object: a **`Document`** with
`page_content` (the text) and `metadata` (source, page, row, …). Standardizing on this
is exactly what lets one pipeline handle many file types.

```python
from langchain_core.documents import Document

doc = Document(
    page_content="Tesla reported record revenue in Q3.",
    metadata={"source": "tesla_q3.pdf", "page": 1},
)
```

Keep good metadata — you'll filter and cite with it later.

## Text files — `TextLoader`

The simplest source: a `.txt` file straight into `page_content`.

```python
from langchain_community.document_loaders import TextLoader

docs = TextLoader("notes.txt", encoding="utf-8").load()
# → [Document(page_content="...full file text...", metadata={"source": "notes.txt"})]
```

For a whole folder, `DirectoryLoader` runs a loader over every matching file:

```python
from langchain_community.document_loaders import DirectoryLoader, TextLoader

docs = DirectoryLoader("docs/", glob="*.txt", loader_cls=TextLoader).load()
```

## Text splitting

Loaded documents are too big to retrieve precisely, so they're split into chunks. The
**recursive** splitter is the default — it tries paragraph → line → sentence → word,
so it rarely cuts mid-thought.

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,                          # overlap so boundary facts survive
    separators=["\n\n", "\n", ". ", " ", ""],   # coarse → fine
)
chunks = splitter.split_documents(docs)
```

Rule of thumb: ~1000 chars with ~10–20% overlap to start, then tune on real data.

## PDF — `PyPDFLoader`

PDFs are the most common real source. `PyPDFLoader` returns **one Document per page**,
with the page number in metadata.

```python
from langchain_community.document_loaders import PyPDFLoader

pages = PyPDFLoader("handbook.pdf").load()   # one Document per page
# pages[0].metadata == {"source": "handbook.pdf", "page": 0}
```

## Messy & scanned PDFs

The part that earns its keep — naive loaders silently lose data on hard PDFs:

- **Scanned / image PDFs** have no text layer → need **OCR** to extract anything.
- **Multi-column layouts** get read in the wrong order by simple extractors → use a
  layout-aware loader.
- **Tables** flatten into garbled text → keep them structured (HTML/markdown) instead.

```python
from langchain_community.document_loaders import UnstructuredPDFLoader

# "hi_res" runs layout + table detection (and OCR for scans) — slower but accurate
docs = UnstructuredPDFLoader("scanned.pdf", strategy="hi_res").load()
```

## Word — `Docx2txtLoader`

Pulls the text out of a `.docx`.

```python
from langchain_community.document_loaders import Docx2txtLoader

docs = Docx2txtLoader("policy.docx").load()
# → one Document with the document's text in page_content
```

For richer structure (headings, tables) `UnstructuredWordDocumentLoader` is the
heavier alternative.

## CSV & Excel

For CSV, `CSVLoader` makes **one Document per row** — great when each row is its own
record. Keep the header so each row has context.

```python
from langchain_community.document_loaders import CSVLoader

docs = CSVLoader("sales.csv").load()   # one Document per row
```

Excel (`.xlsx`) goes through the Unstructured loader, which reads sheets:

```python
from langchain_community.document_loaders import UnstructuredExcelLoader

docs = UnstructuredExcelLoader("report.xlsx", mode="elements").load()
```

## JSON — `JSONLoader`

JSON needs you to say _which fields_ become the content, using a `jq`-style schema.

```python
from langchain_community.document_loaders import JSONLoader

# pull the "content" field from each item in a top-level array
loader = JSONLoader(
    file_path="data.json",
    jq_schema=".[].content",
    text_content=True,
)
docs = loader.load()
```

Point `jq_schema` at the field(s) you actually want indexed; push the rest into
metadata.

## SQL databases — `SQLDatabase`

Pull rows from a database and turn them into Documents. LangChain's `SQLDatabase`
utility connects via SQLAlchemy; you run a query and wrap each row.

```python
from langchain_community.utilities import SQLDatabase
from langchain_core.documents import Document

db = SQLDatabase.from_uri("sqlite:///company.db")          # any SQLAlchemy URI

rows = db.run("SELECT id, title, body FROM articles;", fetch="all")

docs = [
    Document(
        page_content=f"{title}\n\n{body}",
        metadata={"source": "articles", "row_id": rid},
    )
    for rid, title, body in rows
]
```

This lets relational data flow into the same chunk → embed → retrieve pipeline as
everything else. (Querying a DB with natural language later is **Text2SQL** — a
separate, advanced topic.)

## Cheat sheet

| Source              | Loader / function                          | What it returns                |
| ------------------- | ------------------------------------------ | ------------------------------ |
| Text (`.txt`)       | `TextLoader`                               | one Document (full text)       |
| Folder of files     | `DirectoryLoader(glob=…, loader_cls=…)`    | one Document per file          |
| PDF (`.pdf`)        | `PyPDFLoader`                              | one Document **per page**      |
| Messy / scanned PDF | `UnstructuredPDFLoader(strategy="hi_res")` | layout + OCR-aware Documents   |
| Word (`.docx`)      | `Docx2txtLoader`                           | one Document (text)            |
| CSV (`.csv`)        | `CSVLoader`                                | one Document **per row**       |
| Excel (`.xlsx`)     | `UnstructuredExcelLoader`                  | Documents from sheet elements  |
| JSON (`.json`)      | `JSONLoader(jq_schema=…)`                  | Documents from selected fields |
| SQL database        | `SQLDatabase` + wrap rows                  | one Document per row           |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Using `PyPDFLoader` on a **scanned** PDF — no text layer, so you get empty content.
  Use an OCR/layout-aware loader for scans and tables.
- Chunking with **no overlap** — facts on a boundary get split and lost.
- Dropping metadata at load time — you can't filter by source or cite later.
</div>

<div class="takeaway">
One rule ties it together: whatever the source, get it into a LangChain <code>Document</code> (page_content + metadata) with the right loader, then split into overlapping chunks. PDFs lose the most data — reach for the layout/OCR-aware loader when they're scanned or full of tables.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What does every loader return, regardless of source?</summary>
<p>A LangChain <code>Document</code> with <code>page_content</code> (the text) and <code>metadata</code>.</p>
</details>

<details>
<summary>Which loader gives one Document per page? Per row?</summary>
<p><code>PyPDFLoader</code> → one Document per page. <code>CSVLoader</code> → one Document per row.</p>
</details>

<details>
<summary>Why does a scanned PDF need a special loader?</summary>
<p>It's an image with no text layer, so a plain loader extracts nothing — you need OCR (e.g. UnstructuredPDFLoader, hi_res).</p>
</details>
</div>

**Related:** [Embeddings →](/docs/rag-course/06-embeddings) · [Glossary](/docs/glossary)

Next: Vector Embedding & Vector Databases — _coming soon (studying next)._
