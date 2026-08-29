---
id: 20-adaptive-rag
title: "Adaptive RAG & Self-RAG"
sidebar_position: 21
description: Self-RAG — the model decides whether to retrieve, generates, then self-reflects on its output. Adaptive RAG routes queries to different strategies. Both built as LangGraph graphs with reflection loops.
tags: [RAG, Self-RAG, Adaptive RAG, LangGraph]
---

# Adaptive RAG & Self-RAG

<div class="tldr">
<strong>TL;DR</strong>

- **Self-RAG** — the model decides *whether* to retrieve at all, generates an answer, then **self-reflects**: is it grounded? is it relevant? If reflection fails → retry with a better query.
- **Adaptive RAG** — a router inspects the query and picks the best strategy: vector store, web search, or direct answer — no one-size-fits-all pipeline.
- Both are built in LangGraph as graphs with conditional edges and reflection loops.
</div>

CRAG (previous section) checks docs *after* retrieval. But what if the question doesn't
need retrieval at all? Or what if the *generated* answer is the thing that's wrong — not
the docs? **Self-RAG** and **Adaptive RAG** push the intelligence further: the model
reasons about *when* to retrieve and *whether its own answer is good*. One submodule per
idea, ending with a cheat sheet.

## Self-RAG: retrieve only when needed, then self-check

