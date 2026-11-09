/**
 * LESSON 3 — chunk size experiment.  Run: npm run chunking
 *
 * Indexes data/docs with 3 chunk sizes into in-memory stores (Chroma is not touched,
 * nothing to reset) and shows what retrieval returns for the same questions.
 * Cost: one embedding call per document per size + one per question. No chat/LLM calls.
 */
import { FileSystemLoader } from "../adapters/fs/file.loader";
import { InMemoryVectorStore } from "../adapters/memory/in-memory.store";
import { handleCliError } from "../cli/shared";
import { loadEnv } from "../config/env";
import { createModels } from "../container";
import { runChunkingExperiment } from "../rag/chunking-experiment";

const CHUNK_SIZES = [300, 1000, 3000];

const QUESTIONS = [
  "How many days of annual leave do I get?", // one fact, one place
  "What does error E7 mean?", // one small section inside a long FAQ
  "Can I work from another country, and for how long?", // fact in the middle of a section
  // TODO (step 1.2): add 2 questions of your own — PREDICT the winning size before you run:
  // TODO: one whose answer needs TWO sections, e.g. sick leave AND parental leave
  // TODO: one that is NOT in the docs at all (what do the scores look like then?)
];

async function main() {
  const env = loadEnv();
  const { embedder } = createModels(env);
  console.log(`Embedding model: ${embedder.modelId} · topK ${env.TOP_K}\n`);

  const rows = await runChunkingExperiment(
    { loader: new FileSystemLoader(env.DOCS_DIR), embedder, createStore: () => new InMemoryVectorStore() },
    { chunkSizes: CHUNK_SIZES, overlapRatio: 0.15, questions: QUESTIONS, topK: env.TOP_K },
  );

  for (const row of rows) {
    console.log(`chunk size ${row.chunkSize} (overlap ${row.chunkOverlap}) → ${row.chunkCount} chunks`);
  }

  QUESTIONS.forEach((question, q) => {
    console.log(`\n━━━ ${question}`);
    for (const row of rows) {
      const result = row.results[q]!;
      const hits = result.hits
        .map((h) => `${h.metadata.source.replace(/^.*\//, "")}#${h.metadata.chunkIndex} ${h.score.toFixed(3)}`)
        .join(" | ");
      console.log(`  size ${String(row.chunkSize).padStart(4)} · ${String(result.contextChars).padStart(5)} chars · ${hits}`);
    }
  });
}

main().catch(handleCliError);
