---
id: multimodal-inputs
title: "Multimodal Inputs (image / audio)"
sidebar_label: "Multimodal Inputs"
sidebar_position: 6
description: Passing an image or audio alongside text so the model can answer questions about it — the basis of document understanding and multi-modal RAG — plus a robust model-calling-layer system design.
tags: [LLM, API, Multimodal, System Design]
---

# Multimodal Inputs (image / audio)

Many models now accept more than text. You pass an image (or audio) alongside your
words and ask questions about it — the image becomes part of the message content.

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this chart?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/chart.png"}},
        ],
    }],
)
```

This unlocks document understanding (reading scanned PDFs, screenshots, diagrams) and
is the basis of **multi-modal RAG** in Part 12. Note that images cost tokens too —
a high-res image can be hundreds to thousands of tokens.

## System design — a robust model-calling layer

In production you never call the raw SDK from your business logic. You wrap it in a
small service that handles the things that go wrong:

```
 your app
    │  (clean request: messages, schema, options)
    ▼
 model-calling layer ─┬─ retries + exponential backoff (transient errors, 429s)
                      ├─ timeouts (don't hang forever)
                      ├─ fallback provider (primary down → secondary)
                      ├─ structured-output validation (re-ask if JSON invalid)
                      ├─ token budgeting (trim history to fit the window)
                      └─ logging (model, version, tokens, latency, cost)
    │
    ▼
 LLM provider API  (streaming back to the user)
```

What each piece buys you:

- **Retries with backoff** — rate limits (HTTP 429) and brief outages are normal at
  scale; retry transient failures automatically, with increasing delays.
- **Timeouts + fallback** — cap how long you wait, and have a second model/provider so
  one vendor's outage doesn't take your product down.
- **Output validation** — if structured output comes back malformed, re-ask once rather
  than crashing downstream code.
- **Idempotency & caching** — identical requests can return a cached answer, saving cost
  and latency.
- **Observability** — log the model version, token counts, latency, and cost on every
  call. Without this you can't debug bad answers or control spend.

<div class="takeaway">
Every model call is: a list of role-tagged messages + settings → a reply. Stream for UX, use structured outputs for anything programmatic, use tool calling to let the model trigger your code, and always wrap the raw API in a layer that does retries, fallback, and logging.
</div>

Next: [3 · Prompting →](/docs/prompting/what-is-prompting)
