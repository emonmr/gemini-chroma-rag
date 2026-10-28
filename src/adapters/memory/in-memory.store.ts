/**
 * ADAPTER: VectorStore kept in a JS array — brute-force cosine search.
 *
 * Used by the tests, and a great way to see that a "vector database" is, at its
 * core, just "compare the query vector with every stored vector and sort".
 * Chroma does the same thing, but with an index (HNSW) so it scales to millions.
 */
import type { VectorStore } from "../../core/ports";
import type { Chunk, RetrievedChunk } from "../../core/types";
import { cosineSimilarity } from "../../shared/vector";

interface StoredRecord {
  chunk: Chunk;
  embedding: number[];
}

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, StoredRecord>();

  async upsert(chunks: Chunk[], embeddings: number[][]): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(`upsert: ${chunks.length} chunks but ${embeddings.length} embeddings`);
    }
    chunks.forEach((chunk, i) => this.records.set(chunk.id, { chunk, embedding: embeddings[i]! }));
  }

  async query(embedding: number[], topK: number): Promise<RetrievedChunk[]> {
    return [...this.records.values()]
      .map(({ chunk, embedding: stored }) => ({ ...chunk, score: cosineSimilarity(embedding, stored) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteBySource(source: string): Promise<void> {
    for (const [id, record] of this.records) {
      if (record.chunk.metadata.source === source) this.records.delete(id);
    }
  }

  async count(): Promise<number> {
    return this.records.size;
  }

  async reset(): Promise<void> {
    this.records.clear();
  }
}
