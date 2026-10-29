/**
 * Step 6.1 (pulled forward): Ollama adapters. These define "done".
 * A fake `fetch` records each request and returns canned responses, so no Ollama is needed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OllamaChatModel, toOllamaMessages } from "../src/adapters/ollama/ollama.chat";
import { OllamaEmbedder } from "../src/adapters/ollama/ollama.embedder";
import type { GenerateRequest } from "../src/core/ports";

type Call = { url: string; method: string | undefined; body: Record<string, unknown> };

/** A fake fetch: records requests, answers with `respond(body)`. */
function fakeFetch(respond: (body: Record<string, unknown>) => Response) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url: String(url), method: init?.method, body });
    return respond(body);
  }) as typeof fetch;
  return { fetchFn, calls };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

/** Embeds every input as [3, 4] (so normalized it's [0.6, 0.8]). */
const embedOk = (body: Record<string, unknown>) =>
  json({ embeddings: (body["input"] as string[]).map(() => [3, 4]) });

/** A streaming body whose network chunks deliberately split JSON lines in half. */
function ndjsonResponse(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}

describe("OllamaEmbedder", () => {
  it("POSTs to /api/embed with embeddinggemma task prompts and dimensions", async () => {
    const { fetchFn, calls } = fakeFetch(embedOk);
    const embedder = new OllamaEmbedder("http://localhost:11434/", "embeddinggemma", 768, fetchFn);

    await embedder.embedDocuments([{ title: "Leave", text: "22 days" }, { title: "  ", text: "E7 error" }]);
    await embedder.embedQuery("how many days?");

    assert.equal(calls[0]!.url, "http://localhost:11434/api/embed");
    assert.equal(calls[0]!.method, "POST");
    assert.deepEqual(calls[0]!.body, {
      model: "embeddinggemma",
      input: ["title: Leave | text: 22 days", "title: none | text: E7 error"],
      dimensions: 768,
    });
    assert.deepEqual(calls[1]!.body["input"], ["task: question answering | query: how many days?"]);
  });

  it("batches requests and L2-normalizes vectors", async () => {
    const { fetchFn, calls } = fakeFetch(embedOk);
    const embedder = new OllamaEmbedder("http://localhost:11434", "embeddinggemma", 768, fetchFn, 2);

    const vectors = await embedder.embedDocuments(Array.from({ length: 5 }, (_, i) => ({ title: "t", text: `d${i}` })));

    assert.deepEqual(calls.map((c) => (c.body["input"] as string[]).length), [2, 2, 1]);
    assert.equal(vectors.length, 5);
    assert.deepEqual(vectors[0], [0.6, 0.8]);
    assert.deepEqual(await embedder.embedQuery("q"), [0.6, 0.8]);
  });

  it("fails loudly if it gets a different number of vectors than inputs", async () => {
    const { fetchFn } = fakeFetch(() => json({ embeddings: [[1, 0]] }));
    const embedder = new OllamaEmbedder("http://localhost:11434", "embeddinggemma", 768, fetchFn);
    await assert.rejects(embedder.embedDocuments([{ title: "a", text: "a" }, { title: "b", text: "b" }]), /Expected 2/);
  });

  it("tells you to `ollama pull` when the model is missing", async () => {
    const { fetchFn } = fakeFetch(() => json({ error: 'model "embeddinggemma" not found, try pulling it first' }, 404));
    const embedder = new OllamaEmbedder("http://localhost:11434", "embeddinggemma", 768, fetchFn);
    await assert.rejects(embedder.embedQuery("q"), /404[\s\S]*ollama pull/);
  });

  it("explains that Ollama is not running when the connection fails", async () => {
    const fetchFn = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const embedder = new OllamaEmbedder("http://localhost:11434", "embeddinggemma", 768, fetchFn);
    await assert.rejects(embedder.embedQuery("q"), /Ollama[\s\S]*localhost:11434/);
  });
});

describe("OllamaChatModel", () => {
  const request: GenerateRequest = {
    system: "Answer only from the context.",
    messages: [
      { role: "user", text: "Hi" },
      { role: "model", text: "Hello!" },
      { role: "user", text: "How many leave days?" },
    ],
  };

  it("maps the system prompt and roles to Ollama messages", () => {
    assert.deepEqual(toOllamaMessages(request.system, request.messages), [
      { role: "system", content: "Answer only from the context." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "How many leave days?" },
    ]);
  });

  it("generate() sends a non-streaming request with thinking off and returns the content", async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ message: { role: "assistant", content: "22 days [1]" }, done: true }));
    const chat = new OllamaChatModel("http://localhost:11434", "qwen3:8b", fetchFn);

    assert.equal(await chat.generate(request), "22 days [1]");
    assert.equal(calls[0]!.url, "http://localhost:11434/api/chat");
    assert.equal(calls[0]!.body["model"], "qwen3:8b");
    assert.equal(calls[0]!.body["stream"], false);
    assert.equal(calls[0]!.body["think"], false);
    assert.equal(calls[0]!.body["options"], undefined, "no temperature → no options (use the model default)");
  });

  it("puts temperature inside options when it is set", async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ message: { content: "ok" }, done: true }));
    await new OllamaChatModel("http://localhost:11434", "qwen3:8b", fetchFn).generate({ ...request, temperature: 0.2 });
    assert.deepEqual(calls[0]!.body["options"], { temperature: 0.2 });
  });

  it("stream() parses NDJSON even when lines are split across network chunks", async () => {
    const { fetchFn, calls } = fakeFetch(() =>
      ndjsonResponse([
        '{"message":{"content":"22 "},"done":false}\n{"message":{"con',
        'tent":"days"},"done":false}\n',
        '{"message":{"content":""},"done":false}\n',
        '{"message":{"content":" [1]"},"done":true}', // last line without "\n"
      ]),
    );
    const chat = new OllamaChatModel("http://localhost:11434", "qwen3:8b", fetchFn);

    const deltas: string[] = [];
    for await (const delta of chat.stream(request)) deltas.push(delta);

    assert.deepEqual(deltas, ["22 ", "days", " [1]"]);
    assert.equal(calls[0]!.body["stream"], true);
  });

  it("stream() throws when Ollama sends an error line", async () => {
    const { fetchFn } = fakeFetch(() => ndjsonResponse(['{"error":"out of memory"}\n']));
    const chat = new OllamaChatModel("http://localhost:11434", "qwen3:8b", fetchFn);
    await assert.rejects(async () => {
      for await (const _ of chat.stream(request)) {
        // drain
      }
    }, /out of memory/);
  });
});
