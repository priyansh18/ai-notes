---
id: 26-evaluation
title: "Chatbot & RAG Evaluation"
sidebar_position: 27
description: Evaluating RAG systems beyond eyeballing — faithfulness, answer relevancy, context precision/recall with RAGAS and DeepEval, LLM-as-judge, golden datasets, and CI/CD integration.
tags: [RAG, Evaluation, Production]
---

# Chatbot & RAG Evaluation

<div class="tldr">
<strong>TL;DR</strong>

- **Eyeballing** doesn't scale — you need automated metrics to catch regressions and compare changes.
- Four key metrics: **faithfulness** (grounded in docs?), **answer relevancy** (answers the question?), **context precision** (right docs ranked high?), **context recall** (all needed docs retrieved?).
- **RAGAS** and **DeepEval** compute these metrics using LLM-as-judge. Build a **golden dataset** of Q&A pairs, run eval in CI, and track scores over time.
</div>

You changed the chunking strategy. Or swapped the embedding model. Or tweaked the prompt.
Did things get better or worse? Without evaluation, you're guessing. And with non-deterministic
outputs, your gut feeling is wrong more often than you think. **Evaluation** gives you
numbers to make decisions on. One submodule per idea, ending with a cheat sheet.

## Why eval matters

RAG systems are non-deterministic — the same question can produce different answers across
runs. This creates three problems:

1. **Regressions are invisible** — you change one thing, and something unrelated breaks. Without
   eval, you won't notice until a user complains.
2. **A/B decisions are gut-feel** — "GPT-4o-mini vs Claude Haiku for our RAG pipeline?" Without
   metrics, you're comparing vibes.
3. **Production drift** — the system works today. In three months, with new documents and new
   query patterns, it quietly degrades.

Automated evaluation catches all three.

## The four key metrics

These come from the RAG evaluation literature and are implemented by frameworks like RAGAS.

### Faithfulness

> Does the answer stick to what the retrieved documents say?

A faithfulness score of 1.0 means every claim in the answer is supported by the context.
A low score means the model is **hallucinating** — making up information that isn't in the docs.

**How it's measured:** The evaluator LLM extracts individual claims from the answer, then
checks each one against the retrieved context. Faithfulness = (supported claims) / (total claims).

### Answer relevancy

> Does the answer actually address the question?

An answer can be perfectly grounded in the docs but still miss the point. The user asks
"How do I cancel?" and the model responds with a detailed explanation of the pricing page.
Relevant to the domain, but not to the question.

**How it's measured:** The evaluator generates synthetic questions from the answer, then
computes similarity between those and the original question. High similarity = high relevancy.

### Context precision

> Are the relevant documents ranked at the top of the retrieved set?

If you retrieve 5 docs and the actually useful one is ranked #5, the LLM has to wade through
4 irrelevant docs to find it — increasing noise and hallucination risk.

**How it's measured:** Using the ground-truth answer, check which retrieved docs are actually
relevant and whether they appear at the top of the ranking.

### Context recall

> Did we retrieve all the documents we needed?

Maybe the answer required information from 3 docs, but we only retrieved 1 of them. The
model answers partially or fills in the gaps with hallucinations.

**How it's measured:** Compare the ground-truth answer's claims against the retrieved context.
What fraction of the ground-truth is covered by the retrieved docs?

## Building a golden dataset

Evaluation needs ground truth. A **golden dataset** is a set of (question, ground_truth_answer,
contexts) tuples that you know are correct.

```python
# golden_dataset.py — your eval test set
eval_dataset = [
    {
        "question": "What is our refund policy?",
        "ground_truth": "Full refund within 30 days of purchase. After 30 days, pro-rated refund.",
        "contexts": [
            "Our refund policy allows full refunds within 30 days of purchase. "
            "After 30 days, customers receive a pro-rated refund based on remaining subscription time."
        ],
    },
    {
        "question": "How do I reset my password?",
        "ground_truth": "Go to Settings > Security > Reset Password. You'll receive an email link.",
        "contexts": [
            "To reset your password, navigate to Settings, then Security, then click Reset Password. "
            "A reset link will be sent to your registered email address."
        ],
    },
    {
        "question": "What integrations do you support?",
        "ground_truth": "Slack, Jira, GitHub, and Google Workspace. Enterprise plans include Salesforce.",
        "contexts": [
            "We support integrations with Slack, Jira, GitHub, and Google Workspace on all plans. "
            "Enterprise customers also get access to Salesforce integration."
        ],
    },
]
```

**How to build one:**
1. Start with **real user questions** from your logs.
2. Have a human write the **ideal answer** for each.
3. Include the **correct context documents** that should be retrieved.
4. Aim for 50–100 questions covering different topics, difficulty levels, and edge cases.
5. Keep it versioned in git — it's part of your test suite.

