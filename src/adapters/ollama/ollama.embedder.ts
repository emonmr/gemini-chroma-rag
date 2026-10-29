/**
 * ADAPTER: Embedder → a local embedding model served by Ollama (default: embeddinggemma).
 *
 * No SDK needed: Ollama is a plain REST API on http://localhost:11434, so we use `fetch`.
 * `fetch` is injected through the constructor (like injecting HttpClient in .NET)
 * so tests can pass a fake and never touch the network.
 *
 * API:  POST {host}/api/embed
 *   request  { model, input: string[], dimensions? }
 *   response { embeddings: number[][], prompt_eval_count, total_duration, ... }
 * Docs: https://docs.ollama.com/api/embed
 *
 * Same gotcha as GeminiEmbedder: embeddinggemma has no taskType parameter.
 * It was trained with the task written INSIDE the text (see its model card):
 *   documents → "title: {title | "none"} | text: {content}"
 *   queries   → "task: question answering | query: {content}"
 * Skip the prefixes and retrieval quality drops, with no error to warn you.
 */
import type { Embedder } from "../../core/ports";
import { l2Normalize } from "../../shared/vector";
import { postToOllama } from "./ollama.http";

export class OllamaEmbedder implements Embedder {
  readonly modelId: string;
  readonly dimensions: number;
  private readonly host: string;
  private readonly fetchFn: typeof fetch;
  private readonly batchSize: number;

  constructor(host: string, modelId: string, dimensions: number, fetchFn: typeof fetch = fetch, batchSize = 32) {
    this.host = host.replace(/\/+$/, "");
    this.modelId = modelId;
    this.dimensions = dimensions;
    this.fetchFn = fetchFn;
    this.batchSize = batchSize;
  }

  async embedDocuments(docs: { title: string; text: string }[]): Promise<number[][]> {
    const inputs = docs.map((d) => `title: ${d.title.trim() || "none"} | text: ${d.text}`);
    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += this.batchSize) {
      vectors.push(...(await this.embedBatch(inputs.slice(i, i + this.batchSize))));
    }
    return vectors;
  }

  async embedQuery(query: string): Promise<number[]> {
    const [vector] = await this.embedBatch([`task: question answering | query: ${query}`]);
    if (!vector) throw new Error("Ollama returned no embedding for the query");
    return vector;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    // No withRetry here: there are no rate limits locally, and a dead server won't come back in 2s.
    const response = await postToOllama(this.fetchFn, this.host, "/api/embed", {
      model: this.modelId,
      input: texts,
      dimensions: this.dimensions,
    });
    const data = (await response.json()) as { embeddings?: number[][] };

    const vectors = data.embeddings ?? [];
    if (vectors.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings from ${this.modelId}, got ${vectors.length}`);
    }
    // The Ollama docs don't promise unit-length vectors; cosine math downstream assumes them.
    return vectors.map(l2Normalize);
  }
}
