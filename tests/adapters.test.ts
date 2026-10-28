/**
 * Adapter tests with hand-rolled fake SDK clients: we check the exact requests
 * we send to Gemini / Chroma without any network calls.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { GoogleGenAI } from "@google/genai";
import type { ChromaClient } from "chromadb";
import { ChromaVectorStore } from "../src/adapters/chroma/chroma.store";
import { extractTitle, FileSystemLoader } from "../src/adapters/fs/file.loader";
import { GeminiEmbedder } from "../src/adapters/gemini/gemini.embedder";

type EmbedCall = { model: string; contents: { parts: { text: string }[] }[]; config: Record<string, unknown> };

function fakeGenAI(vectorsPerCall?: number) {
  const calls: EmbedCall[] = [];
  const ai = {
    models: {
      embedContent: async (params: EmbedCall) => {
        calls.push(params);
        const n = vectorsPerCall ?? params.contents.length;
        return { embeddings: Array.from({ length: n }, () => ({ values: [3, 4] })) };
      },
    },
  } as unknown as GoogleGenAI;
  return { ai, calls };
}

describe("GeminiEmbedder", () => {
  it("uses task prefixes (not taskType) for gemini-embedding-2", async () => {
    const { ai, calls } = fakeGenAI();
    const embedder = new GeminiEmbedder(ai, "gemini-embedding-2", 768);

    await embedder.embedDocuments([{ title: "Leave", text: "22 days" }, { title: "", text: "E7 error" }]);
    await embedder.embedQuery("how many days?");

    assert.deepEqual(
      calls[0]!.contents.map((c) => c.parts[0]!.text),
      ["title: Leave | text: 22 days", "title: none | text: E7 error"],
    );
    assert.equal(calls[1]!.contents[0]!.parts[0]!.text, "task: question answering | query: how many days?");
    assert.deepEqual(calls[0]!.config, { outputDimensionality: 768 });
  });

  it("uses the taskType config for gemini-embedding-001", async () => {
    const { ai, calls } = fakeGenAI();
    const embedder = new GeminiEmbedder(ai, "gemini-embedding-001", 768);
    await embedder.embedDocuments([{ title: "T", text: "doc" }]);
    await embedder.embedQuery("q");
    assert.equal(calls[0]!.contents[0]!.parts[0]!.text, "doc");
    assert.equal(calls[0]!.config["taskType"], "RETRIEVAL_DOCUMENT");
    assert.equal(calls[1]!.config["taskType"], "QUESTION_ANSWERING");
  });

  it("batches requests and normalizes vectors", async () => {
    const { ai, calls } = fakeGenAI();
    const embedder = new GeminiEmbedder(ai, "gemini-embedding-2", 768, 2);
    const vectors = await embedder.embedDocuments(Array.from({ length: 5 }, (_, i) => ({ title: "t", text: `d${i}` })));
    assert.deepEqual(calls.map((c) => c.contents.length), [2, 2, 1]);
    assert.equal(vectors.length, 5);
    assert.deepEqual(vectors[0], [0.6, 0.8]);
  });

  it("fails loudly if the API aggregates inputs into fewer embeddings", async () => {
    const { ai } = fakeGenAI(1);
    const embedder = new GeminiEmbedder(ai, "gemini-embedding-2", 768);
    await assert.rejects(
      embedder.embedDocuments([{ title: "a", text: "a" }, { title: "b", text: "b" }]),
      /Expected 2 embeddings/,
    );
  });
});

describe("ChromaVectorStore", () => {
  function fakeChroma() {
    const log: { method: string; args: unknown }[] = [];
    const collection = {
      upsert: async (args: unknown) => void log.push({ method: "upsert", args }),
      delete: async (args: unknown) => void log.push({ method: "delete", args }),
      count: async () => 7,
      query: async (args: unknown) => {
        log.push({ method: "query", args });
        return {
          rows: () => [[{ id: "a.md#0", document: "Alpha", metadata: { source: "a.md", title: "A", chunkIndex: 0 }, distance: 0.25 }]],
        };
      },
    };
    const client = {
      getOrCreateCollection: async (args: unknown) => {
        log.push({ method: "getOrCreateCollection", args });
        return collection;
      },
      deleteCollection: async (args: unknown) => void log.push({ method: "deleteCollection", args }),
    } as unknown as ChromaClient;
    return { client, log };
  }

  it("creates a cosine collection without an embedding function", async () => {
    const { client, log } = fakeChroma();
    await new ChromaVectorStore(client, "docs").count();
    assert.deepEqual(log[0], {
      method: "getOrCreateCollection",
      args: { name: "docs", embeddingFunction: null, configuration: { hnsw: { space: "cosine" } } },
    });
  });

  it("converts cosine distance into a similarity score", async () => {
    const { client } = fakeChroma();
    const [hit] = await new ChromaVectorStore(client, "docs").query([0.1, 0.2], 3);
    assert.equal(hit?.score, 0.75);
    assert.equal(hit?.metadata.source, "a.md");
  });

  it("deletes by source using a metadata filter", async () => {
    const { client, log } = fakeChroma();
    await new ChromaVectorStore(client, "docs").deleteBySource("a.md");
    assert.deepEqual(log.at(-1), { method: "delete", args: { where: { source: "a.md" } } });
  });

  it("explains how to start Chroma when it cannot connect", async () => {
    const client = {
      getOrCreateCollection: async () => {
        throw new Error("fetch failed");
      },
    } as unknown as ChromaClient;
    await assert.rejects(new ChromaVectorStore(client, "docs").count(), /npm run chroma:up/);
  });
});

describe("FileSystemLoader", () => {
  it("loads .md/.txt files recursively with forward-slash ids", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rag-docs-"));
    try {
      await mkdir(path.join(dir, "sub"));
      await writeFile(path.join(dir, "a.md"), "# Alpha Title\n\nBody");
      await writeFile(path.join(dir, "sub", "b.txt"), "plain text");
      await writeFile(path.join(dir, "ignored.json"), "{}");

      const docs = await new FileSystemLoader(dir).load();
      assert.deepEqual(
        docs.map((d) => [d.id, d.title]),
        [
          ["a.md", "Alpha Title"],
          ["sub/b.txt", "b"],
        ],
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("gives a helpful error when the folder does not exist", async () => {
    await assert.rejects(new FileSystemLoader("./definitely-not-here").load(), /DOCS_DIR/);
  });

  it("extracts the first markdown heading as the title", () => {
    assert.equal(extractTitle("intro\n# Real Title\n## Sub", "x.md"), "Real Title");
    assert.equal(extractTitle("no heading", "folder/notes.md"), "notes");
  });
});
