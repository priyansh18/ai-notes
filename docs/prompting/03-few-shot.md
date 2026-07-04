---
id: few-shot
title: "Few-Shot & In-Context Learning"
sidebar_label: "Few-Shot & In-Context Learning"
sidebar_position: 3
description: Teaching the model a pattern from examples in the prompt — zero-shot vs few-shot, when to add examples, and the tips that make them work.
tags: [LLM, Prompting]
---

# Few-Shot & In-Context Learning

**In-context learning** is the model's ability to learn a pattern from examples placed
_in the prompt_ — no fine-tuning. **Few-shot prompting** means including a handful of
input→output examples so the model copies the pattern.

- **Zero-shot** — just instructions, no examples. Try this first; modern models are
  strong zero-shot.
- **Few-shot** — add 2–5 examples when you need a specific format, a tricky edge case
  handled consistently, or a tone matched.

```
Classify the sentiment as positive, negative, or neutral.

Review: "Shipping was fast and the product works great." → positive
Review: "Arrived broken and support ignored me." → negative
Review: "It's fine, does the job." → neutral
Review: "Honestly blown away by the quality." →
```

The model continues the pattern and outputs `positive`. Tips that matter: make examples
**representative** (cover the hard cases), keep the **format identical** across
examples, and remember each example spends tokens — don't pad with more than you need.

Next: [Chain-of-Thought →](/docs/prompting/chain-of-thought)
