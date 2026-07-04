---
id: 11-multimodal-rag
title: "Multi-Modal RAG"
sidebar_position: 11
description: Retrieval over documents that mix text and images — extract the text, have a vision model describe each image as a caption, embed both into one vector store, and answer from whichever is relevant.
tags: [RAG, Multimodal, Vision]
---

# Multi-Modal RAG

<div class="tldr">
<strong>TL;DR</strong>

- Real documents aren't pure text — PDFs have charts, diagrams, tables, screenshots.
- The simplest, most reliable approach: **turn images into text** with a vision model, then embed everything the normal way.
- A query like "what drove Q3 growth?" can then retrieve a _chart's_ caption, not just paragraphs.
</div>

A normal RAG pipeline only reads text, so it's blind to the chart that actually answers the
question. **Multi-modal RAG** makes images retrievable too. The most robust pattern is to
describe each image as text and put it in the same vector store as the paragraphs. One
submodule per step, ending with a cheat sheet.

![Multimodal RAG: extract text, caption images with a vision model, embed both into one store](/img/multimodal-rag.svg)

Reading the diagram: a PDF page has both paragraphs and a chart image. The text is
extracted directly; the chart is sent to a vision model that writes a caption. Both become
text, embed into one shared space, and at query time the right one is retrieved.

## Why plain RAG misses images

Take a one-page report: text describing revenue, plus a bar chart showing Q1→Q3 growth.
Standard extraction (`PyPDFLoader`) pulls the words but **drops the chart** — so a question
like _"which quarter grew fastest?"_ finds nothing, even though the chart says it plainly.
The fix is to give the chart a text representation the retriever can match against.

## Describe images with a vision model

Send each extracted image to a vision-capable model and ask for a factual caption. That
caption is the image's searchable text.

```python
import base64
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

vision = ChatOpenAI(model="gpt-4o")   # a vision-capable model

def describe_image(image_bytes):
    b64 = base64.b64encode(image_bytes).decode()
    msg = HumanMessage(content=[
        {"type": "text", "text":
            "Describe this image factually for search: any chart type, "
            "axes, trends, and key numbers."},
        {"type": "image_url",
         "image_url": {"url": f"data:image/png;base64,{b64}"}},
    ])
    return vision.invoke([msg]).content
# → "Bar chart of revenue by quarter: Q1 moderate, Q2 higher,
#    Q3 highest with exponential growth."
```

The model converts a picture into the kind of text your embedding model already understands.

## Extract text _and_ images from the PDF

Pull both streams out of the document, then run images through the captioner:

```python
import fitz  # PyMuPDF

doc = fitz.open("annual_revenue.pdf")
text_docs, image_captions = [], []

for page in doc:
    text_docs.append(page.get_text())                 # the paragraphs
    for img in page.get_images(full=True):
        xref = img[0]
        image_bytes = doc.extract_image(xref)["image"]
        image_captions.append(describe_image(image_bytes))  # caption each image
```

## Embed both into one store

Captions are just text, so they go into the **same** vector store as the paragraphs — no
special multimodal index needed.

```python
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

emb = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
all_text = text_docs + image_captions          # paragraphs + image captions together
vectorstore = FAISS.from_texts(all_text, emb)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
```

## Answer from whichever is relevant

At query time, retrieval just works — the question matches the chart's caption as easily as
a paragraph, and the LLM answers from both.

```python
docs = retriever.invoke("What drove the strongest revenue growth?")
# retrieves the chart caption ("Q3 highest, exponential growth") +
# the surrounding text ("Q3 had exponential growth due to global expansion")
# → LLM answers: "Q3, driven by global expansion."
```

## Cheat sheet

| Step                           | Code                                                     |
| ------------------------------ | -------------------------------------------------------- |
| Open PDF + iterate pages       | `fitz.open(path)` → `for page in doc`                    |
| Extract text                   | `page.get_text()`                                        |
| Extract images                 | `page.get_images(full=True)` → `doc.extract_image(xref)` |
| Caption an image               | vision model + base64 `image_url` message                |
| Embed text + captions together | `FAISS.from_texts(text_docs + image_captions, emb)`      |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Using a text-only loader and silently dropping every chart/diagram — the most common
  multimodal bug.
- Vague caption prompts — ask for chart type, axes, trends, and numbers, or the caption
  won't match real questions.
- Forgetting captions cost vision-model calls at _index_ time — fine, but budget for it on
  large image-heavy corpora.
- Assuming you need a special "multimodal embedding" — describing images as text and
reusing your normal text embeddings is simpler and works well.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why does standard RAG fail on a PDF with charts?</summary>
<p>Text-only extraction drops the images, so anything the chart conveys is invisible to retrieval — the answer simply isn't in the index.</p>
</details>

<details>
<summary>What's the core trick of this multimodal approach?</summary>
<p>Convert each image into a text caption with a vision model, then embed it like any other text — so one normal vector store covers both modalities.</p>
</details>

<details>
<summary>Do you need a special multimodal vector index?</summary>
<p>No. Once images are captioned as text, your normal text embeddings and store handle everything.</p>
</details>

<details>
<summary>When are image captions generated — index time or query time?</summary>
<p>Index time (during ingestion). Queries then just retrieve the stored captions like any other text.</p>
</details>
</div>

**Related:** [Data Ingestion & Parsing](/docs/rag-course/05-data-ingestion) · [Query Enhancement](/docs/rag-course/10-query-enhancement) · [Glossary](/docs/glossary)

Next: AI Agents & Agentic AI — _coming soon (studying next)._
