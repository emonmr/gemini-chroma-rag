/**
 * Typed, validated configuration — fail fast with a readable message
 * instead of a mysterious `undefined` deep inside an SDK call.
 * (.NET analogy: IOptions<T> with data-annotation validation.)
 */
import { z } from "zod";

// Load .env into process.env (built into Node ≥ 20.12, no dotenv package needed).
try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to real environment variables.
}

const MISSING_KEY = "missing — copy .env.example to .env and paste your key from https://aistudio.google.com/apikey";

const EnvSchema = z.object({
  // Which adapters container.ts wires up: Google's cloud API or local models via Ollama.
  LLM_PROVIDER: z.enum(["gemini", "ollama"]).default("gemini"),

  // Only required when LLM_PROVIDER=gemini (checked in loadEnv).
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  GEMINI_EMBED_MODEL: z.string().min(1).default("gemini-embedding-2"),
  EMBED_DIMENSIONS: z.coerce.number().int().min(128).max(3072).default(768),

  OLLAMA_HOST: z.url().default("http://localhost:11434"),
  OLLAMA_CHAT_MODEL: z.string().min(1).default("qwen3:8b"),
  OLLAMA_EMBED_MODEL: z.string().min(1).default("embeddinggemma"),

  CHROMA_HOST: z.string().min(1).default("localhost"),
  CHROMA_PORT: z.coerce.number().int().positive().default(8000),
  CHROMA_COLLECTION: z.string().min(1).default("docs"),

  DOCS_DIR: z.string().min(1).default("./data/docs"),
  CHUNK_SIZE: z.coerce.number().int().min(100).default(1000),
  CHUNK_OVERLAP: z.coerce.number().int().min(0).default(150),
  TOP_K: z.coerce.number().int().min(1).max(50).default(4),
  MIN_SCORE: z.coerce.number().min(-1).max(1).default(0),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // Treat empty strings ("TOP_K=") as "not set" so defaults apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = EnvSchema.safeParse(cleaned);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new ConfigError(`Invalid configuration in .env:\n${issues}`);
  }
  if (result.data.LLM_PROVIDER === "gemini" && !result.data.GEMINI_API_KEY) {
    throw new ConfigError(`Invalid configuration in .env:\n  • GEMINI_API_KEY: ${MISSING_KEY} (or set LLM_PROVIDER=ollama)`);
  }
  if (result.data.CHUNK_OVERLAP >=result.data.CHUNK_SIZE) {
    throw new ConfigError("Invalid configuration in .env:\n  • CHUNK_OVERLAP must be smaller than CHUNK_SIZE");
  }
  return result.data;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}
