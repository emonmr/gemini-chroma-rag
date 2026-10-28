/**
 * npm run ingest        → index every .md/.txt file in DOCS_DIR
 * npm run ingest:reset  → wipe the collection first, then index
 */
import { createContainer } from "../container";
import { handleCliError } from "./shared";

async function main() {
  const reset = process.argv.includes("--reset");
  const app = createContainer();

  console.log(`Ingesting ${app.env.DOCS_DIR} → Chroma collection "${app.collection}"`);
  console.log(`Embedding model: ${app.embedder.modelId} (${app.embedder.dimensions} dims)\n`);

  const started = Date.now();
  const report = await app.ingest.run({ reset, onProgress: (msg) => console.log(msg) });

  console.log(
    `\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s — ${report.documents} document(s), ` +
      `${report.chunks} chunk(s) embedded, ${report.totalInStore} chunk(s) in the collection.`,
  );
}

main().catch(handleCliError);
