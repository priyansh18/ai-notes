---
id: 04-setup
title: "VS Code & Anaconda Setup"
sidebar_position: 4
description: The local dev setup for the course — VS Code, Anaconda/conda environments, and keeping each project isolated with its own dependencies.
tags: [RAG, Setup]
---

# VS Code & Anaconda Setup

<div class="tldr">
<strong>TL;DR</strong>

- Editor = **VS Code**; environments = **conda** (one isolated env per project).
- Track dependencies in **requirements.txt** so the setup is reproducible.
</div>

A short, practical section: get the local environment ready so the rest of the course
runs cleanly.

## What it covers

- **VS Code** as the editor, with the Python extension.
- **Anaconda / conda** to create isolated environments so each project has its own
  dependencies and Python version — no global clutter, no version clashes.

## The setup, in commands

```bash
# create an isolated environment for the course
conda create -n rag python=3.11 -y
conda activate rag

# open the project folder in VS Code
code .
```

## Why isolate environments

Every RAG/agent library pins specific versions. A dedicated environment means one
project's `langchain` version can't break another's, and you can delete the whole
environment to start clean. Keep a `requirements.txt` so the setup is reproducible.

## Cheat sheet

| Step        | Command                              |
| ----------- | ------------------------------------ |
| Create env  | `conda create -n rag python=3.11 -y` |
| Activate    | `conda activate rag`                 |
| Open editor | `code .`                             |
| Freeze deps | `pip freeze > requirements.txt`      |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Installing everything into the base/global environment — versions clash across
  projects. Always activate a project env first.
- Committing your `.env` / API keys to git. Keep secrets out of the repo.
</div>

<div class="takeaway">
Editor = VS Code; environments = conda. One isolated environment per project, tracked in requirements.txt, keeps dependencies from fighting each other.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>Why use a separate conda environment per project?</summary>
<p>So one project's library versions can't break another's — and you can delete the env to start clean. requirements.txt makes it reproducible.</p>
</details>
</div>

**Related:** [Glossary](/docs/glossary) · [Next: Data Ingestion & Parsing →](/docs/rag-course/05-data-ingestion)
