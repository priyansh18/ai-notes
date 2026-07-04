/**
 * Build-time RAG index for the Docusaurus notes site.
 *
 * Reads every docs/*.md, strips frontmatter + markdown, chunks by section
 * heading, embeds each chunk once with the open-source all-MiniLM-L6-v2
 * model, and writes static/notes-index.json. The chat widget loads that
 * index in the browser; the visitor's browser only embeds their question.
 *
 * Runs as part of `npm run build` (and `npm run generate:index`).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";

// Recursively collect every .md file under a directory (so docs/rag-course/*
// is included, not just the top level).
function collectMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectMarkdown(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}
import { fileURLToPath } from "url";
import { pipeline, env } from "@huggingface/transformers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "..", "docs");
const OUT_PATH = join(__dirname, "..", "static", "notes-index.json");
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

env.allowLocalModels = false;

/** Parse simple YAML-ish frontmatter (id/title/tags) from a markdown string. */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  let body = raw;
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim();
    }
  }
  return { meta, body };
}

/** Strip markdown/HTML to readable plain text for embedding + display. */
function toPlain(md) {
  return md
    .replace(/<div class="yt">[\s\S]*?<\/div>/g, " ") // drop video embeds
    .replace(/<[^>]+>/g, " ") // other html
    .replace(/```[\s\S]*?```/g, " ") // code fences
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[#>*_`~|-]+/g, " ") // md punctuation
    .replace(/:::\w*/g, " ") // admonition markers
    .replace(/\s+/g, " ")
    .trim();
}

/** Split one doc into section chunks (by ## headings). */
function chunkDoc(meta, body, slug, title) {
  const lines = body.split("\n");
  const chunks = [];
  let heading = "Overview";
  let buf = [];
  const flush = () => {
    const text = toPlain(buf.join("\n"));
    if (text && text.length > 20) {
      chunks.push({
        noteSlug: slug,
        noteTitle: title,
        sectionHeading: heading,
        text: `${title}. ${heading}. ${text}`.slice(0, 700),
      });
    }
    buf = [];
  };
  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      flush();
      heading = h[1].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks.map((c, i) => ({ id: `${slug}#${i}`, ...c }));
}

function round(arr, dp = 6) {
  const f = Math.pow(10, dp);
  return Array.from(arr, (x) => Math.round(x * f) / f);
}

async function main() {
  const files = collectMarkdown(DOCS_DIR);
  const allChunks = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    // URL path = location under docs/, minus extension (e.g.
    // "rag-course/05-cosine-similarity"). Used so the bot's citations link
    // correctly to nested pages.
    const rel = file
      .slice(DOCS_DIR.length + 1)
      .replace(/\\/g, "/")
      .replace(/\.md$/, "");
    const urlPath = meta.slug ? meta.slug.replace(/^\//, "") : rel;
    const title = meta.title || basename(file, ".md");
    allChunks.push(...chunkDoc(meta, body, urlPath, title));
  }
  console.log(`  RAG: ${files.length} docs → ${allChunks.length} chunks`);

  console.log(`  RAG: loading embedding model (${MODEL_ID})…`);
  const embed = await pipeline("feature-extraction", MODEL_ID);

  const records = [];
  for (const c of allChunks) {
    const out = await embed(c.text, { pooling: "mean", normalize: true });
    records.push({ ...c, vector: round(out.data) });
  }

  const index = {
    model: MODEL_ID,
    dim: records[0] ? records[0].vector.length : 0,
    builtAt: new Date().toISOString(),
    count: records.length,
    records,
  };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(index));
  const kb = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
  console.log(`  RAG: wrote notes-index.json (${records.length} vectors, ${kb} KB)`);
}

main().catch((e) => {
  console.error("  RAG index build FAILED:", e);
  process.exit(1);
});
