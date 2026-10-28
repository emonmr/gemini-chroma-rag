/**
 * COMPOSITION ROOT — the one place where concrete classes are chosen and wired.
 * (.NET analogy: Program.cs / Startup.ConfigureServices.)
 *
 * Want local models instead of Gemini? Write an OllamaEmbedder + OllamaChatModel
 * implementing the ports and swap them in HERE. Nothing else changes.
 */
import { GoogleGenAI } from "@google/genai";
import { ChromaClient } from "chromadb";
import { FileSystemLoader } from "./adapters/fs/file.loader";
import { ChromaVectorStore } from "./adapters/chroma/chroma.store";
import { GeminiChatModel } from "./adapters/gemini/gemini.chat";
import { GeminiEmbedder } from "./adapters/gemini/gemini.embedder";
import { loadEnv, type Env } from "./config/env";
import { AskService } from "./rag/ask.service";
import { IngestService } from "./rag/ingest.service";

export function createContainer(env: Env = loadEnv()) {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const chroma = new ChromaClient({ host: env.CHROMA_HOST, port: env.CHROMA_PORT });

  const embedder = new GeminiEmbedder(ai, env.GEMINI_EMBED_MODEL, env.EMBED_DIMENSIONS);
  const chat = new GeminiChatModel(ai, env.GEMINI_CHAT_MODEL);
  const store = new ChromaVectorStore(chroma, collectionName(env), `${env.CHROMA_HOST}:${env.CHROMA_PORT}`);
  const loader = new FileSystemLoader(env.DOCS_DIR);

  return {
    env,
    ai,
    embedder,
    chat,
    store,
    collection: collectionName(env),
    ingest: new IngestService(
      { loader, embedder, store },
      { chunkSize: env.CHUNK_SIZE, chunkOverlap: env.CHUNK_OVERLAP },
    ),
    ask: new AskService({ embedder, store, chat }, { topK: env.TOP_K, minScore: env.MIN_SCORE }),
  };
}

export type Container = ReturnType<typeof createContainer>;

/**
 * Vectors from different embedding models (or sizes) are NOT comparable, so the
 * model + dimensions are part of the collection name, e.g. "docs-gemini-embedding-2-768".
 * Change models → you automatically get a fresh collection (just run `npm run ingest`).
 */
export function collectionName(env: Pick<Env, "CHROMA_COLLECTION" | "GEMINI_EMBED_MODEL" | "EMBED_DIMENSIONS">): string {
  return `${env.CHROMA_COLLECTION}-${env.GEMINI_EMBED_MODEL}-${env.EMBED_DIMENSIONS}`.replace(/[^a-zA-Z0-9._-]/g, "-");
}
