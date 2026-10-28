# CLAUDE.md

Context for Claude Code. Read this before every task in this repo.

## What this project is

A "chat with your documents" **RAG** app, built to **learn AI engineering by doing** and to become a CV portfolio project.

- **Stack:** TypeScript (Node ≥ 22, ESM, run with `tsx`), Google Gemini via `@google/genai` (free tier), ChromaDB (local server in Docker, JS client v3), `zod` for config.
- **Learner:** an experienced web developer (≈13 years JavaScript; also C#/.NET Web API, Angular, PHP, MySQL) moving into AI engineering. No need to explain JS/TS basics. **Do** explain AI concepts (embeddings, chunking, retrieval, prompting, evals, agents) and map them to things he already knows (.NET DI, interfaces, middleware, SQL indexes…).
- **Progress tracker:** [docs/ROADMAP.md](docs/ROADMAP.md) — tick `- [x]` when a step is done.
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

```bash
npm run chroma:up        # start Chroma (Docker) on :8000
npm run hello            # lesson 1: first Gemini call
npm run embeddings       # lesson 2: similarity matrix
npm run ingest           # index data/docs → Chroma
npm run ingest:reset     # wipe the collection, then index (PowerShell can swallow `--`, so use this script)
npm run ask -- "question"
npm run chat             # multi-turn REPL (/sources, /clear, /exit)
npm test                 # node:test via tsx — offline, no API calls
npm run typecheck
npm run check            # typecheck + tests — run before saying a task is done
```

## Architecture rules (ports & adapters)

```
src/core      types + port interfaces            → imports NOTHING outside core
src/rag       chunker, prompts, Ingest/AskService → imports core + shared only
src/adapters  Gemini, Chroma, file system, memory → the ONLY place SDKs are imported
src/shared    retry, vector math                  → pure helpers
src/container.ts  composition root: picks adapters, wires services (like Program.cs)
src/cli, src/playground  entry points             → use container / adapters
```

- Never import `@google/genai` or `chromadb` outside `src/adapters/**` (and `container.ts` / `src/playground`).
- New provider (Ollama, Claude, OpenAI…) = new adapter implementing an existing port + one change in `container.ts`.
- RAG logic must stay testable with the fakes in `tests/fakes.ts`. Tests never call real APIs.
- Strict TS: `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type`), extensionless relative imports.
- Config only via `src/config/env.ts` (zod-validated). Add new settings there AND in `.env.example`.

## Gotchas (don't reintroduce these bugs)

- `gemini-embedding-2` has **no `taskType`** — the task goes in the text (`title: … | text: …` for docs, `task: question answering | query: …` for queries). See `GeminiEmbedder`.
- `gemini-embedding-2` **aggregates** a list of plain strings into ONE vector. Wrap each text in its own `{ parts: [{ text }] }` Content to get one vector each. The embedder asserts the count.
- Vectors from different embedding models/dimensions are not comparable. The Chroma collection name includes model + dims; changing them means re-ingesting.
- Gemini 3.x: leave `temperature` at the model default unless there is a reason.
- Free tier: low RPM limits (expect 429s → `withRetry`), and Google may use free-tier prompts to improve its products. **Never ingest private or confidential documents** while on the free tier.
- Model names change fast. They live in `.env`, never hard-code them elsewhere.

## How to help — LEARNING MODE (default)

The goal is that **he** learns, not that the code appears. Unless he says "just do it":

1. When he starts a roadmap step (or runs `/next-step`), first explain the concept in ≤ 10 lines with a .NET/JS analogy, then create a **scaffold**: new files with signatures, types and `// TODO:` comments, plus a **failing test file** in `tests/` that defines "done". Do NOT write the implementation.
2. Give hints in increasing detail when he's stuck; show full code only when he asks for it.
3. When he says he's done (or runs `/review-step`): run `npm run check`, review like a senior AI engineer (correctness, edge cases, cost/latency, prompt quality), suggest one stretch goal, and tick the step in `docs/ROADMAP.md`.
4. Prefer small, runnable increments. Always say which command to run to see the result.
5. When an API detail may have changed (model names, SDK options, Chroma API), check the official docs instead of guessing.

For normal non-learning tasks (fix a bug, refactor, set something up) just do the work, then explain briefly what changed and why.
