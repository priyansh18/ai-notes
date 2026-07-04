---
id: what-is-prompting
title: "What is Prompting?"
sidebar_label: "What is Prompting?"
sidebar_position: 1
description: The cheapest way to change a model's behaviour — setting up a context where the answer you want is the most likely continuation, with the four ingredients of a good prompt.
tags: [LLM, Prompting]
---

# What is Prompting?

A **prompt** is the full text you send the model to steer its next-token prediction
toward the output you want. Because the model is a next-token predictor (Part 1), the
prompt is your only lever at call time: it sets the context the model conditions on.

The mindset shift that makes prompting click: you're not "asking a question," you're
**setting up a context where the desired answer is the most likely continuation.** A
vague prompt has many plausible continuations (so you get inconsistent output); a
specific prompt narrows them.

Four ingredients of a good prompt:

- **Role / persona** — who the model should act as ("You are a senior tax accountant").
- **Task** — exactly what to do, with constraints (length, format, what to avoid).
- **Context** — the facts it needs (retrieved docs, the user's data, examples).
- **Output format** — what the answer should look like (JSON, bullet list, one
  paragraph).

```
Weak:   "Tell me about this error."
Strong: "You are a senior backend engineer. Given the stack trace below, name the
         most likely root cause in one sentence, then list 3 concrete fixes as a
         numbered list. If the trace is insufficient, say what extra info you need.

         Stack trace:
         <trace here>"
```

Next: [System vs User Messages & Instruction Hierarchy →](/docs/prompting/instruction-hierarchy)
