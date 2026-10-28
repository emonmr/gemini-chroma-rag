# gemini-chroma-rag

A "chat with your documents" app (**RAG** — Retrieval-Augmented Generation) built to learn AI engineering hands-on.

**TypeScript · Google Gemini (free tier) · ChromaDB · ports & adapters architecture · 36 offline tests**

```
# example
you › How many days of annual leave do I get?
ai  › Full-time employees get 22 days of paid annual leave per year, and up to 5 unused days
      can be carried over until 31 March [1].
  [1] handbook/leave-policy.md · chunk 0 · score 0.712
```

The sample docs in `data/docs` describe a *fictional* company ("Nimbus Coffee Co."), so a correct answer proves it came from retrieval, not from the model's training data.

---

## Quick start (Windows / PowerShell)

**You need:** Node.js 22+ (24 LTS recommended) · Docker Desktop · a free Gemini API key from **https://aistudio.google.com/apikey**

```powershell
# 1. install
npm install
Copy-Item .env.example .env
notepad .env                      # paste your key into GEMINI_API_KEY=

# 2. start the vector database (Docker Desktop must be running)
npm run chroma:up                 # Chroma on http://localhost:8000

# 3. first contact with the APIs
npm run hello                     # first LLM call + streaming
npm run embeddings                # see semantic similarity numbers

# 4. the RAG app
npm run ingest                    # chunk + embed + store data/docs
npm run ask -- "What does error E7 mean on the Brewer X2?"
npm run chat                      # multi-turn chat: /sources /clear /exit

# 5. tests (offline, free)
npm run check                     # typecheck + 36 tests
```

**No Docker?** Run Chroma with Python instead: `pip install chromadb` then `chroma run --path ./chroma-data` (keep that terminal open).

On macOS/Linux use `cp .env.example .env` instead of `Copy-Item`.

## Learn with Claude Code

Open the folder in VS Code, start Claude Code, and:

- `/next-step` — starts the next lesson from [docs/ROADMAP.md](docs/ROADMAP.md): a short concept explanation, a scaffold with `// TODO`s and failing tests. **You** write the code.
- `/review-step` — runs the checks, reviews your code like a senior AI engineer and ticks off the step.

`CLAUDE.md` tells Claude about the architecture rules, the known gotchas and that you're in learning mode.

## Project layout

```
src/
  core/        types.ts, ports.ts (interfaces)       ← the heart, no dependencies
  rag/         chunker, prompt, IngestService, AskService
  adapters/    gemini/  chroma/  fs/  memory/       ← the only code that touches SDKs
  shared/      retry (429 backoff), vector math
  config/      env.ts (zod-validated .env)
  container.ts composition root (wires adapters → services)
  cli/         ingest, ask, chat
  playground/  01-hello-gemini, 02-embeddings
tests/         node:test + fakes — whole pipeline runs offline
data/docs/     sample documents (replace with your own)
docs/          ARCHITECTURE.md, ROADMAP.md
```

Details and diagrams: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Configuration (.env)

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | required |
| `GEMINI_CHAT_MODEL` | `gemini-3.6-flash` | any free-tier text model from AI Studio |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-2` | `gemini-embedding-001` also supported |
| `EMBED_DIMENSIONS` | `768` | 768 / 1536 / 3072 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `150` | characters |
| `TOP_K` / `MIN_SCORE` | `4` / `0` | how many chunks, minimum cosine similarity |

Changing the embedding model or dimensions automatically uses a new Chroma collection — just run `npm run ingest` again.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `429` / `RESOURCE_EXHAUSTED` | Free-tier rate limit. The app retries with backoff; if it persists you've hit the daily quota — check limits in AI Studio. |
| `404` / model not found | Model names change often. Pick a current free-tier model in AI Studio and update `.env`. |
| `Could not open Chroma collection` | Chroma isn't running → `npm run chroma:up` (start Docker Desktop first). |
| Answers ignore your new files | Run `npm run ingest` again (or `npm run ingest:reset` to start clean). |

## ⚠️ Free tier & privacy

On the Gemini API free tier, Google may use your prompts and responses to improve its products. **Don't ingest private, confidential or customer documents** until you switch to a paid key or a local model (roadmap step 6.1).
