import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

// The full AI-engineer learning path. Live sections link out; the rest are
// "coming soon" as I write them.
const PATH = [
  {
    num: "0",
    emoji: "🐍",
    title: "Python for AI",
    desc:
      "The minimum Python you actually need — APIs, JSON, environments, Git, and a fast Streamlit/FastAPI UI.",
    to: "/docs/roadmap",
    tag: "Soon",
  },
  {
    num: "1",
    emoji: "🧠",
    title: "LLM Basics",
    desc:
      "How to think about an LLM, tokens, sampling, temperature & top-p, context windows, and reasoning models.",
    to: "/docs/llm-basics/what-is-an-llm",
    tag: "Live",
  },
  {
    num: "2",
    emoji: "🔌",
    title: "Calling Models",
    desc:
      "The API layer — chat completions & roles, streaming, structured outputs, tool calling, and multimodal inputs.",
    to: "/docs/calling-models/apis-and-sdks",
    tag: "Live",
  },
  {
    num: "3",
    emoji: "✍️",
    title: "Prompting & LLM Apps",
    desc:
      "Instruction hierarchy, few-shot, chain-of-thought, prompt templates, context engineering — and shipping an app.",
    to: "/docs/prompting/what-is-prompting",
    tag: "Live",
  },
  {
    num: "4",
    emoji: "🔎",
    title: "Retrieval (RAG)",
    desc:
      "The flagship 17-part course — chunking, embeddings, vector search, hybrid retrieval, reranking, and multimodal RAG.",
    to: "/docs/rag-course/rag-course-overview",
    tag: "Live",
  },
  {
    num: "5",
    emoji: "🏭",
    title: "Advanced & Production RAG",
    desc:
      "Enterprise RAG — hybrid search, reranking, HyDE, CRAG, Self-RAG, Text2SQL, caching, guardrails, and evaluation.",
    to: "/docs/roadmap",
    tag: "Soon",
  },
  {
    num: "6",
    emoji: "🎛️",
    title: "Fine-Tuning & Open Models",
    desc:
      "When to fine-tune vs RAG, LoRA/QLoRA, Hugging Face Transformers, and running open models like Llama.",
    to: "/docs/roadmap",
    tag: "Soon",
  },
  {
    num: "7",
    emoji: "🤖",
    title: "Agentic AI",
    desc:
      "The ReAct loop, tool calling, agent memory, and frameworks — LangGraph, CrewAI, AutoGen — plus multi-agent systems.",
    to: "/docs/roadmap",
    tag: "Soon",
  },
  {
    num: "8",
    emoji: "🚀",
    title: "AgentOps, MCP & Production",
    desc:
      "MCP & A2A protocols, tracing & observability, agent evaluation and security, cloud deployment, and monitoring.",
    to: "/docs/roadmap",
    tag: "Soon",
  },
];

export default function Home() {
  return (
    <Layout
      title="AI Engineering Notes"
      description="Open AI-engineering notes by Priyansh Singhal — a complete learning path from LLM basics and prompting to RAG, agents, evaluation, and production."
    >
      <main className={styles.wrap}>
        {/* ─── Hero ─── */}
        <section className={styles.hero}>
          <span className={styles.badge}>📚 The AI Engineer's Handbook</span>
          <h1 className={styles.title}>
            Become an <span className={styles.grad}>AI Engineer</span> — a
            complete path from LLM basics to production.
          </h1>
          <p className={styles.subtitle}>
            Open, build-with-LLMs notes covering the whole stack: how models
            work, calling them, prompting, retrieval (RAG), agents, evaluation,
            and shipping to production. No ML-training theory — just what you
            need to build real AI systems. Free for anyone to study.
          </p>
          <div className={styles.cta}>
            <Link className={styles.btnPrimary} to="/docs/roadmap">
              🗺️ See the Roadmap
            </Link>
            <Link
              className={styles.btnGhost}
              to="/docs/llm-basics/what-is-an-llm"
            >
              🚀 Start Learning
            </Link>
          </div>
        </section>

        {/* ─── Stats Row ─── */}
        <section className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statNum}>9</span>
            <span className={styles.statLabel}>Stages · LLM → Agents</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>40+</span>
            <span className={styles.statLabel}>Mapped Projects</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>100</span>
            <span className={styles.statLabel}>Interview Questions</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>100%</span>
            <span className={styles.statLabel}>Free & Open</span>
          </div>
        </section>

        {/* ─── The Learning Path ─── */}
        <section className={styles.gridSection}>
          <h2 className={styles.gridTitle}>🗺️ The AI Engineer Learning Path</h2>
          <p className={styles.gridSub}>
            Nine stages, beginner to advanced — each builds on the last. Start
            at the top and work down, or jump to what you need.
          </p>
          <div className={styles.grid}>
            {PATH.map((t) => (
              <Link key={t.title} to={t.to} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.cardEmoji}>{t.emoji}</span>
                  <span
                    className={`${styles.cardTag} ${
                      t.tag === "Soon" ? styles.tagSoon : ""
                    }`}
                  >
                    {t.tag}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>
                  <span className={styles.cardNum}>{t.num}</span>
                  {t.title}
                </h3>
                <p className={styles.cardDesc}>{t.desc}</p>
                <span className={styles.cardRead}>
                  {t.tag === "Soon" ? "Coming soon" : "Read notes →"}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Interview prep CTA ─── */}
        <section className={styles.botSection}>
          <div className={styles.botCard}>
            <span className={styles.botEmoji}>🎯</span>
            <div>
              <h3 className={styles.botTitle}>
                Prepping for AI Engineer interviews?
              </h3>
              <p className={styles.botDesc}>
                100 RAG interview questions with detailed answers — RAG is the
                #1 most-asked AI-engineering topic in 2026.{" "}
                <Link to="/docs/interview-prep">Start practicing →</Link>
              </p>
            </div>
          </div>
        </section>

        {/* ─── Ask Bot CTA ─── */}
        <section className={styles.botSection}>
          <div className={styles.botCard}>
            <span className={styles.botEmoji}>💬</span>
            <div>
              <h3 className={styles.botTitle}>Ask My Notes Anything</h3>
              <p className={styles.botDesc}>
                There's an in-browser RAG bot (bottom-right corner) that answers
                from these notes and cites its source. Try it!
              </p>
            </div>
          </div>
        </section>

        {/* Site-wide footer handles branding */}
      </main>
    </Layout>
  );
}
