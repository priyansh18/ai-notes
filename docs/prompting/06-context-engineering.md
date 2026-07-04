---
id: context-engineering
title: "Context Engineering (what to put in the window)"
sidebar_label: "Context Engineering"
sidebar_position: 6
description: The most important framing — deciding what information to place in the limited context window, why more context isn't better context, and how it bridges into RAG. Includes a prompting-layer system design.
tags: [LLM, Prompting, System Design]
---

# Context Engineering (what to put in the window)

The newest and most important framing: the bottleneck usually isn't _clever wording_,
it's **what information you place in the limited context window**. Context engineering
is deciding, for each request, exactly what to include — and what to leave out.

Why "more context" is not "better context":

- The window is a **budget** (Part 1): system prompt + history + retrieved context +
  output all compete for the same tokens.
- **Irrelevant context hurts.** Extra, off-topic text distracts the model and triggers
  the lost-in-the-middle effect — so padding the prompt can _lower_ answer quality.
- The skill is **curating**: retrieve the few most relevant chunks (that's RAG),
  rerank tightly, summarize or drop old history, and order the most important material
  at the start or end of the window.

```
 Good context budgeting for one request:
   system prompt        ~400 tokens   (rules + format)
   recent history       ~800 tokens   (last few turns, trimmed)
   retrieved context  ~3,000 tokens   (top 3–5 reranked chunks, most relevant first)
   leave room for output ~2,000 tokens
```

This is the bridge into the rest of the path: **Part 4 (RAG)** is, at its heart, the
discipline of putting the _right_ retrieved context into the window.

## System design — a prompting layer in production

Prompts in a real system aren't strings scattered through code; they're a managed
component:

```
 request ─▶ select prompt template (by task/version)
                │
                ▼
        assemble context ──┬─ inject system rules
                           ├─ pull recent history (trim to budget)
                           ├─ retrieve + rerank context (RAG)
                           └─ add few-shot examples (if needed)
                │
                ▼
        fill template ─▶ token-budget check ─▶ model call
                │
                ▼
        validate output (format/guardrails) ─▶ log (prompt version + result)
```

What a mature setup includes:

- **A prompt registry** — named, versioned templates, decoupled from code, so you can
  iterate and A/B test prompts without redeploying.
- **Context assembly** — the logic that fills slots from history + retrieval within the
  token budget (this _is_ most of a RAG app).
- **Guardrails** — output validation and injection defenses, since both user input and
  retrieved documents are untrusted.
- **Eval in the loop** — every prompt change runs against a golden set before shipping
  (Part 7), because prompt edits are behaviour changes.

<div class="takeaway">
Prompting steers a next-token predictor with words: set durable rules in the system message, show examples when format matters, ask for step-by-step reasoning on hard problems, version prompts like code, and — most of all — engineer *what* goes in the context window, not just how it's phrased.
</div>

Next: [4 · Retrieval (RAG) →](/docs/rag-course/rag-course-overview)
