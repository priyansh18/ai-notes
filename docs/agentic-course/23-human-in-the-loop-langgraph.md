---
id: 23-human-in-the-loop-langgraph
title: "Human-in-the-Loop with interrupt()"
sidebar_position: 23
description: "Pause a LangGraph agent inside a sensitive tool with interrupt(), resume it with Command(resume=...), and why a checkpointer is mandatory for the pause to survive."
tags: [Agentic AI, LangGraph, Human-in-the-Loop]
---

# Human-in-the-Loop with interrupt()

<div class="tldr">
<strong>TL;DR</strong>

- **Human-in-the-loop (HITL)** puts a human checkpoint at critical points of an agent workflow so consequential actions (buying stock, sending mail, publishing a post) are approved, corrected or rejected by a person rather than decided autonomously.
- In LangGraph it is one function: `interrupt(payload)` **pauses** the run, the payload surfaces to the caller under `__interrupt__`, and `invoke(Command(resume=value), config)` **continues** from the pause with `value` as the return of `interrupt`.
- A **checkpointer is mandatory**, because the paused state has to be saved and reloaded. Put the interrupt **inside the sensitive tool**, not in the chat node, so only that action asks for approval.
</div>

Part 9 adds the last core component to the chatbot. The bot can already search, fetch prices and
answer over uploaded documents, and it will happily execute a `purchase_stock` tool the moment you
ask. That is the problem. This lesson explains why some actions need a human gate, shows how
LangGraph's `interrupt` and `Command` implement it, and wires approval into the stock-purchase
tool, first from a CLI loop and then from the Streamlit UI.

## Why a human gate exists

The video's definition: HITL is a design approach where a human actively participates at critical
points of the workflow to supervise, approve, correct or guide the model's output. It is not applied
everywhere. Fetching the weather needs no approval. Spending money does, because a model can
hallucinate: asked for 10 shares, it may buy 20, or the wrong company.

Reasons listed in the lesson: it **helps the agent** complete tasks it should not finish alone,
adds **accountability** (someone reviewed the action), improves **accuracy** and **safety**, keeps
**ethical alignment** (a human rejects a post with abusive content before it is published), and
gives a better **user experience** because people trust a bot that asks before acting.

Four common patterns:

| Pattern | Shape |
| --- | --- |
| Action approval | approve or reject before execution (the stock purchase) |
| Output review and edit | agent drafts, human edits and finalises |
| Ambiguity clarification | "which Friday, this one or next?" |
| Escalation | bot cannot handle it, hands off to a person |

## How interrupt pauses and Command resumes

Inside any node or tool, call `decision = interrupt(payload)`. Execution stops there. The `invoke`
call returns as usual, but the result carries an `__interrupt__` entry holding your payload (a
string or a dict with whatever the human needs to see: type, reason, question, instruction). No
model output appears yet.

To continue, call `invoke` again on the **same thread** with `Command(resume=value)` instead of a
message. LangGraph reloads the checkpoint for that thread, finds the paused point, and the
`interrupt` call now returns `value`. Your code after it runs normally: check the decision, execute
the action or return a declined message.

This is why the checkpointer is required. The pause is only possible because the state at that
moment is saved somewhere (in memory or a database) and can be loaded when the resume arrives. The
same `thread_id` config must be used on both calls, or the resume has nothing to resume.

```
without HITL:
  "buy 10 AAPL" -> chat_node -> tools(purchase_stock) -> chat_node -> "order placed"

with HITL:
  "buy 10 AAPL" -> chat_node -> tools(purchase_stock)
                                   interrupt("Approve buying 10 shares of AAPL?")
                                   ... run paused, state checkpointed ...
  Command(resume="yes") -> purchase_stock continues -> chat_node -> "order placed"
  Command(resume="no")  -> purchase_stock returns "declined"  -> chat_node -> "declined"
```

## Where the interrupt goes

The video first demonstrates the mechanism in the simplest possible place: the chat node itself,
asking "do you really want to ask this question?" before every answer. That is only to show the
API. The rule for a real agent with many tools is different: **do not** gate the chat node. Put
the `interrupt` inside the specific tool that performs the sensitive action. Every other tool keeps
running without prompts, and the approval text can include the exact arguments the model generated
(quantity and symbol), which is what the human actually needs to check.

## Driving it from a CLI and a UI

The CLI loop changes in one place. After each `invoke`, check `result.get("__interrupt__")`. If
present, print the payload, read a yes/no from the terminal, and invoke again with
`Command(resume=decision)`. If absent, print the last message as before. "Hello" never triggers it;
"purchase 20 stock of Apple" does, and answering `no` yields a declined message instead of an order.