The [Self-RAG paper](https://arxiv.org/abs/2310.11511) (Asai et al., 2023) trains a model
to emit special **reflection tokens** at inference time:

1. **Retrieve** — should I retrieve? (yes/no)
2. **ISREL** — is the retrieved doc relevant to the query?
3. **ISSUP** — is the generated sentence *supported* by the retrieved doc?
4. **ISUSE** — is the overall response *useful* to the user?

In practice — rather than training a custom model — we simulate these checks with an LLM
judging its own output. The pattern is:

```
question → should_retrieve? → (retrieve → grade docs) → generate → reflect → (retry or finish)
```

## Adaptive RAG: route first, then execute

Adaptive RAG takes a different angle: instead of always doing the same pipeline, **classify
the query first** and route it to the right strategy.

| Query type | Strategy |
| --- | --- |
| Simple factual ("What year was Python created?") | **Direct LLM answer** — no retrieval needed |
| Domain-specific ("Explain our refund policy") | **Vector store retrieval** — search your docs |
| Current events ("Latest OpenAI news") | **Web search** — your vector store is stale |
| Complex / multi-part | **Multi-step retrieval** — decompose and retrieve per sub-question |

The router is itself an LLM call with structured output — it reads the question and returns
a strategy label.

## Building Adaptive RAG + Self-RAG in LangGraph

We'll combine both ideas into one graph: route the query first (Adaptive), then execute the
chosen strategy, then self-reflect (Self-RAG).

### Step 1 — State and imports

```python
from typing import List, Literal
from typing_extensions import TypedDict
from langchain.schema import Document
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

class AdaptiveRAGState(TypedDict):
    question: str
    documents: List[Document]
    generation: str
    route: str           # "vectorstore" | "web_search" | "direct"
    retry_count: int

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

### Step 2 — Query router

The router classifies the question and picks a strategy. Structured output keeps it clean.

```python
class RouteDecision(BaseModel):
    """Route a user question to the best data source."""
    datasource: Literal["vectorstore", "web_search", "direct"] = Field(
        description="Route to 'vectorstore' for domain-specific questions, "
                    "'web_search' for current events, or 'direct' for simple factual questions."
    )

router_llm = llm.with_structured_output(RouteDecision)

ROUTER_PROMPT = """You are a query router. Given a user question, decide the best strategy:

- "vectorstore" — the question is about domain-specific knowledge that would be in our docs.
- "web_search" — the question is about recent events or needs up-to-date information.
- "direct" — the question is simple enough to answer directly without any retrieval.

Question: {question}
"""

def route_question(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Classify the query and pick a retrieval strategy."""
    question = state["question"]
    result = router_llm.invoke(ROUTER_PROMPT.format(question=question))
    return {**state, "route": result.datasource, "retry_count": 0}
```

### Step 3 — The conditional edge after routing

```python
def pick_strategy(state: AdaptiveRAGState) -> Literal["retrieve", "web_search", "direct_answer"]:
    """Route to the correct node based on the router's decision."""
    route = state["route"]
    if route == "vectorstore":
        return "retrieve"
    elif route == "web_search":
        return "web_search"
    else:
        return "direct_answer"
```

### Step 4 — Retrieval and web search nodes

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.tools.tavily_search import TavilySearchResults

vectorstore = Chroma(
    collection_name="my_docs",
    embedding_function=OpenAIEmbeddings(),
    persist_directory="./chroma_db",
)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
web_search_tool = TavilySearchResults(max_results=3)

def retrieve(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Retrieve from the vector store."""
    docs = retriever.invoke(state["question"])
    return {**state, "documents": docs}

def web_search(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Search the web for fresh context."""
    results = web_search_tool.invoke({"query": state["question"]})
    docs = [
        Document(page_content=r["content"], metadata={"source": r["url"]})
        for r in results
    ]
    return {**state, "documents": docs}

def direct_answer(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Answer directly without retrieval."""
    answer = llm.invoke(f"Answer concisely: {state['question']}").content
    return {**state, "documents": [], "generation": answer}
```

### Step 5 — Generate node

```python
def generate(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Generate an answer from the retrieved context."""
    context = "\n\n".join(doc.page_content for doc in state["documents"])
    prompt = f"""Answer the question using ONLY the context below. If the context is
insufficient, say so.

Context:
{context}

Question: {state['question']}"""

    answer = llm.invoke(prompt).content
    return {**state, "generation": answer}
```

### Step 6 — Self-reflection node (the Self-RAG part)

After generation, the model checks its own output. Two questions:
1. **Is the answer grounded in the retrieved docs?** (faithfulness)
2. **Does it actually answer the question?** (relevance)

```python
class ReflectionResult(BaseModel):
    """Self-reflection on generated answer quality."""
    is_grounded: Literal["yes", "no"] = Field(
        description="Is the answer supported by the provided documents?"
    )
    answers_question: Literal["yes", "no"] = Field(
        description="Does the answer actually address the user's question?"
    )

reflection_llm = llm.with_structured_output(ReflectionResult)

REFLECTION_PROMPT = """You are a quality checker. Given a question, retrieved documents,
and a generated answer, evaluate:

1. Is the answer grounded in (supported by) the documents? → is_grounded
2. Does the answer actually address the user's question? → answers_question

Question: {question}
Documents: {documents}
Answer: {answer}
"""

def reflect(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Self-reflect on the generated answer."""
    docs_text = "\n".join(doc.page_content for doc in state["documents"])
    prompt = REFLECTION_PROMPT.format(
        question=state["question"],
        documents=docs_text,
        answer=state["generation"],
    )
    result = reflection_llm.invoke(prompt)

    # if reflection fails, bump retry count
    if result.is_grounded == "no" or result.answers_question == "no":
        return {**state, "retry_count": state["retry_count"] + 1}

    return state  # passes — keep the answer
```

### Step 7 — Decide after reflection

```python
def after_reflection(state: AdaptiveRAGState) -> Literal["rewrite", "finish"]:
    """If reflection failed and we haven't retried too many times, rewrite and retry."""
    if state["retry_count"] > 0 and state["retry_count"] <= 2:
        return "rewrite"
    return "finish"

def rewrite_query(state: AdaptiveRAGState) -> AdaptiveRAGState:
    """Rewrite the question for a better retrieval attempt."""
    rewrite_prompt = f"""Rewrite this question to be clearer and more specific for search:
    Original: {state['question']}
    Rewritten:"""
    rewritten = llm.invoke(rewrite_prompt).content.strip()
    return {**state, "question": rewritten, "documents": []}
```

### Step 8 — Compile the full graph

```python
from langgraph.graph import StateGraph, END

workflow = StateGraph(AdaptiveRAGState)

# nodes
workflow.add_node("route_question", route_question)
workflow.add_node("retrieve", retrieve)
workflow.add_node("web_search", web_search)
workflow.add_node("direct_answer", direct_answer)
workflow.add_node("generate", generate)
workflow.add_node("reflect", reflect)
workflow.add_node("rewrite", rewrite_query)

# entry
workflow.set_entry_point("route_question")

# routing after classification
workflow.add_conditional_edges(
    "route_question",
    pick_strategy,
    {
        "retrieve": "retrieve",
        "web_search": "web_search",
        "direct_answer": "direct_answer",
    },
)

# after retrieval / web search → generate
workflow.add_edge("retrieve", "generate")
workflow.add_edge("web_search", "generate")

# direct answer skips generation and reflection
workflow.add_edge("direct_answer", END)

# after generation → reflect
workflow.add_edge("generate", "reflect")

# after reflection → finish or retry
workflow.add_conditional_edges(
    "reflect",
    after_reflection,
    {
        "rewrite": "rewrite",
        "finish": END,
    },
)

# rewrite loops back to retrieve
workflow.add_edge("rewrite", "retrieve")

adaptive_rag = workflow.compile()
```

### Running it

```python
# domain-specific question → routed to vectorstore
result = adaptive_rag.invoke({
    "question": "How does our cancellation policy work?",
    "documents": [],
    "generation": "",
    "route": "",
    "retry_count": 0,
})
print(result["generation"])

# current events → routed to web search
result = adaptive_rag.invoke({
    "question": "What did OpenAI announce this week?",
    "documents": [],
    "generation": "",
    "route": "",
    "retry_count": 0,
})
print(result["generation"])
```

## Self-RAG vs CRAG vs Adaptive RAG

| | CRAG | Self-RAG | Adaptive RAG |
| --- | --- | --- | --- |
| **Checks** | Docs after retrieval | Docs + generated answer | Query before retrieval |
| **Decision** | Generate or web search | Retrieve or not, answer quality | Which strategy to use |
| **Loop** | No (single pass) | Yes (reflect → retry) | Depends on combination |
| **Strength** | Filters bad docs | Catches hallucinations | Right tool for each query |

In practice you **combine them** — Adaptive routing at the front, CRAG-style grading in the
middle, Self-RAG reflection at the end. That's exactly what our graph above does.

## Cheat sheet

| Task | Code |
| --- | --- |
| Route a query | `llm.with_structured_output(RouteDecision).invoke(prompt)` |
| Conditional routing | `workflow.add_conditional_edges("route_question", pick_fn, {...})` |
| Self-reflection | `llm.with_structured_output(ReflectionResult).invoke(prompt)` |
| Retry loop | conditional edge from `reflect` → `rewrite` → `retrieve` (capped) |
| Direct answer (no retrieval) | skip retrieval entirely for simple questions |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- No retry cap on the reflection loop — without a max retry count, the graph can loop
  forever rewriting and re-retrieving. Always cap it (2–3 retries is plenty).
- Routing with a single keyword match — use an LLM for routing, not regex. Queries are
  ambiguous and keyword rules break on edge cases.
- Reflecting without the source docs — the reflection check needs the retrieved docs to
  judge groundedness. Don't just compare the answer to the question.
- Skipping reflection for direct answers — if the model answered without retrieval, there's
  nothing to ground-check, so route `direct_answer` straight to END.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What two things does Self-RAG's reflection check?</summary>
<p>1) Is the answer grounded in the retrieved documents? (faithfulness) 2) Does the answer actually address the user's question? (relevance)</p>
</details>

<details>
<summary>How does Adaptive RAG differ from CRAG?</summary>
<p>CRAG checks docs after retrieval and falls back to web search. Adaptive RAG classifies the query before retrieval and routes to the best strategy (vectorstore, web search, or direct answer) upfront.</p>
</details>

<details>
<summary>Why cap the reflection retry loop?</summary>
<p>Without a cap, a query that consistently produces poor answers will loop forever — rewriting, re-retrieving, regenerating, and reflecting endlessly. A cap of 2–3 retries prevents this.</p>
</details>

<details>
<summary>When should Adaptive RAG route to "direct" (no retrieval)?</summary>
<p>For simple factual questions the LLM already knows well — retrieval adds latency and cost without improving the answer.</p>
</details>
</div>

**Related:** [Corrective RAG](/docs/rag-course/19-corrective-rag) · [Agentic RAG](/docs/rag-course/16-agentic-rag) · [Agents Architecture](/docs/rag-course/15-agents-architecture)

Next: RAG with Persistent Memory — _coming soon._
