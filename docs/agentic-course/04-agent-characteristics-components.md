---
id: 04-agent-characteristics-components
title: "Agent Characteristics and Components"
sidebar_position: 4
description: "A worked recruiting-agent example, the six characteristics of an agentic system (autonomy, goals, planning, reasoning, adaptability, context) and the five components every agent is built from."
tags: [Agentic AI, Agent Architecture, Human-in-the-Loop]
---

# Agent Characteristics and Components

<div class="tldr">
<strong>TL;DR</strong>

- An agent takes a goal, **plans**, **acts through tools**, **monitors** the result, **adapts** the plan when reality disagrees, and **asks a human** only at checkpoints. A chatbot answers isolated prompts and does none of this.
- Six characteristics define agentic behaviour: **autonomy, goal orientation, planning, reasoning, adaptability, context awareness**. Autonomy is bounded by permission scopes, human-in-the-loop checkpoints, override controls and guardrails.
- Five components implement it: **brain** (LLM), **orchestrator** (framework), **tools**, **memory** (short-term and long-term), **supervisor** (approvals, guardrail enforcement, escalation).
</div>

This lesson turns the one-line definition of agentic AI into something you can recognise in an architecture
diagram: one agent walked through a long task, then the characteristics behind that behaviour and the
components that implement them. LangGraph, CrewAI and AutoGen are different ways of wiring the same five boxes.

## One worked example: a recruiting agent, end to end

The video's example is an agent connected to a company's internal documents and given a single prompt:
hire a remote backend engineer with two to four years of experience. What happens next is the whole
mechanism in miniature.

1. **Goal.** The prompt becomes a persistent objective, with the experience range as a constraint.
2. **Plan.** The agent proposes a sequence: draft a job description and post it, monitor the pipeline and
   adjust strategy if needed, shortlist, schedule interviews, send an offer, onboard. It asks for approval
   before starting.
3. **Act through tools.** Drafting uses the company documents. Posting calls each job platform's API, which
   the video names explicitly as a tool the agent chose to invoke. Scheduling later uses calendar access.
4. **Monitor.** After posting, the agent keeps watching the pipeline rather than declaring the step done.
5. **Adapt.** Two applications arrive against an expectation of twenty. The agent proposes widening the
   role to full stack and promoting the post, asks for confirmation, then re-posts and monitors again.
6. **Keep going with checkpoints.** Eight applications are screened into strong, partial and weak matches;
   the agent asks before scheduling the top two, checks the calendar, drafts invitations, sends a reminder
   with prepared questions, drafts the offer on request, tracks acceptance, and starts onboarding tasks.

Every step follows the same shape: propose, wait for approval where it matters, act, observe, revise.
A chatbot has no tools, no reasoning about when to use them, and no memory of the goal between turns.

## The six characteristics

| Characteristic | What it means | In the example |
| --- | --- | --- |
| Autonomy | Decides and acts toward the goal without step-by-step prompting; proactive execution, decision-making, tool use | Runs the whole pipeline from one prompt |
| Goal-oriented | Holds a persistent objective plus constraints, and directs every action at it, instead of reacting to isolated prompts | "Hire a backend engineer, 2 to 4 years, remote" |
| Planning | Breaks the goal into ordered steps or sub-goals; may generate several candidate plans and evaluate them | Plan A: post on job boards; plan B: referrals and agencies |
| Reasoning | Interprets information, draws conclusions and decides, both while planning and while executing | Chooses the job-board API, not the calendar, when posting |
| Adaptability | Modifies the plan or strategy on failures, external feedback or changed goals, while staying aligned with the goal | Widens the role when applications are low |
| Context awareness | Retains and uses task state, past interactions, preferences and tool results across steps | Answers "what is the progress?" two days later |

## Autonomy needs brakes

The video is direct that full autonomy is dangerous: left alone, the recruiting agent could send offers
with wrong terms, shortlist by age or nationality in breach of anti-discrimination law, or keep promoting
the post beyond what is needed. Four controls bound it:

- **Permission scopes**: limit which tools and actions run independently. It can screen candidates but
  needs approval before rejecting anyone.
- **Human-in-the-loop (HITL)**: checkpoints where the agent must wait for input, such as "post this
  description?" Every framework in the course exposes this.
- **Override controls**: stop, pause or change behaviour at any time, for example halting a screening
  round mid-way and resuming later.
- **Guardrails and policies**: hard rules and ethical boundaries, such as "never schedule interviews on
  weekends", plus refusal of harmful or violating content. Libraries such as guardrails.ai exist for this.

## Goals, plans and reasoning

The goal is the compass for autonomy, and it is **stored in core memory** as structured state so the agent
cannot lose it (see the dict below). Goals carry constraints and can be altered later.

Planning is more than one list. The agent can generate **multiple candidate plans** and score each on
efficiency (faster), cost (cheaper), risk (what if no one applies) and alignment with constraints (remote
only, within budget), then let the human pick or apply a preset policy such as "prefer low-cost channels".