The Streamlit version is the same logic with an approve/reject button pair instead of `input()`.
The backend file does not change between CLI and UI. LangSmith traces show the interrupt as a step
inside the tool run, so approvals are auditable after the fact.

## Code that matters

```python
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langgraph.types import interrupt, Command


@tool
def purchase_stock(symbol: str, quantity: int) -> str:
    """Place a buy order for a stock. Sensitive: requires human approval before executing."""
    decision = interrupt(
        f"Approve buying {quantity} shares of {symbol}? (yes/no)"
    )
    if isinstance(decision, str) and decision.lower() == "yes":
        # sketch: a real tool would call a brokerage API here
        return f"Purchase order placed for {quantity} shares of {symbol}."
    return f"Purchase of {quantity} shares of {symbol} was declined by the human."


# purchase_stock is appended to the tools list and bound like every other tool;
# the graph is compiled with a checkpointer (the video uses a SQLite one).

config = {"configurable": {"thread_id": "demo"}}

while True:  # sketch of the CLI loop
    user_input = input("You: ")
    if user_input.lower() in ("exit", "quit"):
        break
    result = chatbot.invoke(
        {"messages": [HumanMessage(content=user_input)]}, config=config
    )
    interruption = result.get("__interrupt__")
    if interruption:
        print("HITL:", interruption[0].value)
        decision = input("Your decision (yes/no): ").strip().lower()
        result = chatbot.invoke(Command(resume=decision), config=config)
    print("Bot:", result["messages"][-1].content)
```

The notebook demo uses a dict payload and a dict resume instead:
`interrupt({"type": "approval", "question": q, "instruction": "Approve? yes/no"})` paired with
`Command(resume={"approved": user_input})`, then `if decision.get("approved") == "no"`. Either
shape works; the resume value is whatever you pass, and your code decides how to read it.

## Failure modes and gotchas

- **No checkpointer.** `interrupt` cannot pause without somewhere to save the state. Compile with a checkpointer before adding any HITL.
- **Different `thread_id` on resume.** The resume must target the thread that paused. A new thread ID means a new run with no pause to continue.
- **Gating the chat node.** Every message then asks for approval, including "hello". Gate the action, not the conversation.
- **Side effects before the interrupt.** On resume, LangGraph re-enters the paused node or tool and replays it up to the interrupt, so code placed before `interrupt` inside that function can run twice. Keep the irreversible call after the decision check.
- **Ambiguous resume shape.** If the tool expects a string and the UI sends a dict (or the reverse), `decision.lower()` or `decision.get(...)` fails. Pick one shape per interrupt and document it in the payload.
- **Missing keys in `.env`.** The notebook demo errored on first run because environment variables were not loaded; `interrupt` only surfaces after the model call succeeds.

## Takeaways

- Worth remembering: HITL in LangGraph is two calls, `interrupt(payload)` to pause and `Command(resume=value)` to continue, plus a checkpointer to make the pause durable.
- The approval payload should carry the concrete arguments the model produced. Approving "buy 20 AAPL" is meaningful; approving "do the purchase" is not.
- Approval belongs in the sensitive tool. Search, weather and RAG keep running unattended; only money, messages and publishing wait for a person.
- The four patterns (approval, review-and-edit, clarification, escalation) are all the same mechanism with different payloads and different code after the resume.

## Test yourself

<details>
<summary>Why does a graph with <code>interrupt()</code> need a checkpointer?</summary>
<p>The pause works by saving the run's state at the interrupt point and reloading it when <code>Command(resume=...)</code> arrives on the same thread. Without a checkpointer there is nothing to reload, so the run cannot continue from where it stopped.</p>
</details>

<details>
<summary>How does the calling code know that an interrupt happened?</summary>
<p>The result of <code>invoke</code> contains an <code>__interrupt__</code> entry holding the payload passed to <code>interrupt</code>. If that key is absent, the run finished normally and the last message is the answer.</p>
</details>

<details>
<summary>In an agent with many tools, where should the approval interrupt live and why?</summary>
<p>Inside the tool that performs the sensitive action (for example <code>purchase_stock</code>), not in the chat node. That way only that action prompts for approval, the prompt can show the exact generated arguments, and all other tools run without interruption.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/9ZYxMs2pAIA"
    title="21. Implement Human-in-the-Loop (HITL) in Agentic Chatbot using LangGraph / Part 9"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [21. Implement Human-in-the-Loop (HITL) in Agentic Chatbot using LangGraph / Part 9](https://www.youtube.com/watch?v=9ZYxMs2pAIA).

**Related:** [Loop Engineering](/docs/agentic-ai/loop-engineering) · [Agent Persistence](/docs/agentic-ai/agent-persistence) · [Glossary](/docs/glossary)
