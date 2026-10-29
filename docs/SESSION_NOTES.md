# Session notes (handoff between PCs / Claude sessions)

Claude Code sessions are stored per machine, so this file carries the context across.
**On a new machine, start Claude with:** "Read docs/SESSION_NOTES.md and continue from there."

---

## 2026-10-28 — Session 1: first run + "how does this work?"

### Where I am
- Ran every README command: `chroma:up`, `hello`, `embeddings`, `ingest`, `ask`, `chat`. All worked.
- Chroma collection created: **`docs-gemini-embedding-2-768`** (name = `CHROMA_COLLECTION` + embed model + dims).
- No roadmap steps ticked yet. Honestly: 0.1 is basically done (it runs), but I don't yet *understand* it.

### What Claude explained (my summary)
- **Why RAG:** the LLM has never seen my docs → it hallucinates. So: find the relevant text myself and paste it into the prompt with "answer only from this".
- **Ingest pipeline** (`src/rag/ingest.service.ts`): load files → **chunk** (~1000 chars, 150 overlap, `chunker.ts`) → **embed** (each chunk → 768 numbers encoding *meaning*, `gemini.embedder.ts`) → **store** in Chroma (id, vector, text, metadata).
- **Ask pipeline** (`src/rag/ask.service.ts`): embed the question with the same model → Chroma returns the 4 nearest chunks (`TOP_K`) — like `ORDER BY cosine_similarity DESC LIMIT 4` with HNSW as the "index" → `prompt.ts` wraps them in `<context>[1]…[4]</context>` → Gemini answers and cites `[n]`.
- Key insight: **the LLM doesn't search; it only reads what retrieval hands it.** Bad retrieval = bad answer. That's why chunking/retrieval/evals matter most.
- Architecture = ports & adapters: `core/ports.ts` (interfaces) / `adapters/*` (Gemini, Chroma) / `container.ts` (= Program.cs DI).

### Looking at Chroma data (GUI)
- **Swagger UI:** http://localhost:8000/docs (works, no install). Use `POST …/collections/{id}/get` with `{"limit":10,"include":["documents","metadatas"]}`.
- `chroma browse <collection> --local` — official TUI, but the CLI bundled with the npm `chromadb` package fails on Windows x64 ("Only ARM64 is supported"). Needs the standalone CLI or `pip install chromadb`.
- Community web UI: chromadb-admin (Docker, port 3001, connect to `http://host.docker.internal:8000`) — check Chroma 1.x compatibility first.
- Raw embedding numbers are meaningless to read; only comparisons between vectors matter.
- ✅ **ChromaDB UI works:** https://blackydrum.github.io/chromadb-ui/ → URL `http://localhost:8000` (no trailing slash), `default_tenant` / `default_database`, then click the collection in the sidebar. CORS for it is already set in `docker-compose.yml`.

### Next steps (pick up here)
1. Quick experiments: hallucination without RAG (step 0.2), own sentences in `npm run embeddings` (0.3), ask an off-topic question / try `TOP_K=1`.
2. Then `/next-step` → **1.1 `ask --debug`** (print retrieved chunks + scores + the full prompt). Recommended first real step.
3. Open offer from Claude: a small `npm run peek` script to list the chunks in Chroma.

## 2026-10-30 — Session 2: Gemini quota hit → going local with Ollama

- Gemini free-tier quota ran out, so I pulled roadmap **6.1 (Ollama)** forward. GPU: RTX 3060 Ti (8 GB VRAM).
- Models: `embeddinggemma` (768 dims, same `title: … | text: …` prompt format as gemini-embedding-2) + `qwen3:8b` (~5.2 GB, chat).
- Claude did the plumbing: `LLM_PROVIDER=gemini|ollama` in `env.ts`/`.env.example`, `createModels()` in `container.ts`,
  collection name now uses the active embed model (`docs-embeddinggemma-768`), `npm run embeddings` follows the provider.
- I said "just do it" → Claude wrote the adapters (`src/adapters/ollama/*`, shared HTTP/error helper in `ollama.http.ts`). 46/46 tests green.
- ✅ Runs fully local: `LLM_PROVIDER=ollama`, ingest = 6 chunks in 14s, `ask` ≈ 5s with correct citations. qwen3:8b ≈ 68 tok/s, 100% GPU.
- Observed: embeddinggemma similarity scores are on a different scale than Gemini's (top hit ~0.55–0.62). Scores are only comparable within one model → matters for `MIN_SCORE` (step 2.1).
- 6.1 not ticked yet: its "compare quality via the Phase 3 eval" part needs the eval first.
- **Next:** read the two adapters (esp. NDJSON parsing in `ollama.chat.ts` `stream()`), finish 0.2/0.3 with Ollama, then 1.1 `ask --debug`.

### New-machine setup checklist
- `npm install`
- Copy `.env.example` → `.env`, paste `GEMINI_API_KEY` (the key is NOT in git).
- `npm run chroma:up` then `npm run ingest` (Chroma data lives in a local Docker volume, not in git — must re-ingest).
- `npm run check` to confirm everything is green.