Reasoning is the LLM at work, and it happens twice. **During planning**: decomposing an abstract goal into
concrete steps, selecting the tool for each step, estimating time, dependencies and risk. **During
execution**: choosing between options (schedule the best two of three candidates), knowing when to pause
and ask (unsure about terms), and handling errors (a tool's API is down, so fall back to another).
Without reasoning, what remains is a plain chatbot.

## Context awareness is memory

Context awareness is implemented as two memories. **Short-term memory** holds the current state and the
metadata of the running task, including tool responses as they arrive. **Long-term memory** holds the whole
interaction history and user preferences. Both feed every decision; an agent without them cannot continue
a task after a break or explain its own progress.

## The five components

```
          +---------------------------------------------+
          |         ORCHESTRATOR (framework)            |
          |  sequencing, routing, retries, delegation   |
 goal --> |  BRAIN (LLM) <----> MEMORY (short + long)   |
          |      |                                      |
          |      +--> TOOLS (APIs, search, calendar,    |
          |      |          files, knowledge base)      |
          |      +--> SUPERVISOR (HITL approvals,       |
          |             guardrails, escalation)         |
          +---------------------------------------------+
```

- **Brain**: the LLM. Goal interpretation, planning, reasoning, tool selection.
- **Orchestrator**: the agent-building framework: task sequencing, conditional routing, retry logic,
  looping and delegation. LangGraph, CrewAI, AutoGen, and no-code n8n; LangChain can build simple agents
  but the field moved to LangGraph.
- **Tools**: connections to external sources: search, calendars, email, code interpreters, browsers,
  databases, files. A RAG knowledge base is itself a tool here. Public catalogs list thousands.
- **Memory**: conversation context and state tracking, short-term and long-term, built with the
  orchestrator's memory features or an external database.
- **Supervisor**: the human channel. Approval requests, guardrail enforcement that blocks unsafe or
  non-compliant behaviour, and escalation to a person when uncertainty or conflict arises.

## Code that matters

The video shows the agent's core memory as JSON. Reconstructed here as a Python dict (shape from the
video, values illustrative), followed by a sketch of a permission-scoped action:

```python
# core memory: the goal and progress the agent must never lose (shape from the video)
agent_state = {
    "goal": "hire a backend engineer",
    "constraints": {
        "experience_years": [2, 4],
        "remote": True,
        "stack": ["Python", "Django", "cloud"],
    },
    "status": "active",
    "posted_on": "2026-01-10",
    "progress": {
        "job_description_created": True,
        "posted_to": ["LinkedIn", "Naukri"],
        "applications_received": 8,
        "interviews_scheduled": 2,
    },
}

# sketch: permission scopes plus a human checkpoint around one tool call
TOOLS: dict = {}
NEEDS_APPROVAL = {"post_job", "send_offer", "reject_candidate"}


def run_action(name: str, args: dict, ask_human) -> dict:
    if name in NEEDS_APPROVAL and not ask_human(f"Allow {name} with {args}?"):
        return {"status": "skipped", "reason": "human declined"}
    return TOOLS[name](**args)
```

## Failure modes and gotchas

- **Unbounded autonomy.** Wrong offer terms, discriminatory shortlisting and runaway promotion are the
  video's own examples; scopes and HITL exist to prevent them.
- **Goal not persisted.** If the goal lives only in the prompt, the agent cannot pick the task up again
  after a break or report progress.
- **No error path for tools.** APIs go down; reasoning at execution time has to include a fallback.
- **Calling a chatbot an agent.** If it cannot select tools, hold a goal, or ask for help, it fails the
  characteristics test regardless of the label.

## Takeaways

- The definition in practice: plan, act, adapt, seek help when necessary, all anchored to a stored goal.
- Reasoning is the LLM's job and it happens twice, at planning time and at execution time.
- Autonomy is a dial with four brakes: scopes, HITL, override, guardrails.
- Five components make one checklist: brain, orchestrator, tools, memory, supervisor.

## Test yourself

<details>
<summary>What separates the recruiting agent from a chatbot fed the same prompt?</summary>
<p>The agent keeps the goal, produces a plan, calls tools such as job-board APIs and a calendar, monitors results, changes strategy when applications are low, and pauses for approval at checkpoints. A chatbot answers the prompt once with no tools, no plan and no memory of the goal.</p>
</details>

<details>
<summary>Name the four ways the video bounds an agent's autonomy.</summary>
<p>Permission scopes (which actions run without asking), human-in-the-loop checkpoints (wait for approval), override controls (stop, pause, continue at any time), and guardrails and policies (hard rules such as no weekend interviews, refusal of harmful content).</p>
</details>

<details>
<summary>What does the supervisor component do, and how is it different from the orchestrator?</summary>
<p>The supervisor is the human channel: it raises approval requests, enforces guardrails, and escalates edge cases to a person. The orchestrator is the framework that sequences tasks, routes conditionally, retries and loops; it wires the supervisor in but does not make the human decisions.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/Gv5HxK92vTE"
    title="2. Agentic AI Explained: Core Characteristics & Components"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [2. Agentic AI Explained: Core Characteristics & Components](https://www.youtube.com/watch?v=Gv5HxK92vTE).

**Related:** [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Loop Engineering](/docs/agentic-ai/loop-engineering) · [Guardrails](/docs/rag-course/24-guardrails)
