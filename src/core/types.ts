/**
 * Domain types — plain data, no SDK imports.
 * Think of these as your DTOs / domain models in a .NET project.
 */

/** A whole file as loaded from disk (or a URL, a DB row, a PDF page…). */
export interface SourceDocument {
  /** Stable id, e.g. the relative file path "handbook/leave-policy.md". */
  id: string;
  /** Where it came from — shown to the user as a citation. */
  source: string;
  title: string;
  text: string;
}

/**
 * Metadata stored next to each vector in the database.
 * A `type` (not `interface`) so it is assignable to Chroma's Record-based metadata type.
 */
export type ChunkMetadata = {
  source: string;
  title: string;
  chunkIndex: number;
};

/** A small piece of a document — the unit we embed, store and retrieve. */
export interface Chunk {
  /** Deterministic: `${documentId}#${chunkIndex}` so re-ingesting overwrites. */
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

/** A chunk returned by a similarity search. */
export interface RetrievedChunk extends Chunk {
  /** Cosine similarity: 1 = same meaning, ~0 = unrelated. */
  score: number;
}

/** Gemini calls the assistant role "model". */
export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export interface Answer {
  text: string;
  sources: RetrievedChunk[];
}
