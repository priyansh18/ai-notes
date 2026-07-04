---
id: structured-outputs
title: "Structured Outputs & JSON Mode"
sidebar_label: "Structured Outputs & JSON"
sidebar_position: 4
description: Forcing the model to return schema-valid JSON so your code gets a reliable object instead of free text — the backbone of classification, extraction, routing, and form-filling.
tags: [LLM, API]
---

# Structured Outputs & JSON Mode

For anything programmatic, you don't want prose — you want **data your code can parse**.
Structured outputs force the model to return JSON matching a schema you define, so you
get a reliable object instead of free text you'd have to regex.

```python
from pydantic import BaseModel

# 1. Describe the exact shape you want back.
class Ticket(BaseModel):
    category: str
    priority: str          # "low" | "medium" | "high"
    summary: str

# 2. Ask the model to fill that shape. The SDK validates the result for you.
response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[{"role": "user", "content": "My checkout has been broken for 3 days, losing sales!"}],
    response_format=Ticket,
)

ticket = response.choices[0].message.parsed
print(ticket.priority)     # "high"  — a real field, not a string to parse
```

This is the backbone of reliable LLM apps: classification, extraction, routing, and
form-filling all depend on getting back clean, schema-valid data every time.

Next: [Tool / Function Calling →](/docs/calling-models/tool-calling)
