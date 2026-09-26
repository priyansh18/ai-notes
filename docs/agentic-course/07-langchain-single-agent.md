---
id: 07-langchain-single-agent
title: "Single Agent with LangChain"
sidebar_position: 7
description: "How a LangChain ReAct agent works under the hood, the thought, action, observation loop, why AgentExecutor exists, and how to add a custom tool with the tool decorator."
tags: [Agentic AI, LangChain, ReAct]
---

# Single Agent with LangChain

<div class="tldr">
<strong>TL;DR</strong>

- A LangChain agent is an LLM plus a list of tools plus a prompt that forces a **thought, action, observation** loop. `create_react_agent` builds it; `AgentExecutor` runs the loop.
- The LLM only *decides*; the executor *does*: it calls the chosen tool, feeds the result back as an observation, and repeats until the model writes "I now know the final answer".
- Any Python function becomes a tool with the `@tool` decorator. The agent picks between tools on its own, so give each one a clear docstring.
</div>

This lesson builds the course's first working agent: a search-and-weather assistant that answers
questions a plain GPT-3.5 model cannot, because the model's knowledge stops in 2022. It uses the
older LangChain agent API (`create_react_agent` and `AgentExecutor`), which is worth understanding
because every newer framework, including LangGraph, is a cleaner version of the same loop. The
lesson finishes by wrapping the agent in a Streamlit page and deploying it, but the mechanism is
the part that transfers.

## What the agent adds to a bare LLM

Ask GPT-3.5 "what year is it?" and it says 2022. Ask it for news and it hallucinates or refuses.
The model has no connection to anything outside its weights. An agent fixes this by putting the
LLM in charge of a small set of external tools:

- The **LLM** is the brain: it reasons about the goal and decides whether a tool is needed and which one.
- **Tools** are the hands: a Tavily web search, a weather API, anything callable.
- An **orchestration framework** (here LangChain) wires the two together and runs the loop.

## The ReAct loop: thought, action, observation

ReAct stands for **Reasoning and Acting**. Instead of answering in one shot, the model
interleaves internal reasoning with tool calls. Each pass through the loop has three parts:

1. **Thought**: "I need to find the capital of France."
2. **Action**: pick a tool and an input: `tavily_search("capital of France")`.
3. **Observation**: the tool's result comes back: "Paris".

Then the loop runs again with the observation in context: "Now I need the population of Paris",
search, "2.1 million". On the third pass the model writes "I now know the final answer", and the
loop stops. The whole history of thoughts, actions and observations is called the
**agent scratchpad**, and it is re-sent to the model on every pass so it remembers what it has
already done.

```
user input
    |
    v
+-----------+   thought + action    +----------------+
| LLM       | --------------------> | AgentExecutor  |
| (reason)  | <-------------------- | (run the tool) |
+-----------+   observation         +----------------+
    |                                      |
    | "I now know the final answer"        v
    v                                   tools: tavily_search, get_weather_data
final output
```

## The prompt is the loop

The loop is not hard-coded in Python. It lives in the prompt. The lesson pulls the standard ReAct
prompt from LangChain Hub, and it reads roughly: "Answer the following questions as best you can.
You have access to the following tools: ... Use the following format: Question, Thought, Action,
Action Input, Observation ... (this Thought/Action/Action Input/Observation can repeat N times)
... Thought: I now know the final answer. Final Answer: ..."

That format string is what makes the model emit parseable `Action:` lines, and the sentence
"I now know the final answer" is the stop condition. Write your own prompt and drop one of those
pieces, and the agent either never calls a tool or never terminates. That is why the lesson
recommends the hub prompt over a hand-written one.

## Why AgentExecutor exists

`create_react_agent(llm, tools, prompt)` returns an agent object, but that object cannot run
itself. It is a chain that, given the input and scratchpad, produces the *next* thought and
action. Something has to:

1. Send the user input plus the scratchpad (empty on the first pass) to the agent.
2. Read the action the agent chose.
3. Actually execute that tool with the given input.
4. Append the observation to the scratchpad and go back to step 1.
5. Stop when the agent returns a final answer, or when the iteration or time limit is hit.

That something is `AgentExecutor`. It takes the agent *and* the tools, because it is the one
calling them. `verbose=True` prints every thought, action and observation live, which is the
fastest way to see what the agent is actually doing.

## Custom tools with the tool decorator

Tavily is a prebuilt tool. The lesson also adds a home-made one: a function that hits the
Weatherstack API for a city and returns temperature, description and humidity. The only change
needed to make a function usable by the agent is the `@tool` decorator. The function name and
docstring become the tool description the LLM reads when deciding what to call. With two tools in
the list, the prompt "find the capital of India and then its current weather" produces a
two-step run: Tavily for "New Delhi", then the weather tool for New Delhi.

