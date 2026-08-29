---
id: 19-corrective-rag
title: "Corrective RAG (CRAG)"
sidebar_position: 20
description: The CRAG pattern — retrieve, grade for relevance, rewrite the query or fall back to web search when docs are irrelevant, then generate a grounded answer. Built step by step in LangGraph.
tags: [RAG, CRAG, LangGraph, Agents]
---

# Corrective RAG (CRAG)

<div class="tldr">
<strong>TL;DR</strong>

- **Naive RAG** retrieves docs and answers blindly — even when the retrieved docs are irrelevant, the LLM hallucinates a plausible-sounding answer.
- **Corrective RAG (CRAG)** adds a **grading step** after retrieval: an LLM judges whether each doc is relevant. If not → rewrite the query or fall back to **web search**.
- Build it in LangGraph with four nodes: `retrieve → grade_documents → (web_search | generate)` connected by a conditional edge.
</div>

Naive RAG has a dirty secret: it answers confidently even when the retrieved context is garbage.
The user asks about a topic that isn't in your vector store, the retriever returns the
*least-irrelevant* chunks, and the LLM weaves them into a hallucinated answer that sounds
perfect. **Corrective RAG** fixes this by adding a self-check loop — grade the docs before
you generate. One submodule per idea, ending with a cheat sheet.

## Why naive RAG fails

The retriever always returns *something*. Cosine similarity doesn't know "none of these are
relevant" — it just ranks. So you get three failure modes:

1. **Irrelevant retrieval** — the top-k docs don't actually answer the question, but the LLM
   generates from them anyway.
2. **Partial retrieval** — some docs are relevant, some aren't, and the LLM mixes them
   together indiscriminately.
3. **Out-of-scope queries** — the question is outside the knowledge base entirely, but the
   system still produces an answer instead of saying "I don't know."

CRAG addresses all three by inserting a **relevance gate** between retrieval and generation.

## The CRAG paper's key idea

The [Corrective Retrieval Augmented Generation](https://arxiv.org/abs/2401.15884) paper
(Yan et al., 2024) proposes a simple but effective pipeline:

1. **Retrieve** documents as usual.
2. **Grade** each document for relevance to the query (using a lightweight evaluator).
3. **Decide**:
   - If docs are **relevant** → proceed to generate.
   - If docs are **ambiguous** → refine the query and re-retrieve.
   - If docs are **irrelevant** → fall back to web search for fresh context.
4. **Generate** the answer from the surviving (or newly fetched) context.

The key insight: **retrieval quality is not guaranteed, so you must check it before trusting it.**

## Building CRAG in LangGraph

We'll build this as a four-node graph with a conditional edge after grading.

### Step 1 — Define the state

```python
from typing import List, Literal
from typing_extensions import TypedDict
from langchain.schema import Document

class CRAGState(TypedDict):
    question: str
    documents: List[Document]
    generation: str
    web_search_needed: str  # "yes" or "no"
```

### Step 2 — Retrieve node

Nothing special here — standard retriever call.

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

vectorstore = Chroma(
    collection_name="my_docs",
    embedding_function=OpenAIEmbeddings(),
    persist_directory="./chroma_db",
)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

def retrieve(state: CRAGState) -> CRAGState:
    """Retrieve documents from the vector store."""
    question = state["question"]
    docs = retriever.invoke(question)
    return {"question": question, "documents": docs, "web_search_needed": "no"}
```

### Step 3 — Grade documents (LLM-as-judge)

This is the core of CRAG. An LLM reads each document and the question, then decides:
is this document relevant? We use structured output so the LLM returns a clean `yes`/`no`.

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

class GradeResult(BaseModel):
    """Binary relevance score for a retrieved document."""
    score: Literal["yes", "no"] = Field(
        description="Is the document relevant to the question? 'yes' or 'no'"
    )

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
grader_llm = llm.with_structured_output(GradeResult)

GRADER_PROMPT = """You are a relevance grader. Given a user question and a retrieved document,
decide whether the document contains information relevant to answering the question.

Give a binary 'yes' or 'no' score. 'yes' means the document is relevant.

Question: {question}
Document: {document}
"""

def grade_documents(state: CRAGState) -> CRAGState:
    """Grade each retrieved document for relevance. Drop irrelevant ones."""
    question = state["question"]
    documents = state["documents"]

    relevant_docs = []
    web_search_needed = "no"

    for doc in documents:
        prompt = GRADER_PROMPT.format(question=question, document=doc.page_content)
        result = grader_llm.invoke(prompt)

        if result.score == "yes":
            relevant_docs.append(doc)
        else:
            # at least one doc was irrelevant — flag for potential web search
            web_search_needed = "yes"

    # if ALL docs were irrelevant, definitely need web search
    if not relevant_docs:
        web_search_needed = "yes"

    return {
        "question": question,
        "documents": relevant_docs,
        "web_search_needed": web_search_needed,
    }
```

### Step 4 — Decide: generate or web search?

A **conditional edge** in LangGraph inspects the state and routes to the right next node.

```python
def decide_to_generate(state: CRAGState) -> Literal["web_search", "generate"]:
    """Route based on grading results."""
    if state["web_search_needed"] == "yes" and len(state["documents"]) == 0:
        # no relevant docs at all — must search the web
        return "web_search"
    elif state["web_search_needed"] == "yes":
        # some relevant docs, but gaps — supplement with web search
        return "web_search"
    else:
        # all docs relevant — go straight to generation
        return "generate"
```

### Step 5 — Web search fallback

When the grader says the vector store docs aren't good enough, fall back to **Tavily** (or
any web search API) for fresh context.

