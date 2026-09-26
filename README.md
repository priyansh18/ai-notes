# Priyansh's AI Notes — Docusaurus site

Open AI learning notes, served at **notes.priyanshsinghal.com**. Built with
[Docusaurus](https://docusaurus.io/). This is a standalone repo
(`priyansh18/ai-notes`); Vercel deploys `main` automatically.

## Run locally

```bash
npm install --legacy-peer-deps
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

Push to `main`; Vercel builds with `npm install --legacy-peer-deps` and `npm run build`
(see `vercel.json`) and serves the `build/` folder on `notes.priyanshsinghal.com`.

## Publish gate

After `npm run build`, run `npm run gate`. It checks that new pages are in the search
index, that every Python block parses, and that the Ask bot retrieves the right page for
the questions in `scripts/ask-check.questions.json`. Sections hidden through
`docs.exclude` in `docusaurus.config.js` are left out of the search index too.
