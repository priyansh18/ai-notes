---
id: 24-cicd-aws-github-actions
title: "CI/CD to AWS with Docker and GitHub Actions"
sidebar_position: 24
description: "How the course ships the LangGraph chatbot to an EC2 machine with zero downtime, using a Dockerfile, Docker Hub, a self-hosted GitHub Actions runner, repo secrets and port mapping."
tags: [Agentic AI, Deployment, CI/CD]
---

# CI/CD to AWS with Docker and GitHub Actions

<div class="tldr">
<strong>TL;DR</strong>

- **CI/CD** means a push to `main` rebuilds and redeploys the app while the old container keeps serving, so users never hit a "server down" gap during an update.
- The workflow has three jobs: lint on a GitHub-hosted runner, build and push a Docker image to Docker Hub, then pull and run it on an EC2 machine that is registered as a **self-hosted runner**.
- Every API key lives in **GitHub repository secrets** and is injected into the container at run time. Nothing secret is baked into the image or committed to the repo.
</div>

This is part 10 of the agentic chatbot series: the Streamlit front end and LangGraph back end from the
human-in-the-loop lesson get packaged into a Docker image and deployed to AWS through an automated
pipeline. The point is the shape of the pipeline, not the AWS clicks: after a one-time setup, every future
feature ships by `git push`, and the running app is never stopped by hand.

## Why a pipeline instead of a manual deploy

A manual deploy looks fine the first time: create an EC2 instance, copy the code, start the server, share
the endpoint. The trouble arrives with the second release. To update a manually deployed app you stop the
server, upload the new code and restart it, and for however long that takes (the video uses "3 hours" as
the example) users see an error page and go elsewhere.

CI/CD removes the human from that loop. The developer still only pushes code to GitHub. GitHub Actions
notices the push, builds a fresh image, and a runner on the AWS machine swaps the running container for
the new one. The endpoint stays the same and stays up. The video picks GitHub Actions over Jenkins and
CircleCI for one reason: it is already hosted inside GitHub, so there is no CI server to install.

## The three-stage workflow

Everything the pipeline does is declared in `.github/workflows/cicd.yml`. Both the folder name and the
`workflows` subfolder are fixed by GitHub; rename either and nothing triggers. The trigger is a push to
`main`, with `paths-ignore` for `README.md` so documentation edits do not redeploy anything.

```
git push origin main
        │
        ▼
GitHub Actions
        │
        ├─ job 1  continuous-integration   runs-on: ubuntu-latest   (lint the code)
        │
        ├─ job 2  build-and-push           runs-on: ubuntu-latest
        │           docker login  ──►  docker build  ──►  docker push  ──►  Docker Hub
        │
        └─ job 3  continuous-deployment    runs-on: self-hosted  (this IS the EC2 box)
                    docker pull IMAGE
                    check every required secret is set, else fail "secret is missing"
                    docker run -d -p 8501:8501 -e GOOGLE_API_KEY=... IMAGE
                                     │
                          http://ec2-public-dns:8501
```

Two details carry the design. Job 3 says `runs-on: self-hosted`, meaning "run this on a machine I
registered myself", and that machine is the EC2 instance. And secrets are never written into the YAML;
every value is read as `secrets.NAME`, and the deploy step refuses to start the container if one is empty.

## What the container needs

The Dockerfile is the standard Python service recipe: a slim Python base image, `PYTHONDONTWRITEBYTECODE`
and `PYTHONUNBUFFERED` so logs appear immediately, `build-essential` for packages that compile, and
`libgomp1` because the FAISS vector index used by the RAG tool needs it. Requirements are copied and
installed before the source so the dependency layer is cached between builds. The image exposes 8501
(Streamlit's default) and its command is `streamlit run app.py`.

A `.dockerignore` file plays the role `.gitignore` plays for the repo: it keeps the virtual environment,
notebooks, local `.env` and any SQLite or FAISS files generated during development out of the image. The
video also deletes the locally generated `chatbot.db` before the first push, so the deployed app starts clean.

## Preparing AWS once

| Step | What the video does | Why it matters |
| --- | --- | --- |
| IAM user | New user with only `AmazonEC2FullAccess`, then an access key for CLI use (download the CSV) | Least privilege: the pipeline cannot touch services it does not need, which also caps surprise cost |
| EC2 instance | Ubuntu, `t2.medium` (2 vCPU, 4 GB RAM), 32 GB disk, allow HTTP and HTTPS | 4 GB is the stated minimum for this app; Ubuntu is what production servers usually run |
| Docker on the box | `apt-get update`, `upgrade`, then the Docker install script, verify with `docker --version` | A fresh EC2 image has no Docker |
| Runner | GitHub repo Settings, Actions, Runners, New self-hosted runner (Linux), paste the commands into the EC2 terminal, name the runner `self-hosted`, then `./run.sh` | The name must match `runs-on` in the YAML or the deploy job queues forever |
| Secrets | Settings, Secrets and variables, Actions: `REGISTRY` (`docker.io`), `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `IMAGE_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, plus every app key (`GOOGLE_API_KEY`, `TAVILY_API_KEY`, `OPENWEATHER_API_KEY`, `LANGSMITH_*`) | The YAML reads them as `secrets.NAME`; values are typed without quotes |
| Port | Security group, inbound rules, add TCP 8501 from `0.0.0.0/0` | Until this rule exists the public DNS times out; the URL must end in `:8501` |

When the runner prints "Listening for Jobs" and shows as idle in the repo's Runners page, the setup is done.
The first `git push` runs all three jobs; the image appears in Docker Hub during job 2 and the app answers
at the instance's public DNS on port 8501 after job 3.

## Code that matters

The Dockerfile and workflow are reconstructed from what the video shows on screen (sketch).

```dockerfile
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8501
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

```yaml
name: streamlit-aws-cicd
on:
  push:
    branches: [main]
    paths-ignore: ["README.md"]
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker login ${{ secrets.REGISTRY }} -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }}
      - run: docker build -t ${{ secrets.DOCKER_USERNAME }}/${{ secrets.IMAGE_NAME }}:latest . && docker push ${{ secrets.DOCKER_USERNAME }}/${{ secrets.IMAGE_NAME }}:latest
  continuous-deployment:
    needs: build-and-push
    runs-on: self-hosted
    steps:
      - run: docker pull ${{ secrets.DOCKER_USERNAME }}/${{ secrets.IMAGE_NAME }}:latest
      - run: docker rm -f chatbot || true
      - run: docker run -d --name chatbot -p 8501:8501 -e GOOGLE_API_KEY="${{ secrets.GOOGLE_API_KEY }}" -e TAVILY_API_KEY="${{ secrets.TAVILY_API_KEY }}" ${{ secrets.DOCKER_USERNAME }}/${{ secrets.IMAGE_NAME }}:latest
