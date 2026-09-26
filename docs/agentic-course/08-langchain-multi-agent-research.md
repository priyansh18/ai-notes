---
id: 08-langchain-multi-agent-research
title: "Multi-Agent Research Assistant with LangChain"
sidebar_position: 8
description: "A four-role research pipeline in LangChain, search agent, reader agent, writer chain, critic chain, passing work through a shared state dict, and why splitting roles beats one do-everything agent."
tags: [Agentic AI, LangChain, Multi-Agent]
---

# Multi-Agent Research Assistant with LangChain

<div class="tldr">
<strong>TL;DR</strong>

- The video builds a research assistant from four specialists: a **search agent** (Tavily), a **reader agent** (BeautifulSoup scraper), a **writer chain** and a **critic chain**. Each does one job well.
- Agents hand off through a plain Python dict called the **state**: search results go in, the reader reads them, the writer reads both, the critic reads the report.
- Not everything needs to be an agent. The writer and critic have no tools, so they are plain LCEL chains: `prompt | llm | StrOutputParser()`.
</div>

The previous lesson built one agent with two tools. This one builds a team. The task is "give me a
professional research report on topic X", and the video's argument is that one agent doing
search, extraction, writing and review in a single loop produces average output, while four
narrow roles produce good output. The lesson also switches to the newer `create_agent` API and
to LCEL chains, a useful contrast with the legacy `create_react_agent` from lesson 5.

## Why split the work

The video's analogy is a company. A project needs frontend, AI and backend work. A single
full-stack hire can do all three, but with limited depth in each; a team of three specialists
each goes deep, then the results are combined. Agents behave the same way: a single prompt that
says "search, scrape, write and critique" gives the model too many competing instructions, and
quality drops. Four agents with one instruction each is the fix. Two rules follow: every agent
that needs outside information gets a tool, and every agent gets an LLM for reasoning, even the
ones without tools.

## The four roles and their tools

| Role | Kind | Tool | Reads from state | Writes to state |
| --- | --- | --- | --- | --- |
| Search agent | `create_agent` | `web_search` (Tavily, 5 results, title + URL + 300-char snippet) | topic | `search_results` |
| Reader agent | `create_agent` | `scrape_url` (requests + BeautifulSoup + readability) | topic, `search_results` | `scraped_content` |
| Writer | LCEL chain | none | topic, `search_results`, `scraped_content` | `report` |
| Critic | LCEL chain | none | `report` | `feedback` |

The search tool deliberately returns only three fields per hit. Tavily's raw response is large;
the agent only needs enough to choose which URLs are worth opening. The reader then does the
expensive part: fetch the page, strip boilerplate, keep the article text. The writer and critic
have no decision to make and no tool to call, so a loop would only add latency; a
`ChatPromptTemplate` piped into the LLM and a `StrOutputParser` is the whole implementation.

## Shared state as the handoff

There is no message bus and no orchestrator model. The pipeline is a function that creates an
empty dict, runs each stage in order, and stores each stage's output under a key. The next stage
pulls what it needs from that dict and formats it into its own prompt. The video calls this
**state memory** and is clear that it is temporary: it lives for one run and is gone after. A
persistent store can replace it later without changing the stages.

```
topic
  v
[search agent] --tavily-->  state["search_results"]   (title, url, snippet x5)
  v
[reader agent] --scraper--> state["scraped_content"]  (full text of chosen URLs)
  v
[writer chain] ---------->  state["report"]           (intro, findings, conclusion, sources)
  v
[critic chain] ---------->  state["feedback"]         (score /10, strengths, improvements, verdict)
  v
return state
```

## create_agent replaces create_react_agent plus AgentExecutor

Lesson 5 needed two objects: the agent (decides) and the executor (runs the loop). The newer
`create_agent(model=..., tools=...)` folds the thought, action, observation loop inside, so one
call returns a runnable agent and `.invoke()` runs it to completion. The video checks the docs
and notes that `create_react_agent` still works but is the older implementation.

## Code that matters

A sketch of the modules the video writes (`tools.py`, `agents.py`, `pipeline.py`). Scraper
internals and the critic prompt (same shape as the writer, with a reviewer persona and a
`{report}` slot) are omitted.