## Code that matters

Reconstructed from the notebook the lesson builds. The weather function body is a sketch of what
the lesson shows; field names may differ.

```python
import os
import requests
from dotenv import load_dotenv
from langchain import hub
from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import tool
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_openai import ChatOpenAI

load_dotenv()  # OPENAI_API_KEY, TAVILY_API_KEY, WEATHERSTACK_API_KEY

search_tool = TavilySearchResults(max_results=2)
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

@tool
def get_weather_data(city: str) -> str:
    """Fetch the current weather for a given city."""
    key = os.getenv("WEATHERSTACK_API_KEY")
    url = f"http://api.weatherstack.com/current?access_key={key}&query={city}"
    data = requests.get(url, timeout=10).json()
    if "current" not in data:
        return "Could not fetch weather data."
    cur = data["current"]
    return f"{city}: {cur['temperature']} C, {cur['weather_descriptions'][0]}, humidity {cur['humidity']}%"

prompt = hub.pull("hwchase17/react")  # the standard ReAct prompt (name inferred)
tools = [search_tool, get_weather_data]

agent = create_react_agent(llm, tools, prompt)          # LLM + tools + prompt -> agent
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)  # runs the loop

response = executor.invoke({"input": "Find the capital of India and then find its current weather"})
print(response["output"])
```

| Piece | Role |
| --- | --- |
| `TavilySearchResults(max_results=2)` | Prebuilt search tool; `max_results` = how many sources come back |
| `@tool` | Turns any function into a tool; the docstring is what the LLM reads |
| `hub.pull(...)` | Pulls the ReAct format prompt with the stop phrase built in |
| `create_react_agent(llm, tools, prompt)` | Builds the decision-maker, does not run it |
| `AgentExecutor(agent, tools, verbose)` | Runs thought, action, observation until a final answer |

## Failure modes and gotchas

- **Empty tool list**: the lesson runs the agent with `tools=[]` and the model keeps trying to act with nothing to call. The run ends with "Agent stopped due to iteration limit or time limit". The loop needs at least one tool that can produce the missing fact.
- **Hand-written prompts that drop the format**: without the `Action:` / `Observation:` structure and the "I now know the final answer" phrase, the executor cannot parse the agent's output, and the loop either never calls a tool or never stops.
- **Old model, wrong expectations**: GPT-3.5 confidently says the year is 2022. That is not a bug in the agent; it is why the search tool exists. Temperature is set to 0 so tool selection is deterministic.
- **Keys in the notebook**: the lesson keeps every key in a `.env` file loaded with `python-dotenv`, and adds `.env` to `.gitignore` before pushing to GitHub. Copying the `.env` into a subfolder is fine locally, but the deployed app reads the same names from the host's environment settings instead.
- **Windows SSL path errors**: the lesson adds a `certifi` line setting `SSL_CERT_FILE` because Windows sometimes points at a stale certificate bundle. Only needed if you see certificate errors.

## Takeaways

- An agent is a loop, not a model. The model contributes one decision per pass; the executor supplies the tool results and the memory of previous passes.
- The stop condition is a sentence in the prompt. Worth remembering when an agent runs forever: check the prompt before the code.
- Tools are the whole point. A weak model with a search tool beats a strong model with no tools on any question about the present.
- `create_react_agent` plus `AgentExecutor` is the legacy shape. The next lesson moves to `create_agent`, which folds the executor into the agent, and LangGraph later makes the loop an explicit graph.

## Test yourself

<details>
<summary>Why does the agent stop with "iteration limit or time limit" when given no tools?</summary>
<p>The ReAct prompt tells the model to take an action with one of the available tools. With none available it keeps producing actions the executor cannot run, no observation ever answers the question, and the executor's safety cap ends the run.</p>
</details>

<details>
<summary>What does AgentExecutor do that create_react_agent does not?</summary>
<p>create_react_agent builds a chain that outputs the next thought and action. AgentExecutor runs the loop: sends input plus scratchpad to the agent, executes the chosen tool, appends the observation, repeats, and stops on a final answer.</p>
</details>

<details>
<summary>How does the model know to call the weather tool second, after the search tool?</summary>
<p>After the first observation ("capital of India is New Delhi") is appended to the scratchpad, the model's next thought is that it now needs weather for New Delhi. It reads the tool descriptions (the docstrings) and picks get_weather_data.</p>
</details>

**Related:** [Agents Architecture](/docs/rag-course/15-agents-architecture) · Tool Calling · [Glossary](/docs/glossary)

Next: [Multi-Agent Research Assistant with LangChain →](./08-langchain-multi-agent-research.md)