```

The app side of the contract is small: configuration comes from the environment, and a missing key fails
at start-up instead of deep inside a tool call.

```python
import os

REQUIRED = ["GOOGLE_API_KEY", "TAVILY_API_KEY", "OPENWEATHER_API_KEY", "LANGSMITH_API_KEY"]
missing = [name for name in REQUIRED if not os.environ.get(name)]
if missing:  # sketch of the check the deploy step performs before docker run
    raise RuntimeError(f"secret is missing: {', '.join(missing)}")
```

## Failure modes and gotchas

- **Runner name mismatch.** The deploy job says `runs-on: self-hosted`; if the runner was registered under
  another name, the job sits in "queued" forever with no error.
- **Port not opened.** The app is running but the public DNS times out: the security group needs an inbound
  rule for 8501, and the URL needs `:8501` appended.
- **Secrets with quotes.** Typing `"true"` into the `LANGSMITH_TRACING` secret stores the quotes; the
  video stresses values go in bare.
- **A tool's key missing from `docker run`.** The chatbot boots and chats fine, then one tool fails only in
  production. Every key the agent uses must be listed both in secrets and in the `-e` flags.
- **Local state in the repo.** SQLite checkpoints and FAISS folders created while testing should not travel
  in the repo or the image; an IAM username with a space is rejected too, use a hyphen.
- **Billing does not stop by itself.** When the exercise is over: terminate the instance, delete the IAM
  user and deactivate its keys. The Docker Hub image can stay.

## Takeaways

- Worth remembering: CI/CD is a one-time setup that turns every later release into a `git push`, with no
  downtime, because the old container keeps serving until the new one is up.
- The self-hosted runner is the bridge between GitHub and the server: GitHub decides *what* to run, the
  EC2 box runs it locally with its own Docker.
- Secrets flow from GitHub secrets, to `secrets.NAME` in the workflow, to `docker run -e`, to
  `os.environ`; they never touch the repo or the image.
- Least-privilege IAM, `.dockerignore`, `paths-ignore` for docs and a fail-fast secret check are the small
  habits that keep the pipeline safe and cheap.

## Test yourself

<details>
<summary>Why does the deploy job run on a "self-hosted" runner instead of ubuntu-latest?</summary>
<p>Because the container must run on the EC2 machine that serves users. Registering that machine as a self-hosted runner lets GitHub Actions execute the pull-and-run steps directly on it, using its local Docker.</p>
</details>

<details>
<summary>What keeps the API keys out of the repo and the image?</summary>
<p>They are stored as GitHub repository secrets, referenced in the workflow as <code>secrets.NAME</code>, and passed to the container at run time with <code>docker run -e</code>. The app reads them from the environment.</p>
</details>

<details>
<summary>The pipeline is green but the public URL times out. What is the usual cause?</summary>
<p>No inbound rule for port 8501 in the instance's security group, or the port was left off the URL. The container is listening on 8501; AWS is blocking it.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/foyPwFATIC0"
    title="22. Agentic Chatbot CI/CD Deployment on AWS with Docker & GitHub Actions / Part 10"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [22. Agentic Chatbot CI/CD Deployment on AWS with Docker & GitHub Actions / Part 10](https://www.youtube.com/watch?v=foyPwFATIC0).

**Related:** [Harness Engineering](/docs/agentic-ai/harness-engineering) · [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Glossary](/docs/glossary)

Next: [Deploy on Render for Free with Docker](./25-render-free-deploy.md)
