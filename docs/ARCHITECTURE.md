# Architecture

**Ports & adapters** (a.k.a. hexagonal / clean architecture): the RAG logic in the middle depends only on interfaces; everything that talks to the outside world (Gemini, Chroma, disk) is a replaceable adapter at the edge.

```
                         ┌──────────────────────────────────────────┐
  npm run ingest/ask ──▶ │ cli / playground / (later) HTTP server   │  entry points
                         └───────────────────┬──────────────────────┘
                                             │ createContainer()
                         ┌───────────────────▼──────────────────────┐
                         │ container.ts  (composition root / DI)    │
                         └───────────────────┬──────────────────────┘
                         ┌───────────────────▼──────────────────────┐
                         │ rag/  IngestService · AskService          │  application logic
                         │       chunker · prompt (pure functions)   │  (no SDK imports)
                         └───────────────────┬──────────────────────┘
                                             │ depends on
                         ┌───────────────────▼──────────────────────┐
                         │ core/ ports.ts: Embedder · ChatModel ·    │  interfaces + types
                         │       VectorStore · DocumentLoader        │
                         └───────────────────▲──────────────────────┘
                                             │ implemented by
     ┌──────────────────┬────────────────────┼───────────────────┬──────────────────┐
     │ GeminiEmbedder   │ GeminiChatModel    │ ChromaVectorStore │ FileSystemLoader │  adapters/
     │ (@google/genai)  │ (@google/genai)    │ (chromadb)        │ (node:fs)        │
     └──────────────────┴────────────────────┴───────────────────┴──────────────────┘
       + InMemoryVectorStore (tests)   + later: Ollama*, Claude*, PdfLoader, …
```

## The two pipelines

**Ingest (offline, ahead of time)**

```
data/docs/*.md ─▶ FileSystemLoader ─▶ chunkDocument() ─▶ GeminiEmbedder.embedDocuments() ─▶ ChromaVectorStore.upsert()
                                       ~1000 chars          768-dim vectors, task-prefixed     id = "file.md#3", + metadata
```

**Ask (per question, online)**

```
question ─▶ embedQuery() ─▶ store.query(topK) ─▶ filter minScore ─▶ buildUserPrompt() ─▶ GeminiChatModel.stream() ─▶ answer + [1][2] citations
```

## .NET mapping

| Here | .NET equivalent |
|---|---|
| `core/ports.ts` interfaces | `IEmbedder`, `IVectorStore` in a Domain/Application project |
| `adapters/*` classes | Infrastructure project implementations |
| `container.ts` | `Program.cs` service registrations |
| `config/env.ts` (zod) | `IOptions<T>` + validation |
| `shared/retry.ts` | Polly retry policy |
| `tests/fakes.ts` | Hand-written fakes / Moq |
| Chroma collection | A table with a vector index (HNSW ≈ a B-tree for "nearest" instead of "equal") |

## Why these choices

- **Bring-your-own embeddings** (`embeddingFunction: null` in Chroma): the embedding model is explicit, swappable and testable instead of hidden inside the DB client.
- **Model + dimensions in the collection name**: vectors from different models are incomparable, so switching models can never silently mix them.
- **Deterministic chunk ids + delete-by-source**: re-ingesting is idempotent, edited files leave no stale chunks.
- **Streaming events (`sources` then `delta`)**: the same `AskService.askStream()` will drive the CLI today and an SSE endpoint + Angular UI later.
- **node:test + fakes**: the whole pipeline is tested offline in ~1 s, no API quota used.
