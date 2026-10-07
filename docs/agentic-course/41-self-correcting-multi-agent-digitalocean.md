---
id: 41-self-correcting-multi-agent-digitalocean
title: "Self-Correcting Multi-Agent App on DigitalOcean"
sidebar_position: 41
description: "A writer, reviewer and reviser agent wired into a LangGraph retry loop with a max-revision guard, served by FastAPI, routed through an inference router and auto-deployed on App Platform."
tags: [Agentic AI, LangGraph, Deployment]
---

# Self-Correcting Multi-Agent App on DigitalOcean

<div class="tldr">
<strong>TL;DR</strong>

- **Three agents, one loop**: a writer drafts, a reviewer grades the draft against fixed rules and returns `pass` or `revise` plus feedback, a reviser rewrites from that feedback and sends it back to the reviewer.
- **The loop needs a termination guard**: a `revision_count` in state and a `MAX_REVISIONS` cap (3 in the lesson) so a draft that never passes still exits with the last version instead of running forever.
- **Infrastructure is one OpenAI-compatible endpoint**: an inference router picks a different model per agent task (strong model for writing, cheaper one for review) with a fallback model, and the FastAPI app ships via App Platform with auto-deploy on every push.
</div>

This lesson turns the loop engineering idea into a deployable product. Instead of trusting a single LLM call, the app lets one agent write, a second agent verify, and a third agent fix, repeating until the verifier is satisfied or a hard cap is hit. The same build also shows the production pieces most tutorials skip: per-agent model routing through a managed router, a FastAPI backend with a small web front end, and a push-to-deploy pipeline with no server to manage.

## The three-agent loop

Each agent is a plain Python function that reads from and writes to a shared LangGraph state. The state is a `TypedDict` with five fields: `topic` (user input), `draft` (current text), `feedback` (reviewer notes), `decision` (`pass` or `revise`) and `revision_count` (how many times the reviser has run).

| Agent | Reads | Writes | Prompt contract |
| --- | --- | --- | --- |
| Writer | `topic` | `draft` | Beginner-friendly explanation, 120 to 160 words, one everyday analogy, one tiny example |
| Reviewer | `topic`, `draft` | `decision`, `feedback` | Check only four rules: easy for a beginner, has an analogy, has a concrete example, stays on topic. If any fails, choose `revise` and give one or two precise improvements. Return JSON only |
| Reviser | `topic`, `draft`, `feedback` | `draft`, `revision_count` | Improve the draft using the feedback, keep it concise, return only the improved answer |

The reviewer is the verifier of the loop. Its output is forced into a Pydantic model with two fields (`decision`, `feedback`) so the routing code never has to guess what the LLM meant. A small `parse_review` helper handles the case where the model wraps the JSON in extra text, and a `content_to_text` helper normalises whatever shape the chat response comes back in.

## Routing after review: the termination guard

One conditional edge decides everything. The function `route_after_review` returns `done` when the decision is `pass`, returns `done` again when `revision_count` has reached `MAX_REVISIONS`, and otherwise returns `revise`. The second condition is the safety valve: a weaker writer model or a hard topic can produce drafts the reviewer keeps rejecting, and without the cap the writer-reviewer-reviser cycle becomes an infinite loop that burns credits. With the cap, the app ships the last draft after the third revision even if it never passed.

```
START ──> writer ──> reviewer ──┬── decision == "pass" ──────────> END
                        ^       │
                        │       ├── revision_count >= MAX ───────> END
                        │       │
                        │       └── otherwise ("revise")
                        │                 │
                        └──── reviser <───┘
                         (draft rewritten, revision_count + 1)
```

In the demo runs, a strong writer model passed review on the first attempt for both "what is RAG" and a request to explain agentic RAG in a complex way, so the loop closed after one review. The lesson's point is that the loop exists for the cases where it does not, and that swapping in a weaker writer model is the quickest way to see the revise path fire.

## One endpoint, many models: the inference router

All three agents call the same OpenAI-compatible chat endpoint using `ChatOpenAI` from `langchain-openai`, with `base_url` set to the provider's inference URL and `api_key` set to a model access key. What differs is the `model` string. Two modes are supported by one `effective_model` helper:

- **Router mode**: an environment variable names an inference router. The helper passes the router name as the model. The router, configured in the provider console, holds a list of custom tasks (writing, reviewing, revision), each with a description, a prioritisation policy (cost efficiency, speed optimisation or manual ranking) and an assigned model. The lesson assigns a large flagship model to writing because draft quality matters most, and cheaper models to reviewing and revision because those are narrower jobs.
- **Direct mode**: no router name is set, so each agent loads its own model name from an environment variable, falling back to a single `DEFAULT_MODEL` for everyone.

