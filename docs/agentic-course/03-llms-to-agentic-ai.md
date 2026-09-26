---
id: 03-llms-to-agentic-ai
title: "From LLMs to Agentic AI"
sidebar_position: 3
description: "How generative AI evolved from a bare LLM with a knowledge cutoff, through RAG, to agents that decide for themselves when to call a tool and then plan and execute whole workflows."
tags: [Agentic AI, LLMs, RAG]
---

# From LLMs to Agentic AI

<div class="tldr">
<strong>TL;DR</strong>

- A bare LLM answers from training data and stops at its **knowledge cutoff**. Fine-tuning to add new facts is too slow and expensive for everyday development.
- **RAG** fixes that by connecting the model to a knowledge base you can update without retraining, but it still fails on **real-time data** (weather, news, anything changing hourly).
- An **agent** is an LLM that decides on its own whether to answer from memory or **call a tool**, and then extends that decision-making into planning, executing and checking multi-step work with minimal human input.
</div>

This lesson is the origin story of agentic AI, told as a sequence of problems and fixes: what a plain LLM
could do, where it broke, what RAG patched, where RAG broke, and what the agent added. It matters because
each stage is still in use. Knowing which problem each stage solves tells you when a chatbot is enough,
when RAG is enough, and when you genuinely need an agent.

## Stage 1: a bare LLM and its knowledge cutoff

The first generative AI applications were a pre-trained model with a prompt in and a response out. That
covered text generation, translation, summarisation, chat, and NLP tasks such as entity extraction, and
later images once models went multimodal. The limit is baked into how models are trained: every model has
a **knowledge cutoff**, the date up to which internet data was included. The video opens a provider's model
page to show it listed next to the context window and maximum output tokens (one model shows an early 2024
cutoff). Ask about something older than the cutoff and the answer is fine. Ask about anything after it and
the honest response is "no context for that".

## Stage 2: why fine-tuning was not the everyday fix

The obvious repair is to fine-tune: take the pre-trained model, add new data, train some parameters. The
video's objection is practical. Parameters run from millions to billions, so fine-tuning needs serious
compute, budget and time. Labs with those resources can do it. A developer whose data changes every week
cannot retrain a model each time, and cannot make users wait while it happens.

## Stage 3: RAG plugs an updatable knowledge base into the model

Retrieval-augmented generation keeps the model frozen and attaches a **knowledge base** (in practice a
vector store holding the latest documents) through an orchestration framework such as LangChain or
LlamaIndex. The flow the video draws:

```
user question
     |
     v
 LLM: do I already know this?  --yes-->  answer directly
     |
     no
     v
 semantic search over knowledge base  -->  relevant chunks
     |
     v
 LLM reads, cleans, rearranges  -->  refined answer to user
```

Updating knowledge now means adding documents to the store. No training, no waiting. This is why RAG became
the default way to build generative AI applications and is still used today.

## Stage 4: where RAG breaks: real-time data

RAG assumes someone loads the knowledge base. For weather, temperatures, prices, or news that changes
within the hour, nobody can sit and re-ingest continuously. Ask a RAG system for "the latest news" at
noon when the store was filled in the morning, and it has nothing. The store is always a snapshot.

## Stage 5: the agent: an LLM that decides when to use a tool

The researchers' answer was to give the LLM **tools**: a web search, a calendar, storage, anything with an
API. The important part is not the tools, it is who decides to use them. In a RAG pipeline the developer
hard-wires retrieval into every request. In an agent, the model reads the prompt and **reasons about
whether it needs a tool at all**. The video demonstrates this in a chat assistant: "tell me about Python"
is answered instantly from training knowledge with no search, while "latest election news" triggers a web
search, pulls several news sites, and the model summarises them into a refined answer with sources.

| Stage | Answers from | Handles new facts? | Handles real-time facts? | Who decides to fetch? |
| --- | --- | --- | --- | --- |
| Bare LLM | Training data only | No | No | Nobody |
| RAG | Training data plus a knowledge base | Yes, by re-ingesting | No | The developer, on every request |
| Agent | Training data plus tools | Yes | Yes | The model, per request |

