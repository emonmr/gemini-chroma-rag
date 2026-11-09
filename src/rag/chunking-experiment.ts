/**
 * STEP 1.2 — CHUNKING EXPERIMENT
 *
 * Index the same documents with several chunk sizes and ask the same questions against
 * each index, so you can compare RETRIEVAL side by side (which chunks come back, scores,
 * how much text you'd paste into the prompt).
 *
 * Each chunk size gets its OWN fresh store (from `createStore`), so the runs can't mix.
 * .NET analogy: injecting a Func<IVectorStore> factory instead of one IVectorStore instance.
 */
import type { DocumentLoader, Embedder, VectorStore } from "../core/ports";
import type { RetrievedChunk } from "../core/types";

export interface ChunkingExperimentDeps {
  loader: DocumentLoader;
  embedder: Embedder;
  /** Called once per chunk size → a new, empty store for that run. */
  createStore: () => VectorStore;
}

export interface ChunkingExperimentOptions {
  chunkSizes: number[];
  /** Overlap as a fraction of the chunk size, e.g. 0.15 → size 300 gets overlap 45. */
  overlapRatio: number;
  questions: string[];
  topK: number;
}

export interface QuestionResult {
  question: string;
  /** The top-k chunks for this question, best first. */
  hits: RetrievedChunk[];
  /** Total characters of all hits = how much context you'd paste into the prompt (≈ tokens × 4). */
  contextChars: number;
}

export interface ChunkingExperimentRow {
  chunkSize: number;
  chunkOverlap: number;
  /** How many chunks this size produced over all documents. */
  chunkCount: number;
  /** One entry per question, in the same order as `options.questions`. */
  results: QuestionResult[];
}

export async function runChunkingExperiment(
  deps: ChunkingExperimentDeps,
  options: ChunkingExperimentOptions,
): Promise<ChunkingExperimentRow[]> {
  // TODO (step 1.2):
  // 1. Embed every question ONCE, before the loop over chunk sizes.
  //    Why? A question's vector does not depend on the chunk size. Embedding it again for
  //    every size wastes API calls (free-tier quota!) and time. A test counts the calls.
  //
  // 2. For each chunk size (keep the order of options.chunkSizes):
  //    a. chunkOverlap = Math.round(chunkSize * options.overlapRatio)
  //    b. store = deps.createStore()  → a fresh, empty store for this size
  //    c. index the documents into it. Don't rewrite chunk → embed → store yourself:
  //       IngestService already does exactly that (look at its constructor + run()).
  //       Its report tells you how many chunks were created.
  //    d. for each question vector: store.query(vector, options.topK)
  //       → QuestionResult { question, hits, contextChars: sum of hit.text.length }
  //
  // 3. Return one ChunkingExperimentRow per chunk size.
  void deps;
  void options;
  throw new Error("TODO (step 1.2): implement runChunkingExperiment");
}
