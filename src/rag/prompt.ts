/**
 * PROMPTS — the "augmented" part of Retrieval-Augmented Generation.
 * Keep prompts in one place, version them, and test them like code.
 */
import type { RetrievedChunk } from "../core/types";

export const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about the user's documents.

Rules:
- Answer ONLY from the information inside <context>. Do not use outside knowledge.
- If the context does not contain the answer, reply exactly: "I couldn't find that in the documents."
- Cite the sources you used with their bracket numbers, e.g. [1] or [2][3].
- Be concise: short paragraphs or bullet points.`;

export const NOT_FOUND_ANSWER = "I couldn't find that in the documents.";

/** Numbers each chunk so the model can cite it as [1], [2], … */
export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => `[${i + 1}] source: ${chunk.metadata.source}\n${chunk.text}`)
    .join("\n\n---\n\n");
}

export function buildUserPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks.length > 0 ? formatContext(chunks) : "(no relevant documents were found)";
  return `<context>\n${context}\n</context>\n\nQuestion: ${question}`;
}
