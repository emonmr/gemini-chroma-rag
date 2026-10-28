/**
 * PORTS — the interfaces the app depends on.
 *
 * .NET analogy: these are your `IEmbedder`, `IChatModel`, `IVectorStore` interfaces.
 * The RAG logic (src/rag) only ever talks to these. The concrete classes that call
 * Gemini / Chroma (src/adapters) implement them, and src/container.ts wires them up
 * like `builder.Services.AddSingleton<IEmbedder, GeminiEmbedder>()` would.
 *
 * Payoff: swap Gemini → Ollama (local Qwen) → Claude by writing ONE new adapter,
 * and test the whole pipeline offline with fakes (see tests/).
 */
import type { ChatMessage, Chunk, RetrievedChunk, SourceDocument } from "./types";

/** Turns text into vectors. */
export interface Embedder {
  readonly modelId: string;
  readonly dimensions: number;
  /** Embeds chunks for storage. Returns one vector per input, same order. */
  embedDocuments(docs: { title: string; text: string }[]): Promise<number[][]>;
  /** Embeds a user question for searching. */
  embedQuery(query: string): Promise<number[]>;
}

export interface GenerateRequest {
  /** System instruction: the rules the model must follow. */
  system: string;
  /** Conversation so far; the last message is the new user turn. */
  messages: ChatMessage[];
  /** Leave undefined to use the model's default (recommended for Gemini 3.x). */
  temperature?: number;
}

/** Generates text from a conversation. */
export interface ChatModel {
  readonly modelId: string;
  generate(request: GenerateRequest): Promise<string>;
  /** Yields text deltas as they arrive (for a "typing" UI). */
  stream(request: GenerateRequest): AsyncIterable<string>;
}

/** Stores vectors + text + metadata and finds the nearest neighbours. */
export interface VectorStore {
  upsert(chunks: Chunk[], embeddings: number[][]): Promise<void>;
  query(embedding: number[], topK: number): Promise<RetrievedChunk[]>;
  /** Removes every chunk from one source file (so re-ingesting a shorter file leaves no leftovers). */
  deleteBySource(source: string): Promise<void>;
  count(): Promise<number>;
  /** Deletes everything in this collection. */
  reset(): Promise<void>;
}

/** Loads raw documents from somewhere. */
export interface DocumentLoader {
  load(): Promise<SourceDocument[]>;
}
