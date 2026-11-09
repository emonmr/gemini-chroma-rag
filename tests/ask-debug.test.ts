/**
 * Step 1.1 — "Trace a question". These tests define done.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVectorStore } from "../src/adapters/memory/in-memory.store";
import { parseAskArgs } from "../src/cli/shared";
import { AskService, type AskStreamEvent } from "../src/rag/ask.service";
import { IngestService } from "../src/rag/ingest.service";
import { SYSTEM_PROMPT } from "../src/rag/prompt";
import { FakeChatModel, FakeEmbedder, FakeLoader, sampleDocs } from "./fakes";

async function collect(question: string) {
  const embedder = new FakeEmbedder();
  const store = new InMemoryVectorStore();
  const chat = new FakeChatModel();
  await new IngestService(
    { loader: new FakeLoader(structuredClone(sampleDocs)), embedder, store },
    { chunkSize: 500, chunkOverlap: 50 },
  ).run();
  const ask = new AskService({ embedder, store, chat }, { topK: 1, minScore: 0 });

  const events: AskStreamEvent[] = [];
  for await (const event of ask.askStream(question, [{ role: "user", text: "earlier question" }])) events.push(event);
  return { events, chat };
}

describe("askStream prompt event (step 1.1)", () => {
  it("emits sources → prompt → deltas, in that order", async () => {
    const { events } = await collect("what does error E7 mean?");
    assert.deepEqual(
      events.slice(0, 2).map((e) => e.type),
      ["sources", "prompt"],
    );
    assert.ok(events.length > 2, "expected answer deltas after the prompt");
    assert.ok(events.slice(2).every((e) => e.type === "delta"));
  });

  it("the prompt event contains the system prompt, history and the context-stuffed question", async () => {
    const { events } = await collect("what does error E7 mean?");
    const promptEvent = events.find((e) => e.type === "prompt");
    assert.ok(promptEvent && promptEvent.type === "prompt", "no prompt event emitted");

    const { request } = promptEvent;
    assert.equal(request.system, SYSTEM_PROMPT);
    assert.equal(request.messages[0]?.text, "earlier question");
    assert.match(request.messages.at(-1)!.text, /<context>[\s\S]*E7[\s\S]*<\/context>[\s\S]*Question: what does error E7 mean\?/);
  });

  it("shows EXACTLY what the chat model received (same object, no drift)", async () => {
    const { events, chat } = await collect("annual leave?");
    const promptEvent = events.find((e) => e.type === "prompt");
    assert.ok(promptEvent && promptEvent.type === "prompt", "no prompt event emitted");
    assert.equal(chat.requests.length, 1);
    assert.equal(promptEvent.request, chat.requests[0]);
  });
});

describe("parseAskArgs (step 1.1)", () => {
  it("joins plain words into the question", () => {
    assert.deepEqual(parseAskArgs(["How", "many", "days?"]), { question: "How many days?", debug: false });
  });

  it("recognises --debug before the question", () => {
    assert.deepEqual(parseAskArgs(["--debug", "How many days?"]), { question: "How many days?", debug: true });
  });

  it("recognises --debug after the question", () => {
    assert.deepEqual(parseAskArgs(["How many days?", "--debug"]), { question: "How many days?", debug: true });
  });

  it("an empty question stays empty (so the CLI can print usage)", () => {
    assert.deepEqual(parseAskArgs(["--debug"]), { question: "", debug: true });
  });
});
