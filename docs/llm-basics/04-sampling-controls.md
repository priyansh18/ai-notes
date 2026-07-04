---
id: sampling-controls
title: "Temperature, Top-p & Decoding Controls"
sidebar_label: "Temperature, Top-p & Decoding"
sidebar_position: 4
description: The knobs that control creativity — temperature reshapes the distribution, top-p and top-k limit which tokens are eligible — with default settings per use case and the most common mistake.
tags: [LLM, Sampling]
---

# Temperature, Top-p & Decoding Controls

**Temperature** reshapes the distribution before sampling. Low temperature makes the
peaks sharper (the model gets more confident and predictable); high temperature
flattens them (more variety, more risk of nonsense).

```
 temperature → 0      almost greedy, deterministic   ← use for facts, extraction, code
 temperature ≈ 0.7    balanced, natural               ← use for chat, general writing
 temperature → 1.5+   wild, creative, risky           ← use for brainstorming only
```

**Top-p (nucleus sampling)** limits _which_ tokens are even eligible: keep only the
smallest set of top tokens whose probabilities add up to `p`, then sample among those.
`top_p = 0.9` means "consider only the most likely tokens that together cover 90% of
the probability mass, ignore the long tail."

**Top-k** is the simpler cousin: only consider the `k` most likely tokens.

Practical defaults that cover most cases:

| Use case                               | temperature | top_p |
| -------------------------------------- | ----------- | ----- |
| Factual answers, RAG, extraction, code | 0 – 0.3     | 1.0   |
| Conversational assistant               | 0.5 – 0.7   | 0.9   |
| Creative writing, brainstorming        | 0.9 – 1.2   | 0.95  |

A common mistake: turning temperature _up_ to fix wrong answers. Wrong answers are
usually a knowledge/retrieval problem; raising temperature just makes the model
_more_ creative about being wrong. For factual work, keep temperature low.

Next: [Context Windows & Long-Context →](/docs/llm-basics/context-windows)