The router also carries a **fallback model**. If a request matches no task, or the assigned model's provider is down, the fallback handles it in priority order instead of the whole app failing. Functionally this is the same idea as an LLM gateway: routing plus failover without touching application code. The model access key is created after the router and bound to it, so one key covers every model behind the router.

## Serving it with FastAPI

`backend.py` holds the graph and exposes two functions. `run_workflow(topic)` builds the initial state, streams the graph so the UI can show "running the writer agent" style progress, collects every event and returns them. `runtime_info()` returns metadata: provider, endpoint, whether the router is enabled, the router name and the per-agent model names.

`app.py` wraps those in three routes: `GET /` renders `templates/index.html` through Jinja2 (with `static/style.css` and `static/app.js` mounted), `GET /api/config` returns the runtime info, and `POST /api/run` validates a `RunRequest` Pydantic body (a `topic` with min and max length) and calls `run_workflow`. The front end is a single page that posts the topic and renders the draft, decision, feedback and final answer.

## Deploying to App Platform

The deployment is source-based: push to GitHub, point App Platform at the repo, and it builds and serves the app.

| Setting | Value in the lesson | Why |
| --- | --- | --- |
| Source | GitHub repo, `main` branch | GitLab and Bitbucket work the same way |
| Auto-deploy | On | Every push to the branch triggers a rebuild and redeploy without taking the live app down |
| Instance size | Smallest shared-CPU tier (512 MB) | The app only orchestrates; all inference is remote, so it needs almost no memory |
| Run command | `uvicorn app:app --host 0.0.0.0 --port 8080` | Must match the HTTP port the platform routes to; the local `uvicorn.run` block on port 8000 is commented out before deploy |
| Environment variables | `MODEL_ACCESS_KEY` (encrypted), `INFERENCE_BASE_URL`, `DEFAULT_MODEL`, `INFERENCE_ROUTER_NAME`, `MAX_REVISIONS` | Same names the code reads locally from `.env`; the `.env` file itself is gitignored and never pushed |

After "Create app" the platform clones the repo, installs `requirements.txt`, starts the run command and hands back a public URL. The lesson also uses a coding agent to regenerate the README from the project before pushing, since the README is what lets someone else set up the same app.

## Code that matters

A sketch of `backend.py`, reconstructed from what the lesson shows. The FastAPI layer in `app.py` only imports `run_workflow` and `runtime_info`, validates the `topic` with a Pydantic `RunRequest` and exposes them on `/api/run` and `/api/config`.

```python
import os
from typing import Literal, TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

MAX_REVISIONS = int(os.getenv("MAX_REVISIONS", "3"))
ROUTER_NAME = os.getenv("INFERENCE_ROUTER_NAME", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "")

def make_llm(model_name: str) -> ChatOpenAI:
    # One OpenAI-compatible client for every model behind the endpoint.
    return ChatOpenAI(
        model=model_name,
        base_url=os.environ["INFERENCE_BASE_URL"],
        api_key=os.environ["MODEL_ACCESS_KEY"],
        temperature=0.3, max_retries=2, timeout=60,
    )

def effective_model(agent_model: str) -> str:
    # Router set: send the router name as the model and let it choose.
    # No router: the per-agent model, else the shared default.
    return ROUTER_NAME or agent_model or DEFAULT_MODEL

class State(TypedDict):
    topic: str
    draft: str
    feedback: str
    decision: str  # "pass" or "revise"
    revision_count: int

class Review(BaseModel):
    decision: Literal["pass", "revise"] = Field(description="pass only if every rule holds")
    feedback: str = Field(description="one or two precise improvements, or 'no change needed'")

WRITER_RULES = "Explain the topic for a beginner in 120-160 words with one everyday analogy and one tiny example."
REVIEW_RULES = ("Check the draft using only these rules: easy for a beginner, has an everyday analogy, "
                "has a tiny concrete example, stays on the requested topic. If any rule fails choose "
                "'revise' and give one or two precise improvements.")

def writer(state: State) -> dict:
    llm = make_llm(effective_model(os.getenv("WRITER_MODEL", "")))
    reply = llm.invoke(f"You are the writer agent. {WRITER_RULES}\n\nTopic: {state['topic']}")
    return {"draft": reply.content, "feedback": "", "decision": ""}

def reviewer(state: State) -> dict:
    llm = make_llm(effective_model(os.getenv("REVIEWER_MODEL", "")))
    prompt = f"You are the reviewer agent. {REVIEW_RULES}\n\nTopic: {state['topic']}\n\nDraft:\n{state['draft']}"
    review = llm.with_structured_output(Review).invoke(prompt)
    return {"decision": review.decision, "feedback": review.feedback}

def reviser(state: State) -> dict:
    llm = make_llm(effective_model(os.getenv("REVISER_MODEL", "")))
    prompt = ("You are the reviser agent. Improve the draft using the reviewer feedback. "
              "Keep it beginner friendly and concise. Return only the improved answer.\n\n"
              f"Topic: {state['topic']}\n\nDraft:\n{state['draft']}\n\nFeedback: {state['feedback']}")
    return {"draft": llm.invoke(prompt).content, "revision_count": state["revision_count"] + 1}

def route_after_review(state: State) -> Literal["revise", "done"]:
    if state["decision"] == "pass":
        return "done"
    if state["revision_count"] >= MAX_REVISIONS:
        return "done"  # termination guard: ship the last draft
    return "revise"

builder = StateGraph(State)
builder.add_node("writer", writer)
builder.add_node("reviewer", reviewer)
builder.add_node("reviser", reviser)
builder.add_edge(START, "writer")
builder.add_edge("writer", "reviewer")
builder.add_conditional_edges("reviewer", route_after_review, {"revise": "reviser", "done": END})
builder.add_edge("reviser", "reviewer")  # closes the loop
graph = builder.compile()

def run_workflow(topic: str) -> dict:
    state = {"topic": topic, "draft": "", "feedback": "", "decision": "", "revision_count": 0}
    events = list(graph.stream(state, stream_mode="updates"))  # streamed so the UI can show progress
    return {"topic": topic, "events": events}
```

