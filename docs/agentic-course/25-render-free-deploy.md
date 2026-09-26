---
id: 25-render-free-deploy
title: "Deploy on Render for Free with Docker"
sidebar_position: 25
description: "The same Dockerised LangGraph chatbot shipped to Render's free tier in a few clicks, with the repo connected, env vars pasted in, and Render's built-in CI/CD redeploying on each commit."
tags: [Agentic AI, Deployment, Docker]
---

# Deploy on Render for Free with Docker

<div class="tldr">
<strong>TL;DR</strong>

- Render is a platform-as-a-service: point it at a GitHub repo that contains a Dockerfile and it builds the image and serves it at a public URL. No IAM user, no EC2, no runner, no workflow file.
- CI/CD is built in. Each commit can be redeployed with "Deploy latest commit" or automatically, and the old instance keeps serving until the new build is live.
- The free instance is 512 MB RAM and 0.1 CPU: enough to demo the chatbot, visibly slow, and quick to expose the rate limits of free third-party APIs.
</div>

The AWS pipeline in the previous lesson works, but it took an hour of setup and needs a paid account.
This short follow-up answers the question the video's viewers asked: can the same project go live in a few
minutes, for free, and still redeploy on every commit? It can, because the hard part was already done.
The Dockerfile from the AWS lesson is the whole contract, and a container does not care who runs it.

## What Render replaces

| Concern | AWS path (previous lesson) | Render path (this lesson) |
| --- | --- | --- |
| Compute | Create IAM user, launch EC2, install Docker | Pick an instance type in a form |
| Image build | GitHub Actions job builds and pushes to Docker Hub | Render clones the repo and builds the Dockerfile itself |
| Deploy trigger | Self-hosted runner listens for jobs | Render watches the repo; manual button or auto-deploy |
| Secrets | GitHub repository secrets passed via `docker run -e` | Environment variables typed into the service settings (or a `.env` upload) |
| Networking | Security group inbound rule, public DNS plus port | A `*.onrender.com` URL, nothing to open |
| Cost | Charged while the instance runs | Free tier for hobby use; paid tiers for real load |

The trade is control for convenience. On AWS every piece is yours to configure and pay for; on Render
you get a working service fast and accept whatever the free instance can do.

## The deployment, step by step

The video reuses the `agentic-chatbot-using-langgraph` repo pushed in the AWS lesson, which already holds
the Dockerfile, `.dockerignore` and `requirements.txt`.

1. Sign in to Render (Google login works) and click **New**, then **Web Service**.
2. Connect the Git provider or paste the public repo URL. Render also accepts an existing image URL, so
   the Docker Hub image from the AWS pipeline could be used directly instead of the source.
3. Give the service a name and set **Language** to **Docker**. Choosing plain Python would work too, but
   then build and start commands must be filled in by hand; with Docker the Dockerfile answers both.
4. Pick the **Free** instance type (512 MB, 0.1 CPU).
5. Add the environment variables one by one: `TAVILY_API_KEY`, `OPENWEATHER_API_KEY`, `GOOGLE_API_KEY`,
   `LANGSMITH_TRACING`, `LANGSMITH_ENDPOINT`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`. Uploading the local
   `.env` file populates the same list.
6. Leave the advanced section alone and click **Deploy web service**.

Render then shows the Docker build log. When the status flips to "Live", the service URL opens the same
Streamlit chatbot: weather tool, web search, document upload with RAG, new threads. Everything that worked
locally works here because the image is byte-for-byte the one the Dockerfile describes.

## Built-in CI/CD

The AWS lesson had to wire the redeploy path by hand. Render already has one:

```
git push origin main
        │
        ▼
Render sees the new commit
        │
        ├─ auto-deploy ON  ──► builds the Dockerfile ──► swaps the instance when healthy
        │
        └─ auto-deploy OFF ──► Events tab ──► Manual Deploy ──► "Deploy latest commit"

