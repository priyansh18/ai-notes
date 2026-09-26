---
id: 29-what-is-mcp
title: "What is MCP and Why Agents Need It"
sidebar_position: 29
description: "Model Context Protocol explained through a real multi-agent app: the problem with hand-written tool functions, the client/server split, the JSON-RPC message loop, and stdio vs streamable HTTP."
tags: [Agentic AI, MCP, Tools]
---

# What is MCP and Why Agents Need It

<div class="tldr">
<strong>TL;DR</strong>

- **Model Context Protocol (MCP)** is a standard way for an agent to discover and call tools that live in a separate process or service. The video's analogy: a USB-C port for AI apps.
- Without it, every third-party API becomes a custom function inside your code that breaks when the API version changes, and has to be rewritten for every agent framework.
- Two components: an **MCP client** inside the agent app and one or more **MCP servers** that expose tools. They exchange **JSON-RPC 2.0** messages over **stdio** (local) or **streamable HTTP** (remote).
</div>

This lesson is the "why" before the "how". It takes the TripMate AI planner from the previous capstone, which calls AviationStack and Tavily through hand-written Python functions, and asks what happens to that app six months from now. The answer explains what MCP is for better than any spec: it moves the tool implementation out of your codebase and behind a stable protocol, so upgrades happen on the server side and your agent does not notice.

## The problem MCP solves

The video names two concrete pains with the "custom function" approach.

**API drift.** The flight tool hardcodes a `v1` endpoint. When the provider moves to `v2`, the function still runs, returns nothing, and the user sees a plan with an empty flights section. Nobody is alerted. With a thousand tools you cannot re-read a thousand changelogs every week. The app has no way to heal itself.

**Framework lock-in.** The same weather or flight function has to be re-wrapped differently for LangGraph, CrewAI, OpenAI's SDK, AutoGen or Agno. Switching frameworks means rewriting every tool binding.

MCP answers both with one idea: the tool code lives in a server that someone maintains (often the API vendor), and the agent only speaks a fixed protocol to it. If the vendor changes their API, they update their server; your client config does not change.

## The two components

| Component | Where it lives | Job |
| --- | --- | --- |
| MCP client | Inside your agent app (LangChain ships one) | Connects to servers, lists their tools, forwards calls, returns results to the LLM |
| MCP server | Local process, remote service, or one you write | Exposes tools; each tool wraps an API or a function |
| Tools | Inside a server | Named functions with a description and input schema, e.g. `get_current_weather(city)` |

A single client can be connected to many servers at once (weather, Google Drive, GitHub, a database, a flight API). The LLM does not talk to servers directly; the client is the bridge.

## The message loop, step by step

The part of the video worth internalising is the order of operations for a query such as "What is the weather in Delhi today?":

```
LLM ──▶ client: which servers do you have?
client ◀── [google_drive, weather]
LLM ──▶ client: use "weather"; what tools does it have?
client ◀── [get_current_weather, get_forecast, get_air_quality, get_temperature]
LLM decides: get_current_weather(city="Delhi")
client ──▶ weather server: tools/call get_current_weather {city: Delhi}   (JSON-RPC 2.0)
weather server ──▶ vendor API (HTTP)
weather server ◀── JSON result {temp, condition, humidity}
client ◀── result
LLM writes the final answer from the result
```

Two LLM decisions happen here: which server, then which tool. Everything between is protocol traffic the LLM never sees. The message envelope is JSON-RPC 2.0: a request carries a method and params, a response carries a result or an error, and both sides speak the same envelope regardless of transport.

## Transports: stdio vs streamable HTTP

| Transport | Used for | How messages move |
| --- | --- | --- |
| `stdio` | Local servers on the same machine | JSON-RPC lines over the server process's standard input and output |
| `streamable_http` | Remote servers on the internet | JSON-RPC over HTTP requests to a URL, usually with an API key |

The transport is chosen per server in the client config. The video's rule of thumb: prefer remote servers when they exist (the vendor maintains them), use a local server when only a community one exists, and write a custom server only when nothing exists (a private folder, an internal database).

