/**
 * ADAPTER: Embedder → Gemini embedding models.
 *
 * Two gotchas this class handles for you (read the comments!):
 *
 * 1. gemini-embedding-2 does NOT take a `taskType` parameter. Instead you put the
 *    task in the text itself:
 *      documents → "title: {title} | text: {content}"
 *      queries   → "task: question answering | query: {content}"
 *    gemini-embedding-001 uses the `taskType` config field instead.
 *
 * 2. gemini-embedding-2 AGGREGATES a list of plain strings into ONE embedding.
 *    To get one vector per text we wrap each text in its own Content object.
 */
import type { GoogleGenAI } from "@google/genai";
import type { Embedder } from "../../core/ports";
import { withRetry } from "../../shared/retry";
import { l2Normalize } from "../../shared/vector";

export class GeminiEmbedder implements Embedder {
  readonly modelId: string;
  readonly dimensions: number;
  private readonly ai: GoogleGenAI;
  private readonly batchSize: number;

  constructor(ai: GoogleGenAI, modelId: string, dimensions: number, batchSize = 50) {
    this.ai = ai;
    this.modelId = modelId;
    this.dimensions = dimensions;
    this.batchSize = batchSize;
  }

  /** gemini-embedding-2 (and newer) use task prefixes inside the text. */
  private get usesTaskPrefixes(): boolean {
    return !this.modelId.startsWith("gemini-embedding-001");
  }

  async embedDocuments(docs: { title: string; text: string }[]): Promise<number[][]> {
    const inputs = docs.map((d) =>
      this.usesTaskPrefixes ? `title: ${d.title.trim() || "none"} | text: ${d.text}` : d.text,
    );
    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += this.batchSize) {
      vectors.push(...(await this.embedBatch(inputs.slice(i, i + this.batchSize), "RETRIEVAL_DOCUMENT")));
    }
    return vectors;
  }

  async embedQuery(query: string): Promise<number[]> {
    const input = this.usesTaskPrefixes ? `task: question answering | query: ${query}` : query;
    const [vector] = await this.embedBatch([input], "QUESTION_ANSWERING");
    if (!vector) throw new Error("Gemini returned no embedding for the query");
    return vector;
  }

  private async embedBatch(texts: string[], taskType: string): Promise<number[][]> {
    const response = await withRetry(() =>
      this.ai.models.embedContent({
        model: this.modelId,
        // One Content object per text → one embedding per text (see gotcha #2).
        contents: texts.map((text) => ({ parts: [{ text }] })),
        config: {
          outputDimensionality: this.dimensions,
          ...(this.usesTaskPrefixes ? {} : { taskType }),
        },
      }),
    );

    const vectors = (response.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings from ${this.modelId}, got ${vectors.length}`);
    }
    // gemini-embedding-2 already normalizes; gemini-embedding-001 does not for < 3072 dims.
    return vectors.map(l2Normalize);
  }
}