old instance keeps answering requests during the build
```

The video demonstrates this by deleting the emoji added in the AWS lesson, pushing, clicking **Deploy
latest commit**, and chatting with the still-running old version while the build runs. A refresh after
"Live" shows the change. The auto-deploy toggle in the service settings makes the click unnecessary.

## What the free tier is really like

Two things show up in the demo. The app is noticeably slower than on the 4 GB EC2 box, which is what
0.1 CPU buys. And the stock-price tool fails with a rate-limit error: the free key for that API had been
used up across the AWS and Render tests, so a new key was needed. Neither is a bug in the code; both are
the free tier telling you where its edges are.

For anything with real users the video is explicit: take a paid instance. To shut the demo down, open the
service's Settings, scroll to **Delete web service**, type the confirmation phrase, and the URL goes
offline.

## Code that matters

The image is unchanged from the AWS lesson; the lines Render relies on are the port and the start command
(sketch).

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8501
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

Because both platforms inject configuration as environment variables, the app needs exactly one way of
reading it. Anything that reads a local file or a hard-coded value would work on one host and break on the
other.

```python
import os
from dotenv import load_dotenv

load_dotenv()  # local dev reads .env; on Render and AWS the variables are already in the environment


def env(name: str, default: str | None = None) -> str:
    """Single source of truth for configuration on every host (sketch)."""
    value = os.environ.get(name, default)
    if value is None:
        raise RuntimeError(f"secret is missing: {name}")
    return value


TAVILY_API_KEY = env("TAVILY_API_KEY")
LANGSMITH_TRACING = env("LANGSMITH_TRACING", "false")
```

## Failure modes and gotchas

- **No Dockerfile in the repo.** With Language set to Docker the build fails immediately; either add the
  Dockerfile or switch to the Python runtime and supply build and start commands.
- **A missing environment variable** shows up as a crash in the Render log at boot, not in the build. The
  list must match what the AWS secrets held.
- **Ephemeral disk.** The chatbot writes its SQLite checkpoints and FAISS index inside the container's
  filesystem. That follows directly from the Docker mechanism: a rebuild starts from the image, so threads
  and uploaded-document indexes from before a redeploy are gone. Fine for a demo, not for users.
- **Manual deploy is manual.** With auto-deploy off, a pushed commit is not live until someone clicks
  "Deploy latest commit".
- **Free API quotas are shared across environments.** Local tests, the AWS instance and the Render instance
  all draw on the same free key.
- **0.1 CPU** makes tool-heavy answers slow; that is the tier, not the graph.

## Takeaways

- Worth remembering: once an app is containerised, the deployment target is a detail. The same image ran on
  EC2 through a hand-built pipeline and on Render through a form.
- Render's value is that the build-and-swap loop is already there; the cost is less control and a free
  tier that is only for demos.
- Configuration through environment variables is what makes the image portable; a `.env` file is a local
  convenience, not the source of truth.
- Anything the container writes to its own disk does not survive a redeploy; durable state needs a store
  outside the container.

## Test yourself

<details>
<summary>What does Render need from the repo to deploy the chatbot?</summary>
<p>A Dockerfile at the root (with Language set to Docker) plus the environment variables the app reads. Render clones the repo, builds the image and hosts it; no workflow file or runner is required.</p>
</details>

<details>
<summary>How does a new commit reach the live service?</summary>
<p>Either auto-deploy is switched on and Render rebuilds on every push, or someone opens the Events tab and clicks "Deploy latest commit". In both cases the old instance keeps serving until the new build is live.</p>
</details>

<details>
<summary>Why did the stock-price tool fail on Render when the code was unchanged?</summary>
<p>The free API key behind that tool had hit its rate limit after being used in local and AWS tests. It was a quota problem on the third-party service, solved by issuing a new key, not a deployment bug.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/zB2dA_BtprU"
    title="23. Deploy Agentic AI Chatbot on Render for FREE with Docker / Fastest Deployment"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [23. Deploy Agentic AI Chatbot on Render for FREE with Docker / Fastest Deployment](https://www.youtube.com/watch?v=zB2dA_BtprU).

**Related:** [CI/CD to AWS with Docker and GitHub Actions](./24-cicd-aws-github-actions.md) · [Harness Engineering](/docs/agentic-ai/harness-engineering) · [Glossary](/docs/glossary)

Next: [End-to-End Agentic Chatbot: The Full Build](./26-agentic-chatbot-end-to-end.md)