## RAGAS: RAG Assessment

**[RAGAS](https://docs.ragas.io/)** is the most popular RAG evaluation framework. It computes
all four metrics using LLM-as-judge — no human labeling needed for the metrics themselves
(just for the golden dataset).

### Setup and basic eval

```python
# pip install ragas langchain_openai

from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

# prepare the dataset in RAGAS format
eval_data = {
    "question": [
        "What is our refund policy?",
        "How do I reset my password?",
    ],
    "answer": [                                    # your RAG pipeline's actual answers
        "You can get a full refund within 30 days. After that, it's pro-rated.",
        "Go to Settings > Security > Reset Password to get an email link.",
    ],
    "contexts": [                                  # what the retriever actually returned
        ["Our refund policy allows full refunds within 30 days of purchase..."],
        ["To reset your password, navigate to Settings, then Security..."],
    ],
    "ground_truth": [                              # the human-verified correct answers
        "Full refund within 30 days of purchase. After 30 days, pro-rated refund.",
        "Go to Settings > Security > Reset Password. You'll receive an email link.",
    ],
}

dataset = Dataset.from_dict(eval_data)

# run evaluation
results = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
)

print(results)
# {'faithfulness': 0.95, 'answer_relevancy': 0.92, 'context_precision': 0.88, 'context_recall': 0.90}
```

### Evaluating your live RAG pipeline

The real power: run your actual pipeline on the golden dataset and evaluate the outputs.

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
from datasets import Dataset

def run_rag_pipeline(question: str) -> dict:
    """Your actual RAG pipeline — returns answer and retrieved docs."""
    docs = retriever.invoke(question)
    context = "\n\n".join(doc.page_content for doc in docs)
    answer = llm.invoke(f"Answer from context:\n{context}\n\nQuestion: {question}").content
    return {
        "answer": answer,
        "contexts": [doc.page_content for doc in docs],
    }

# run the pipeline on every question in the golden dataset
questions = [item["question"] for item in eval_dataset]
ground_truths = [item["ground_truth"] for item in eval_dataset]

answers = []
contexts = []
for q in questions:
    result = run_rag_pipeline(q)
    answers.append(result["answer"])
    contexts.append(result["contexts"])

# evaluate
dataset = Dataset.from_dict({
    "question": questions,
    "answer": answers,
    "contexts": contexts,
    "ground_truth": ground_truths,
})

results = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy],
)
print(results)
print(results.to_pandas())  # per-question breakdown
```

### Interpreting scores

| Metric | Good | Needs work | Action |
| --- | --- | --- | --- |
| **Faithfulness** | > 0.9 | < 0.7 | Improve prompts ("only use provided context"), add guardrails |
| **Answer relevancy** | > 0.85 | < 0.6 | Better query understanding, query rewriting |
| **Context precision** | > 0.8 | < 0.5 | Improve retriever (re-ranking, hybrid search) |
| **Context recall** | > 0.8 | < 0.5 | Better chunking, more docs, different embedding model |

## DeepEval

**[DeepEval](https://docs.confident-ai.com/)** is an alternative that offers similar
metrics plus custom metric support and a test-runner interface.

```python
# pip install deepeval

from deepeval import evaluate
from deepeval.metrics import (
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
)
from deepeval.test_case import LLMTestCase

# create test cases
test_cases = [
    LLMTestCase(
        input="What is our refund policy?",
        actual_output="Full refund within 30 days, pro-rated after.",
        expected_output="Full refund within 30 days. After 30 days, pro-rated.",
        retrieval_context=[
            "Our refund policy allows full refunds within 30 days of purchase..."
        ],
    ),
]

# define metrics
metrics = [
    FaithfulnessMetric(threshold=0.7),
    AnswerRelevancyMetric(threshold=0.7),
    ContextualPrecisionMetric(threshold=0.7),
    ContextualRecallMetric(threshold=0.7),
]

# run evaluation
results = evaluate(test_cases=test_cases, metrics=metrics)
```

DeepEval also integrates with `pytest`:

```python
# test_rag.py — run with: deepeval test run test_rag.py
import pytest
from deepeval import assert_test
from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase

@pytest.mark.parametrize("question,expected,context", [
    ("Refund policy?", "Full refund within 30 days...", ["Our refund policy..."]),
])
def test_rag_faithfulness(question, expected, context):
    test_case = LLMTestCase(
        input=question,
        actual_output=run_rag_pipeline(question)["answer"],
        expected_output=expected,
        retrieval_context=context,
    )
    assert_test(test_case, [FaithfulnessMetric(threshold=0.7)])
```

## LLM-as-judge pattern

Both RAGAS and DeepEval use an LLM to judge the output. You can also build this yourself
for custom criteria.

```python
from pydantic import BaseModel, Field
from typing import Literal
from langchain_openai import ChatOpenAI

