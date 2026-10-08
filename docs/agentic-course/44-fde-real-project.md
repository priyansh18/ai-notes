---
id: 44-fde-real-project
title: "FDE Project Build: Problem Statement to Production"
sidebar_position: 44
description: "How a forward deployed engineer turns a vague HR support problem into an evidence-gated agentic RAG copilot: discovery, design, modular build, FastAPI, audit log, Docker and push-to-deploy."
tags: [Agentic AI, Agentic RAG, Deployment]
---

# FDE Project Build: Problem Statement to Production

<div class="tldr">
<strong>TL;DR</strong>

- **The FDE loop is discover, design, build, deploy, iterate**, and the engineer is measured by the customer outcome (fewer repeated HR questions, faster correct answers), not by lines of code.
- **The design is evidence-gated agentic RAG**: route the question, retrieve from the private knowledge base, grade the evidence with an LLM judge, fall back to web search only when private evidence is weak, grade again, rewrite and retry under a `max_retries` cap, and always return sources plus a decision trace.
- **The build is notebook first, then modules**: prove the LangGraph workflow in one notebook, then split it into config, ingestion, vector store, state, workflow, audit, routes and a FastAPI entrypoint, containerise it, and let the cloud platform redeploy on every push.
</div>

This lesson follows one forward deployed engineer (FDE) project from a customer problem statement all the way to a live URL. The useful part is not the finished copilot but the process: how a fuzzy complaint ("employees keep asking HR the same questions") becomes a scoped technical design, why the obvious solutions get rejected, what order the modules are written in, and which production pieces (config, audit log, tracing, Docker, auto-deploy) turn a demo into something a team can run.

## The FDE loop and how the problem is scoped

An FDE sits between a customer and the technology. The lesson frames the mission as five steps: **discover** (talk to the people with the problem, see their data, learn their access rules and success metrics), **design** (decide what to build), **build**, **deploy**, and **iterate** on user feedback. A quick prototype normally sits between discover and build so the customer can confirm direction before the real engineering starts; the lesson skips it only because this is a one-shot build.

The scenario: a fictional company of about 5,000 employees has an internal HR knowledge base (leave, remote work, attendance, payroll, benefits, onboarding and offboarding, code of conduct, HR forms). The documents exist, but employees still contact HR because they cannot find the right one or tell which policy applies. Discovery turns that into three constraints: answers must be **fast**, must be **grounded in approved private documents whenever possible**, and must be **transparent** about where they came from. Some questions (a latest public holiday announcement) are not in the private documents at all, so the system needs a controlled path to public information.

Three candidate solutions are rejected on the way to the design:

| Candidate | Why it fails the constraints |
| --- | --- |
| Keyword search (regex over files) | Returns many documents instead of one answer, breaks when formats change, still needs a human to read |
| Plain chatbot | Answers confidently even when no company evidence exists; no grounding |
| Simple RAG (retrieve once, generate) | Trusts whatever the retriever returns, cannot answer when the private base is missing or outdated, never decides whether the evidence is strong enough |

## Why simple RAG is not enough, and what agentic RAG adds

Simple RAG retrieves once and generates from whatever comes back, with no check on whether that evidence is actually sufficient. For an internal HR policy assistant that is a problem on two of the three stated constraints: it cannot tell a strong chunk from a weak or outdated one, and it has no path to current public information when the private base simply does not contain the answer (a holiday calendar update, for instance).

Agentic RAG keeps the same retrieval building blocks (embed, store, retrieve, generate) but adds decisions made during execution: **route** the question before retrieving anything, **grade** the retrieved evidence with an LLM judge instead of trusting it blindly, **search the web only as a controlled fallback** when the private grade is weak, grade that web evidence too, and **rewrite and retry** under a capped loop when evidence stays weak. The answer is generated only after the evidence has been judged, and the judgment itself (which path, which grade) ships with the answer as a trace. That is the whole reason the design in this lesson is one step beyond retrieve-and-hope RAG rather than a variation on it.

## The workflow design

```
question
   |
route_question (LLM, structured: kb | direct)
   |-- direct --> direct_answer --> END
   |
retrieve_kb (Pinecone, top_k=4)
   |
grade_kb (LLM judge: good | weak)
   |-- good --> generate_from_kb --> END  (sources = private docs)
   |
search_web (Tavily, max_results=5)
   |
grade_web (LLM judge: good | weak) <-------------------+
   |-- good --> generate_from_web --> END  (sources = URLs)
   |-- weak and retry_count < MAX_RETRIES --> rewrite_query --+
   |-- weak and cap reached --> insufficient_answer --> END
```

