---
id: next-token-prediction
title: "Next-Token Prediction & Sampling"
sidebar_label: "Next-Token Prediction & Sampling"
sidebar_position: 3
description: How logits become probabilities and how sampling turns that distribution into one chosen token — greedy vs random, and why the strategy decides whether you get a reliable assistant or a creative writer.
tags: [LLM, Sampling]
---

# Next-Token Prediction & Sampling

At each step the model produces a score (a **logit**) for every token in its
vocabulary, then `softmax` turns those into probabilities that sum to 1. For the
prompt "The capital of France is" a model might output:

```
" Paris"   0.91
" the"     0.03
" located" 0.02
" a"       0.01
 ...        (tens of thousands more, each tiny)
```

**Sampling** is how we turn that distribution into one chosen token. The strategy you
pick is the difference between a reliable factual assistant and a creative writer:

- **Greedy** — always take the highest-probability token. Deterministic, but can get
  repetitive and dull.
- **Random sampling** — draw a token according to its probability. More natural and
  varied, but can wander.

The knobs that control exactly how that draw happens — temperature, top-p, top-k — are
the next page.

Next: [Temperature, Top-p & Decoding Controls →](/docs/llm-basics/sampling-controls)
