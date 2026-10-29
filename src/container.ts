/**
 * COMPOSITION ROOT — the one place where concrete classes are chosen and wired.
 * (.NET analogy: Program.cs / Startup.ConfigureServices.)
 *
 * LLM_PROVIDER picks the adapters (Gemini in the cloud, or Ollama on your GPU).
 * The RAG services below never know which one they got.
 */
import { GoogleGenAI } from "@google/genai";
import { ChromaClient } from "chromadb";
import { FileSystemLoader } from "./adapters/fs/file.loader";
import { ChromaVectorStore } from "./adapters/chroma/chroma.store";
import { GeminiChatModel } from "./adapters/gemini/gemini.chat";
import { GeminiEmbedder } from "./adapters/gemini/gemini.embedder";
import { OllamaChatModel } from "./adapters/ollama/ollama.chat";
import { OllamaEmbedder } from "./adapters/ollama/ollama.embedder";
import { loadEnv, type Env } from "./config/env";
import type { ChatModel, Embedder } from "./core/ports";
import { AskService } from "./rag/ask.service";
import { IngestService } from "./rag/ingest.service";

export function createContainer(env: Env = loadEnv()) {
  const chroma = new ChromaClient({ host: env.CHROMA_HOST, port: env.CHROMA_PORT });
  const { embedder, chat } = createModels(env);

  const collection = collectionName(env, embedder.modelId);
  const store = new ChromaVectorStore(chroma, collection, `${env.CHROMA_HOST}:${env.CHROMA_PORT}`);
  const loader = new FileSystemLoader(env.DOCS_DIR);

  return {
    env,
    embedder,
    chat,
    store,
    collection,
    ingest: new IngestService(
      { loader, embedder, store },
      { chunkSize: env.CHUNK_SIZE, chunkOverlap: env.CHUNK_OVERLAP },
    ),
    ask: new AskService({ embedder, store, chat }, { topK: env.TOP_K, minScore: env.MIN_SCORE }),
  };
}

export type Container = ReturnType<typeof createContainer>;

/** Picks the embedder + chat model for LLM_PROVIDER (like registering one of two implementations in DI). */
export function createModels(env: Env): { embedder: Embedder; chat: ChatModel } {
  if (env.LLM_PROVIDER === "ollama") {
    return {
      embedder: new OllamaEmbedder(env.OLLAMA_HOST, env.OLLAMA_EMBED_MODEL, env.EMBED_DIMENSIONS),
      chat: new OllamaChatModel(env.OLLAMA_HOST, env.OLLAMA_CHAT_MODEL),
    };
  }
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return {
    embedder: new GeminiEmbedder(ai, env.GEMINI_EMBED_MODEL, env.EMBED_DIMENSIONS),
    chat: new GeminiChatModel(ai, env.GEMINI_CHAT_MODEL),
  };
}

/**
 * Vectors from different embedding models (or sizes) are NOT comparable, so the
 * model + dimensions are part of the collection name, e.g. "docs-gemini-embedding-2-768"
 * or "docs-embeddinggemma-768". Change models → you automatically get a fresh
 * collection (just run `npm run ingest`).
 */
export function collectionName(env: Pick<Env, "CHROMA_COLLECTION" | "EMBED_DIMENSIONS">, embedModel: string): string {
  return `${env.CHROMA_COLLECTION}-${embedModel}-${env.EMBED_DIMENSIONS}`.replace(/[^a-zA-Z0-9._-]/g, "-");
}
