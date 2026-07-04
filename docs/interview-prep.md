---
id: interview-prep
title: "100 RAG Interview Questions"
sidebar_label: "Interview Questions"
sidebar_position: 99
description: 100 RAG interview questions with detailed answers — the complete study guide for AI Engineer interviews. Fundamentals, chunking & embeddings, vector DBs, evaluation, and production RAG.
tags: [RAG, Interview, Study Guide]
---

# 100 RAG Interview Questions — With Detailed Answers

**The complete study guide for AI Engineers · 2026 edition.**

**Who this is for:** software engineers and students prepping for AI Engineer
interviews where RAG comes up — which is roughly **36% of all AI Engineer roles**.
RAG is the #1 most-asked AI engineering topic in 2026.

**How to use this doc:** don't memorize. Try to answer each question out loud in
under 60 seconds, then expand it to see what you missed. If you can confidently answer
**70+ out of 100**, you're ready for senior RAG interviews. Hit 90+ and you're in the
top 5%.

> Tip: each question is collapsed. Click a question to reveal the answer. Pair this
> page with the [RAG course](/docs/rag-course/rag-course-overview) — every concept
> here is taught in depth there.

## Category 1 — RAG Fundamentals (1–20)

<div class="interview-block">

<details>
<summary><span class="qnum">Q1</span> What is RAG and what problems does it actually solve?</summary>
<p>RAG (Retrieval-Augmented Generation) is a pattern where an LLM is given relevant context retrieved from an external knowledge base at inference time, instead of relying only on what it learned during training. It solves three core problems: knowledge cutoffs (LLMs don't know recent or private data), hallucinations (the model invents facts when ungrounded), and verifiability (you can't cite the source of a pure LLM output). RAG essentially turns a generic LLM into a domain-aware system without retraining.</p>
</details>

<details>
<summary><span class="qnum">Q2</span> Walk me through the components of a RAG pipeline end-to-end.</summary>
<p>A RAG pipeline has two phases. Ingestion (offline): documents are loaded, chunked into manageable pieces, embedded into vector representations, and stored in a vector database with metadata. Inference (online): the user query is embedded, the top-k most similar chunks are retrieved (often reranked), the retrieved chunks are injected into the prompt as context, and the LLM generates an answer grounded in that context. Production systems usually add query rewriting, hybrid search, reranking, citation enforcement, and evaluation hooks on top of this base flow.</p>
</details>

<details>
<summary><span class="qnum">Q3</span> When would you choose RAG over fine-tuning?</summary>
<p>Choose RAG when your data changes frequently, when you need verifiable sources, when you can't risk training-data leakage, or when your corpus is too large to fit in a fine-tuning dataset. Choose fine-tuning when you need to teach the model a style or behavior (tone, format, refusal patterns), or when latency/cost demands a smaller specialized model. In practice, most production systems use RAG for what the model says (facts) and fine-tuning for how it says it (style) — they're complements, not alternatives.</p>
</details>

<details>
<summary><span class="qnum">Q4</span> RAG vs longer context windows — when does which win?</summary>
<p>Long context wins for small, fixed corpora that fit entirely in the window (e.g. a single 200-page contract). RAG wins for large corpora (millions of documents), frequently changing data, and cost-sensitive use cases — even with cheap long-context models, dumping irrelevant context wastes tokens and degrades quality due to "lost-in-the-middle" effects. The sweet spot is often hybrid: use RAG to narrow to the top 20 chunks, then let a long-context model reason over them.</p>
</details>

<details>
<summary><span class="qnum">Q5</span> What are the failure modes of a basic RAG system?</summary>
<p>Top failure modes: (1) retrieval misses — the right chunk wasn't in the top-k; (2) chunking too small or too large — losing context or burying signal; (3) the LLM ignores retrieved context and falls back to parametric knowledge; (4) the LLM hallucinates grounded answers — wrong facts justified by misleading context; (5) query-document vocabulary mismatch; (6) outdated index — the source updated but the embeddings didn't. Every production RAG system needs telemetry on each of these.</p>
</details>