Three paths cover the three question types the lesson demonstrates: "how many annual leave days" is answered from the handbook without a web call; "latest public holiday rules" gets a weak private grade, goes to the web, passes the web grade and is answered with URLs plus a note that it needs HR validation before being treated as policy; "hello" is routed `direct` and never touches retrieval. Every response carries `source_used`, citations and the full decision `trace` (router choice, chunks retrieved, each grade), which the front end shows so an employee can see why the answer came from where it did.

The **execution principle** behind the graph: never search the public web until internal evidence is graded insufficient, and never generate from evidence that has not been graded at all.

## The termination guard: stopping the rewrite-and-retry loop forever

A LangGraph agentic RAG workflow that rewrites a query and searches again whenever the grade comes back weak needs something that forces it to stop. Here that is a `retry_count` field carried in the graph state: the rewrite node increments it, and the routing function that runs after every web grade compares it against `max_retries` before deciding to rewrite again. Once the count reaches the cap, the graph does not rewrite a third time; it routes straight to a fixed "could not find enough reliable evidence" node and ends there. The guard is what turns an open-ended retry loop into a workflow with a guaranteed end state, even for a question the web genuinely cannot answer.

## Stack and repository layout

| Layer | Choice in the lesson | Note |
| --- | --- | --- |
| Orchestration | LangGraph | Nodes are plain functions over a shared `TypedDict` state |
| Private knowledge base | Pinecone | An index is the database, a namespace is a table; one namespace per department or tenant |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims); notebook used a free 384-dim sentence-transformer | The index dimension must match the embedding model, so the vector store keeps a model-to-dimension map |
| LLM | One OpenAI chat model for routing, grading, rewriting and generation | Structured output via Pydantic for every decision |
| Web fallback | Tavily search tool | Returns LLM-ready results; called only when the KB grade is weak |
| Backend | FastAPI + Uvicorn, Jinja2 templates, static HTML/CSS/JS | Front end generated with a coding assistant; a real team would have a front end developer |
| Audit log | SQLite table of question, source used and trace | Swappable for any production database by changing the connection code |
| Observability | LangSmith via four environment variables | No extra code beyond loading the environment at startup |
| Packaging and hosting | Dockerfile, App Platform with auto-deploy from the `main` branch | Push to `main` rebuilds and redeploys |

The repo layout is `app/` with `api/routes.py`, `core/config.py`, `core/logging.py`, `rag/state.py`, `rag/vector_store.py`, `rag/workflow.py`, `services/ingestion.py`, `services/audit.py` and `main.py`, plus `data/sample_kb/`, `uploads/`, `static/`, `templates/`, `ingest_sample_kb.py`, `run.py`, `requirements.txt` and `.env`. The folders and empty files are created by a short `create_project.py` script (a list of paths, `Path.mkdir(parents=True, exist_ok=True)` for folders, `Path.touch(exist_ok=True)` for files) so the same skeleton can be reproduced for the next customer. Every package folder gets an `__init__.py` so modules import as `app.core.config`.

## Build order: notebook first, then modules

The workflow is first proven in a single notebook against a public documentation page (load with a web loader, chunk with a recursive character splitter, embed, upsert to Pinecone, build the ten nodes, compile, run four demo questions). Only then is it rewritten as modules, mostly by copying node functions out of the notebook. The lesson keeps a `steps.md` file listing the order, and the order matters because each file depends on the one before it:

1. `requirements.txt` with pinned versions, then `.env` with the OpenAI, Tavily, Pinecone and LangSmith keys plus index name, namespace, model names and an admin key.
2. `core/config.py` (settings class) and `core/logging.py`. Tested from a root-level `test.py` before anything else is written.
3. `data/sample_kb/` with the customer's documents (a handbook and an HR operations runbook in the lesson; in a real engagement these come from wherever the customer stores them, which is a discovery question).
4. `services/ingestion.py`: `load_file()` picks a loader by extension (`.pdf`, `.txt`, `.md`, `.docx`, anything else raises "unsupported"), `chunk_documents()` splits.
5. `rag/vector_store.py`: embedding dimension lookup, lazy `get_embeddings()` and `get_vector_store()` singletons, index creation if missing, `get_retriever(k=top_k)`, `add_documents(chunks)`.
6. `ingest_sample_kb.py`: iterate the folder, load, chunk, add. Running it once creates the index; the app must not start before this has run.
7. `rag/state.py` (state plus the two Pydantic decision models) and `rag/workflow.py` (nodes, conditional edges, compiled graph, an `ask(question)` entrypoint that seeds the state with only the question).
8. `services/audit.py` (`init_db()` creates the table, `write_audit(question, source_used, trace)` inserts one row per chat), then `api/routes.py`, `main.py`, the front end files, `run.py`, `Dockerfile` and `.dockerignore`.

