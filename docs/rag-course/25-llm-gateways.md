---
id: 25-llm-gateways
title: "LLM Gateways"
sidebar_position: 26
description: LLM gateways sit between your app and model providers — handling routing, fallback, caching, rate limiting, cost tracking, and observability through a single proxy layer. Built with LiteLLM.
tags: [RAG, LLM Gateway, Production, Cost]
---

# LLM Gateways

<div class="tldr">
<strong>TL;DR</strong>

- An **LLM gateway** is a proxy between your app and model providers — one API, many backends.
- It handles **fallbacks** (if OpenAI is down, try Anthropic), **caching** (don't re-call for the same prompt), **cost tracking**, **rate limiting**, and **load balancing**.
- **LiteLLM** is the go-to open-source gateway — unified `completion()` API across 100+ providers, plus a proxy server for team-wide use.
</div>

You're calling OpenAI today. Tomorrow you want to try Claude. Next month, your team needs
cost controls and audit logs. Without a gateway, every model switch means rewriting code,
and cost tracking is a spreadsheet nightmare. An **LLM gateway** solves all of this with
one proxy layer. One submodule per idea, ending with a cheat sheet.

## Why you need a gateway

| Problem | Without a gateway | With a gateway |
| --- | --- | --- |
| **Vendor lock-in** | Code is tightly coupled to one provider's SDK | Swap providers by changing a config string |
| **Reliability** | If OpenAI is down, your app is down | Automatic fallback to another provider |
| **Cost control** | No idea who's spending what | Per-user, per-team budget limits |
| **Caching** | Same prompt = same cost every time | Redis cache for repeated queries |
| **Observability** | Scattered logs, no unified view | One place for latency, cost, error rates |
| **Rate limits** | Hit provider limits and get 429s | Gateway-level throttling and queuing |

## How LLM gateways work

The gateway sits between your application and the model providers:

```
Your app → LLM Gateway (proxy) → OpenAI / Anthropic / Google / Local models
                ↓
         Logs, cache, budget checks, fallback logic
```

Your app sends every LLM call to the gateway. The gateway:
1. **Checks the cache** — if this exact prompt was seen recently, return the cached response.
2. **Checks budgets/rate limits** — if the user or team is over budget, reject the request.
3. **Routes** — send to the configured provider (or load-balance across several).
4. **Falls back** — if the primary provider fails, try the next one in the fallback chain.
5. **Logs** — record latency, tokens, cost, and the full request/response for observability.

## LiteLLM: the open-source gateway

**[LiteLLM](https://github.com/BerriAI/litellm)** gives you a unified API across 100+
providers. It works two ways:

1. **As a Python SDK** — drop-in replacement for `openai.ChatCompletion.create()`.
2. **As a proxy server** — run it as a standalone service your whole team calls.

### Basic usage (SDK mode)

```python
# pip install litellm
import litellm

# OpenAI
response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is RAG?"}],
)
print(response.choices[0].message.content)

# Anthropic — same API, just change the model string
response = litellm.completion(
    model="claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": "What is RAG?"}],
)
print(response.choices[0].message.content)

# Google Gemini
response = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=[{"role": "user", "content": "What is RAG?"}],
)
print(response.choices[0].message.content)

# Local model via Ollama
response = litellm.completion(
    model="ollama/llama3",
    messages=[{"role": "user", "content": "What is RAG?"}],
    api_base="http://localhost:11434",
)
```

The key: **same function, same response format**, regardless of provider.

### Fallback chains

If the primary model fails (rate limit, outage, error), automatically try the next one.

```python
import litellm
from litellm import completion

# fallback list — try in order
model_fallbacks = [
    {"model": "gpt-4o-mini", "api_key": "sk-..."},
    {"model": "claude-sonnet-4-20250514", "api_key": "sk-ant-..."},
    {"model": "gemini/gemini-2.0-flash", "api_key": "AIza..."},
]

response = None
for fallback in model_fallbacks:
    try:
        response = completion(
            model=fallback["model"],
            messages=[{"role": "user", "content": "What is RAG?"}],
            api_key=fallback["api_key"],
        )
        break  # success — stop trying
    except Exception as e:
        print(f"Failed with {fallback['model']}: {e}")
        continue

if response:
    print(response.choices[0].message.content)
```

LiteLLM also supports this declaratively via the **Router**:

```python
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "my-model",           # your internal alias
            "litellm_params": {
                "model": "gpt-4o-mini",         # actual provider model
                "api_key": "sk-...",
            },
        },
        {
            "model_name": "my-model",           # same alias = fallback
            "litellm_params": {
                "model": "claude-sonnet-4-20250514",
                "api_key": "sk-ant-...",
            },
        },
    ],
    fallbacks=[{"my-model": ["my-model"]}],    # try all deployments
    routing_strategy="least-busy",              # or "simple-shuffle", "latency-based"
)

response = router.completion(
    model="my-model",
    messages=[{"role": "user", "content": "Explain vector databases"}],
)
```

### Running LiteLLM as a proxy server

For team-wide use, run LiteLLM as a standalone proxy. Your app calls it like it's OpenAI,
and the proxy handles routing, caching, and logging.

```yaml
# litellm_config.yaml
model_list:
  - model_name: "gpt-4o-mini"
    litellm_params:
      model: "gpt-4o-mini"
      api_key: "sk-..."

  - model_name: "claude-sonnet"
    litellm_params:
      model: "claude-sonnet-4-20250514"
      api_key: "sk-ant-..."

  - model_name: "cheap-model"
    litellm_params:
      model: "gpt-4o-mini"
      api_key: "sk-..."

litellm_settings:
  drop_params: true          # silently drop unsupported params per provider
  set_verbose: false

general_settings:
  master_key: "sk-litellm-master-key"   # auth for the proxy itself
```

```bash
# start the proxy
litellm --config litellm_config.yaml --port 4000
```

```python
# now call it like OpenAI — just point to your proxy
import openai

client = openai.OpenAI(
    api_key="sk-litellm-master-key",     # your proxy's master key
    base_url="http://localhost:4000",     # your proxy URL
)

response = client.chat.completions.create(
    model="gpt-4o-mini",                  # the model_name from your config
    messages=[{"role": "user", "content": "What is RAG?"}],
)
print(response.choices[0].message.content)
```

### Redis caching

Cache repeated prompts so you don't pay twice for the same question.

```python
import litellm

# enable Redis caching
litellm.cache = litellm.Cache(
    type="redis",
    host="localhost",
    port=6379,
    password="",           # set if your Redis requires auth
    ttl=3600,              # cache for 1 hour
)

# first call — hits the LLM, caches the result
response1 = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is a vector database?"}],
    caching=True,
)

# second identical call — served from cache (instant, free)
response2 = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is a vector database?"}],
    caching=True,
)
```

For the proxy server, add caching to the config:

```yaml
# add to litellm_config.yaml
litellm_settings:
  cache: true
  cache_params:
    type: "redis"
    host: "localhost"
    port: 6379
    ttl: 3600
```

### Budget and rate limits

Control spending per user, per team, or globally.

```python
from litellm import Router

router = Router(
    model_list=[...],                    # your model list
    redis_host="localhost",              # Redis for tracking
    redis_port=6379,
)

# set a budget for a specific user
# (in the proxy, you'd do this via the /user/new API)
response = router.completion(
    model="my-model",
    messages=[{"role": "user", "content": "Hello"}],
    user="user-123",                     # track spend per user
    max_budget=10.0,                     # max $10 for this user
)
```

In proxy mode, use the admin API:

```bash
# create a user with a $50 monthly budget
curl -X POST http://localhost:4000/user/new \
  -H "Authorization: Bearer sk-litellm-master-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "max_budget": 50.0}'

# create a virtual key with rate limits
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer sk-litellm-master-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "max_parallel_requests": 10, "tpm_limit": 100000}'
```

## Other gateway options

| Gateway | Type | Key feature |
| --- | --- | --- |
| **LiteLLM** | Open-source | Broadest provider support, full proxy mode |
| **Portkey** | SaaS + open-source | Beautiful dashboard, prompt management, guardrails |
| **Helicone** | SaaS | One-line integration, strong analytics and cost tracking |
| **Martian** | SaaS | Automatic model routing based on prompt complexity |

LiteLLM is the most common for self-hosted setups. Portkey and Helicone are popular when
you want managed dashboards without running infrastructure.

## Cheat sheet

| Task | Code |
| --- | --- |
| Call any provider | `litellm.completion(model="provider/model", messages=[...])` |
| Fallback chain | `Router(model_list=[...], fallbacks=[...])` |
| Start proxy | `litellm --config config.yaml --port 4000` |
| Call proxy | `openai.OpenAI(base_url="http://localhost:4000")` |
| Redis cache | `litellm.cache = litellm.Cache(type="redis", host="...", ttl=3600)` |
| Per-user budget | `router.completion(..., user="id", max_budget=10.0)` |
| Routing strategy | `Router(..., routing_strategy="least-busy")` |

<div class="gotcha">
<strong>⚠ Common mistakes</strong>

- Hardcoding API keys in the config — use environment variables (`os.environ["OPENAI_API_KEY"]`)
  instead of putting keys in YAML files that get committed to git.
- No fallback chain — if you only configure one provider and it goes down, your whole app
  is down. Always have at least one fallback.
- Caching without thinking about freshness — caching is great for repeated factual queries,
  but bad for conversations where context changes. Set appropriate TTLs and disable caching
  for chat-style interactions.
- Running the proxy without auth — the `master_key` is not optional in production. Without
  it, anyone who finds your proxy URL can make LLM calls on your bill.
</div>

<div class="quiz">
<p class="quiz-title">Quick self-check</p>

<details>
<summary>What five things does an LLM gateway handle?</summary>
<p>Routing (to the right provider), fallback (when a provider fails), caching (for repeated prompts), rate limiting / budget enforcement, and observability (logging latency, cost, errors).</p>
</details>

<details>
<summary>How does LiteLLM's Router handle fallbacks?</summary>
<p>You register multiple deployments under the same model_name. If the first deployment fails, the Router automatically tries the next one. You can configure the routing strategy (least-busy, round-robin, latency-based).</p>
</details>

<details>
<summary>What's the difference between SDK mode and proxy mode?</summary>
<p>SDK mode: you import litellm in your Python code and call completion() directly. Proxy mode: you run litellm as a standalone HTTP server, and your app calls it using the standard OpenAI client pointed at the proxy URL.</p>
</details>

<details>
<summary>When should you NOT cache LLM responses?</summary>
<p>In conversational settings where context changes between turns, or when the answer depends on real-time data. Caching works best for repeated, context-free factual queries.</p>
</details>
</div>

**Related:** [Guardrails](/docs/rag-course/24-guardrails) · [Evaluation](/docs/rag-course/26-evaluation) · [Glossary](/docs/glossary)

Next: [Chatbot & RAG Evaluation →](/docs/rag-course/26-evaluation)
