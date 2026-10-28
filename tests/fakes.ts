/**
 * Test doubles for the ports — the whole RAG pipeline runs offline,
 * instantly and for free. This is the payoff of the ports & adapters design.
 */
import type { ChatModel, DocumentLoader, Embedder, GenerateRequest } from "../src/core/ports";
import type { SourceDocument } from "../src/core/types";
import { l2Normalize } from "../src/shared/vector";

/**
 * "Bag of words" embedder: each word is hashed into one of N buckets.
 * Texts sharing words get similar vectors — crude, but enough for real retrieval in tests.
 */
export class FakeEmbedder implements Embedder {
  readonly modelId = "fake-bow";
  readonly dimensions = 256;
  calls = 0;

  async embedDocuments(docs: { title: string; text: string }[]): Promise<number[][]> {
    this.calls++;
    return docs.map((d) => this.vectorize(d.text));
  }

  async embedQuery(query: string): Promise<number[]> {
    this.calls++;
    return this.vectorize(query);
  }

  private vectorize(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
      if (word.length < 3) continue;
      let hash = 0;
      for (const ch of word) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      v[hash % this.dimensions]! += 1;
    }
    return l2Normalize(v);
  }
}

/** Records the requests it receives and answers with a canned reply. */
export class FakeChatModel implements ChatModel {
  readonly modelId = "fake-chat";
  readonly requests: GenerateRequest[] = [];

  constructor(private readonly reply = "Fake answer [1]") {}

  async generate(request: GenerateRequest): Promise<string> {
    this.requests.push(request);
    return this.reply;
  }

  async *stream(request: GenerateRequest): AsyncGenerator<string> {
    this.requests.push(request);
    for (const word of this.reply.split(" ")) yield `${word} `;
  }
}

export class FakeLoader implements DocumentLoader {
  constructor(public documents: SourceDocument[]) {}
  async load(): Promise<SourceDocument[]> {
    return this.documents;
  }
}

export const sampleDocs: SourceDocument[] = [
  {
    id: "leave.md",
    source: "leave.md",
    title: "Leave policy",
    text: "Employees receive 22 days of paid annual leave. Unused vacation days expire in March.",
  },
  {
    id: "brewer.md",
    source: "brewer.md",
    title: "Brewer FAQ",
    text: "Descale the espresso brewer every month with descaler. Error E7 means the grinder is jammed.",
  },
];
