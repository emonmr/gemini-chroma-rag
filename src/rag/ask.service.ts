/**
 * QUERY PIPELINE (the "retrieve + generate" half of RAG):
 *   question → embed → nearest chunks → prompt with context → LLM answer
 */
import type { ChatModel, Embedder, VectorStore } from "../core/ports";
import type { Answer, ChatMessage, RetrievedChunk } from "../core/types";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

export interface AskDeps {
  embedder: Embedder;
  store: VectorStore;
  chat: ChatModel;
}

export interface AskOptions {
  topK: number;
  /** Drop chunks below this cosine similarity. 0 = keep all. */
  minScore: number;
}

export type AskStreamEvent =
  | { type: "sources"; sources: RetrievedChunk[] }
  | { type: "delta"; text: string };

export class AskService {
  private readonly deps: AskDeps;
  private readonly options: AskOptions;

  constructor(deps: AskDeps, options: AskOptions) {
    this.deps = deps;
    this.options = options;
  }

  /** Step 1+2: embed the question and find the most similar chunks. */
  async retrieve(question: string): Promise<RetrievedChunk[]> {
    const queryVector = await this.deps.embedder.embedQuery(question);
    const hits = await this.deps.store.query(queryVector, this.options.topK);
    return hits.filter((hit) => hit.score >= this.options.minScore);
  }

  /** Full answer in one go. `history` = earlier turns (raw questions + answers). */
  async ask(question: string, history: ChatMessage[] = []): Promise<Answer> {
    const sources = await this.retrieve(question);
    const text = await this.deps.chat.generate({
      system: SYSTEM_PROMPT,
      messages: [...history, { role: "user", text: buildUserPrompt(question, sources) }],
    });
    return { text, sources };
  }

  /** Same as ask(), but emits the sources first and then the answer token by token. */
  async *askStream(question: string, history: ChatMessage[] = []): AsyncGenerator<AskStreamEvent> {
    const sources = await this.retrieve(question);
    yield { type: "sources", sources };

    const stream = this.deps.chat.stream({
      system: SYSTEM_PROMPT,
      messages: [...history, { role: "user", text: buildUserPrompt(question, sources) }],
    });
    for await (const text of stream) yield { type: "delta", text };
  }
}
