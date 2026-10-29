# Learning roadmap

Each step = one concept + something you build. In Claude Code run `/next-step` to start the next unchecked step (you get a scaffold + failing tests, not the answer) and `/review-step` when you're done.

Rule of thumb: **read → run → break it → build the next piece.**

---

## Phase 0 — Setup & first contact (½ day)

- [x] **0.1 Run it.** Follow the README quick start until `npm run chat` answers "How many days of annual leave do I get?" with a citation.
- [ ] **0.2 Your first LLM call.** Run `npm run hello`, then edit `src/playground/01-hello-gemini.ts`: change the system instruction, print `usageMetadata`, ask about the fictional "Nimbus Coffee" leave policy *without* RAG and watch it invent an answer (hallucination).
- [ ] **0.3 See embeddings.** Run `npm run embeddings`. Add your own sentences (Bangla + English, a typo, an unrelated sentence). Write down: what score means "related" for this model?

## Phase 1 — Understand the RAG pipeline (1–2 days)

Read the code in this order: `core/ports.ts` → `rag/chunker.ts` → `rag/ingest.service.ts` → `rag/ask.service.ts` → `rag/prompt.ts` → `adapters/*`.

- [ ] **1.1 Trace a question.** Add an `npm run ask:debug` script (a `--debug` flag on `src/cli/ask.ts`) that prints the retrieved chunks and the full prompt sent to Gemini. *Done when* you can explain every line of that prompt.
- [ ] **1.2 Chunking experiments.** Re-ingest with `CHUNK_SIZE` 300 / 1000 / 3000 and compare answers to the same 5 questions. Write your conclusions at the bottom of this file.
- [ ] **1.3 Add your own documents.** Put public docs you know well (e.g. docs of a library you use) in `data/docs` and chat with them. Find 3 questions it answers badly — keep them for Phase 3.
- [ ] **1.4 Markdown-aware chunking.** Split on `#`/`##` headings first and store the section heading in metadata; prepend it to each chunk's text before embedding. Compare retrieval with 1.2.

## Phase 2 — Better retrieval (2–3 days)

- [ ] **2.1 Score threshold.** Tune `MIN_SCORE` so off-topic questions retrieve nothing, and make the bot say it can't find the answer *without* calling the LLM when nothing passes the threshold (saves cost).
- [ ] **2.2 Metadata filters.** Add `where` support to the `VectorStore` port (e.g. only `products/`), implement it in the Chroma and in-memory adapters, and expose it as `--source` in the CLI.
- [ ] **2.3 Query rewriting for follow-ups.** "What about the warranty?" retrieves badly because it lacks context. Use the chat history + a small LLM call to rewrite the follow-up into a standalone question before embedding.
- [ ] **2.4 LLM re-ranking.** Retrieve top 10, ask Gemini to score each chunk's relevance with **structured output** (JSON schema), keep the best 3. Measure the extra latency and cost.
- [ ] **2.5 Hybrid search.** Combine vector search with keyword matching (Chroma `whereDocument: { $contains }` or your own BM25) — helps with exact terms like error codes ("E7").

## Phase 3 — Evaluation: the skill that separates AI engineers from prompt tinkerers (2–3 days)

- [ ] **3.1 Golden dataset.** Create `eval/questions.json`: 20+ questions with the expected source file and a short expected answer (include "not in the docs" questions).
- [ ] **3.2 Retrieval metrics.** `npm run eval:retrieval` → hit rate@k and MRR. Use it to compare the chunking/retrieval changes from Phases 1–2 with numbers, not vibes.
- [ ] **3.3 Answer quality (LLM-as-judge).** Ask Gemini to grade each answer for *faithfulness* (only uses context) and *correctness* vs. the expected answer. Store results as a dated JSON report.
- [ ] **3.4 Prompt versioning.** Change the system prompt, re-run the eval, and keep the better version. Track token usage per run.

## Phase 4 — Structured output, tools & agents (3–4 days)

- [ ] **4.1 Structured answers.** Return `{ answer, citations: [{ source, quote }], confidence }` using Gemini structured output with a zod schema. Validate it with zod.
- [ ] **4.2 Function calling.** Give the model a `search_docs(query, source?)` tool instead of always retrieving first. Let it decide when and how often to search (agentic RAG).
- [ ] **4.3 A second tool.** e.g. `calculate_leave_days(startDate, endDate)` — see how the model combines tools and retrieved knowledge.
- [ ] **4.4 Guardrails.** Detect prompt-injection text inside documents ("ignore previous instructions…"), cap the number of tool calls, and handle refusals.

## Phase 5 — Ship it as a product (3–5 days) — your portfolio piece

- [ ] **5.1 HTTP API.** Add `src/server` (Hono or Express): `POST /api/ingest`, `POST /api/ask`, `POST /api/chat` with **SSE streaming**. Reuse the same `AskService` — this is where the architecture pays off.
- [ ] **5.2 File upload.** Upload `.md/.txt/.pdf` through the API; add a `PdfLoader` adapter.
- [ ] **5.3 Angular front end.** Chat UI with streaming tokens, clickable citations and a sources panel.
- [ ] **5.4 Observability.** Log per request: latency, tokens in/out, estimated cost, retrieved chunk ids. Add a `/api/stats` endpoint.
- [ ] **5.5 Docker & deploy.** One `docker compose up` for API + Chroma + UI. Write the README for recruiters: problem, architecture diagram, eval numbers, demo GIF.

## Phase 6 — Swap the models (1–2 days each)

- [ ] **6.1 Local models.** Implement `OllamaEmbedder` + `OllamaChatModel` (Qwen + nomic-embed-text) behind the same ports; pick the provider via `.env`. Run the Phase 3 eval on both and compare quality, speed and cost.
- [ ] **6.2 Claude.** Add a `ClaudeChatModel` adapter (Anthropic API) and compare it in the eval.
- [ ] **6.3 Write it up.** A short blog post / LinkedIn post: "What I learned comparing Gemini, Qwen and Claude on my own RAG eval".

---

## My notes & conclusions

<!-- Write what you learned after each step. Future you (and interviewers) will love this. -->
- [ ] today i just setup project and hit some command from readme file . just saw how vector database works and how to get gemini api
