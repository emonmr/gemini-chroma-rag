# gemini-chroma-rag

A "chat with your documents" app (**RAG** — Retrieval-Augmented Generation) built to learn AI engineering hands-on.

**TypeScript · Google Gemini (free tier) or local models via Ollama · ChromaDB · ports & adapters architecture · 46 offline tests**

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

**You need:** Node.js 22+ (24 LTS recommended) · Docker Desktop · **one** of:
- a free Gemini API key from **https://aistudio.google.com/apikey**, or
- [Ollama](https://ollama.com) + a GPU with ~8 GB VRAM for fully local models (see [Choose your models](#choose-your-models-gemini-cloud-or-ollama-local))

```powershell
# 1. install
npm install
Copy-Item .env.example .env
notepad .env                      # Gemini: paste your key into GEMINI_API_KEY=
                                  # Ollama: set LLM_PROVIDER=ollama instead

# 2. start the vector database (Docker Desktop must be running)
npm run chroma:up                 # Chroma on http://localhost:8000

# 3. first contact with the APIs
npm run hello                     # first LLM call + streaming (Gemini only)
npm run embeddings                # see semantic similarity numbers (uses LLM_PROVIDER)

# 4. the RAG app
npm run ingest                    # chunk + embed + store data/docs
npm run ask -- "What does error E7 mean on the Brewer X2?"
npm run chat                      # multi-turn chat: /sources /clear /exit

# 5. tests (offline, free)
npm run check                     # typecheck + 46 tests
```

**No Docker?** Run Chroma with Python instead: `pip install chromadb` then `chroma run --path ./chroma-data` (keep that terminal open).

On macOS/Linux use `cp .env.example .env` instead of `Copy-Item`.

## Choose your models: Gemini (cloud) or Ollama (local)

One setting in `.env` decides which models the whole app uses:

| `LLM_PROVIDER=` | Chat model | Embedding model | Needs | Cost / limits |
|---|---|---|---|---|
| `gemini` *(default)* | `gemini-3.6-flash` | `gemini-embedding-2` | API key + internet | free tier, low rate limits and a daily quota |
| `ollama` | `qwen3:8b` | `embeddinggemma` | Ollama + ~8 GB VRAM GPU | free, no limits, nothing leaves your PC |

Nothing else changes. `src/container.ts` reads `LLM_PROVIDER` and wires the matching adapters; the RAG code never knows which one it got.

### Set up Ollama (one time)

```powershell
# install Ollama from https://ollama.com, then:
ollama pull embeddinggemma        # 0.6 GB, embeddings (768 dims)
ollama pull qwen3:8b              # 5.2 GB, chat (both fit in 8 GB VRAM)
```

In `.env`:

```env
LLM_PROVIDER=ollama
```

Then `npm run ingest` and `npm run ask -- "How many days of annual leave do I get?"`.
The first request after a while takes longer while the model loads into VRAM; then an RTX 3060 Ti answers at ~68 tokens/s.

### Switching

| I want to… | Do this |
|---|---|
| Switch for good | Change `LLM_PROVIDER` in `.env` and save |
| Switch for one command (PowerShell) | `$env:LLM_PROVIDER="gemini"; npm run ask -- "…"` (a shell variable beats `.env`; undo with `Remove-Item Env:LLM_PROVIDER`) |
| Check what's active | `npm run ingest` prints the embedding model and collection on its first lines |

> **The one rule: run `npm run ingest` once per provider.** Vectors from different embedding models can't be compared, so each provider gets its **own** Chroma collection:
> `docs-gemini-embedding-2-768` (Gemini) and `docs-embeddinggemma-768` (Ollama).
> Once both are filled you can switch back and forth freely. Re-ingest only when files in `data/docs` change.
> Changing a **chat** model never needs a re-ingest. Changing an **embedding** model always does.

### Using two PCs (e.g. Ollama at home, Gemini at the office)

`.env` is git-ignored, so **each PC keeps its own `.env`**. The code travels through git; the provider choice stays on each machine.

| | Home PC (has the GPU) | Office PC |
|---|---|---|
| `.env` | `LLM_PROVIDER=ollama` | `LLM_PROVIDER=gemini` + `GEMINI_API_KEY=…` |
| Needs Ollama? | yes (`ollama pull …` as above) | no |
| Needs an API key? | no | yes |

**First time on a PC:**

```powershell
git clone https://github.com/emonmr/gemini-chroma-rag.git   # or `git pull` if you already have it
cd gemini-chroma-rag
npm install
Copy-Item .env.example .env       # then edit LLM_PROVIDER (+ GEMINI_API_KEY for Gemini)
npm run chroma:up
npm run ingest                    # each PC has its own Chroma data in Docker; it is NOT synced
npm run check
```

**Every day:**

```
at home:     git pull → work → npm run check → git commit → git push
at office:   git pull → work → npm run check → git commit → git push
```

Re-run `npm run ingest` on a PC after `data/docs` changes.

Keep in mind:
- **Answers differ between the PCs.** Different models give different answers and use different similarity-score scales (embeddinggemma's top hits score ~0.55–0.65; Gemini's are higher). If something works at home but not at the office, check the provider first. A good `MIN_SCORE` for one model is wrong for the other.
- **Privacy:** at the office you're on the Gemini free tier, so don't put company or confidential documents in `data/docs` there (see **Free tier & privacy** at the bottom). The Ollama setup keeps everything on your PC.

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
  adapters/    gemini/  ollama/  chroma/  fs/  memory/   ← the only code that talks to SDKs / model APIs
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
| `LLM_PROVIDER` | `gemini` | `gemini` (cloud) or `ollama` (local) |
| `GEMINI_API_KEY` | — | required only when `LLM_PROVIDER=gemini` |
| `GEMINI_CHAT_MODEL` | `gemini-3.6-flash` | any free-tier text model from AI Studio |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-2` | `gemini-embedding-001` also supported |
| `OLLAMA_HOST` | `http://localhost:11434` | where Ollama listens |
| `OLLAMA_CHAT_MODEL` | `qwen3:8b` | any model you've pulled, e.g. `gemma4:e4b-it-qat` |
| `OLLAMA_EMBED_MODEL` | `embeddinggemma` | uses the same `title: … \| text: …` prompt format as gemini-embedding-2 |
| `EMBED_DIMENSIONS` | `768` | Gemini: 768 / 1536 / 3072 · embeddinggemma: 768 / 512 / 256 / 128 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `150` | characters |
| `TOP_K` / `MIN_SCORE` | `4` / `0` | how many chunks, minimum cosine similarity |

Changing the provider, embedding model or dimensions automatically uses a new Chroma collection — just run `npm run ingest` again.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `429` / `RESOURCE_EXHAUSTED` | Free-tier rate limit. The app retries with backoff; if it persists you've hit the daily quota — check limits in AI Studio. |
| `404` / model not found | Model names change often. Pick a current free-tier model in AI Studio and update `.env`. |
| `Could not open Chroma collection` | Chroma isn't running → `npm run chroma:up` (start Docker Desktop first). |
| Answers ignore your new files | Run `npm run ingest` again (or `npm run ingest:reset` to start clean). |
| `Could not reach Ollama at http://localhost:11434` | Ollama isn't running → start the Ollama app (or `ollama serve`). |
| `Ollama returned 404 … not found` | The model isn't downloaded → `ollama pull <model>` (check with `ollama list`). |
| `GEMINI_API_KEY: missing` | You're on `LLM_PROVIDER=gemini` without a key → add the key, or set `LLM_PROVIDER=ollama`. |
| Empty / bad answers after switching provider | That provider's collection is empty → `npm run ingest` once for it. |
| Ollama is very slow | Check `ollama ps`: `PROCESSOR` should say `100% GPU`. If it shows CPU, the model doesn't fit in VRAM → use a smaller model. |

## ⚠️ Free tier & privacy

On the Gemini API free tier, Google may use your prompts and responses to improve its products. **Don't ingest private, confidential or customer documents** until you switch to a paid key or to local models with `LLM_PROVIDER=ollama`.
