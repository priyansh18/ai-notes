---
id: chat-completions
title: "Chat Completions & Message Roles"
sidebar_label: "Chat Completions & Roles"
sidebar_position: 2
description: The message-list request shape and the system / user / assistant roles — and how a stateless model holds a conversation because you resend the history each turn.
tags: [LLM, API]
---

# Chat Completions & Message Roles

Modern models are called with a **list of messages**, each tagged with a **role**.
The roles tell the model who said what:

- **`system`** — your standing instructions: who the model is, rules, tone, output
  format. Sent once at the top; highest authority.
- **`user`** — what the end user said.
- **`assistant`** — what the model said on previous turns (you include these to give it
  memory of the conversation).

```python
messages = [
    {"role": "system", "content": "You are a concise support agent. Answer in 2 sentences max."},
    {"role": "user", "content": "How do I reset my password?"},
    {"role": "assistant", "content": "Go to Settings → Security → Reset password."},
    {"role": "user", "content": "And if I don't get the email?"},
]
response = client.chat.completions.create(model="gpt-4o", messages=messages)
```

The model reads the _whole list_ each time. The follow-up "And if I don't get the
email?" only makes sense because the earlier turns are present — that's how a stateless
model holds a conversation. **You manage that history**, and you keep it bounded
(token budget from Part 1) by trimming or summarizing old turns.

Next: [Streaming Responses →](/docs/calling-models/streaming)
