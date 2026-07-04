---
id: tool-calling
title: "Tool / Function Schemas & Tool Calling"
sidebar_label: "Tool / Function Calling"
sidebar_position: 5
description: How a model decides to call a function you provide — you describe tools as schemas, it requests a call with arguments, your code runs it. The foundation of agents and of RAG's retrieval step.
tags: [LLM, API, Tools]
---

# Tool / Function Schemas & Tool Calling

LLMs can't look things up or do exact math on their own — but they _can_ decide to call
a function you provide. You describe your tools as schemas; the model, when it needs
one, replies with the tool name and arguments; **your code runs it** and feeds the
result back.

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
    tools=tools,
)

call = response.choices[0].message.tool_calls[0]
print(call.function.name)        # "get_weather"
print(call.function.arguments)   # '{"city": "Tokyo"}'
```

The crucial point: **the model never runs anything.** It only _requests_ a call with
arguments. Your code executes the function, appends the result as a `tool` message, and
calls the model again so it can use that result in its answer. This request → tool →
result → answer loop is the foundation of **agents** (Part 5) and of RAG's retrieval
step (Part 4).

Next: [Multimodal Inputs →](/docs/calling-models/multimodal-inputs)
