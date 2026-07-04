---
id: prompt-templates
title: "Prompt Templates & Versioning"
sidebar_label: "Prompt Templates & Versioning"
sidebar_position: 5
description: Treating prompts like application code — templates with runtime slots, version control, eval-before-ship, and keeping template separate from injected data.
tags: [LLM, Prompting]
---

# Prompt Templates & Versioning

In a real app you don't write prompts by hand each time — you build **templates** with
slots you fill at runtime (the user's question, retrieved context, examples).

```python
PROMPT = """You are a {role}.
Answer the question using ONLY the context below.
If the answer isn't there, say you don't know.

Context:
{context}

Question: {question}
"""

filled = PROMPT.format(role="support agent", context=context, question=user_q)
```

Because a prompt _is_ application logic, treat it like code:

- **Version it.** Store prompts in your repo, give them version numbers, and tag which
  version produced each logged response — so you can reproduce and roll back.
- **Test it.** Run prompt changes against an eval set before shipping (Part 7); a
  one-word tweak can regress quality.
- **Separate template from data.** Keep the reusable template apart from the
  runtime-injected content, and be careful that injected content can't break out of its
  slot (injection risk).

Next: [Context Engineering →](/docs/prompting/context-engineering)
