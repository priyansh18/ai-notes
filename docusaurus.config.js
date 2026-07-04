// @ts-check
// Docusaurus config for Priyansh Singhal's AI notes site.
// Served at https://notes.priyanshsinghal.com

import { themes as prismThemes } from "prism-react-renderer";

const PORTFOLIO_URL = "https://priyanshsinghal.com";

// Transformers.js (used by the in-browser RAG bot) pulls in Node-only native
// deps (sharp, onnxruntime-node) that webpack tries — and fails — to bundle.
// This plugin tells webpack to ignore them in the browser build; the browser
// uses the WASM/web backend at runtime instead.
function ignoreNodeOnlyDeps() {
  return {
    name: "ignore-node-only-deps",
    configureWebpack(_config, isServer) {
      return {
        resolve: {
          alias: {
            sharp: false,
            "onnxruntime-node": false,
          },
          fallback: {
            sharp: false,
            "onnxruntime-node": false,
            fs: false,
            path: false,
            crypto: false,
          },
        },
        // On the SSR build, never bundle Transformers.js (it's browser-only,
        // loaded dynamically at runtime). This keeps sharp's native binaries
        // out of the server compile entirely.
        externals: isServer
          ? [
              ({ request }, callback) => {
                if (
                  request === "@huggingface/transformers" ||
                  request === "sharp" ||
                  request === "onnxruntime-node"
                ) {
                  return callback(null, "commonjs " + request);
                }
                callback();
              },
            ]
          : [],
      };
    },
  };
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Priyansh's AI Notes",
  tagline:
    "Learning AI in the open — RAG, LLMs, agents, and the mistakes along the way.",
  favicon: "img/logo.svg",

  url: "https://notes.priyanshsinghal.com",
  baseUrl: "/",

  organizationName: "priyansh",
  projectName: "ai-notes",

  plugins: [ignoreNodeOnlyDeps],

  // Mermaid diagrams in markdown (```mermaid fences).
  // Requires: npm install @docusaurus/theme-mermaid
  markdown: { mermaid: true },
  themes: ["@docusaurus/theme-mermaid"],

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  // Match the portfolio's typography: Inter (body) + JetBrains Mono (code).
  headTags: [
    {
      tagName: "link",
      attributes: { rel: "preconnect", href: "https://fonts.googleapis.com" },
    },
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    },
  ],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "docs",
          // "Edit this page" → your GitHub repo (update the path if needed).
          editUrl:
            "https://github.com/priyansh18/PortfolioNew/tree/main/notes/",
          showLastUpdateTime: true,
          // Hide sections that are written but not yet "studied/published".
          // These pages still live in the repo, but are NOT built into public
          // routes — so visitors can't reach them by guessing the URL. To
          // publish a section: remove its line here AND restore it in sidebars.js.
          exclude: ["llm-basics/**", "calling-models/**", "prompting/**"],
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
        sitemap: {
          changefreq: "weekly",
          priority: 0.7,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/social-card.svg",
      colorMode: {
        defaultMode: "dark",
        respectPrefersColorScheme: true,
      },
      mermaid: {
        theme: { light: "neutral", dark: "dark" },
      },
      navbar: {
        title: "Priyansh's Notes",
        logo: {
          alt: "AI Notes",
          src: "https://github.com/priyansh18.png",
          style: { borderRadius: "50%" },
        },
        items: [
          // Right side
          {
            href: PORTFOLIO_URL,
            label: "Portfolio",
            position: "right",
            className: "navbar-portfolio-cta",
          },
          {
            href: "https://github.com/priyansh18",
            position: "right",
            className: "header-social-link header-github-link",
            "aria-label": "GitHub",
          },
          {
            href: "https://www.linkedin.com/in/priyanshsinghal/",
            position: "right",
            className: "header-social-link header-linkedin-link",
            "aria-label": "LinkedIn",
          },
          {
            href: "https://x.com/priyansh_s18",
            position: "right",
            className: "header-social-link header-twitter-link",
            "aria-label": "Twitter / X",
          },
        ],
      },
      // Footer is rendered by our custom swizzled component
      footer: undefined,
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ["python", "bash", "json"],
      },
    }),
};

export default config;
