---
id: 10-query-enhancement
title: "Query Enhancement"
sidebar_position: 10
description: Reshaping the user's query before retrieval — query expansion (synonyms/context), query decomposition (split complex questions), and HyDE (embed a hypothetical answer) — so the retriever finds better context.
tags: [RAG, Retrieval, Query]
---

# Query Enhancement

<div class="tldr">
<strong>TL;DR</strong>

- The query you send the retriever decides how good the context is — so fix the query first.
- **Expansion** adds synonyms/related terms; **decomposition** splits a complex question; **HyDE** embeds a draft _answer_ instead of the question.
- All three run _before_ retrieval — the LLM only ever sees better context, not your raw phrasing.
</div>

A short or vague query retrieves weak chunks, and weak chunks mean a weak answer. **Query
enhancement** reformulates the question into something the retriever handles better. One
submodule per technique, ending with a cheat sheet.

![Query enhancement: a raw query fans out to expansion, decomposition, and HyDE, all feeding a better retrieval](/img/query-enhancement.svg)

Reading the diagram: the raw user query is short and one-phrased. Each technique reshapes
it into something that matches the stored documents better, and the improved query — not
the original — is what hits the retriever.

## Query Expansion (synonyms & context)

The simplest enhancement: ask an LLM to rewrite the query with synonyms, technical terms,
and useful context, so it overlaps with more of the relevant chunks.

```python
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

query_expansion_prompt = PromptTemplate.from_template("""
You are a helpful assistant. Expand the following query to improve document
retrieval by adding relevant synonyms, technical terms, and useful context.

Original query: "{query}"

Expanded query:
""")

query_expansion_chain = query_expansion_prompt | llm | StrOutputParser()
query_expansion_chain.invoke({"query": "Langchain memory"})
# → "LangChain memory, conversation buffer, chat history,
#    ConversationBufferMemory, persistent memory in LLM apps…"
```

Then you wire that expanded query into a normal RAG pipeline — expand, _then_ retrieve:

```python
from langchain_core.runnables import RunnableMap
from langchain.chains.combine_documents import create_stuff_documents_chain

retriever = vectorstore.as_retriever(search_type="mmr", search_kwargs={"k": 5})
document_chain = create_stuff_documents_chain(llm=llm, prompt=answer_prompt)

rag_pipeline = (
    RunnableMap({
        "input": lambda x: x["input"],
        # expand the question, then retrieve with the expanded text
        "context": lambda x: retriever.invoke(
            query_expansion_chain.invoke({"query": x["input"]})
        ),
    })
    | document_chain
)

rag_pipeline.invoke({"input": "What types of memory does LangChain support?"})
```

The expanded query catches chunks that the original wording would have missed (e.g. a doc
that says "conversation buffer" when the user typed "memory").

## Query Decomposition (split complex questions)

A single complex question often needs facts from several different chunks. **Decomposition**
asks the LLM to break it into simpler sub-questions, retrieve for each, then combine.

```python
decompose_prompt = PromptTemplate.from_template("""
Break the following question into 2-4 simpler, standalone sub-questions
that together cover everything needed to answer it.

Question: "{query}"
Sub-questions (one per line):
""")

decompose_chain = decompose_prompt | llm | StrOutputParser()

# "Compare LangChain and CrewAI memory" →
#   1. How does LangChain handle memory?
#   2. How does CrewAI handle memory?
sub_qs = decompose_chain.invoke({"query": "Compare LangChain and CrewAI memory"}).split("\n")

# retrieve for each sub-question, then merge the contexts
context = []
for q in sub_qs:
    context += retriever.invoke(q)
```

This is the fix for "the answer is split across the corpus" — each sub-question pulls its
own focused chunks instead of one blurry query trying to cover everything.

## HyDE (Hypothetical Document Embeddings)

A question and a document don't _look_ alike, so a question's embedding can sit far from
the chunks that answer it. **HyDE** flips this: have the LLM draft a hypothetical answer,
embed _that_, and retrieve with it — answer-like text matches real documents far better.

![HyDE: question to a drafted answer to its embedding to retrieving the real docs](/img/hyde.svg)

```python
hyde_prompt = PromptTemplate.from_template("""
Write a short, plausible paragraph that answers the question below.
It does not need to be correct — it's only used to improve search.

Question: "{query}"
Hypothetical answer:
""")

hyde_chain = hyde_prompt | llm | StrOutputParser()

def hyde_retrieve(question):
    draft = hyde_chain.invoke({"query": question})   # throwaway fake answer
    return retriever.invoke(draft)                    # retrieve with the draft's vector

docs = hyde_retrieve("What is LCEL in LangChain?")    # then answer from the REAL docs
```

The draft is never shown to the user — it exists only to produce a better _search vector_.
The cost is one extra LLM call per query, so reach for HyDE when plain retrieval keeps
missing the right chunks.

## Cheat sheet

| Technique     | What it does               | Code shape                                                   |
| ------------- | -------------------------- | ------------------------------------------------------------ |
| Expansion     | add synonyms/context       | `expansion_prompt \| llm \| StrOutputParser()` then retrieve |
| Decomposition | split into sub-questions   | retrieve per sub-question, merge contexts                    |
| HyDE          | embed a drafted answer     | `retriever.invoke(hyde_chain.invoke({...}))`                 |
| Wire into RAG | expand → retrieve → answer | `RunnableMap({...}) \| create_stuff_documents_chain(...)`    |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Adding an LLM call you don't need — enhancement costs latency; only use it when plain
  retrieval is actually weak.
- Letting expansion drift off-topic — a too-greedy prompt can add unrelated terms and
  _hurt_ precision. Keep it tight.
- Forgetting HyDE's draft can be wrong — that's fine, it only shapes the search vector;
  the final answer must still come from the **real** retrieved docs.
- Decomposing simple questions — overhead with no benefit; save it for genuinely
multi-part queries.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why does enhancing the query improve the final answer?</summary>
<p>Retrieval quality sets a ceiling on answer quality — a better query retrieves more relevant chunks, so the LLM has better context to answer from.</p>
</details>

<details>
<summary>What problem does HyDE specifically solve?</summary>
<p>A question's embedding sits far from the documents that answer it. A drafted answer is written like a document, so its embedding lands closer to the real source chunks.</p>
</details>

<details>
<summary>When is query decomposition the right tool?</summary>
<p>When one question needs facts spread across multiple chunks — split it into sub-questions, retrieve for each, then combine.</p>
</details>

<details>
<summary>Is the HyDE draft shown to the user?</summary>
<p>No. It's throwaway — used only to produce a better search vector. The final answer comes from the real retrieved documents.</p>
</details>
</div>

**Related:** [Hybrid Search](/docs/rag-course/09-hybrid-search) · [Embeddings](/docs/rag-course/06-embeddings) · [Glossary](/docs/glossary)

Next: [Multi-Modal RAG →](/docs/rag-course/11-multimodal-rag)
