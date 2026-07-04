---
id: chain-of-thought
title: "Chain-of-Thought (Reasoning Prompts)"
sidebar_label: "Chain-of-Thought"
sidebar_position: 4
description: Asking the model to show its work before answering to raise accuracy on multi-step problems — when to use it, and why reasoning models don't need it.
tags: [LLM, Prompting]
---

# Chain-of-Thought (Reasoning Prompts)

For multi-step problems, asking the model to **show its work before answering** raises
accuracy a lot. Giving it room to lay out intermediate steps means each step
conditions the next, instead of forcing a correct answer out in one jump.

```
Q: A shop sells pens at 3 for $2. How much do 12 pens cost?
A: Let's think step by step.
   12 pens is 4 groups of 3.
   Each group costs $2.
   4 × $2 = $8.
   Answer: $8.
```

Two practical notes:

- Plain instructions like _"think step by step"_ or _"show your reasoning, then give
  the final answer"_ are enough to trigger it on standard models.
- **Reasoning models** (Part 1) do this internally — you don't need to prompt for it,
  and asking can even hurt. Use explicit chain-of-thought on _standard_ models for
  math, logic, and multi-step tasks.
- If you only want the final answer in production, ask the model to reason, then put
  the final result in a clearly delimited field you can extract.

Next: [Prompt Templates & Versioning →](/docs/prompting/prompt-templates)