## Stage 6: from tool use to workflow automation

Modern coding assistants show the same mechanism scaled up. Given "create a car racing game in Python",
the agent first produces a **plan** (set up the display and clock, player car, obstacles, collision
detection, scoring, game-over screen, requirements, a verification step), pauses so the human can edit
or approve it, then executes step by step, writing code, testing as it goes, and stopping to ask before
running an install command. The definition the video keeps returning to is now fully visible: take a goal,
plan, take actions, adapt to changes, and seek help only when necessary.

## Code that matters

The video shows no code; the mechanism it describes is a single decision inside a loop (sketch):

```python
# sketch: the decision that turns an LLM into an agent
def agent(question: str, llm, tools: dict, max_steps: int = 5) -> str:
    messages = [{"role": "user", "content": question}]
    for _ in range(max_steps):
        reply = llm.invoke(messages, tools=list(tools.values()))
        messages.append(reply)
        if not reply.tool_calls:
            return reply.content                    # training knowledge was enough
        for call in reply.tool_calls:               # the model chose a tool; run it
            output = tools[call["name"]].invoke(call["args"])
            messages.append(
                {"role": "tool", "content": str(output), "tool_call_id": call["id"]}
            )
    return "Stopped: step limit reached"
```

RAG is the special case where retrieval is called unconditionally before the model sees the question.
The agent moves that "call or not" choice inside the model, which is why a search tool can sit unused on a
question about Python and fire on a question about today's news.

## Failure modes and gotchas

- **Expecting a bare LLM to know recent events.** It cannot; check the cutoff on the model page before
  blaming the prompt.
- **Treating RAG as live data.** The knowledge base is only as fresh as the last ingestion.
- **Calling every tool on every request.** That is RAG with extra steps and it wastes calls; the value of
  an agent is that the model skips tools it does not need.
- **Full autonomy without checkpoints.** The coding demo pauses before installing packages for a reason;
  an agent that never asks will eventually run something you did not want.
- **Unbounded loops.** The sketch has a step limit; a real agent needs one too, or a confused model calls
  tools forever.

## Takeaways

- Each stage solves one problem: cutoff (RAG), staleness (tools), multi-step work (planning plus execution).
- The defining feature of an agent is reasoning about whether to act, not the number of tools attached.
- RAG has not been replaced; inside an agent the knowledge base is just one more tool.
- Minimal human guidance still means some guidance: plan review and approval before risky actions.

## Test yourself

<details>
<summary>Why was RAG introduced instead of fine-tuning models with new data?</summary>
<p>Fine-tuning retrains parameters that number in the millions to billions, which needs compute, budget and time most developers do not have. RAG keeps the model frozen and stores new information in a knowledge base that can be updated instantly.</p>
</details>

<details>
<summary>What kind of question defeats a RAG system, and how does an agent handle it?</summary>
<p>Anything real-time, such as current weather or news from the last hour, because the knowledge base is a snapshot. An agent gives the model a search tool and lets it decide to call that tool when the question needs live data.</p>
</details>

<details>
<summary>What is the one capability that makes a system "agentic" in this lesson's definition?</summary>
<p>The model itself decides whether to answer directly or call a tool, rather than the developer hard-wiring retrieval into every request. That same reasoning extends to planning and executing multi-step tasks with minimal human guidance.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/swpzuGjAh-4"
    title="1. Evolution from LLMs to Agentic AI: Complete Agentic AI Course"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [1. Evolution from LLMs to Agentic AI: Complete Agentic AI Course](https://www.youtube.com/watch?v=swpzuGjAh-4).

**Related:** [Introduction to RAG](/docs/rag-course/02-introduction-to-rag) · Context Windows · Tool Calling

Next: [Agent Characteristics and Components →](./04-agent-characteristics-components.md)
