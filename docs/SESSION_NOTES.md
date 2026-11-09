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
- Setup decided: **home PC = Ollama, office PC = Gemini**. `.env` is git-ignored, so each PC keeps its own `LLM_PROVIDER`.
  README now has a "Choose your models" + "Using two PCs" section. Everything committed & pushed (`b91bb98`).
- `npm run embeddings` on embeddinggemma: Bangla question ↔ English question = **0.723** (higher than the English answer, 0.701!);
  unrelated sentences ≈ 0.20–0.37, related ≈ 0.43–0.72. → embeddings capture meaning across languages.

### ▶ Pick up here (next session — office PC, Gemini)
1. Office setup (first time after this session): `git pull` → `npm install` → `.env` has `LLM_PROVIDER=gemini` + key →
   `npm run chroma:up` → `npm run ingest` → `npm run check` (expect 46 passing).
2. **Step 0.2** (Gemini quota should have reset): `npm run hello`, then in `src/playground/01-hello-gemini.ts`:
   extreme `systemInstruction` (pirate / Bangla), read `usageMetadata` (prompt vs candidates vs thoughts tokens),
   ask "How many days of annual leave do Nimbus Coffee employees get?" WITHOUT RAG 2–3× → see it invent; compare with `npm run ask`.
   (Home alternative: `ollama run qwen3:8b --verbose`, `/set system …`, `/set nothink`.)
3. **Step 0.3**: add sentences to `src/playground/02-embeddings.ts` — a typo, an *unrelated* Bangla sentence, a negation
   ("Employees get no paid leave"). Run `npm run embeddings` on Gemini and compare with the embeddinggemma numbers above.
   Answer: "on this model, score above ___ = related".
4. Write 2–3 lines per step in `docs/ROADMAP.md` → "My notes & conclusions", then `/review-step` (Claude ticks 0.2/0.3).
5. Then `/next-step` → **1.1 `ask --debug`**.
- Still open: read `src/adapters/ollama/ollama.chat.ts` `stream()` (NDJSON buffering); `npm run peek` script offer.

### New-machine setup checklist
- `npm install`
- Copy `.env.example` → `.env`. Set `LLM_PROVIDER` (`gemini` + paste `GEMINI_API_KEY`, or `ollama` — the key is NOT in git).
- Ollama PCs only: `ollama pull embeddinggemma` and `ollama pull qwen3:8b`.
- `npm run chroma:up` then `npm run ingest` (Chroma data lives in a local Docker volume, not in git — must re-ingest, once per provider).
- `npm run check` to confirm everything is green.

## 2026-11-04 — Session 3: step 0.3 in progress (topK)

- 0.2 ticked. Implemented `topK()` in `src/shared/vector.ts` → 51/51 tests green. Added 4 own sentences to `02-embeddings.ts`.
- `/review-step` result — 0.3 NOT ticked yet. To do (office PC, Gemini):
  1. `02-embeddings.ts`: `return topK(...)` prints nothing → loop over it and `console.log` score + `sentences[r.index]`.
  2. Add the missing **typo** and **negation** ("Employees get no paid leave.") sentences — predict scores first.
  3. Small: in `topK()` do `if (k <= 0) return [];` first (don't score everything just to throw it away).
  4. `npm run embeddings` on Gemini → write "on this model, score above ___ = related" in ROADMAP notes,
     compare with embeddinggemma (home: related ≈ 0.43–0.72, unrelated ≈ 0.20–0.37).
  5. `/review-step` → give Claude the "Learned:" sentence → tick 0.3. Then `/next-step` → **1.1 `ask --debug`**.

## 2026-11-04 — Session 4 (office PC, Gemini): step 0.3 approved, not ticked yet

- Added typo + negation sentences; `02-embeddings.ts` now prints the topK top 3. 51/51 tests green.
- **Gemini `gemini-embedding-2` scores:** related 0.72–0.92 (typo ↔ original 0.924), unrelated 0.55–0.67 → cut-off ≈ **0.70**.
  Floor is much higher than embeddinggemma (unrelated 0.20–0.37) → `MIN_SCORE` must be tuned per model.
- **Negation:** "Employees get no paid leave." ↔ "Staff receive 22 days of paid annual leave." = **0.808** → embeddings capture topic, not "no".
- Top 3 for "how much time off do I get?": Bangla leave question 0.867, typo 0.801, vacation question 0.777.

### ▶ Pick up here
1. Give Claude the "Learned:" sentence → Claude ticks 0.3 in ROADMAP and fixes `- [ x]` → `- [x]` in the notes.
2. Small cleanup in `02-embeddings.ts`: dangling "vs each sentence:" heading + indentation of the topK loop.
   Optional: `if (k <= 0) return [];` first in `topK()`; stretch: "Employees get 30 days of paid leave." (numbers).
3. `/next-step` → **1.1 `ask --debug`**.

## 2026-11-09 — Session 5: 0.3 ticked, step 1.1 `ask:debug` done

- Ticked 0.3; tidied `02-embeddings.ts` (old TODOs, topK loop indentation).
- **Step 1.1 done & ticked.** `AskService.askStream` now emits `sources → prompt → delta…`; the `prompt` event carries the
  exact `GenerateRequest` sent to the LLM (same object → debug output can't drift). `ask()` and `askStream()` share a
  `private buildRequest()`. `parseAskArgs()` in `src/cli/shared.ts` handles `--debug`. New `npm run ask:debug -- "…"`.
  New test file `tests/ask-debug.test.ts` → 58/58 green.
- Learned: `yield` in an `async *` generator = C# `yield return` in `IAsyncEnumerable`; the caller's `for await` gets one
  event per loop pass. Tests cover logic, not `console.log` display.
- Seen in `ask:debug` (Gemini, leave question): chunks [3]/[4] were off-topic `remote-work.md` (0.636 / 0.628, below the
  ~0.70 cut-off) → step 2.1 `MIN_SCORE`. Chunk [2] starts with "days." → 150-char overlap cuts mid-sentence → steps 1.2/1.4.

### ▶ Pick up here
1. Optional stretch: `/prompt` command in `npm run chat` (store `lastRequest` from the `prompt` event, print it) —
   watch history grow, old turns stored without context, 6-message cap.
2. `/next-step` → **1.2 Chunking experiments** (`CHUNK_SIZE` 300 / 1000 / 3000, same 5 questions; use `ask:debug`).

## 2026-11-09 — Session 5b: step 1.2 scaffold (not started yet)

- `/next-step` created step 1.2: `src/rag/chunking-experiment.ts` (TODO: `runChunkingExperiment`),
  `src/playground/03-chunking.ts` (`npm run chunking`), `tests/chunking-experiment.test.ts`.
- `npm run check` = **7 failing on purpose** (58 pass) — those 7 define "done" for 1.2.
- Experiment uses in-memory stores per chunk size (300 / 1000 / 3000) → Chroma untouched, no re-ingest, no LLM calls.

### ▶ Pick up here (home PC, Ollama)
1. `git pull` → `npm run check` (expect 58 pass / 7 fail).
2. Implement `runChunkingExperiment`: embed each question ONCE before the size loop; reuse `IngestService`
   with a fresh `deps.createStore()` per size; `store.query(vector, topK)`; `contextChars` = sum of hit text lengths.
3. Add 2 questions in `03-chunking.ts` (one needing two sections, one not in the docs). Predict, then `npm run chunking`.
   Note: on Ollama (embeddinggemma) scores are lower than Gemini (related ≈ 0.43–0.72) — compare within one model only.
4. Write 2–3 lines of conclusions in ROADMAP notes → `/review-step`.