```python
# tools.py
import os
from langchain.tools import tool
from tavily import TavilyClient

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


@tool
def web_search(query: str) -> str:
    """Search the web; return title, URL and a short snippet for the top results."""
    results = tavily.search(query=query, max_results=5)
    lines = [f"{r['title']}\n{r['url']}\n{r['content'][:300]}" for r in results["results"]]
    return "\n\n".join(lines)


@tool
def scrape_url(url: str) -> str:
    """Fetch a web page and return its main readable text."""
    ...  # sketch: requests.get, readability, BeautifulSoup text, all inside try/except


# agents.py
from langchain.agents import create_agent
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)


def build_search_agent():
    return create_agent(model=llm, tools=[web_search])


def build_reader_agent():
    return create_agent(model=llm, tools=[scrape_url])


writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Write clean, structured, insightful reports."),
    ("human", "Write a detailed research report on: {topic}\n\nResearch:\n{research}\n\n"
              "Structure: Introduction, Key Findings (at least 3), Conclusion, Sources (URLs)."),
])
writer_chain = writer_prompt | llm | StrOutputParser()
critic_chain = critic_prompt | llm | StrOutputParser()   # critic_prompt: score /10, strengths, improvements, verdict


# pipeline.py
def run_research_pipeline(topic: str) -> dict:
    state = {}

    out = build_search_agent().invoke(
        {"messages": [("user", f"Find recent, reliable, detailed information about: {topic}")]})
    state["search_results"] = out["messages"][-1].content

    out = build_reader_agent().invoke({"messages": [("user",
        f"From these search results on '{topic}', pick the most relevant URLs and scrape them:\n"
        f"{state['search_results']}")]})
    state["scraped_content"] = out["messages"][-1].content

    research = f"Search results:\n{state['search_results']}\n\nDetailed content:\n{state['scraped_content']}"
    state["report"] = writer_chain.invoke({"topic": topic, "research": research})
    state["feedback"] = critic_chain.invoke({"report": state["report"]})
    return state
```

## Failure modes and gotchas

- **Scraping is the flaky stage**: pages time out, block bots, or return junk. The video wraps the scraper in `try/except` and says any third-party call deserves the same. Without it one bad URL kills the whole run.
- **State is per-run**: the dict is created inside the pipeline function and discarded on return. Nothing is remembered between topics. Fine for a demo; a real assistant needs a persistent memory layer, which later lessons cover.
- **No feedback loop yet**: the critic scores the report (the demo got 6/10) but nothing sends that feedback back to the writer. The pipeline is strictly one-way. Turning "areas to improve" into a rewrite pass needs a loop, which is exactly what LangGraph adds.
- **Prompt drift between stages**: the writer is told to list sources, so the pipeline must pass the URLs (search results) *and* the scraped text. Pass only the text and the sources section is hallucinated. Pass only the 300-character snippets and the report is thin.

## Takeaways

- Split by role, not by step count. Each agent should have one verb: search, read, write, review.
- Reach for an agent only where there is a tool to call and a decision about when to call it. Otherwise a chain is faster, cheaper and more predictable.
- A shared dict is a perfectly good first state layer. What matters is that every stage reads from and writes to the same object with named keys.
- The pipeline's weakness (no branching, no loops, no persistence) is the setup for the next lesson on why LangGraph exists.

## Test yourself

<details>
<summary>Why are the writer and critic chains rather than agents?</summary>
<p>They have no tools and no decision about whether to act. Given the research text they always do the same thing, so a prompt piped into the LLM and a string parser is enough. An agent loop would only add cost and latency.</p>
</details>

<details>
<summary>How does the reader agent know which URLs to open?</summary>
<p>The pipeline injects the search agent's output (title, URL, snippet for five hits) from the state dict into the reader's prompt and asks it to pick the most relevant URLs and scrape them with its scrape_url tool.</p>
</details>

<details>
<summary>What does create_agent do that create_react_agent did not?</summary>
<p>It runs the thought, action, observation loop itself. With create_react_agent you also had to wrap the agent in AgentExecutor to execute tools and iterate; create_agent returns one object whose invoke runs to completion.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/9bGYJ68qvAA"
    title="6. End-to-End Multi-Agent AI System with LangChain"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [6. End-to-End Multi-Agent AI System with LangChain](https://www.youtube.com/watch?v=9bGYJ68qvAA).

**Related:** [LangChain v1](/docs/rag-course/13-langchain-v1) · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)

Next: [LangChain vs LangGraph →](./09-langchain-vs-langgraph.md)
