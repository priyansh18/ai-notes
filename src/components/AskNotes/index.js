import React, { useEffect, useRef, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

const SUGGESTIONS = [
  "Why does my RAG hallucinate?",
  "How should I chunk documents?",
  "RAG vs fine-tuning?",
  "What is a context window?",
];

function Widget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // idle|warming|ready|thinking
  const [messages, setMessages] = useState([
    {
      role: "bot",
      kind: "text",
      text:
        "Hi! I'm an open-source RAG bot running in your browser. I answer from these AI notes and cite my sources. Ask me anything.",
    },
  ]);
  const scrollRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (engineRef.current) return;
    setStatus("warming");
    import("../../rag/engine")
      .then((mod) => {
        engineRef.current = mod;
        return mod.loadEngine((p) => {
          if (p && typeof p.progress === "number")
            setProgress(Math.min(99, Math.round(p.progress)));
        });
      })
      .then(() => {
        setProgress(100);
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("idle");
      });
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const send = async (text) => {
    const q = (text != null ? text : input).trim();
    if (!q || status === "thinking") return;
    setInput("");
    setMessages((m) => [...m, { role: "user", kind: "text", text: q }]);
    setStatus("thinking");
    try {
      const res = await engineRef.current.ask(q);
      setMessages((m) => [
        ...m,
        res.empty
          ? { role: "bot", kind: "text", text: res.text }
          : {
              role: "bot",
              kind: "answer",
              passages: res.passages,
              citations: res.citations,
            },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", kind: "text", text: "Something went wrong. Try again." },
      ]);
    }
    setStatus("ready");
  };

  const statusLabel =
    status === "warming"
      ? `Loading engine… ${progress}%`
      : status === "thinking"
      ? "Searching the notes…"
      : "Open-source · runs in your browser";

  if (!open) {
    return (
      <button
        className={styles.launcher}
        onClick={() => setOpen(true)}
        aria-label="Ask my notes"
      >
        <span className={styles.spark}>✦</span> Ask my notes
      </button>
    );
  }

  return (
    <section className={styles.panel} role="dialog" aria-label="Ask my notes">
      <header className={styles.head}>
        <div>
          <p className={styles.title}>✦ Ask my notes</p>
          <p className={styles.status}>{statusLabel}</p>
        </div>
        <button
          className={styles.close}
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          ×
        </button>
      </header>

      {status === "warming" && (
        <div className={styles.progress}>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className={styles.scroll} ref={scrollRef}>
        {messages.map((m, i) => (
          <Msg key={i} m={m} />
        ))}
        {status === "thinking" && (
          <div className={styles.botRow}>
            <div className={`${styles.bubble} ${styles.typing}`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className={styles.suggest}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className={styles.chip} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about AI…"
          aria-label="Ask a question"
        />
        <button
          className={styles.send}
          onClick={() => send()}
          disabled={!input.trim() || status === "thinking"}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
      <p className={styles.foot}>Answers come only from these notes</p>
    </section>
  );
}

function Msg({ m }) {
  if (m.role === "user") {
    return (
      <div className={styles.userRow}>
        <div className={`${styles.bubble} ${styles.user}`}>{m.text}</div>
      </div>
    );
  }
  if (m.kind === "answer") {
    return (
      <div className={styles.botRow}>
        <div className={`${styles.bubble} ${styles.bot}`}>
          <p className={styles.lead}>From the notes:</p>
          {m.passages.map((p, i) => (
            <blockquote key={i} className={styles.passage}>
              {p.text}
            </blockquote>
          ))}
          <div className={styles.cites}>
            {m.citations.map((c) => (
              <Link
                key={c.noteSlug}
                to={`/docs/${c.noteSlug}`}
                className={styles.cite}
              >
                {c.noteTitle} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.botRow}>
      <div className={`${styles.bubble} ${styles.bot}`}>{m.text}</div>
    </div>
  );
}

export default function AskNotes() {
  return <BrowserOnly>{() => <Widget />}</BrowserOnly>;
}
