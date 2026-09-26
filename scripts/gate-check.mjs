/**
 * Publish gate for new notes. Run AFTER `npm run build` (which rebuilds
 * static/notes-index.json). Exits non-zero on any failure.
 *
 *   node scripts/gate-check.mjs                 # check every docs/agentic-course page
 *   node scripts/gate-check.mjs <dir-or-file>…  # check specific docs
 *
 * Checks
 *  1. Every checked doc has its id in the search index (noteSlug present).
 *  2. Every ```python block in a checked doc parses (python3 ast).
 *  3. Ask-bot retrieval: entries in scripts/ask-check.questions.json ({ question, expect });
 *     each expected note must be cited for at least 2 of its questions, using the same
 *     scoring as src/rag/engine.js.
 *  4. No bare `{`/`}` or `<tag>` outside code in checked docs would already fail the
 *     build (MDX), so it is not re-checked here.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdtempSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import { pipeline, env } from "@huggingface/transformers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const INDEX = join(ROOT, "static", "notes-index.json");
const QUESTIONS = join(ROOT, "scripts", "ask-check.questions.json");
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const THRESHOLD = 0.25; // keep in sync with src/rag/engine.js

const failures = [];
const fail = (msg) => failures.push(msg);

function collect(p) {
  const full = resolve(p);
  if (statSync(full).isDirectory()) {
    return readdirSync(full).flatMap((e) => collect(join(full, e)));
  }
  return full.endsWith(".md") || full.endsWith(".mdx") ? [full] : [];
}

const targets = process.argv.slice(2);
const files = (targets.length ? targets : [join(DOCS, "agentic-course")])
  .filter((p) => existsSync(p))
  .flatMap(collect);

if (!existsSync(INDEX)) {
  console.error("FAIL: static/notes-index.json missing. Run `npm run build` first.");
  process.exit(1);
}
const index = JSON.parse(readFileSync(INDEX, "utf8"));
const slugs = new Set(index.records.map((r) => r.noteSlug));

// 1 + 2
for (const f of files) {
  const rel = f.slice(DOCS.length + 1).replace(/\.mdx?$/, "");
  const raw = readFileSync(f, "utf8");
  const idMatch = raw.match(/^---\n[\s\S]*?\nid:\s*(\S+)/);
  const slug = idMatch ? `${rel.split("/").slice(0, -1).join("/")}/${idMatch[1].replace(/["']/g, "")}` : rel;
  // build-notes-index.mjs only indexes .md, so .mdx pages are never searchable.
  if (f.endsWith(".md") && !slugs.has(slug)) fail(`not in search index: ${slug} (${rel})`);

  // No source shown: course pages must read as standalone lessons (no embeds, credits, channel or
  // playlist names, "video"/"instructor" wording). Fenced code is ignored; the phrase
  // "video upload checks" is a genuine example concept, not a source reference.
  if (rel.startsWith("agentic-course/")) {
    const prose = raw.replace(/```[\s\S]*?```/g, "").replace(/video upload checks/gi, "");
    const bad = prose.match(/youtube|iframe|class="yt"|dswithbappy|bappy|\bplaylist\b|\bvideos?\b|\bwatch (the|this|along)\b|\binstructor\b|Source:/i);
    if (bad) fail(`source-revealing text "${bad[0]}" in ${rel}`);
  }

  const blocks = [...raw.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]);
  blocks.forEach((code, i) => {
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    const tmp = join(dir, "block.py");
    writeFileSync(tmp, code);
    const r = spawnSync("python3", ["-c", "import ast,sys; ast.parse(open(sys.argv[1]).read())", tmp], {
      encoding: "utf8",
    });
    if (r.status !== 0) fail(`python block ${i + 1} does not parse in ${rel}: ${(r.stderr || "").trim().split("\n").pop()}`);
  });
}

// 3. Ask-bot retrieval. Per expected page, at least 2 of its questions (or all, if it
// has fewer than 3) must cite it, because sibling pages legitimately overlap.
if (existsSync(QUESTIONS)) {
  const qs = JSON.parse(readFileSync(QUESTIONS, "utf8"));
  env.allowLocalModels = false;
  const pipe = await pipeline("feature-extraction", MODEL_ID);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const byPage = {};
  for (const { question, expect } of qs) {
    const out = await pipe(question, { pooling: "mean", normalize: true });
    const qv = Array.from(out.data);
    const scored = index.records
      .map((r) => ({ r, score: dot(qv, r.vector) }))
      .sort((a, b) => b.score - a.score);
    const best = scored.length ? scored[0].score : 0;
    let cited = [];
    if (best >= THRESHOLD) {
      const perNote = {};
      const hits = [];
      for (const { r, score } of scored) {
        if (score < THRESHOLD * 0.8) break;
        perNote[r.noteSlug] = (perNote[r.noteSlug] || 0) + 1;
        if (perNote[r.noteSlug] > 2) continue;
        hits.push(r);
        if (hits.length >= 4) break;
      }
      cited = [...new Set(hits.map((h) => h.noteSlug))];
    }
    (byPage[expect] ||= []).push({ question, ok: cited.includes(expect), cited });
  }
  for (const [page, rows] of Object.entries(byPage)) {
    const need = Math.min(2, rows.length);
    const passed = rows.filter((r) => r.ok).length;
    if (passed < need) {
      fail(
        `ask-bot cites ${page} for only ${passed}/${rows.length} questions (need ${need}). Missed: ` +
          rows.filter((r) => !r.ok).map((r) => `"${r.question}" -> ${r.cited.join(", ") || "no answer"}`).join(" | ")
      );
    }
  }
  await pipe.dispose?.();
}

if (failures.length) {
  console.error(`GATE FAILED (${failures.length}):`);
  failures.forEach((m) => console.error(" - " + m));
  process.exit(1);
}
console.log(`GATE OK: ${files.length} doc(s) checked${existsSync(QUESTIONS) ? ", ask-bot questions passed" : ""}`);