## Failure modes and gotchas

- **No termination condition.** The lesson is explicit: without `MAX_REVISIONS` the writer-reviewer-reviser cycle can run indefinitely on a topic the reviewer never accepts, and every lap is three paid LLM calls.
- **Reviewer returns prose instead of JSON.** The routing function compares `decision` to the string `pass`; anything else is treated as `revise`. Structured output plus a tolerant parser keeps a chatty model from silently forcing extra revisions.
- **Router name typo.** In router mode the router name is sent as the model string. If it does not match the router created in the console, every agent call fails, not just one. Keep the exact name in the environment variable and check `/api/config` after deploy.
- **A strong writer hides the loop.** The demo passed first time because the writer model was powerful. That is fine in production but useless for testing the revise path; swap in a weaker writer model to exercise it.
- **Port mismatch on deploy.** The local `uvicorn.run` on port 8000 and the platform run command are different things. The run command's port has to match the HTTP port the platform routes to, and the local block should be commented out.
- **Secrets in the repo.** The model access key is an account-level credential; it belongs in `.env` locally (gitignored) and in the platform's encrypted environment variables, never in source. The smallest instance tier is only safe because inference is remote; a local model would need a bigger one.

## Takeaways

- Worth remembering: a self-correcting system is three roles plus one conditional edge. The verifier's structured `pass`/`revise` output is what makes the edge deterministic.
- The revision counter lives in graph state, not in a global, so each run starts at zero and the cap is enforced per request.
- Per-agent model choice is an infrastructure decision, not a code change: an inference router maps tasks to models and gives you failover for free, while the code only ever sends one model string.
- Keeping both router mode and direct mode behind one `effective_model` helper means the same code runs locally without a router and in production with one.
- Source-based auto-deploy turns every push into a release. The cost is that the branch you connect must always be deployable.

## Test yourself

<details>
<summary>Why does the reviser feed back into the reviewer rather than into the writer?</summary>
<p>The reviser already has the draft and the feedback, so it only needs to patch the specific problems the reviewer named. Sending the result to the reviewer again checks whether those patches actually fixed the rules; sending it to the writer would throw the draft away and start from scratch.</p>
</details>

<details>
<summary>What two conditions make `route_after_review` return `done`?</summary>
<p>The reviewer decision is <code>pass</code>, or <code>revision_count</code> has reached <code>MAX_REVISIONS</code>. The second one is the termination guard that prevents an infinite loop when a draft keeps failing review.</p>
</details>

<details>
<summary>How does the code switch between an inference router and direct model names?</summary>
<p>An <code>effective_model</code> helper checks whether an <code>INFERENCE_ROUTER_NAME</code> environment variable is set. If it is, that name is passed as the model string and the router picks the real model per task. If not, each agent uses its own model variable, falling back to <code>DEFAULT_MODEL</code>.</p>
</details>

**Related:** [Loop Engineering](/docs/agentic-ai/loop-engineering) · [LLM Gateways](/docs/rag-course/25-llm-gateways) · [Deploy on Render for Free with Docker](/docs/agentic-course/25-render-free-deploy)
