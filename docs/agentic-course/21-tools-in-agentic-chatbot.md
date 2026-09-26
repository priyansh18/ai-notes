---
id: 21-tools-in-agentic-chatbot
title: "Tools in the Agentic Chatbot"
sidebar_position: 21
description: "Give a LangGraph chatbot real actions, bind tools to the LLM, route with the prebuilt tools_condition, run them in a ToolNode, and loop tool output back through the chat node."
tags: [Agentic AI, LangGraph, Tool Calling]
---

# Tools in the Agentic Chatbot

<div class="tldr">
<strong>TL;DR</strong>

- A plain LLM answers from its training data and stops at its **knowledge cutoff**: ask for today's news, a live stock price or the weather and it refuses. **Tools** are functions or APIs the agent can call to act beyond text generation.
- LangGraph ships two prebuilt pieces: `tools_condition` (a conditional edge that checks whether the model asked for a tool) and `ToolNode` (a node that runs whichever tool was requested from a list).
- Three wiring rules: call `llm.bind_tools(tools)` and use **that** object in the chat node, add every tool to the list, and add the edge from `tools` back to `chat_node` so raw tool output is turned into a readable answer.
</div>

Part 7 turns the chatbot into an agent. So far it can only generate text, so anything after the
model's training date is out of reach. This lesson explains what a tool is, walks the eight-step
tool-calling loop, builds four tools (web search, calculator, stock price, weather), and wires them
into the existing graph with LangGraph's prebuilt `ToolNode` and `tools_condition`. The result is
the same routing you see in a hosted assistant when it says "searching the web".

## The knowledge-cutoff wall

The lesson asks the pre-tool chatbot three things: the latest news, Apple's current stock price, and
the weather in New York. Every answer is a polite refusal: no real-time access, knowledge cutoff a
few months ago. The same questions in a hosted chat product succeed, and you can watch it call a
search tool, a stock tool and a weather tool before answering. The difference is not the model; it
is that the product has tools bound to the model and a loop that runs them.

A tool is any external function, API, database or service the agent can invoke. Common ones: web
search, calculator, database read/write, a RAG retriever, a Python interpreter, email, calendar,
any REST API, and custom business functions (create a ticket, check inventory).

## The eight-step tool call

The lesson breaks a single tool-using turn into eight steps, and the graph mirrors them:

1. User sends a request.
2. Agent understands the goal.
3. Agent decides whether a tool is needed at all ("tell me about Python" needs none).
4. Agent selects which tool, from the list it was given.
5. Agent generates the tool's arguments (the search query, the math expression, the ticker).
6. The tool executes.
7. The raw result is returned to the agent.
8. The agent rewrites the raw result into a readable final answer.

Step 8 is the one people skip. A calculator returns `2125.0`; the user wants "25% of 8,500 is
2,125". A search tool returns a list of dicts with URLs and metadata; the user wants a summary.

## Four tools, two ways to define them

**Prebuilt tool.** `TavilySearch` from `langchain_tavily` is already a tool object. Configure it
(`max_results`, `topic`, `search_depth`) and it is ready. It needs a Tavily API key in `.env`.

**Custom tools.** Write a normal Python function with a docstring and decorate it with `@tool`
from `langchain_core.tools`. The docstring becomes the description the model reads when choosing a
tool, so write it for the model. The lesson builds three: `calculator` (evaluates a math
expression), `get_stock_price` (calls the Alpha Vantage quote endpoint with `requests` and returns
the JSON), and `get_current_weather` (calls an OpenWeather endpoint for a location). Each external
API needs its own key, kept in environment variables.

## Wiring the graph

Three additions to the one-node graph from part 1:

- `llm_with_tools = llm.bind_tools(tools)`. This tells the model which tools exist and lets it emit
  a tool call instead of plain text. The chat node must invoke **this** object.
- `tool_node = ToolNode(tools)`. A prebuilt node that reads the tool call from the last AI message,
  runs the matching function with the generated arguments, and appends a `ToolMessage` with the
  result.
- `graph.add_conditional_edges("chat_node", tools_condition)`. A prebuilt routing function: if the
  last message contains a tool call, go to the `tools` node; otherwise go to `END`.

Then the edge that closes the loop: `graph.add_edge("tools", "chat_node")`. Without it the graph
ends right after the tool runs and the user sees raw tool output. With it, the tool result flows
back into the chat node, the model reads it, and either answers in plain language or calls another
tool (the lesson chains `get_stock_price` and then `calculator` to price 50 shares in one question).

```
Part 1:   START -> chat_node -> END

Part 7:   START -> chat_node --tools_condition--> END        (no tool needed)
                       ^             |
                       |             v (tool call present)
                       +---------- tools                     (ToolNode runs it)
```

