/**
 * End-to-end RAG pipeline tests with fakes: no API key, no Chroma, no network.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVectorStore } from "../src/adapters/memory/in-memory.store";
import { AskService } from "../src/rag/ask.service";
import { IngestService } from "../src/rag/ingest.service";
import { buildUserPrompt, SYSTEM_PROMPT } from "../src/rag/prompt";
import { FakeChatModel, FakeEmbedder, FakeLoader, sampleDocs } from "./fakes";

function setup() {
  const embedder = new FakeEmbedder();
  const store = new InMemoryVectorStore();
  const chat = new FakeChatModel();
  const loader = new FakeLoader(structuredClone(sampleDocs));
  const ingest = new IngestService({ loader, embedder, store }, { chunkSize: 500, chunkOverlap: 50 });
  const ask = new AskService({ embedder, store, chat }, { topK: 1, minScore: 0 });
  return { embedder, store, chat, loader, ingest, ask };
}

describe("IngestService", () => {
  it("chunks, embeds and stores every document", async () => {
    const { ingest } = setup();
    const report = await ingest.run();
    assert.deepEqual(report, { documents: 2, chunks: 2, totalInStore: 2 });
  });

  it("is idempotent: re-ingesting does not create duplicates", async () => {
    const { ingest } = setup();
    await ingest.run();
    const second = await ingest.run();
    assert.equal(second.totalInStore, 2);
  });

  it("removes leftover chunks when a document gets shorter", async () => {
    const { ingest, loader, store } = setup();
    loader.documents[0]!.text = "Paragraph about leave. ".repeat(60); // → several chunks
    await ingest.run();
    const before = await store.count();

    loader.documents[0]!.text = "Short now.";
    await ingest.run();
    assert.ok((await store.count()) < before);
    assert.equal(await store.count(), 2);
  });
});

describe("AskService", () => {
  it("retrieves the most relevant chunk for a question", async () => {
    const { ingest, ask } = setup();
    await ingest.run();
    const [top] = await ask.retrieve("how many days of annual leave do employees receive?");
    assert.equal(top?.metadata.source, "leave.md");
  });

  it("sends the system prompt and the retrieved context to the chat model", async () => {
    const { ingest, ask, chat } = setup();
    await ingest.run();
    const answer = await ask.ask("what does error E7 mean on the brewer?");

    assert.equal(answer.text, "Fake answer [1]");
    assert.equal(answer.sources[0]?.metadata.source, "brewer.md");

    const request = chat.requests[0]!;
    assert.equal(request.system, SYSTEM_PROMPT);
    const lastMessage = request.messages.at(-1)!;
    assert.equal(lastMessage.role, "user");
    assert.match(lastMessage.text, /<context>[\s\S]*E7[\s\S]*<\/context>/);
  });

  it("keeps earlier turns in the conversation", async () => {
    const { ingest, ask, chat } = setup();
    await ingest.run();
    await ask.ask("and the warranty?", [
      { role: "user", text: "tell me about the brewer" },
      { role: "model", text: "It is a coffee machine." },
    ]);
    assert.equal(chat.requests[0]?.messages.length, 3);
  });

  it("filters out chunks below minScore", async () => {
    const { ingest, embedder, store, chat } = setup();
    await ingest.run();
    const strict = new AskService({ embedder, store, chat }, { topK: 5, minScore: 0.99 });
    assert.deepEqual(await strict.retrieve("completely unrelated question about football"), []);
  });

  it("streams sources first, then the answer text", async () => {
    const { ingest, ask } = setup();
    await ingest.run();
    const events = [];
    for await (const event of ask.askStream("annual leave?")) events.push(event);
    assert.equal(events[0]?.type, "sources");
    assert.ok(events.slice(1).every((e) => e.type === "delta"));
  });
});

describe("buildUserPrompt", () => {
  it("numbers sources so the model can cite them", () => {
    const prompt = buildUserPrompt("Q?", [
      { id: "a#0", text: "Alpha", score: 0.9, metadata: { source: "a.md", title: "A", chunkIndex: 0 } },
      { id: "b#0", text: "Beta", score: 0.8, metadata: { source: "b.md", title: "B", chunkIndex: 0 } },
    ]);
    assert.match(prompt, /\[1\] source: a\.md\nAlpha/);
    assert.match(prompt, /\[2\] source: b\.md\nBeta/);
    assert.match(prompt, /Question: Q\?$/);
  });

  it("says so when nothing was retrieved", () => {
    assert.match(buildUserPrompt("Q?", []), /no relevant documents/);
  });
});
