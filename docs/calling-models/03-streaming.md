---
id: streaming
title: "Streaming Responses"
sidebar_label: "Streaming Responses"
sidebar_position: 3
description: Sending tokens as they're generated so the user sees text immediately — it doesn't make generation faster, but it slashes perceived latency.
tags: [LLM, API]
---

# Streaming Responses

By default you wait for the entire answer before getting anything. **Streaming** sends
tokens as they're generated, so the user sees text appear immediately — the same
effect as a chatbot "typing." It doesn't make generation faster, but it slashes
_perceived_ latency.

```python
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku about retrieval."}],
    stream=True,                       # turn on streaming
)

for chunk in stream:                   # arrives token-by-token
    piece = chunk.choices[0].delta.content
    if piece:
        print(piece, end="", flush=True)
```

Use streaming for anything a human reads in real time (chat, long answers). Skip it
for background jobs where you just need the final string.

Next: [Structured Outputs & JSON Mode →](/docs/calling-models/structured-outputs)
