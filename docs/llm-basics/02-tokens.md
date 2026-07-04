---
id: tokens
title: "Tokens & Tokenization"
sidebar_label: "Tokens & Tokenization"
sidebar_position: 2
description: Why models read tokens not words, how tokenization works, and why tokens are the unit of cost, limits, and a few surprising failure modes — with a worked cost example.
tags: [LLM, Tokens]
---

# Tokens & Tokenization

The model doesn't read characters or words — it reads **tokens**. A tokenizer splits
text into chunks (whole words, word-pieces, or single characters) and maps each to an
integer ID. The model only ever sees those integers.

A rough rule for English: **1 token ≈ 4 characters ≈ 0.75 words**, so 1,000 tokens is
about 750 words.

```
text:    "Tokenization isn't obvious."
tokens:  ["Token", "ization", " isn", "'t", " obvious", "."]
ids:     [30642,    1634,      5358,   956,  8121,        13]
```

Notice "Tokenization" splits into two tokens while " obvious" is one. Common words are
single tokens; rare words fragment into pieces. This matters in practice:

- **Cost and limits are counted in tokens, not words.** A 500-word answer is ~650
  tokens. You pay per token (input + output) and every model has a hard token ceiling.
- **Weird inputs cost more.** Code, JSON, non-English text, and long numbers fragment
  into many tokens, so they eat your budget faster than plain prose.
- **Spelling-level tasks are hard** for the same reason — the model sees "strawberry"
  as a couple of tokens, not eight letters, which is why early models miscounted the
  r's.

## Worked example — estimating cost

Say a model charges \$0.50 per million input tokens and \$1.50 per million output
tokens. A request with a 2,000-token prompt and a 400-token answer:

```
input  : 2000 tokens × $0.50 / 1,000,000 = $0.0010
output :  400 tokens × $1.50 / 1,000,000 = $0.0006
total  ≈ $0.0016 per request  →  ~$1.60 per 1,000 requests
```

Output tokens are usually 2–4× more expensive than input tokens, which is why
"make the answer shorter" is a real cost lever.

Next: [Next-Token Prediction & Sampling →](/docs/llm-basics/next-token-prediction)