<details>
<summary><span class="qnum">Q6</span> Explain the difference between extractive and generative QA.</summary>
<p>Extractive QA pulls the exact answer span verbatim from a source document (like Google's "featured snippets") — high precision, no hallucination risk, but rigid. Generative QA uses an LLM to synthesize an answer in natural language using retrieved context — more flexible, handles multi-document reasoning, but can hallucinate. Modern RAG is generative QA with constraints (cite sources, refuse if context insufficient) to get the flexibility of generation with the safety of extraction.</p>
</details>

<details>
<summary><span class="qnum">Q7</span> When is RAG the wrong tool for the job?</summary>
<p>RAG is wrong when: (1) the question doesn't require external knowledge (e.g. "translate this to French"); (2) the data is highly structured and a SQL query would do better; (3) you need precise computation or aggregation (use tools/agents); (4) the corpus is small enough to fit in context; (5) latency requirements are sub-100ms and retrieval adds too much; (6) the use case requires reasoning across the entire corpus rather than from a few documents. Don't reach for RAG just because it's trendy.</p>
</details>

<details>
<summary><span class="qnum">Q8</span> What is the role of embeddings in RAG?</summary>
<p>Embeddings are dense vector representations of text that capture semantic meaning — texts with similar meaning map to nearby vectors in high-dimensional space. In RAG, both documents and queries are embedded into the same space, and retrieval is just "find the document vectors closest to my query vector" (usually by cosine similarity). The quality of your embedding model is one of the biggest determinants of retrieval quality — a bad embedding model can't be saved by a better LLM downstream.</p>
</details>

<details>
<summary><span class="qnum">Q9</span> What is the difference between RAG and search?</summary>
<p>Traditional search returns documents and lets the human read them. RAG retrieves chunks and then uses an LLM to synthesize a natural-language answer grounded in those chunks. Search is optimized for relevance ranking; RAG additionally needs faithfulness, citation, and synthesis. A good way to think about it: search ends where RAG begins.</p>
</details>

<details>
<summary><span class="qnum">Q10</span> What's the difference between a retriever and a reranker?</summary>
<p>A retriever does fast first-pass filtering — usually vector similarity over the entire corpus, returning the top-k (say k=50) candidates. A reranker takes those candidates and scores them more precisely using a heavier model (often a cross-encoder), reordering them and returning the top-N (say N=5). Retrievers optimize recall (don't miss the right answer); rerankers optimize precision (put the right answer first).</p>
</details>

<details>
<summary><span class="qnum">Q11</span> Can RAG work without an LLM?</summary>
<p>Sort of — pure retrieval with extractive QA (like older search engines or QA systems with BERT-style readers) achieves the retrieval half of RAG without generation. But "RAG" as a term specifically implies Generation — the synthesis step where an LLM combines retrieved context into a natural answer. Without that, you have search or extractive QA, not RAG.</p>
</details>

<details>
<summary><span class="qnum">Q12</span> What does "grounding" mean in RAG?</summary>
<p>Grounding means tying the LLM's response to specific, verifiable source material — the retrieved chunks. A grounded answer can be traced back to a source ("this claim came from document X, paragraph 3"). Ungrounded answers come from the model's parametric memory and have no verifiable source. Strong grounding requires both providing relevant context and enforcing — via prompt engineering or output validation — that the model uses that context.</p>
</details>

<details>
<summary><span class="qnum">Q13</span> What is "context stuffing" and why is it a problem?</summary>
<p>Context stuffing means cramming as much retrieved content into the prompt as possible, hoping the LLM finds the relevant parts. Problems: (1) cost scales linearly with context tokens; (2) latency goes up; (3) LLMs suffer "lost-in-the-middle" — they pay more attention to the start and end of context than the middle; (4) irrelevant context can actually degrade answer quality by distracting the model. Better approach: retrieve more, then rerank tightly, and pass only the top 3–5 chunks.</p>
</details>

<details>
<summary><span class="qnum">Q14</span> What's the "lost in the middle" problem?</summary>
<p>Research (Liu et al., 2023, replicated since) shows LLMs pay disproportionate attention to the beginning and end of their context window, with accuracy degrading sharply for information placed in the middle. Practical implication for RAG: ordering matters. Put the most relevant chunks at the start or end, not buried in the middle. Some systems explicitly re-order retrieved chunks so the highest-ranked piece is first, the second-highest is last, and lower-ranked chunks fill the middle.</p>
</details>

<details>
<summary><span class="qnum">Q15</span> What is a "chunk" in RAG?</summary>
<p>A chunk is a unit of text — typically 200–1000 tokens — that gets independently embedded and indexed. Documents are too large to embed as a whole (and similarity over a whole document is meaningless), so they're split into chunks. The chunk is the atomic unit of retrieval: when the retriever returns the top-k, it's returning k chunks, not k documents. Chunk boundary choices have outsized impact on retrieval quality.</p>
</details>

<details>
<summary><span class="qnum">Q16</span> What metadata should you store with each chunk?</summary>
<p>At minimum: document ID, source URL or file path, chunk index within the document, character or token offsets, ingestion timestamp, and access-control tags (user_id, team_id, role). Beyond minimum: document title, section/heading, author, publication date, language, document type (PDF, HTML, etc.), and any domain-specific tags (product line, geography, customer tier) that you might want to filter on at query time.</p>
</details>

<details>
<summary><span class="qnum">Q17</span> What's the difference between sync and async RAG?</summary>
<p>Sync RAG: user query → retrieve → generate → return. Everything blocks the user. Async/streaming RAG: retrieval still blocks, but the generation streams tokens to the user as they're produced. Some advanced systems also do speculative retrieval — starting retrieval before the user finishes typing. In production, you almost always want streaming for the generation step to keep perceived latency low.</p>
</details>

<details>
<summary><span class="qnum">Q18</span> What's a "context window budget" and how do you manage it?</summary>
<p>The context window budget is the total tokens the LLM can process per request. You spend it across system prompt, conversation history, retrieved context, and the model's output. Budgeting means deciding how many tokens to allocate to each — e.g. 500 for system prompt, 2000 for history, 4000 for retrieved chunks, leaving 2000 for generation. When the budget tightens, you choose what to drop: shorter history, fewer chunks, smaller chunks, or output truncation.</p>
</details>

<details>
<summary><span class="qnum">Q19</span> What is the difference between recall and precision in RAG retrieval?</summary>
<p>Recall = of all the chunks that should have been retrieved (the truly relevant ones), how many did we actually return? Missing the right chunk is a recall failure. Precision = of the chunks we did return, what fraction were actually relevant? Returning lots of garbage is a precision failure. In RAG you want both, but they trade off — wider retrieval (higher k) improves recall but hurts precision. Reranking is the typical fix: cast a wide net (recall), then filter tight (precision).</p>
</details>

<details>
<summary><span class="qnum">Q20</span> What's a "naive RAG" and how does it differ from production RAG?</summary>
<p>Naive RAG = chunk documents → embed → store → embed query → top-k similarity → stuff in prompt → generate. Production RAG adds: query understanding (rewriting, decomposition, expansion), hybrid retrieval (dense + sparse), reranking, metadata filtering, multi-step retrieval, citation enforcement, evals, caching, fallbacks, observability, and version control on prompts. The gap between naive and production is where most engineering effort lives.</p>
</details>

</div>

## Category 2 — Chunking & Embeddings (21–40)

<div class="interview-block">

<details>
<summary><span class="qnum">Q21</span> How do you pick the right chunk size for your use case?</summary>
<p>Start with 500 tokens with 50-token overlap as a default. Adjust based on: document structure (Q&A pairs → small chunks; legal contracts → larger); embedding model context length; how specific vs broad your queries tend to be (specific → smaller); and downstream LLM context budget. The honest interview answer: "I'd start at 500/50, evaluate retrieval quality on a golden set, and tune from there." Hand-waving isn't acceptable — you'd evaluate empirically.</p>
</details>

<details>
<summary><span class="qnum">Q22</span> What chunking strategies do you know? When to use which?</summary>
<p>(1) Fixed-size: every N tokens, simple, fast, but cuts mid-sentence — fine for baselines. (2) Recursive: split on paragraph, then sentence, then word, respecting structure — good general default. (3) Semantic: split where embedding similarity drops between adjacent sentences — best quality, more expensive. (4) Document-aware: split on markdown headers, HTML tags, code-block boundaries — best for structured docs. (5) Parent-child / hierarchical: small chunks for retrieval, larger parent chunks for generation context — best of both worlds.</p>
</details>

<details>
<summary><span class="qnum">Q23</span> What is semantic chunking and when is it worth the cost?</summary>
<p>Semantic chunking computes embeddings for each sentence and creates a new chunk boundary wherever the cosine similarity between adjacent sentences drops below a threshold (the topic is shifting). Worth the cost when document structure is loose (no clean headings/paragraphs), when queries are very specific, or when retrieval precision is critical (medical, legal). Not worth it for well-structured documents where document-aware splitting already aligns with topic boundaries.</p>
</details>

<details>
<summary><span class="qnum">Q24</span> What is chunk overlap and why do you need it?</summary>
<p>Chunk overlap means the last N tokens of chunk i are also the first N tokens of chunk i+1. You need it because relevant information can fall on a chunk boundary, and without overlap, both chunks miss it. Typical overlap is 10–20% of chunk size. Trade-off: more overlap = more storage and more retrieved duplicates to deduplicate. Sweet spot is usually 50–100 tokens for 500-token chunks.</p>
</details>

<details>
<summary><span class="qnum">Q25</span> How do you handle tables in chunking?</summary>
<p>Don't split tables mid-row. Options: (1) keep the entire table as one chunk regardless of size; (2) convert the table to markdown or a structured text format (CSV-like, sentence-per-row) before embedding; (3) treat each table row as its own chunk with the header repeated; (4) store the table as metadata alongside its chunk and use the surrounding text for retrieval. The right approach depends on whether queries reference table contents or surrounding narrative.</p>
</details>

<details>
<summary><span class="qnum">Q26</span> How do you handle code in chunking?</summary>
<p>Don't split mid-function. Use language-aware splitters (e.g. LangChain's RecursiveCharacterTextSplitter with language-specific separators, or AST-based splitters like tree-sitter). Preserve function/class boundaries. Keep imports with the code they apply to. For RAG over codebases, also consider embedding function signatures and docstrings separately from full implementations — they're often what users actually search for.</p>
</details>

<details>
<summary><span class="qnum">Q27</span> How do you handle images and figures in chunking?</summary>
<p>Three options: (1) use a multimodal embedding model that can embed images directly (CLIP, etc.); (2) run image captioning first (e.g. GPT-4V) and treat the caption as the chunk's content; (3) ignore images but keep their captions and surrounding text. Production systems often do (2) — generate rich captions during ingestion and index those alongside the original image reference for display.</p>
</details>

<details>
<summary><span class="qnum">Q28</span> How do you pick an embedding model for production?</summary>
<p>Evaluate on: (1) MTEB leaderboard performance on your task type (retrieval, semantic similarity, classification); (2) domain match — general-purpose (text-embedding-3, BGE) vs domain-specific (BioBERT for medical, FinBERT for finance); (3) dimensions — higher = better quality but more storage/compute; (4) cost and latency — hosted (OpenAI, Cohere) vs self-hosted (BGE, e5); (5) multilingual needs. Always benchmark 2–3 candidates on your own retrieval eval set before committing.</p>
</details>

<details>
<summary><span class="qnum">Q29</span> When would you train or fine-tune your own embeddings?</summary>
<p>When off-the-shelf embeddings systematically miss your domain's semantics — e.g. medical jargon where "MI" means myocardial infarction, or finance where "short" is a verb. Fine-tune when: (1) you have at least a few thousand labeled query-document pairs; (2) general-purpose embeddings underperform on your eval set despite tuning everything else; (3) the cost/effort is justified by the gain. Often, hybrid search + reranking gets you 80% of the gain without training.</p>
</details>

<details>
<summary><span class="qnum">Q30</span> What's the difference between bi-encoders and cross-encoders?</summary>
<p>Bi-encoders embed query and document independently and compare via similarity (cosine, dot product). Fast — pre-compute document embeddings once, only the query needs embedding at query time. Used for retrieval. Cross-encoders take query and document together as input and output a relevance score directly. More accurate (the model attends across both) but slow — can't pre-compute. Used for reranking. Standard architecture: bi-encoder retrieves 50, cross-encoder reranks to 5.</p>
</details>

<details>
<summary><span class="qnum">Q31</span> What is the "parent-document retrieval" pattern?</summary>
<p>Index small chunks for precise retrieval, but when a chunk is retrieved, fetch and pass its larger parent (e.g. the full section or paragraph it came from) to the LLM. This gives you the retrieval precision of small chunks with the contextual completeness of large ones. Implementation: store both small and large chunks, with the parent_id on each small chunk, and join at query time.</p>
</details>

<details>
<summary><span class="qnum">Q32</span> What are sparse embeddings (BM25, SPLADE)?</summary>
<p>Sparse embeddings represent text as a high-dimensional vector where most values are zero, with non-zero values for the terms in the text (and sometimes related terms). BM25 is the classical example — keyword matching with term-frequency / inverse-document-frequency weighting. SPLADE is a neural sparse model that learns to expand and weight terms. Sparse retrieval is strong on exact keyword matches, especially rare terms or named entities where dense models blur the signal.</p>
</details>

<details>
<summary><span class="qnum">Q33</span> What does dimensionality mean for embeddings?</summary>
<p>Embedding dimensions = the length of the vector representing each text (e.g. 384, 768, 1536, 3072). Higher dimensions generally capture more nuance but cost more in storage (linear) and computation (matters at scale). Practical guidance: 384–768 is enough for most apps; 1536 is overkill unless you need maximum quality; 3072 is for cases where every percentage point of recall matters.</p>
</details>

<details>
<summary><span class="qnum">Q34</span> What is Matryoshka Representation Learning (MRL)?</summary>
<p>MRL is a training technique where embeddings are trained so that prefixes of the full vector are themselves valid embeddings of lower dimensionality. So a 3072-dim Matryoshka embedding can be truncated to 1536 or 768 dims and still work, just with slightly less accuracy. Practical use: store full embeddings, but use truncated versions for fast first-pass retrieval, then re-score with full embeddings on the top candidates. OpenAI's text-embedding-3 uses MRL.</p>
</details>

<details>
<summary><span class="qnum">Q35</span> What's the difference between sentence embeddings and word embeddings?</summary>
<p>Word embeddings (Word2Vec, GloVe) give one vector per word, ignoring context — "bank" has the same embedding whether it means a financial institution or a river bank. Sentence embeddings (Sentence-BERT, modern embedding models) give one vector per sentence or chunk using context-aware transformer models, so "bank" gets different embeddings in different sentences. RAG uses sentence-level embeddings exclusively — word embeddings are too coarse for retrieval.</p>
</details>

<details>
<summary><span class="qnum">Q36</span> How do you handle multilingual RAG?</summary>
<p>Three approaches: (1) Multilingual embedding model (e.g. multilingual-e5, BGE-M3) — embeds all languages into a shared space, so an English query can retrieve Hindi documents. (2) Translate to a pivot language (usually English) at ingestion and query time — simple but loses nuance. (3) Per-language indexes plus language detection at query time. (1) is the modern default. Always evaluate on your actual language mix because quality varies a lot across languages.</p>
</details>

<details>
<summary><span class="qnum">Q37</span> What is "instruction-tuned" embedding?</summary>
<p>Some embedding models (Instructor, text-embedding-3, BGE) accept an instruction prefix like "Represent this sentence for retrieving similar documents:" before embedding. The same text gets different embeddings depending on the task instruction. Use cases: the same text might need different embeddings for retrieval vs classification vs clustering. In RAG, you typically use one instruction for queries ("Find passages that answer this question:") and a different one for documents.</p>
</details>

<details>
<summary><span class="qnum">Q38</span> How do you embed long documents?</summary>
<p>You don't — embedding models have token limits (256–8192 typically), and beyond that the embedding becomes meaningless (an average of too many ideas). You chunk first, then embed each chunk. If you want a "document-level" representation for filtering or routing, embed the title plus the first ~500 tokens, or use a hierarchical embedding approach (embed chunks, average them).</p>
</details>

<details>
<summary><span class="qnum">Q39</span> What's a typical embedding latency budget?</summary>
<p>For a hosted API (OpenAI, Cohere): 50–200ms per query embedding, with batch endpoints embedding thousands of documents per second at lower cost. For self-hosted models on GPU: under 50ms per query, thousands per second for batch ingestion. Rule of thumb: query embedding should not be your bottleneck — if it is, you're probably calling the API one query at a time when you could batch, or using a hosted model when self-hosted is fast enough.</p>
</details>

<details>
<summary><span class="qnum">Q40</span> What is embedding drift and how do you detect it?</summary>
<p>Embedding drift = the distribution of embeddings produced by your model shifts over time, typically because (1) the embedding model was updated by the vendor or (2) new types of documents are entering the corpus that the model wasn't designed for. Detect by tracking: average pairwise similarity across new docs, retrieval quality on a fixed eval set over time, and the distribution of similarity scores at query time. Fix by re-embedding the corpus (expensive but sometimes necessary) or pinning a model version.</p>
</details>

</div>

## Category 3 — Vector DBs & Retrieval (41–60)

<div class="interview-block">

<details>
<summary><span class="qnum">Q41</span> Compare pgvector, Pinecone, Weaviate, Qdrant. When does which win?</summary>
<p>pgvector: Postgres extension. Free, you already have Postgres, great for under ~10M vectors and when you want transactional semantics alongside vector search. Pinecone: hosted, very fast, hands-off, but pay-per-vector pricing gets expensive at scale. Weaviate: open-source, strong hybrid search, good for complex filtering. Qdrant: open-source, very fast, written in Rust, best self-hosted performance per dollar. Decision tree: starting out → pgvector; need managed and don't care about cost → Pinecone; need open-source with hybrid → Weaviate; need self-hosted performance → Qdrant.</p>
</details>

<details>
<summary><span class="qnum">Q42</span> What is HNSW and why is it the default index for vector DBs?</summary>
<p>HNSW = Hierarchical Navigable Small World. It's an approximate nearest neighbor (ANN) index that builds a multi-layer graph where each node connects to its nearest neighbors, with sparser layers on top for fast navigation. Query: start at a high layer, greedily walk toward the query, descend layers, refine. Why default: excellent recall (95%+) at very low latency (sub-10ms for millions of vectors), tunable via two parameters (M and ef), and no retraining needed when adding new vectors.</p>
</details>

<details>
<summary><span class="qnum">Q43</span> What's the difference between exact and approximate nearest neighbor search?</summary>
<p>Exact (brute force): compute similarity between query and every vector. O(N) per query — fine up to ~100K vectors, infeasible at millions. Approximate (ANN): use an index (HNSW, IVF, ScaNN) that trades a tiny bit of accuracy for huge speed gains — millisecond queries at billions of vectors. In production RAG, ANN is always the default; exact search is used only for evaluation (to compute "ground truth" recall of the ANN index).</p>
</details>

<details>
<summary><span class="qnum">Q44</span> Dense vs sparse retrieval — when do you need both?</summary>
<p>Dense (embeddings) is strong on semantic similarity, paraphrases, and concepts — "what causes high blood pressure" matches "hypertension etiology." Sparse (BM25) is strong on exact matches, rare terms, named entities, product codes, error messages — "ERR-4017" needs to match exactly. You need both when your queries mix conceptual questions with specific identifiers. Most production systems use hybrid search; pure dense fails on rare-term queries, pure sparse fails on rephrased queries.</p>
</details>

<details>
<summary><span class="qnum">Q45</span> What is hybrid search and how would you implement it?</summary>
<p>Hybrid search combines dense (semantic) and sparse (lexical, BM25) retrieval. Options: (1) Run both, merge using Reciprocal Rank Fusion (RRF) — robust, no score normalization needed. (2) Weighted score combination — needs careful normalization since BM25 and cosine are on different scales. (3) Use a vector DB with native hybrid (Weaviate, Qdrant, Elasticsearch). RRF is the most common production choice because it's parameter-free and works well out of the box.</p>
</details>

<details>
<summary><span class="qnum">Q46</span> What is Reciprocal Rank Fusion (RRF)?</summary>
<p>RRF combines multiple ranked lists into one. For each result, compute 1 / (k + rank) from each list (k is a constant, typically 60), then sum across lists. Higher final score = higher rank. Why it works: it's robust to score-scale differences (only ranks matter, not raw scores), simple to implement, parameter-light (just k), and consistently performs well across domains. Standard tool in any hybrid retrieval setup.</p>
</details>

<details>
<summary><span class="qnum">Q47</span> How does reranking work and when is it worth the latency?</summary>
<p>Rerankers (typically cross-encoders like Cohere Rerank or BGE-reranker) take the top-k retrieved candidates (say k=50) and the query, and score each candidate's relevance more precisely than embedding similarity. They reorder, returning the top-N (say N=5). Worth the latency (50–200ms) when precision matters more than minor latency increase, when relevant-but-not-best chunks rank high, or when the corpus is large enough that retrieval alone misses nuance. Almost always worth it for production.</p>
</details>

<details>
<summary><span class="qnum">Q48</span> How do you implement metadata filtering at scale?</summary>
<p>Two patterns plus a hybrid: (1) Pre-filter — filter candidates by metadata first, then run vector search on the filtered set; simple but expensive if filters are unselective. (2) Post-filter — run vector search, then filter results; fast but may not return enough. (3) Filter-aware ANN — vector DBs like Pinecone, Qdrant, Weaviate maintain filter-aware indexes that integrate filtering into the vector search; best of both worlds. Always benchmark with your actual filter selectivity.</p>
</details>

<details>
<summary><span class="qnum">Q49</span> How do you handle multi-tenant data isolation in a vector DB?</summary>
<p>Three options: (1) One namespace/collection per tenant — strong isolation, but expensive at thousands of tenants. (2) Metadata-based isolation in a shared index — every chunk tagged with tenant_id, every query filtered by it; cheaper but riskier (one bug = data leak). (3) Tier isolation — top customers get their own namespace, small customers share. The "shared with metadata filter" approach is most common, with rigorous testing of the filter logic.</p>
</details>

<details>
<summary><span class="qnum">Q50</span> What's the difference between cosine similarity, dot product, and Euclidean distance?</summary>
<p>Cosine = dot product of normalized vectors; measures angle, ignores magnitude. Standard for embeddings since most models are trained for it. Dot product = cosine times magnitude; faster (no normalization) but assumes embeddings are already normalized or that magnitude carries signal. Euclidean (L2) = straight-line distance in vector space. For most modern embeddings (L2-normalized at training), cosine and dot product give identical rankings. Pick whichever your vector DB optimizes for.</p>
</details>

<details>
<summary><span class="qnum">Q51</span> How do you handle large-scale ingestion (millions of documents)?</summary>
<p>(1) Batch embedding — never one document at a time; batch hundreds per request. (2) Parallelize across workers (Celery, Ray, or multiprocessing). (3) Use the vector DB's bulk-insert APIs — 10–100x faster than single inserts. (4) Stage embeddings — write to S3/Parquet first, then bulk-load — gives retry-ability if vector DB ingestion fails. (5) Pre-compute on cheaper hardware offline rather than during a deploy.</p>
</details>

<details>
<summary><span class="qnum">Q52</span> What is "vector quantization" and when do you use it?</summary>
<p>Vector quantization compresses each embedding from float32 (4 bytes/dimension) to lower precision: float16 (2x compression), int8 (4x), or binary (32x). Trade-off: minor recall loss for massive storage and speed gains. Use it when the corpus is 10M+ vectors, memory/storage is a bottleneck, or you need sub-millisecond queries. Product Quantization (PQ) and Scalar Quantization are the two common families. Most vector DBs support this natively.</p>
</details>

<details>
<summary><span class="qnum">Q53</span> What's the difference between IVF, HNSW, and ScaNN indexes?</summary>
<p>IVF (Inverted File): clusters vectors into N partitions, searches only the closest M partitions at query time. Fast, simple, but recall depends heavily on cluster quality. HNSW: graph-based, very high recall, slightly more memory — the default choice. ScaNN (Google): uses anisotropic quantization, excellent on high-dim embeddings, used inside Google. Most production systems use HNSW unless operating at Google scale.</p>
</details>

<details>
<summary><span class="qnum">Q54</span> How do you handle real-time updates to a vector index?</summary>
<p>Vector DBs differ: Pinecone, Qdrant, Weaviate support live upsert/delete with eventual consistency. pgvector with ivfflat degrades as you insert without rebuilding; its hnsw index handles inserts well. Key pattern: separate "hot" (recently added, small, frequently updated) from "cold" (bulk, rarely changed) indexes, query both, merge results. For high-write workloads, batch inserts every few seconds rather than per-document.</p>
</details>

<details>
<summary><span class="qnum">Q55</span> What's a "namespace" or "collection" in a vector DB?</summary>
<p>A logical container that separates one set of vectors from another within the same DB instance. Used for multi-tenancy (one namespace per customer), versioning (current vs previous index for A/B testing), or topic separation (one namespace per knowledge area). Queries are scoped to a single namespace by default. Think of namespaces like database schemas — same engine, separate data.</p>
</details>

<details>
<summary><span class="qnum">Q56</span> How do you do "search-as-you-type" with vector search?</summary>
<p>Standard vector search isn't great for incremental queries because each character changes the embedding. Solutions: (1) Debounce — only embed and search every ~300ms while typing. (2) Hybrid with autocomplete — traditional prefix search (trie or Elasticsearch) for autocompletion, dense search only when the user pauses. (3) Cache common partial queries. (4) Speculative search — embed partial queries and pre-fetch. Most production search-as-you-type stays on traditional autocomplete and reserves vector search for finalized queries.</p>
</details>

<details>
<summary><span class="qnum">Q57</span> What is "cold-start" in vector search and how do you handle it?</summary>
<p>Cold start = serving queries before the index is fully built or warmed in memory. For HNSW, warming means loading the index into RAM. The first few queries on a fresh process can be 10x slower as caches fill. Mitigations: (1) preload index at deploy; (2) run synthetic queries at startup to warm caches; (3) keep indexes in shared memory across worker restarts; (4) for serverless, use provisioned concurrency.</p>
</details>

<details>
<summary><span class="qnum">Q58</span> How does GPU help with vector search?</summary>
<p>GPUs dramatically speed up brute-force similarity and ANN construction (batched matrix multiplies are GPU-native). FAISS-GPU can do millions of vector comparisons in milliseconds. Use GPUs when: extremely large indexes (>100M vectors), high QPS where CPU is the bottleneck, or frequent index rebuilding. Trade-off: GPU cost is high — most systems under 100M vectors run fine on CPU with HNSW.</p>
</details>

<details>
<summary><span class="qnum">Q59</span> What is "query expansion" in retrieval?</summary>
<p>Query expansion enriches the original query with related terms before retrieval to improve recall. Approaches: (1) Synonyms/thesaurus — classical, brittle. (2) LLM-based — ask an LLM to rephrase or add related terms; the most common modern approach. (3) Pseudo-relevance feedback — do an initial retrieval, take top results, extract terms, re-query. Trade-off: better recall but can introduce noise and add latency. Useful for short or vague queries.</p>
</details>

<details>
<summary><span class="qnum">Q60</span> What is "query decomposition" in retrieval?</summary>
<p>Splitting a complex query into sub-questions, retrieving for each, and combining results. Example: "Compare the Q3 revenue of Apple and Microsoft" → ["Apple Q3 revenue", "Microsoft Q3 revenue"]. Typically done by an LLM. Used when single-step retrieval is unlikely to find all relevant context (multi-hop questions). Adds latency but dramatically improves answer quality on complex queries. Standard in research RAG systems (RAPTOR, ReAct-style retrievers).</p>
</details>

</div>

## Category 4 — Evaluation (61–80)

<div class="interview-block">

<details>
<summary><span class="qnum">Q61</span> How do you evaluate a RAG system end-to-end?</summary>
<p>Two layers: Retrieval evaluation (did we get the right context?) using precision@k, recall@k, MRR, NDCG against a labeled set. Generation evaluation (did we answer well given that context?) using faithfulness (is the answer supported by retrieved context?), answer relevance, and answer correctness. Production also adds end-to-end metrics: user satisfaction, click-through on citations, escalation rate. Frameworks like RAGAS and TruLens automate much of this.</p>
</details>

<details>
<summary><span class="qnum">Q62</span> What metrics measure retrieval quality?</summary>
<p>Precision@k: of the top-k retrieved chunks, how many are relevant? Recall@k: of all relevant chunks, how many appear in top-k? MRR (Mean Reciprocal Rank): average of 1/(rank of first relevant result) — penalizes burying the right answer. NDCG (Normalized Discounted Cumulative Gain): weighs rank position with a logarithmic discount; the gold standard when you have graded relevance. For production RAG, recall@10 and MRR are the most commonly tracked.</p>
</details>

<details>
<summary><span class="qnum">Q63</span> What metrics measure generation quality?</summary>
<p>Faithfulness: does the answer only make claims supported by retrieved context? (LLM-as-judge usually). Answer relevance: does it actually address the question? Answer correctness: is it factually right vs a ground-truth answer? Context precision: of the retrieved chunks, how many were actually used? Context recall: was all necessary info retrieved? Faithfulness is the most important — an unfaithful answer is a hallucination, full stop.</p>
</details>

<details>
<summary><span class="qnum">Q64</span> How do you build a golden dataset for RAG?</summary>
<p>(1) Collect real queries — from production logs, user research, or synthetic generation. (2) For each query, identify the relevant chunks — human annotators or domain experts. (3) Write or extract ideal answers. (4) Tag failure modes — hallucination, missing context, irrelevant context — so you can break down failures. Aim for 100–300 high-quality examples to start; quality beats quantity. Synthetic generation (LLMs creating Q&A pairs from your corpus) is great for bootstrapping but should be human-validated.</p>
</details>

<details>
<summary><span class="qnum">Q65</span> What is LLM-as-judge for RAG and what are its limits?</summary>
<p>Use a powerful LLM (GPT-4, Claude) to score outputs against criteria (faithfulness, relevance, etc.). Limits: (1) Bias — judges prefer their own model family's outputs; (2) Inconsistency — same judge, different scores across runs; (3) Cost at scale; (4) Reasoning errors on subtle factual claims; (5) Position bias — when comparing two answers, judges favor the first shown. Mitigations: rotate models, use chain-of-thought, randomize order, calibrate against human scores.</p>
</details>

<details>
<summary><span class="qnum">Q66</span> How do you detect retrieval drift in production?</summary>
<p>Track over time: (1) Similarity score distributions — if average similarity to the top result drops, queries are harder or the index is decaying. (2) Query-document overlap — are queries hitting different documents than before? (3) No-result rate — fraction of queries where top similarity falls below threshold. (4) Click-through on citations — drops mean users aren't finding answers. (5) Periodic eval on a fixed golden set. Alert when any of these moves >2 std dev from baseline.</p>
</details>

<details>
<summary><span class="qnum">Q67</span> How do you regression-test RAG in CI/CD?</summary>
<p>(1) Maintain a golden set of 100+ Q&A pairs in your repo. (2) On every PR that changes the pipeline (prompts, chunking, retrieval params), run the golden set and compute eval metrics. (3) Compare to main's metrics — fail the build if any metric regresses by more than X%. (4) Cache golden-set embeddings to keep CI fast. (5) Log per-question diffs so reviewers see exactly what got better or worse. Most teams skip this; it's the single highest-leverage practice for reliability.</p>
</details>

<details>
<summary><span class="qnum">Q68</span> What is "context precision" and how does it differ from precision@k?</summary>
<p>Precision@k is purely retrieval: of the top-k retrieved chunks, how many are labeled relevant? Context precision (RAGAS terminology) is generation-aware: of the retrieved chunks, how many were actually used to generate the answer? Measured by LLM-as-judge. Context precision can be high even if precision@k is low — the model ignores irrelevant chunks. But low context precision plus high precision@k means the model is hallucinating despite good retrieval.</p>
</details>

<details>
<summary><span class="qnum">Q69</span> What is "context recall" and why does it matter?</summary>
<p>Context recall: was all the information needed to answer the question actually present in the retrieved chunks? If it's low, even a perfect LLM can't give a complete answer — the info just wasn't there. Measured by comparing the ground-truth answer to retrieved chunks and asking (via LLM-as-judge) whether each claim in the ground truth is supported. Low context recall = a retrieval problem, not a generation problem.</p>
</details>

<details>
<summary><span class="qnum">Q70</span> How do you measure faithfulness?</summary>
<p>Run the system to get an answer and the retrieved context. Then ask an LLM judge: "For each claim in this answer, is it supported by the provided context?" The faithfulness score is the fraction of claims supported. Extracting "claims" is itself an LLM step — a separate prompt that breaks the answer into atomic factual statements. RAGAS does this automatically. A faithfulness score below 0.85 is usually a red flag.</p>
</details>

<details>
<summary><span class="qnum">Q71</span> What's the difference between online and offline evaluation?</summary>
<p>Offline eval: run on a fixed golden dataset, in CI or before deployment. Fast, deterministic, but limited to what's in the dataset. Online eval: measure metrics on real production traffic — user feedback (thumbs up/down, edits, escalations), implicit signals (time spent, citation clicks), and A/B tests. Online catches issues offline misses (long-tail queries, distribution shift) but is slower and noisier. Production RAG needs both.</p>
</details>

<details>
<summary><span class="qnum">Q72</span> How do you A/B test RAG changes safely?</summary>
<p>(1) Shadow traffic — run the new version on a copy of production traffic, compare outputs without showing users. Zero risk, slow signal. (2) Canary — route 1% of traffic to the new version, monitor key metrics, ramp up if healthy. (3) Interleaving — show outputs from both versions side-by-side, measure which gets clicked/preferred. Always log enough metadata to attribute outcomes to versions, and always have an automated rollback trigger on key-metric regressions.</p>
</details>

<details>
<summary><span class="qnum">Q73</span> How do you evaluate "I don't know" responses?</summary>
<p>A RAG system should refuse when retrieved context is insufficient, but evaluating when to refuse is hard. Build an explicit "abstain set" in your golden data: questions the system should refuse. Score both (1) refusal accuracy — did it refuse what it should and answer what it should? — and (2) answered-question quality. Penalize models that refuse too often (overcautious) or too rarely (hallucination risk).</p>
</details>

<details>
<summary><span class="qnum">Q74</span> What is "groundedness" and how do you measure it?</summary>
<p>Groundedness = degree to which the generated answer is anchored in retrieved context; equivalent to faithfulness in most usages. Measurement: ask an LLM judge to label each statement as (a) supported by context, (b) contradicted by context, or (c) not in context (outside knowledge). Groundedness score = fraction supported. Some systems flag (b) and (c) separately because they have different failure modes.</p>
</details>

<details>
<summary><span class="qnum">Q75</span> How do you handle subjective or open-ended questions in eval?</summary>
<p>For questions without one right answer ("explain the trade-offs of microservices"), use rubric-based LLM-as-judge: define 3–5 criteria (completeness, accuracy, clarity, structure), score each 1–5, aggregate. Pairwise preference (which of these two answers is better?) is more reliable than absolute scoring for subjective output. Human evaluation on a sample is still the gold standard — use LLM judges for scale, human spot-checks for calibration.</p>
</details>

<details>
<summary><span class="qnum">Q76</span> What tools do you know for RAG evaluation?</summary>
<p>RAGAS: open-source, faithfulness/relevance/precision/recall metrics, integrates with LangChain. TruLens: open-source, app-level evals with feedback functions. DeepEval: pytest-style evals, easy to drop into CI. Arize Phoenix: open-source observability + evals. LangSmith: hosted (by LangChain), strong on tracing and dataset-driven testing. Langfuse: open-source observability with good eval features. Most production systems combine one observability tool with custom eval scripts.</p>
</details>

<details>
<summary><span class="qnum">Q77</span> How do you evaluate citations?</summary>
<p>Score on: (1) Citation precision — of the citations provided, what fraction support the claim they're attached to? (2) Citation recall — of the claims that could be cited, what fraction actually have citations? (3) Citation correctness — do citations point to the right source/chunk, not just any source? Use LLM-as-judge with the answer, the citations, and the source documents. Citations are critical for legal, medical, and enterprise RAG — never ship without explicit citation evaluation.</p>
</details>

<details>
<summary><span class="qnum">Q78</span> How do you set up human-in-the-loop evaluation?</summary>
<p>(1) Sampling — don't review everything; sample interesting cases (low confidence, refused queries, thumbs-down, high-stakes). (2) Review UI — side-by-side query, retrieved chunks, generated answer, expected answer; reviewers label issues by category. (3) Calibration — multiple reviewers double-rate ~10% to measure inter-rater agreement. (4) Close the loop — failed cases become new golden-set entries; recurring failures drive engineering work. Run a steady cadence (e.g. 100 cases/week).</p>
</details>

<details>
<summary><span class="qnum">Q79</span> What's a "smoke test" for RAG and what should be in it?</summary>
<p>A small set (10–20 queries) run on every deploy to catch obvious regressions before production. Include: one query per major topic; one out-of-scope "I don't know" query; one adversarial query (prompt injection attempt); one citation-required query; one multi-hop query. Smoke tests should run in under 60 seconds — not a full eval, but a fast canary.</p>
</details>

<details>
<summary><span class="qnum">Q80</span> How do you measure "user satisfaction" in RAG without explicit ratings?</summary>
<p>Implicit signals: (1) Engagement — did the user click a citation, scroll, expand details? (2) Follow-up rate — did they immediately rephrase (the answer wasn't helpful)? (3) Abandonment — did they leave right after the answer? (4) Copy events — did they copy the answer (a sign of value)? (5) Escalation — did they ask for a human? Combine into a satisfaction proxy and validate against a sample of explicit ratings.</p>
</details>

</div>

## Category 5 — Production & Advanced RAG (81–100)

<div class="interview-block">

<details>
<summary><span class="qnum">Q81</span> How do you reduce hallucinations in a RAG system?</summary>
<p>Defense in depth: (1) strong system prompt — "only answer from the provided context; if insufficient, say so"; (2) force citations — require chunk IDs for every claim; (3) refusal examples in few-shot; (4) output validation — check every cited chunk exists and every claim is in context; (5) faithfulness eval in CI; (6) low temperature (0–0.3) for factual RAG; (7) better retrieval — most hallucinations are retrieval failures, where the model invented an answer because the right context wasn't there.</p>
</details>

<details>
<summary><span class="qnum">Q82</span> How do you force the LLM to cite sources reliably?</summary>
<p>(1) Give each retrieved chunk a stable ID in the prompt ([SOURCE_1], ...). (2) Require inline citations after every claim in the system prompt. (3) Provide few-shot examples of well-cited answers. (4) Use structured outputs (JSON schema with an answer field plus a citations list). (5) Post-process — parse citations, verify each cited ID exists, regenerate if missing. (6) Add a verification call: "does each claim have a valid citation?" Combined, these reach >95% citation reliability.</p>
</details>

<details>
<summary><span class="qnum">Q83</span> What is HyDE (Hypothetical Document Embeddings)?</summary>
<p>Instead of embedding the user's query and searching, first ask an LLM to write a hypothetical answer, then embed that answer and search. It works because answers tend to share vocabulary and style with the documents that contain them, so they retrieve better than questions. Trade-off: an extra LLM call, and if the hypothetical answer is wrong-direction, retrieval suffers. Useful for short or vague queries; less needed when queries are already well-formed.</p>
</details>

<details>
<summary><span class="qnum">Q84</span> What is query rewriting and when do you need it?</summary>
<p>Query rewriting transforms the user's raw query into a better retrieval query using an LLM: expand acronyms, add context from history, clarify pronouns ("the second one" → "the second product mentioned"), decompose multi-part questions, or generate alternative phrasings. Needed when conversational follow-ups are common, when queries are short/vague, or when domain language differs from user language.</p>
</details>

<details>
<summary><span class="qnum">Q85</span> What is multi-query retrieval?</summary>
<p>Generate multiple variations of the query (using an LLM), retrieve for each, and merge results (RRF). A single query embedding might miss documents that match the intent but use different words. Trade-off: more LLM and retrieval calls, so cost rises. Especially useful for ambiguous or vague queries. Standard pattern in production-grade RAG.</p>
</details>

<details>
<summary><span class="qnum">Q86</span> How do you handle multi-hop / multi-document questions?</summary>
<p>Multi-hop = "Who is the CEO of the company that makes the iPhone?" needs Apple first, then Tim Cook. Approaches: (1) Query decomposition into sub-questions. (2) Iterative retrieval — retrieve, generate an intermediate answer, use it to form a new retrieval, repeat. (3) Self-RAG / self-query — let the LLM decide when to retrieve again. (4) Graph-based RAG with a knowledge graph alongside vector search. (1) and (2) are most common in production.</p>
</details>

<details>
<summary><span class="qnum">Q87</span> What is "self-RAG"?</summary>
<p>Self-RAG is a pattern where the LLM decides at each step whether to retrieve again, whether retrieved context is relevant, and whether its own answer is well-supported — using special control tokens during generation. More autonomous than fixed pipelines. Trade-off: more LLM calls (cost, latency) and less predictable behavior, but better at multi-hop and "I don't know" handling. Implementations: the Self-RAG paper (Asai et al.), CRAG, and agent-based RAG patterns.</p>
</details>

<details>
<summary><span class="qnum">Q88</span> What is "agentic RAG"?</summary>
<p>Agentic RAG treats retrieval as a tool the agent can call multiple times with different strategies — different queries, indexes, or filters — based on what it learns about the question. Useful for complex queries, multi-source retrieval, and questions spanning structured (SQL) and unstructured (vector) data. Trade-off: significantly higher cost and latency, and harder to evaluate. Use only when simpler RAG isn't enough.</p>
</details>

<details>
<summary><span class="qnum">Q89</span> What is "RAG fusion"?</summary>
<p>A specific technique: generate multiple query variations → retrieve for each → fuse results using Reciprocal Rank Fusion → pass top results to the LLM. It combines multi-query retrieval with RRF, improving recall on vague or ambiguous queries while keeping precision. Straightforward to implement and gives consistent improvements over a single-query baseline.</p>
</details>

<details>
<summary><span class="qnum">Q90</span> How do you handle conversational RAG (follow-up questions)?</summary>
<p>Two layers: (1) Conversation memory — keep recent turns in the prompt, but bounded (e.g. last 5 turns or 2000 tokens). (2) Query rewriting using history — before retrieving, ask an LLM to rewrite the latest query into standalone form. "What about for enterprise?" → "What pricing applies to enterprise customers?" Standalone queries embed much better than context-dependent fragments. Standard pattern in production chatbots.</p>
</details>

<details>
<summary><span class="qnum">Q91</span> How do you manage cost and latency in production RAG?</summary>
<p>(1) Caching — exact-match cache for repeated queries; semantic cache for similar ones. (2) Model routing — cheap small model for easy queries, expensive large model for hard ones, classified by a fast first pass. (3) Tighter context — rerank aggressively, pass fewer tokens. (4) Async/streaming to reduce perceived latency. (5) Prompt compression (LLMLingua) for long contexts. (6) Embedding cache at ingestion. (7) Batch operations. (8) Track cost per query as a first-class metric.</p>
</details>

<details>
<summary><span class="qnum">Q92</span> What is semantic caching?</summary>
<p>A cache that returns a cached response if a new query is semantically similar (cosine above a threshold) to a cached one — not just exact match. Implementation: embed every query, do a vector similarity check against cached query embeddings, return the cached answer if similarity > ~0.95. Saves huge cost on common questions phrased many ways. Risks: stale answers when data updates, and incorrect cache hits on similar-but-different questions — tune the threshold carefully.</p>
</details>

<details>
<summary><span class="qnum">Q93</span> Design a production RAG system for a 10M-document corpus.</summary>
<p>Ingestion: parallel pipeline (Spark/Ray), language-aware chunking, batch embedding via hosted API or self-hosted GPU, bulk insert into the vector DB; store metadata in Postgres for filtering. Index: HNSW on Qdrant or Weaviate; one collection per tenant if multi-tenant. Retrieval: hybrid (dense + BM25) with RRF merge, top-50; cross-encoder rerank to top-5; metadata pre-filtering. Generation: small fast model for simple questions, large model for hard ones; force-cite system prompt; output validation. Observability: Langfuse for traces; RAGAS metrics in CI; dashboards for cost/latency/quality. Eval: 500-question golden set, weekly review of 100 production samples.</p>
</details>

<details>
<summary><span class="qnum">Q94</span> How do you handle PII in a RAG pipeline?</summary>
<p>(1) At ingestion — detect PII (Presidio, AWS Comprehend, regex) and redact, pseudonymize, or quarantine. (2) At query time — detect PII in user queries; log carefully or not at all. (3) At storage — encrypt at rest, restrict vector DB access. (4) At generation — post-process outputs to redact PII before returning. (5) For compliance (HIPAA, GDPR) — document data flows and support deletion-on-request, which means tracking which embeddings came from which source doc (non-trivial in vector DBs).</p>
</details>

<details>
<summary><span class="qnum">Q95</span> How do you implement prompt injection defenses in RAG?</summary>
<p>(1) Trust boundary — system prompt is trusted, retrieved context is untrusted (it may contain "ignore previous instructions"). (2) Sandwich pattern — restate the system instructions after the retrieved context. (3) Output validation — check the output addresses the user's actual question, not a planted instruction. (4) Structured outputs — JSON schemas make hijacking harder. (5) Detection — flag retrieved chunks with suspicious phrases. (6) Eval against injection attempts in CI. Defense-in-depth, not a single fix.</p>
</details>

<details>
<summary><span class="qnum">Q96</span> How do you build RAG over structured data (databases)?</summary>
<p>Don't use pure vector RAG — use Text-to-SQL: the LLM generates SQL from the question, you execute it, return results. Optionally combine: vector-retrieve documentation about the schema/business logic, then have the LLM generate SQL using that context. For hybrid structured + unstructured questions, build a tool-using agent that can call both vector search and SQL, and let it decide which to use.</p>
</details>

<details>
<summary><span class="qnum">Q97</span> What is "long-context RAG" and how does it differ from regular RAG?</summary>
<p>Long-context RAG retrieves more chunks (50–100 instead of 3–5) and relies on large-context models to find relevant info themselves. Pros: simpler retrieval, robust to retrieval errors. Cons: cost scales with context, "lost-in-the-middle" still happens, slower. Sweet spot: retrieve aggressively (high recall), then either rerank tight (traditional) or pass it all to a long-context model. Hybrid is often best.</p>
</details>

<details>
<summary><span class="qnum">Q98</span> What is a "fact-checker" pattern in RAG?</summary>
<p>After generating an answer, a second LLM call (the fact-checker) verifies each claim against the retrieved context. If any claim is unsupported, either regenerate, flag for human review, or abstain. Trade-off: roughly 2x cost and latency, but dramatically improves faithfulness. Used in high-stakes domains (medical, legal, financial); less needed for low-stakes use cases.</p>
</details>

<details>
<summary><span class="qnum">Q99</span> How do you version a RAG system?</summary>
<p>Version everything: (1) Prompts — store in git, version with semver, tag in production logs. (2) Models — pin embedding and LLM versions; don't auto-upgrade. (3) Chunking strategy — chunking params are part of the version; changes require re-indexing. (4) Index — vector DB collections can be versioned (docs_v1, docs_v2) for safe rollouts. (5) Evals — track which version a metric was measured on. Without versioning, you can't reproduce issues or do safe rollbacks.</p>
</details>

<details>
<summary><span class="qnum">Q100</span> What's the future of RAG (as of 2026)?</summary>
<p>Trends: (1) Long-context models reduce the need for aggressive retrieval — many short-corpus use cases move to "just put it all in context." (2) Multimodal RAG — embedding and retrieving over images, audio, video. (3) Agentic RAG — retrieval becomes one tool among many. (4) Personalized retrieval — embeddings adapted per user/session. (5) Better eval — synthetic eval generation, more reliable judges. (6) End-to-end trained retrieval — joint training of retriever and generator. RAG isn't going away; it's getting more sophisticated.</p>
</details>

</div>

## How to use this doc

- **Week 1:** read all 100, mark which you can answer cold.
- **Week 2:** deep-study your weak categories. For every gap, build a small project.
- **Week 3:** mock interviews with a friend using this doc.
- **Week 4:** re-read just the answers — by now they should feel obvious.

<div class="takeaway">
If you can confidently answer 70+ out of 100, you're ready for senior RAG interviews. If you hit 90+, you're in the top 5%.
</div>