The chat node, state, checkpointer and Streamlit app are otherwise unchanged. In the UI the lesson
adds a small block that inspects `ToolMessage` objects in the stream so the page shows "using
tavily_search" while the tool runs, mirroring what hosted assistants display. In LangSmith the
trace now shows `chat_node`, the routing decision, the `tools` node with the chosen tool and its
arguments, and the second `chat_node` call that refined the output.

## Code that matters

```python
import math
import os
import requests
from langchain_core.tools import tool
from langchain_tavily import TavilySearch
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

search_tool = TavilySearch(max_results=5, topic="general", search_depth="advanced")

@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression such as (25/100)*8500 and return the result."""
    try:  # sketch: the lesson evaluates the expression with the math module available
        return str(eval(expression, {"__builtins__": {}}, vars(math)))
    except Exception as e:
        return f"Error: {e}"

@tool
def get_stock_price(symbol: str) -> dict:
    """Fetch the latest stock quote for a ticker symbol such as AAPL or GOOGL."""
    url = (
        "https://www.alphavantage.co/query?function=GLOBAL_QUOTE"
        f"&symbol={symbol}&apikey={os.environ['ALPHA_VANTAGE_API_KEY']}"
    )
    return requests.get(url, timeout=10).json()

tools = [search_tool, calculator, get_stock_price, get_current_weather]
llm_with_tools = llm.bind_tools(tools)  # sketch: llm defined as in part 1

def chat_node(state: ChatState) -> dict:
    return {"messages": [llm_with_tools.invoke(state["messages"])]}

tool_node = ToolNode(tools)

graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "chat_node")
graph.add_conditional_edges("chat_node", tools_condition)
graph.add_edge("tools", "chat_node")
chatbot = graph.compile(checkpointer=checkpointer)
```

Ask "hello" and it goes `chat_node` to `END`. Ask for movies released this year and it goes
`chat_node`, `tools` (Tavily), `chat_node`, `END`, and the last message is a readable list.

## Failure modes and gotchas

- **Using `llm` instead of `llm_with_tools` in the chat node.** The graph compiles, the model never emits a tool call, and it looks like "tools don't work". The lesson calls this the most common mistake.
- **Tool defined but not in the list.** The weather tool failed in the lesson because it was never added to `tools` before `bind_tools`. `ToolNode` and the model only know what is in that list.
- **Missing the `tools` to `chat_node` edge.** The run ends after the tool and the user gets raw JSON or a bare number. Always route tool output back through the model.
- **`eval` on user-supplied expressions.** The calculator sketch restricts builtins, but evaluating arbitrary strings is still risky. Prefer a real expression parser in anything shared.
- **Vague docstrings.** The model picks tools by reading their descriptions. "Does stuff" gets the wrong tool selected; say what input it takes and what it returns.
- **Provider swap.** The lesson switched from OpenAI to Gemini mid-series when a quota ran out. Only the model constructor changes; `bind_tools`, `ToolNode` and `tools_condition` are model-agnostic.
- **Keys on screen.** Each tool needs its own API key. Keep them in `.env` and rotate any that were exposed.

## Takeaways

- Worth remembering: a tool call is a round trip. Model decides, tool runs, model reads the result. The `tools` to `chat_node` edge is the second half of that trip.
- `tools_condition` and `ToolNode` are the two prebuilt pieces that make LangGraph tool loops short to write; you do not hand-write the routing or the dispatcher.
- Any Python function becomes a tool with `@tool` and a good docstring. The docstring is part of the prompt.
- Tracing pays off immediately here: the LangSmith trace shows exactly which tool was chosen and with what arguments.

## Test yourself

<details>
<summary>What does <code>tools_condition</code> look at, and where can it send the flow?</summary>
<p>It inspects the last AI message. If it contains a tool call, it routes to the <code>tools</code> node; otherwise it routes to END.</p>
</details>

<details>
<summary>The model never calls any tool even though <code>ToolNode</code> is wired in. What is the first thing to check?</summary>
<p>Whether the chat node invokes <code>llm_with_tools</code> (the object returned by <code>bind_tools</code>) rather than the plain <code>llm</code>. Then check that the tool is actually in the list passed to <code>bind_tools</code>.</p>
</details>

<details>
<summary>Why add an edge from <code>tools</code> back to <code>chat_node</code> instead of to END?</summary>
<p>Tool output is raw (JSON, a number, a list of search hits with metadata). Sending it back to the chat node lets the model rewrite it as a readable answer, or call a further tool if the task needs more than one step.</p>
</details>

**Related:** Tool Calling · [LangGraph Workflows](/docs/agentic-ai/langgraph-workflows) · [Glossary](/docs/glossary)
