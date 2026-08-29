---
id: 16-agentic-rag
title: "Agentic RAG"
sidebar_position: 17
description: Turning RAG from a fixed pipeline into an agent that reasons about whether to retrieve, which source to use, and whether results are good enough — built with LangGraph, retriever tools, and a ReAct agent that can loop and retry.
tags: [RAG, Agents, LangGraph]
---

# Agentic RAG

<div class="tldr">
<strong>TL;DR</strong>

- **Traditional RAG** retrieves once, blindly, then answers. **Agentic RAG** lets an agent *decide* when and what to retrieve, and retry if needed.
- Wrap a retriever as a **tool** (`create_retriever_tool`) so a ReAct agent can call it — even choosing between multiple knowledge bases.
- It's just LangGraph: retriever tools + an agent that loops until the answer is grounded.
</div>

Plain RAG always does the same thing: embed the query, retrieve top-k, stuff it in the prompt.
**Agentic RAG** puts an agent in charge, so retrieval becomes a decision, not a fixed step.
One submodule per idea, ending with a cheat sheet.

![Traditional RAG retrieves once; agentic RAG reasons about whether and what to retrieve and can retry](/img/agentic-rag.svg)

Reading the diagram: **top** — traditional RAG is a straight line (query → retrieve →
generate → answer) that never checks its own work. **Bottom** — the agent reasons, picks a
retriever tool (or web search), checks whether the docs are relevant, and loops back to retry
with a better query if they aren't.

## Traditional RAG vs Agentic RAG

| | Traditional RAG | Agentic RAG |
| --- | --- | --- |
| Retrieval | Always once, fixed | Agent decides *if* and *what* to retrieve |
| Sources | One vector store | Can choose between many tools / stores |
| Bad results | Answers anyway | Can reflect and retry |
| Flow | Straight line | Loop with reasoning |

The cost is more LLM calls and latency; the payoff is grounded answers on harder questions.

## A basic RAG graph in LangGraph

Even before adding agent reasoning, you can express plain RAG as a two-node graph — a
retrieve node and a generate node over a shared state. This is the foundation you make
"agentic" next.

```python
from typing import List
from pydantic import BaseModel
from langchain.schema import Document
from langgraph.graph import StateGraph, END

class RAGState(BaseModel):
    question: str
    retrieved_docs: List[Document] = []
    answer: str = ""

def retrieve_docs(state: RAGState) -> RAGState:
    docs = retriever.invoke(state.question)
    return RAGState(question=state.question, retrieved_docs=docs)

def generate_answer(state: RAGState) -> RAGState:
    context = "\n\n".join(d.page_content for d in state.retrieved_docs)
    prompt = f"Answer from the context.\n\nContext:\n{context}\n\nQuestion: {state.question}"
    answer = llm.invoke(prompt).content
    return RAGState(question=state.question, retrieved_docs=state.retrieved_docs, answer=answer)

builder = StateGraph(RAGState)
builder.add_node("retriever", retrieve_docs)
builder.add_node("responder", generate_answer)
builder.set_entry_point("retriever")
builder.add_edge("retriever", "responder")
builder.add_edge("responder", END)
graph = builder.compile()
```

## Retriever as a tool

The key move that makes RAG *agentic*: wrap the retriever as a **tool** so an agent can decide
to call it. `create_retriever_tool` does this in one line.

```python
from langchain.tools.retriever import create_retriever_tool

retriever_tool = create_retriever_tool(
    retriever,
    "retriever_vector_db_blog",
    "Search and return information about LangGraph",   # the agent reads this to decide
)
```

You can register **several** retriever tools over different knowledge bases, and the agent
picks the right one per question:

```python
retriever_tool_langchain = create_retriever_tool(
    retriever_langchain, "retriever_langchain_blog",
    "Search and return information about LangChain",
)
tools = [retriever_tool, retriever_tool_langchain]   # agent chooses which KB to search
```

## The agentic RAG agent

Give those retriever tools to a ReAct agent (Section 15) and you have agentic RAG: it reasons
about which store to search, reads the results, and can search again before answering.

```python
from langgraph.prebuilt import create_react_agent

agent = create_react_agent(llm, tools)   # tools = the retriever tools (+ web search, etc.)
agent.invoke({"messages": [("user", "How do I build a chatbot in LangChain?")]})
# → agent reasons → calls retriever_langchain_blog → reads docs → answers (grounded)
```

Because it's a ReAct loop, the agent can retrieve, judge the results, rewrite the query, and
retrieve again — the retry behaviour plain RAG can't do.

## Cheat sheet

| Task | Code |
| --- | --- |
| RAG state | `class RAGState(BaseModel): question: str; retrieved_docs: list; answer: str` |
| Retrieve node | `retriever.invoke(state.question)` |
| Retriever → tool | `create_retriever_tool(retriever, "name", "description")` |
| Multiple KBs | list several retriever tools; agent picks |
| Agentic RAG | `create_react_agent(llm, [retriever_tool, ...])` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Weak tool descriptions — the agent chooses a retriever tool *by its description*; vague text
  means it searches the wrong knowledge base.
- Making everything agentic — if a question always needs the same single retrieval, plain RAG
  is cheaper and faster.
- No stop condition — an agent that keeps retrieving can loop; cap iterations or let
  `tools_condition`/the agent decide when it's done.
- Forgetting agentic RAG costs more — extra reasoning + possible re-retrieval means more
  tokens and latency than one-shot RAG.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What's the core difference from traditional RAG?</summary>
<p>Traditional RAG retrieves once and answers; agentic RAG lets an agent decide whether/what to retrieve, choose among sources, and retry if results are poor.</p>
</details>

<details>
<summary>What does create_retriever_tool do?</summary>
<p>Wraps a retriever as a tool (with a name and description) so an agent can call it like any other tool.</p>
</details>

<details>
<summary>How does an agent pick between two knowledge bases?</summary>
<p>By the tool descriptions — it reads them and reasons about which retriever tool fits the question.</p>
</details>

<details>
<summary>When is agentic RAG overkill?</summary>
<p>When a question always needs the same single retrieval — the extra reasoning and cost buy nothing over plain RAG.</p>
</details>
</div>

**Related:** [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Hybrid Search](/docs/rag-course/09-hybrid-search) · [Glossary](/docs/glossary)

Next: Autonomous RAG — _coming soon (studying next)._
