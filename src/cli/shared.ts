/** Small helpers shared by the CLI entry points. */
import { ConfigError } from "../config/env";
import type { RetrievedChunk } from "../core/types";
import { describeError, getStatus } from "../shared/retry";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

export function formatSources(sources: RetrievedChunk[]): string {
  if (sources.length === 0) return dim("  (no sources retrieved)");
  return sources
    .map((s, i) => dim(`  [${i + 1}] ${s.metadata.source} · chunk ${s.metadata.chunkIndex} · score ${s.score.toFixed(3)}`))
    .join("\n");
}

/** Turns common failures into a message that tells you what to do next. */
export function handleCliError(error: unknown): never {
  const message = describeError(error);
  const hint = hintFor(error, message);

  console.error(`\n${red("✖")} ${message}`);
  if (hint) console.error(dim(`  → ${hint}`));
  if (error instanceof Error && error.cause) console.error(dim(`  cause: ${describeError(error.cause)}`));
  process.exit(1);
}

function hintFor(error: unknown, message: string): string | undefined {
  if (error instanceof ConfigError) return undefined; // message already explains it
  if (/ollama/i.test(message)) return undefined; // the Ollama adapters write their own hints
  const status = getStatus(error);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message))
    return "Free-tier rate limit or daily quota hit. Wait a minute (or until tomorrow); your limits are shown in Google AI Studio.";
  if (status === 404 || (/model/i.test(message) && /not found|not supported/i.test(message)))
    return "Model not found. Check GEMINI_CHAT_MODEL / GEMINI_EMBED_MODEL in .env against the current model list in AI Studio.";
  if (/API key/i.test(message))
    return "Your GEMINI_API_KEY looks invalid. Create a new one at https://aistudio.google.com/apikey";
  if (/Chroma/i.test(message)) return "Start Chroma with: npm run chroma:up  (Docker Desktop must be running)";
  return undefined;
}
