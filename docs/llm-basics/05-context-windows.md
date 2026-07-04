---
id: context-windows
title: "Context Windows & Long-Context"
sidebar_label: "Context Windows & Long-Context"
sidebar_position: 5
description: The context window as a per-request token budget you spend across system prompt, history, retrieved context, and output — plus lost-in-the-middle and why bigger windows don't make retrieval pointless.
tags: [LLM, Context]
---

# Context Windows & Long-Context

The **context window** is the maximum number of tokens the model can consider at once —
your prompt plus its own output must both fit. In 2026 windows range from a few
thousand tokens to well over a million.

The window is a _budget_ you spend across four things:

```
 ┌─────────────── context window (e.g. 128k tokens) ───────────────┐
 │ system prompt │ conversation history │ retrieved context │ output │
 └──────────────────────────────────────────────────────────────────┘
```

Two facts about long context everyone trips on:

- **Bigger windows don't make retrieval pointless.** Dumping a million tokens in costs
  money, adds latency, and triggers the **"lost-in-the-middle"** effect — models attend
  best to the start and end of the window and can miss facts buried in the middle.
- **The window is per-request, not memory.** The model forgets everything between
  calls. "Memory" in a chatbot is just the app re-sending past turns each time.

<div class="takeaway">
Treat the window as a budget, not a dumping ground. Curate what goes in (that's what RAG and context engineering are for) and put the most important material at the start or end.
</div>

Next: [What are Reasoning Models? →](/docs/llm-basics/reasoning-models)
