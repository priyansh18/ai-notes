/* ═══════════════════════════════════════════════════════════
   RAG engine (browser) for the notes site.
   Loads the prebuilt static index + the open-source embedding
   model, embeds the visitor's question, retrieves the most
   relevant note passages, and returns an extractive answer with
   citations. 100% client-side, no API key.
   ═══════════════════════════════════════════════════════════ */

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const INDEX_URL = "/notes-index.json";
const THRESHOLD = 0.25;

let _pipe = null;
let _pipeLoading = null;
let _index = null;
let _indexLoading = null;

export async function loadEngine(onProgress) {
  if (!_indexLoading) {
    _indexLoading = fetch(INDEX_URL).then((r) => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    });
  }
  if (!_pipeLoading) {
    _pipeLoading = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      return pipeline("feature-extraction", MODEL_ID, {
        progress_callback: onProgress,
      });
    })();
  }
  [_index, _pipe] = await Promise.all([_indexLoading, _pipeLoading]);
  return true;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function ask(query) {
  if (!_pipe || !_index) await loadEngine();
  const out = await _pipe(query, { pooling: "mean", normalize: true });
  const qv = Array.from(out.data);

  const scored = _index.records
    .map((r) => ({ ...r, score: dot(qv, r.vector) }))
    .sort((a, b) => b.score - a.score);

  const best = scored.length ? scored[0].score : 0;
  if (best < THRESHOLD) {
    return {
      empty: true,
      text:
        "I don't have notes on that yet. I answer only from these AI notes — try asking about RAG, LLM fundamentals, or agents vs fine-tuning.",
      passages: [],
      citations: [],
    };
  }

  // top-k with light per-note de-dup
  const perNote = {};
  const hits = [];
  for (const h of scored) {
    if (h.score < THRESHOLD * 0.8) break;
    perNote[h.noteSlug] = (perNote[h.noteSlug] || 0) + 1;
    if (perNote[h.noteSlug] > 2) continue;
    hits.push(h);
    if (hits.length >= 4) break;
  }

  const passages = hits.slice(0, 3).map((h) => ({
    text: h.text.replace(/\s+/g, " ").trim(),
    noteSlug: h.noteSlug,
    noteTitle: h.noteTitle,
  }));
  const seen = new Set();
  const citations = [];
  for (const h of hits) {
    if (seen.has(h.noteSlug)) continue;
    seen.add(h.noteSlug);
    citations.push({ noteSlug: h.noteSlug, noteTitle: h.noteTitle });
  }
  return { empty: false, passages, citations };
}
