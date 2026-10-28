/**
 * INGESTION PIPELINE (the "indexing" half of RAG):
 *   load files → chunk → embed → store
 *
 * Runs offline / ahead of time. Re-running it is safe: chunk ids are
 * deterministic and old chunks of a file are deleted first.
 */
import type { DocumentLoader, Embedder, VectorStore } from "../core/ports";
import { chunkDocument, type ChunkOptions } from "./chunker";

export interface IngestDeps {
  loader: DocumentLoader;
  embedder: Embedder;
  store: VectorStore;
}

export interface IngestReport {
  documents: number;
  chunks: number;
  totalInStore: number;
}

export class IngestService {
  private readonly deps: IngestDeps;
  private readonly chunkOptions: ChunkOptions;

  constructor(deps: IngestDeps, chunkOptions: ChunkOptions) {
    this.deps = deps;
    this.chunkOptions = chunkOptions;
  }

  async run(options: { reset?: boolean; onProgress?: (message: string) => void } = {}): Promise<IngestReport> {
    const { loader, embedder, store } = this.deps;
    const log = options.onProgress ?? (() => {});

    if (options.reset) {
      await store.reset();
      log("Collection reset.");
    }

    const documents = await loader.load();
    log(`Found ${documents.length} document(s).`);

    let chunkCount = 0;
    for (const doc of documents) {
      const chunks = chunkDocument(doc, this.chunkOptions);
      if (chunks.length === 0) {
        log(`  – ${doc.source}: empty, skipped`);
        continue;
      }

      const embeddings = await embedder.embedDocuments(
        chunks.map((c) => ({ title: c.metadata.title, text: c.text })),
      );
      await store.deleteBySource(doc.source);
      await store.upsert(chunks, embeddings);

      chunkCount += chunks.length;
      log(`  ✓ ${doc.source} → ${chunks.length} chunk(s)`);
    }

    return { documents: documents.length, chunks: chunkCount, totalInStore: await store.count() };
  }
}
