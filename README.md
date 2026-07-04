# Priyansh's AI Notes — Docusaurus site

Open AI learning notes, served at **notes.priyanshsinghal.com**. Built with
[Docusaurus](https://docusaurus.io/). Lives in the `notes/` folder of the
PortfolioNew monorepo.

## Run locally

```bash
cd notes
npm install
npm start          # dev server at http://localhost:3000
```

## Add a note

1. Create a markdown file in `docs/`, e.g. `docs/prompt-engineering.md`.
2. Add frontmatter at the top:
   ```md
   ---
   id: prompt-engineering
   title: Prompt Engineering Basics
   description: One-line summary for SEO + cards.
   tags: [Prompting, LLMs]
   ---
   ```
3. Add its `id` to `sidebars.js` so it appears in the sidebar.
4. Embed a YouTube video with:
   ```html
   <div class="yt">
     <iframe
       src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
       title="..."
       loading="lazy"
       allowfullscreen
     ></iframe>
   </div>
   ```
5. Commit & push — Vercel rebuilds. The RAG bot's index regenerates from the
   markdown automatically (see below).

## Build

```bash
npm run build      # regenerates the RAG index, then builds the static site → notes/build
```

## The "Ask my notes" RAG bot

`scripts/build-notes-index.mjs` reads every `docs/*.md`, chunks it, embeds it with
the open-source `all-MiniLM-L6-v2` model, and writes `static/notes-index.json`. The
chat widget loads that index in the browser and answers questions with citations —
all client-side, no API key. Knowledge = these markdown notes, automatically.

---

## Deploying to notes.priyanshsinghal.com (Vercel)

You're hosting two sites from one repo. Create a **second Vercel project** pointed at
the same GitHub repo, with the `notes/` subdirectory as its root:

1. Vercel → **Add New Project** → import the `PortfolioNew` repo again.
2. In project settings → **Root Directory**, set it to `notes`.
3. Framework preset: **Docusaurus** (build `npm run build`, output `build`).
4. After it deploys, go to **Settings → Domains** and add
   `notes.priyanshsinghal.com`.
5. In your DNS provider, add the CNAME Vercel shows you (typically
   `notes` → `cname.vercel-dns.com`).

Your existing portfolio project keeps serving `priyanshsinghal.com` from the repo
root — it ignores the `notes/` folder. The two deploy independently.
