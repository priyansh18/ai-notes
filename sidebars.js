// @ts-check
/**
 * Sidebar = a complete AI ENGINEER learning path (building WITH LLMs).
 *
 * Scope: applied LLM engineering only — NO classical ML / deep-learning /
 * model-training theory. Prompting → context/IO → retrieval (RAG) → agents →
 * evaluation → production/ops, plus the glue (APIs, vector DBs, orchestration,
 * deployment, observability, security, cost).
 *
 * Ordered beginner → advanced, top to bottom. Within each section, "What is X?"
 * comes before advanced/comparison topics. The path is exhaustive within scope
 * so nothing important is skipped between topics.
 *
 * LIVE today: the 17-part Retrieval (RAG) series (+ overview). Everything else
 * is a greyed, non-clickable "soon" label. To publish one: create the doc, then
 * replace its `soon(...)` line with the doc id string.
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */

const soon = (label) => ({
  type: "html",
  value: `<span class="soon-item">${label}<span class="soon-badge">soon</span></span>`,
  defaultStyle: true,
});

const groupLabel = (label) => ({
  type: "html",
  value: `<span class="soon-group">${label}</span>`,
  defaultStyle: true,
});

// A build-along project row, tagged by difficulty (beginner/intermediate/advanced).
const project = (label, level = "beginner") => ({
  type: "html",
  value: `<span class="project-item">${label}<span class="project-badge lvl-${level}">${level}</span></span>`,
  defaultStyle: true,
});

