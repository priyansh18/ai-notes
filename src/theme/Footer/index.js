import React from "react";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

const PORTFOLIO = "https://priyanshsinghal.com";

const COLUMNS = [
  {
    title: "📚 Notes",
    links: [
      { label: "RAG Course", to: "/docs/rag-course/rag-course-overview" },
      {
        label: "Introduction to RAG",
        to: "/docs/rag-course/02-introduction-to-rag",
      },
      {
        label: "Data Ingestion & Parsing",
        to: "/docs/rag-course/05-data-ingestion",
      },
      { label: "About the Author", to: "/docs/intro" },
    ],
  },
  {
    title: "🔗 Connect",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/priyansh18",
        icon: "github",
      },
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/priyanshsinghal/",
        icon: "linkedin",
      },
      {
        label: "Twitter / X",
        href: "https://x.com/priyansh_s18",
        icon: "twitter",
      },
      {
        label: "Medium",
        href: "https://medium.com/@singhalpriyansh58",
        icon: "medium",
      },
      {
        label: "Email",
        href: "mailto:singhalpriyansh58@gmail.com",
        icon: "email",
      },
    ],
  },
  {
    title: "🌐 More",
    links: [
      { label: "Portfolio", href: PORTFOLIO },
      { label: "Projects", href: `${PORTFOLIO}/projects` },
      { label: "Experience", href: `${PORTFOLIO}/education` },
      { label: "Contact", href: `${PORTFOLIO}/contact` },
    ],
  },
];

const ICONS = {
  github: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  ),
  medium: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  ),
};

const SOCIAL_ICONS = [
  { key: "github", href: "https://github.com/priyansh18", label: "GitHub" },
  {
    key: "linkedin",
    href: "https://www.linkedin.com/in/priyanshsinghal/",
    label: "LinkedIn",
  },
  { key: "twitter", href: "https://x.com/priyansh_s18", label: "Twitter" },
  {
    key: "medium",
    href: "https://medium.com/@singhalpriyansh58",
    label: "Medium",
  },
  { key: "email", href: "mailto:singhalpriyansh58@gmail.com", label: "Email" },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      {/* Top: branding + columns */}
      <div className={styles.top}>
        {/* Brand column */}
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <img
              src="https://github.com/priyansh18.png"
              alt="Priyansh Singhal"
              className={styles.avatar}
            />
            <span className={styles.brandName}>Priyansh's Notes</span>
          </div>
          <p className={styles.brandDesc}>
            Open AI engineering notes — RAG, LLMs, agents, and the mistakes
            along the way. Written as I learn, free for everyone.
          </p>
          {/* Social icon row */}
          <div className={styles.socialRow}>
            {SOCIAL_ICONS.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialIcon}
                aria-label={s.label}
                title={s.label}
              >
                {ICONS[s.key]}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {COLUMNS.map((col) => (
          <div key={col.title} className={styles.column}>
            <h4 className={styles.colTitle}>{col.title}</h4>
            <ul className={styles.colList}>
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link to={link.to} className={styles.colLink}>
                      {link.icon && (
                        <span className={styles.colIcon}>
                          {ICONS[link.icon]}
                        </span>
                      )}
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.colLink}
                    >
                      {link.icon && (
                        <span className={styles.colIcon}>
                          {ICONS[link.icon]}
                        </span>
                      )}
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Bottom bar */}
      <div className={styles.bottom}>
        <span className={styles.copyright}>
          &copy; {new Date().getFullYear()} Priyansh Singhal
        </span>
        <span className={styles.builtWith}>
          Built with{" "}
          <a
            href="https://docusaurus.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docusaurus
          </a>{" "}
          &amp; ❤️
        </span>
        <a
          href={PORTFOLIO}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.portfolioLink}
        >
          priyanshsinghal.com ↗
        </a>
      </div>
    </footer>
  );
}