## Serving, auditing and tracing

`routes.py` registers an `APIRouter` with prefix `/api` and three endpoints. `GET /api/health` returns status and the app name from settings. `POST /api/chat` validates a `ChatRequest` whose `question` has a minimum length of 2 and a maximum of 3000, calls `ask()`, writes the audit row, and returns answer, `source_used`, trace, citations and any rewritten query. `POST /api/ingest` is `async`, takes an uploaded file and an admin key header, rejects a wrong key with an HTTP error, rejects unsupported extensions, saves the file under `uploads/`, then loads, chunks and adds it to the same Pinecone namespace. In the demo, uploading a new company handbook grew the namespace from 5 to 13 chunks and the next question about that company was answered from the private base with the new file as its citation.

`main.py` creates the FastAPI app, calls `init_db()`, includes the router, mounts `static/`, points Jinja2 at `templates/` and serves `index.html` on `GET /`. `run.py` starts Uvicorn on port 8080 with reload for development. LangSmith tracing only started appearing once `load_dotenv()` was called in `main.py`, because the four `LANGSMITH_*` variables have to be in the process environment before the first LLM call.

## Shipping it

The Dockerfile is the standard shape: a `python:3.11` base, a working directory, a few environment variables, copy and install `requirements.txt`, copy the source, `EXPOSE 8080`, and a Uvicorn command on the same port. `.dockerignore` excludes `.git`, `.env`, the local virtual environment and caches. On the platform side: connect the GitHub account, pick the repo and the `main` branch, enable auto-deploy, accept the Docker build it detects, pick the smallest shared-CPU instance (all inference is remote so the container does almost nothing), paste the `.env` contents into the environment variable panel (secrets can be marked encrypted), and create the app. The build runs, the app gets a public URL, and the same chat questions are re-run against it as the acceptance check.

## Code that matters

A sketch of the pieces that carry the design: the state, a grader with structured output, and the routing functions that make the graph conditional. The settings class (`pydantic-settings` plus `lru_cache`), node bodies for retrieval, search and generation, and the `ask()` entrypoint are standard calls and are omitted.

```python
import os
from typing import List, Literal, TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

MAX_RETRIES = int(os.getenv("MAX_RETRIES", "1"))   # 1 in the demo; 5 or 6 suggested for real use

class AgentState(TypedDict):
    question: str
    current_query: str      # rewritten query after a weak web pass
    kb_docs: list
    web_results: str
    kb_grade: str           # "good" or "weak"
    web_grade: str
    answer: str
    source_used: str        # "kb", "web", "direct" or "insufficient"
    retry_count: int
    trace: List[str]
    citations: List[str]

class EvidenceGrade(BaseModel):
    grade: Literal["good", "weak"] = Field(description="good only if the evidence answers the question")

llm = ChatOpenAI(model=os.environ["OPENAI_MODEL"], temperature=0)

def grade_kb(state: AgentState) -> dict:
    context = "\n\n".join(d.page_content for d in state["kb_docs"])
    prompt = ("You are an evidence grader. Can this private knowledge base evidence answer the "
              f"question? Return good or weak.\n\nQuestion: {state['question']}\n\nEvidence:\n{context}")
    grade = llm.with_structured_output(EvidenceGrade).invoke(prompt).grade
    return {"kb_grade": grade, "trace": state["trace"] + [f"kb_grade={grade}"]}

def after_route(state: AgentState) -> str:
    return "retrieve_kb" if state["source_used"] == "kb" else "direct_answer"

def after_kb_grade(state: AgentState) -> str:
    return "generate_from_kb" if state["kb_grade"] == "good" else "search_web"

def after_web_grade(state: AgentState) -> str:
    if state["web_grade"] == "good":
        return "generate_from_web"
    if state["retry_count"] < MAX_RETRIES:
        return "rewrite_query"      # loop: rewrite, search again, grade again
    return "insufficient"           # termination guard

builder = StateGraph(AgentState)
# add_node(...) calls for the ten nodes omitted (route_question, retrieve_kb, grade_kb, search_web, grade_web, rewrite_query, generate_from_kb, generate_from_web, direct_answer, insufficient)
builder.add_edge(START, "route_question")
builder.add_conditional_edges("route_question", after_route, ["retrieve_kb", "direct_answer"])
builder.add_edge("retrieve_kb", "grade_kb")
builder.add_conditional_edges("grade_kb", after_kb_grade, ["generate_from_kb", "search_web"])
builder.add_edge("search_web", "grade_web")
builder.add_conditional_edges("grade_web", after_web_grade, ["generate_from_web", "rewrite_query", "insufficient"])
builder.add_edge("rewrite_query", "search_web")     # closes the retry loop
for terminal in ("generate_from_kb", "generate_from_web", "direct_answer", "insufficient"):
    builder.add_edge(terminal, END)
graph = builder.compile()
```