```python
from langchain_community.tools.tavily_search import TavilySearchResults

web_search_tool = TavilySearchResults(max_results=3)

def web_search(state: CRAGState) -> CRAGState:
    """Fall back to web search when retrieved docs are irrelevant."""
    question = state["question"]
    existing_docs = state["documents"]

    # search the web
    web_results = web_search_tool.invoke({"query": question})

    # convert web results to Document objects
    web_docs = [
        Document(page_content=r["content"], metadata={"source": r["url"]})
        for r in web_results
    ]

    # combine any surviving relevant docs with web results
    all_docs = existing_docs + web_docs
    return {"question": question, "documents": all_docs, "web_search_needed": "no"}
```

### Step 6 — Generate node

Standard RAG generation — but now with *vetted* context.

```python
from langchain_core.prompts import ChatPromptTemplate

GENERATE_PROMPT = ChatPromptTemplate.from_template(
    """You are an assistant answering questions. Use ONLY the following context to answer.
If the context doesn't contain enough information, say so.

Context:
{context}

Question: {question}
"""
)

def generate(state: CRAGState) -> CRAGState:
    """Generate an answer from graded (and possibly web-supplemented) context."""
    question = state["question"]
    documents = state["documents"]
    context = "\n\n".join(doc.page_content for doc in documents)

    chain = GENERATE_PROMPT | llm
    answer = chain.invoke({"context": context, "question": question})

    return {
        "question": question,
        "documents": documents,
        "generation": answer.content,
    }
```

### Step 7 — Compile the graph

```python
from langgraph.graph import StateGraph, END

workflow = StateGraph(CRAGState)

# add nodes
workflow.add_node("retrieve", retrieve)
workflow.add_node("grade_documents", grade_documents)
workflow.add_node("web_search", web_search)
workflow.add_node("generate", generate)

# edges
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "grade_documents")

# conditional edge after grading — the decision point
workflow.add_conditional_edges(
    "grade_documents",
    decide_to_generate,
    {
        "web_search": "web_search",
        "generate": "generate",
    },
)

workflow.add_edge("web_search", "generate")
workflow.add_edge("generate", END)

# compile
crag_app = workflow.compile()
```

### Running it

```python
result = crag_app.invoke({"question": "What is corrective RAG?"})
print(result["generation"])

# to see each step:
for step in crag_app.stream({"question": "What is corrective RAG?"}):
    print(step)
```

## Adding query rewriting

The CRAG paper also proposes **query rewriting** when docs are ambiguous — refine the
question and re-retrieve. You can add a `rewrite_query` node that feeds back into `retrieve`:

```python
def rewrite_query(state: CRAGState) -> CRAGState:
    """Rewrite the query for better retrieval."""
    question = state["question"]
    rewrite_prompt = f"""Rewrite this question to be more specific and search-friendly.
    Original: {question}
    Rewritten:"""
    rewritten = llm.invoke(rewrite_prompt).content.strip()
    return {"question": rewritten, "documents": [], "web_search_needed": "no"}
```

Then add a three-way conditional edge: `generate`, `web_search`, or `rewrite_query` — and
wire `rewrite_query` back to `retrieve` to create a loop.

## Cheat sheet

| Task | Code |
| --- | --- |
| Grade a doc | `llm.with_structured_output(GradeResult).invoke(prompt)` |
| Conditional edge | `workflow.add_conditional_edges("node", decide_fn, {"a": "node_a", "b": "node_b"})` |
| Web search fallback | `TavilySearchResults(max_results=3).invoke({"query": q})` |
| Compile CRAG graph | `workflow.compile()` |
| Stream steps | `for step in app.stream({...}): print(step)` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Grading with the same expensive model you use for generation — use `gpt-4o-mini` or a small
  model for grading; it's a binary yes/no, not a creative task.
- Not handling the "zero relevant docs" case — if every doc fails grading and you skip web
  search, you generate from an empty context and get nonsense.
- Grading the full document instead of the chunk — if your chunks are huge, the grader LLM
  call is slow and expensive. Grade the chunk, not the source doc.
- No cap on the rewrite loop — if you add query rewriting, limit retries (e.g. max 2 rewrites)
  or you can loop forever.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What problem does CRAG solve that naive RAG doesn't?</summary>
<p>Naive RAG answers from whatever the retriever returns, even if the docs are irrelevant. CRAG grades retrieved docs for relevance and falls back to web search (or rewrites the query) when they're not good enough.</p>
</details>

<details>
<summary>What does the grading node output?</summary>
<p>A binary "yes" or "no" for each retrieved document — is it relevant to the question? Irrelevant docs are dropped before generation.</p>
</details>

<details>
<summary>When does the conditional edge route to web search vs generate?</summary>
<p>If any docs were graded irrelevant (especially if all were), it routes to web_search to supplement the context. If all docs passed grading, it goes straight to generate.</p>
</details>

<details>
<summary>Why use structured output for the grader?</summary>
<p>So the LLM returns a clean, parseable "yes"/"no" instead of free text — making the conditional edge logic reliable.</p>
</details>
</div>

**Related:** [Agentic RAG](/docs/rag-course/16-agentic-rag) · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)

Next: [Adaptive RAG & Self-RAG →](/docs/rag-course/20-adaptive-rag)