class JudgeResult(BaseModel):
    score: Literal["pass", "fail"] = Field(description="Does the answer meet the criteria?")
    reasoning: str = Field(description="Why the score was given")

judge_llm = ChatOpenAI(model="gpt-4o", temperature=0).with_structured_output(JudgeResult)

def judge_answer(question: str, answer: str, criteria: str) -> JudgeResult:
    """Generic LLM-as-judge for any custom criteria."""
    prompt = f"""Evaluate the answer against the criteria.

Question: {question}
Answer: {answer}
Criteria: {criteria}

Score "pass" if the answer meets the criteria, "fail" otherwise. Explain your reasoning.
"""
    return judge_llm.invoke(prompt)

# usage — custom criteria
result = judge_answer(
    question="What's our SLA?",
    answer="We guarantee 99.9% uptime with 4-hour response time.",
    criteria="The answer must include specific numbers for uptime and response time.",
)
print(result.score, result.reasoning)
```

## CI/CD integration

Run eval automatically on every PR that touches the RAG pipeline.

```yaml
# .github/workflows/rag-eval.yml
name: RAG Evaluation

on:
  pull_request:
    paths:
      - "src/rag/**"
      - "prompts/**"

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - run: pip install -r requirements.txt

      - name: Run RAG evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: python scripts/run_eval.py

      - name: Check thresholds
        run: python scripts/check_thresholds.py
```

```python
# scripts/check_thresholds.py
import json, sys

THRESHOLDS = {
    "faithfulness": 0.85,
    "answer_relevancy": 0.80,
    "context_precision": 0.75,
    "context_recall": 0.75,
}

with open("eval_results.json") as f:
    results = json.load(f)

failed = False
for metric, threshold in THRESHOLDS.items():
    score = results.get(metric, 0)
    status = "PASS" if score >= threshold else "FAIL"
    print(f"  {metric}: {score:.3f} (threshold: {threshold}) [{status}]")
    if score < threshold:
        failed = True

if failed:
    print("\nEval FAILED — scores below threshold.")
    sys.exit(1)
else:
    print("\nAll metrics passed.")
```

## Cheat sheet

| Task | Code |
| --- | --- |
| RAGAS eval | `evaluate(dataset=ds, metrics=[faithfulness, answer_relevancy, ...])` |
| DeepEval test case | `LLMTestCase(input=q, actual_output=a, retrieval_context=[...])` |
| DeepEval run | `evaluate(test_cases=[...], metrics=[FaithfulnessMetric()])` |
| Per-question breakdown | `results.to_pandas()` (RAGAS) |
| LLM-as-judge | `llm.with_structured_output(JudgeResult).invoke(prompt)` |
| CI threshold check | compare each metric score against a minimum threshold |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- No golden dataset — you can't evaluate without ground truth. Even 20 curated Q&A pairs
  is better than nothing. Start small and grow it.
- Evaluating only faithfulness — a faithful answer that doesn't address the question is
  still useless. Always check both faithfulness AND relevancy at minimum.
- Using the same model for generation and judging — if GPT-4o-mini generates the answer and
  also judges it, it's biased toward its own outputs. Use a stronger model (GPT-4o) for
  judging, or a different provider entirely.
- Running eval manually — if it's not automated in CI, it won't happen consistently. Add it
  to the PR workflow so regressions are caught before merge.
- Treating scores as absolute truth — LLM-as-judge metrics have variance. Run eval multiple
  times and look at trends, not individual numbers.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What's the difference between faithfulness and answer relevancy?</summary>
<p>Faithfulness measures whether the answer is grounded in the retrieved docs (no hallucination). Answer relevancy measures whether the answer actually addresses the user's question (not just on-topic, but on-question).</p>
</details>

<details>
<summary>What's the difference between context precision and context recall?</summary>
<p>Context precision: are the relevant docs ranked at the top? Context recall: did we retrieve all the docs we needed? Precision is about ranking quality, recall is about coverage.</p>
</details>

<details>
<summary>Why do you need a golden dataset?</summary>
<p>Evaluation metrics need ground truth to compare against. A golden dataset provides known-correct question-answer pairs so you can measure how well your pipeline performs objectively.</p>
</details>

<details>
<summary>How do you integrate RAG eval into CI/CD?</summary>
<p>Run the eval script in a GitHub Actions workflow triggered on PRs that touch RAG code. Compare metric scores against predefined thresholds — fail the PR if any metric drops below the minimum.</p>
</details>
</div>

**Related:** [Guardrails](/docs/rag-course/24-guardrails) · [LLM Gateways](/docs/rag-course/25-llm-gateways) · [Glossary](/docs/glossary)

Next: Graph Databases & Cypher — _coming soon._