## Failure modes and gotchas

- **Index dimension mismatch.** Pinecone indexes are created with a fixed dimension. Switching from a 384-dim open-source embedding to a 1536-dim provider model without a new index fails on upsert; the vector store keeps a model-to-dimension map and creates the index from it.
- **Loader picked by extension, not content.** A markdown file saved with a `.pdf` suffix produced a "not a valid file or URL" error from the PDF loader during ingestion testing. Validate the extension against what the customer actually sends.
- **Import paths break when tests live in a subfolder.** `from app.core.config import get_settings` failed with "No module named app" from `tests/test.py`; the quick fix was running the test file from the project root, the proper fix is package installation or a path setup.
- **The grader overrules the router.** A demo question meant to be answered from the private base was graded weak and went to the web, because the chunks were semantically close but did not actually answer it. That is the design working, not a bug, and it is why the trace is shown to the user.
- **Placeholder security.** The admin key for `/api/ingest` is a shared string in `.env` and compared in the route. The lesson is explicit that a real deployment needs proper authentication, a production database instead of SQLite, object storage instead of a local `uploads/` folder, and guardrails on inputs and outputs. These are listed as the follow-up assignments.

## Takeaways

- Worth remembering: the scoping step is where the design is decided. Writing down why keyword search, a plain chatbot and simple RAG each miss a stated constraint is what justifies the extra grading and routing nodes.
- Evidence grading is the difference between RAG and agentic RAG here: two LLM judges with structured `good`/`weak` output turn "retrieve and hope" into "retrieve, verify, then generate", with the web as a controlled fallback rather than a default.
- Prove the workflow in a notebook, then move it into modules in dependency order (config, ingestion, vector store, state, workflow, audit, routes, entrypoint). The notebook nodes copy across almost unchanged.
- Production readiness is a checklist, not a feature: health endpoint, input length limits, audit rows with the decision trace, tracing, Docker, auto-deploy, and a known list of what is still placeholder (admin key, SQLite, local uploads).

## Test yourself

<details>
<summary>Why does the design reject simple RAG for the HR copilot?</summary>
<p>Simple RAG retrieves once and generates from whatever comes back. It cannot tell weak or outdated chunks from strong ones, cannot answer when the private base is missing the information, and never makes an explicit evidence decision. The customer constraints (grounded, transparent, able to reach current public information) need grading, routing and a controlled web fallback.</p>
</details>

<details>
<summary>What stops the rewrite-and-retry loop from running forever?</summary>
<p>A <code>retry_count</code> field in the graph state that is incremented by the rewrite node and compared against <code>max_retries</code> in the routing function after the web grade. When the cap is reached the graph routes to a fixed insufficient-evidence answer node instead of rewriting again.</p>
</details>

<details>
<summary>In what order are the modules built, and why does the order matter?</summary>
<p>Requirements and <code>.env</code>, then config and logging, then sample data, ingestion, vector store and the ingest script, then state and workflow, then audit, then routes, the FastAPI entrypoint, front end, Dockerfile and deployment. Each file imports the one before it (routes import the workflow and audit; the workflow imports the retriever and state; everything imports settings), so building in that order lets each piece be tested in isolation before the next depends on it.</p>
</details>

**Related:** [FDE Roadmap](/docs/agentic-course/43-fde-roadmap) · [Corrective RAG (CRAG)](/docs/rag-course/19-corrective-rag) · [Self-Correcting Multi-Agent App on DigitalOcean](/docs/agentic-course/41-self-correcting-multi-agent-digitalocean)
