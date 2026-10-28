/**
 * ADAPTER: VectorStore → ChromaDB (JS client v3, talking to the Chroma server).
 *
 * We compute embeddings ourselves with Gemini and hand Chroma plain vectors
 * (`embeddingFunction: null`). That keeps the embedding model swappable and
 * visible instead of hidden inside the database client.
 */
import type { ChromaClient } from "chromadb";
import type { VectorStore } from "../../core/ports";
import type { Chunk, ChunkMetadata, RetrievedChunk } from "../../core/types";

type Collection = Awaited<ReturnType<ChromaClient["getOrCreateCollection"]>>;

export class ChromaVectorStore implements VectorStore {
  private readonly client: ChromaClient;
  private readonly collectionName: string;
  private readonly location: string;
  private collection: Collection | undefined;

  constructor(client: ChromaClient, collectionName: string, location = "Chroma") {
    this.client = client;
    this.collectionName = collectionName;
    this.location = location;
  }

  private async getCollection(): Promise<Collection> {
    if (this.collection) return this.collection;
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        embeddingFunction: null, // we bring our own vectors
        configuration: { hnsw: { space: "cosine" } }, // distance = 1 - cosine similarity
      });
      return this.collection;
    } catch (error) {
      throw new Error(
        `Could not open Chroma collection "${this.collectionName}" at ${this.location}. ` +
          `Is the Chroma server running? Try: npm run chroma:up`,
        { cause: error },
      );
    }
  }

  async upsert(chunks: Chunk[], embeddings: number[][]): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(`upsert: ${chunks.length} chunks but ${embeddings.length} embeddings`);
    }
    if (chunks.length === 0) return;

    const collection = await this.getCollection();
    await collection.upsert({
      ids: chunks.map((c) => c.id),
      embeddings,
      documents: chunks.map((c) => c.text),
      metadatas: chunks.map((c) => ({ ...c.metadata })),
    });
  }

  async query(embedding: number[], topK: number): Promise<RetrievedChunk[]> {
    const collection = await this.getCollection();
    const result = await collection.query({ queryEmbeddings: [embedding], nResults: topK });

    // Results are batched per query embedding; we sent one, so take batch [0].
    const rows = result.rows()[0] ?? [];
    return rows.map((row) => ({
      id: row.id,
      text: row.document ?? "",
      metadata: toChunkMetadata(row.metadata),
      score: 1 - (row.distance ?? 1),
    }));
  }

  async deleteBySource(source: string): Promise<void> {
    const collection = await this.getCollection();
    await collection.delete({ where: { source } });
  }

  async count(): Promise<number> {
    const collection = await this.getCollection();
    return collection.count();
  }

  async reset(): Promise<void> {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
    } catch {
      // Collection didn't exist yet — nothing to reset.
    }
    this.collection = undefined;
  }
}

function toChunkMetadata(raw: Record<string, unknown> | null | undefined): ChunkMetadata {
  return {
    source: String(raw?.["source"] ?? "unknown"),
    title: String(raw?.["title"] ?? ""),
    chunkIndex: Number(raw?.["chunkIndex"] ?? 0),
  };
}
