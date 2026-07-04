---
id: apis-and-sdks
title: "LLM APIs & SDKs (the basics)"
sidebar_label: "APIs & SDKs"
sidebar_position: 1
description: "How you actually call a model from code — the HTTPS endpoint, the provider SDK, and the two rules from day one: never hard-code keys, and the call is stateless."
tags: [LLM, API]
---

# LLM APIs & SDKs (the basics)

You call a model over an HTTPS endpoint, sending a JSON request (messages + settings)
and getting back the model's reply. Most people use the provider's **SDK** — a thin
wrapper that handles auth, retries, and types — rather than raw HTTP.

```python
from openai import OpenAI

client = OpenAI()   # reads your API key from the OPENAI_API_KEY environment variable

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain RAG in one sentence."}],
    temperature=0.3,
)

print(response.choices[0].message.content)
```

Two rules from day one:

- **Never hard-code your API key.** Read it from an environment variable or secret
  manager. A key committed to git is a key that gets abused.
- **The call is stateless.** The server remembers nothing between requests — if you
  want a conversation, _you_ resend the prior messages every time (next page).

Next: [Chat Completions & Message Roles →](/docs/calling-models/chat-completions)