const sidebars = {
  notesSidebar: [
    "intro",
    "roadmap",

    // ════════ 0 · Python for AI (the minimum you need) ════════
    {
      type: "category",
      label: "0 · Python for AI",
      collapsed: true,
      items: [
        soon("Python Setup (VS Code, first script)"),
        soon("Variables, Data Types & f-strings"),
        soon("Data Structures (list, dict, set, tuple)"),
        soon("Control Flow & Comprehensions"),
        soon("Functions & Arguments"),
        soon("Object-Oriented Python (enough to read frameworks)"),
        soon("Error Handling & Files (JSON)"),
        soon("Environments & Packages (venv, pip, requirements)"),
        soon("API Keys & .env (never hard-code secrets)"),
        soon("Calling an API (requests + JSON)"),
        soon("Async Basics You'll See in Agents"),
        soon("Git & GitHub (commit, push, README)"),
        soon("Build a UI Fast (Streamlit + a little FastAPI)"),

        groupLabel("Projects"),
        project("Personal AI Voice Assistant", "beginner"),
        project("Automated Content Automation", "beginner"),
      ],
    },

    // ════════ 1 · LLM Basics — coming soon (pages written, hidden until studied) ════════
    // NOTE: full pages exist under docs/llm-basics/ — to re-publish, restore the
    // explicit doc-id list from git history and remove this soon() block.
    {
      type: "category",
      label: "1 · LLM Basics",
      collapsed: true,
      items: [soon("Coming soon")],
    },

    // ════════ 2 · Calling Models — coming soon ════════
    // Pages exist under docs/calling-models/ — hidden until studied.
    {
      type: "category",
      label: "2 · Calling Models",
      collapsed: true,
      items: [soon("Coming soon")],
    },

    // ════════ 3 · Prompting & LLM Apps — coming soon ════════
    // Pages exist under docs/prompting/ — hidden until studied.
    {
      type: "category",
      label: "3 · Prompting & LLM Apps",
      collapsed: true,
      items: [soon("Coming soon")],
    },

    // ════════ 4 · Retrieval (RAG) — LIVE (currently studying) ════════
    {
      type: "category",
      label: "4 · Retrieval (RAG)",
      collapsed: false,
      link: { type: "doc", id: "rag-course/rag-course-overview" },
      items: [
        // Sections I've completed — live
        "rag-course/01-introduction",
        "rag-course/02-introduction-to-rag",
        "rag-course/03-core-components",
        "rag-course/04-setup",
        "rag-course/05-data-ingestion",
        "rag-course/06-embeddings",
        "rag-course/07-vector-stores",
        "rag-course/08-advanced-chunking",
        "rag-course/09-hybrid-search",
        "rag-course/10-query-enhancement",
        "rag-course/11-multimodal-rag",
        "rag-course/13-langchain-v1",
        "rag-course/14-langgraph-basics",
        "rag-course/14b-lang-ecosystem",

        // Remaining course sections — published as I complete them
        groupLabel("Coming soon (studying)"),
        soon("12 · AI Agents & Agentic AI (intro)"),
        soon("15 · Agents Architecture"),
        soon("16 · Agentic RAG"),
        soon("17 · Autonomous RAG"),
        soon("18 · Multi-Agent RAGs"),
        soon("19 · Corrective RAG"),
        soon("20 · Adaptive RAG"),
        soon("21 · RAG with Persistent Memory"),
        soon("22 · Cache RAG with LangGraph"),
        soon("23 · VectorLess RAG with PageIndex"),
        soon("24 · Guardrails"),
        soon("25 · LLM Gateways"),
        soon("26 · Chatbot & RAG Evaluation"),
        soon("27 · Graph Databases & Cypher (LangChain)"),
        soon("28 · Practical GraphDB with LangChain"),
        soon("29 · End-to-End RAG Document Search Project"),
      ],
    },

    // ════════ 5 · Advanced & Production RAG ════════
    {
      type: "category",
      label: "5 · Advanced & Production RAG",
      collapsed: true,
      items: [
        soon("Limits of Basic RAG (where naive fails)"),
        soon("Corrective RAG (CRAG)"),
        soon("Self-RAG (model decides when to retrieve)"),
        soon("Text2SQL (query a database safely)"),
        soon("Caching & LLM Gateways (Redis, cost/latency)"),
        soon("RAG Guardrails (input/output filtering)"),
        soon("RAG Evaluation (faithfulness, relevance, eval sets)"),
        soon("Orchestrating RAG with LangGraph"),
        soon("RAG Failure Modes & Debugging"),

        groupLabel("Projects"),
        project("Flipkart Product Recommender (RAG + GCP)", "intermediate"),
        project("Enterprise Advanced RAG in LangGraph", "advanced"),
        project("Production-Grade Cyclic RAG (Guardrails + Evals)", "advanced"),
      ],
    },

    // ════════ 6 · Fine-Tuning & Open Models ════════
    {
      type: "category",
      label: "6 · Fine-Tuning & Open Models",
      collapsed: true,
      items: [
        soon("Prompt vs RAG vs Fine-Tune (the decision)"),
        soon("When to Fine-Tune (and when not to)"),
        soon("Datasets for Fine-Tuning (instruction/chat)"),
        soon("LoRA & QLoRA (parameter-efficient tuning)"),
        soon("Hugging Face Transformers (load, tokenize, infer)"),
        soon("Running Open Models (Llama via Ollama/Groq)"),
        soon("Evaluating a Fine-Tune"),
        soon("Serving a Fine-Tuned Model Behind an API"),

        groupLabel("Projects"),
        project("End-to-End NLP: Text Summarization (HF)", "intermediate"),
        project("AI Web App with LLM Fine-Tuning + CI/CD", "beginner"),
      ],
    },

    // ════════ 7 · Agentic AI ════════
    {
      type: "category",
      label: "7 · Agentic AI",
      collapsed: true,
      items: [
        soon("What Makes Something an 'Agent'"),
        soon("The ReAct Loop (reason → act → observe)"),
        soon("Tool / Function Calling for Agents"),
        soon("Building Your First Tool"),
        soon("Agent Memory (short-term vs Mem0/LangMem)"),
        soon("LangGraph (stateful agents as graphs)"),
        soon("CrewAI (role-based agent crews)"),
        soon("Microsoft AutoGen (conversational multi-agent)"),
        soon("OpenAI Agents SDK & Google ADK"),
        soon("Multi-Agent Orchestration"),
        soon("Agentic RAG (agents that decide when to retrieve)"),
        soon("Human-in-the-Loop & Approval Gates"),

        groupLabel("Projects"),
        project("Stateful Agent (LangGraph + Llama 3)", "beginner"),
        project("YouTube Content Creation Agent", "beginner"),
        project("Notion ReAct Planner Agent", "beginner"),
        project("AutoGen Data Analyzer", "beginner"),
        project("SwarmAI — Multi-Agent Assistant", "intermediate"),
        project("AI Customer-Support Agent (Memory + Tools)", "intermediate"),
        project("Autonomous Blog-Generation Agent", "intermediate"),
      ],
    },

    // ════════ 8 · AgentOps, MCP & Production ════════
    {
      type: "category",
      label: "8 · AgentOps, MCP & Production",
      collapsed: true,
      items: [
        soon("Why AgentOps (agents are non-deterministic)"),
        soon("MCP — Model Context Protocol"),
        soon("A2A — Agent-to-Agent Communication"),
        soon("Tracing & Observability (LangSmith, Langfuse, Opik)"),
        soon("Agent Evaluation (DeepEval, eval sets)"),
        soon("Agent Security (prompt injection, least-privilege)"),
        soon("Containerize & CI/CD"),
        soon("Cloud Deployment (AWS / GCP / Azure)"),
        soon("Production Monitoring (Prometheus, Grafana, ELK)"),

        groupLabel("Projects"),
        project("MCP with AutoGen — Integrate with Notion", "beginner"),
        project("Google ADK: Build & Deploy Agents to Cloud", "beginner"),
        project("Advanced AI GitHub PR Reviewer", "advanced"),
        project("Azure Multi-Modal Compliance Engine", "advanced"),
        project("Real-Time Voice AI Agent with RAG", "intermediate"),
      ],
    },

    // ════════ Reference pages ════════
    "glossary",

    // ════════ Interview Questions (standalone, at the bottom) ════════
    "interview-prep",
  ],
};

export default sidebars;