## Three kinds of servers

- **Remote**: runs on someone else's infrastructure; Tavily, GitHub, Google Drive and many vendors publish one. You connect with a URL.
- **Local**: runs on your machine, typically launched from a command; a Git or filesystem server, or a community server for an API that has no official one.
- **Custom**: you write it. A Python function becomes a tool with one decorator; the video previews this and builds it in the next capstone. When you author the server you also own the upgrade burden, so host it and keep it current.

## Code that matters

The video is conceptual and shows configuration rather than a full program. This sketch reflects the client shape it describes (LangChain's multi-server client) and the config keys it names: server name, transport, and either a URL or a command.

```python
# sketch: an MCP client connected to a remote and a local server
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "tavily": {
        "transport": "streamable_http",
        "url": "https://mcp.tavily.com/mcp/?tavilyApiKey=" + TAVILY_API_KEY,
    },
    "weather": {
        "transport": "stdio",
        "command": "python",
        "args": ["custom_weather_mcp_server.py"],
    },
})


async def list_tools():
    tools = await client.get_tools()          # every tool from every server
    return [t.name for t in tools]
```

The agent code never imports the weather API. It only knows a server called `weather` exists.

## Failure modes and gotchas

- **MCP is only worth it when tools exist.** If the agent uses no external tools, there is nothing to protocolise. The value scales with the number of third-party integrations.
- **Someone still maintains the server.** With a vendor server that is the vendor. With a local community server it is a stranger on GitHub. With a custom server it is you. MCP relocates the maintenance burden; it does not delete it.
- **Two LLM round trips before any data arrives.** Server selection and tool selection are both model decisions. More servers and more tools mean more choice and more chances to pick wrong; keep the connected set small and the tool descriptions sharp.
- **Local servers need a runtime.** A `stdio` server is a process the client launches, so the command, interpreter path and args must be correct on that machine. This is the usual source of "server not found" errors.
- **Silent empty results are still possible.** MCP removes drift caused by your outdated code, not drift caused by an outdated server. Log tool results and check for empties.

## Takeaways

- MCP separates "which tools exist and how to call them" from "how they are implemented".
- Worth remembering: client in the app, servers outside it, JSON-RPC in between, transport chosen per server.
- The LLM makes two selections (server, then tool); the client does the plumbing.
- Prefer remote vendor servers, fall back to local, write custom only when nothing exists.
- The concrete win is operational: an API version bump no longer requires a code change and a redeploy.

## Test yourself

<details>
<summary>What exactly breaks in the "custom function" approach when a vendor bumps their API version?</summary>
<p>The hardcoded endpoint keeps being called, returns nothing, and the agent produces an output with a missing section. Nothing crashes, so nobody notices until users complain, and the fix is a code change plus redeploy for every tool that drifted.</p>
</details>

<details>
<summary>Which transport would you use for a server you run on your laptop, and which for a vendor-hosted one?</summary>
<p><code>stdio</code> for the local process (JSON-RPC over standard input and output) and <code>streamable_http</code> for the remote server (JSON-RPC over HTTP to a URL).</p>
</details>

<details>
<summary>Where does the LLM sit in the MCP message loop?</summary>
<p>At the decision points only: it picks which server to use from the client's list, then which tool from that server's list. The client sends the JSON-RPC calls and hands results back; the LLM never talks to a server directly.</p>
</details>

<div class="yt">
  <iframe
    src="https://www.youtube-nocookie.com/embed/Vuixmnhc1v4"
    title="What is MCP? Why AI Agents Need It / Model Context Protocol Explained"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>

Source: DSwithBappy, [What is MCP? Why AI Agents Need It / Model Context Protocol Explained](https://www.youtube.com/watch?v=Vuixmnhc1v4).

**Related:** Tool Calling · [Agents Architecture](/docs/rag-course/15-agents-architecture) · [Glossary](/docs/glossary)
