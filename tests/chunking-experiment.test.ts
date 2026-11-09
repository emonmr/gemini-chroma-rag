/**
 * Step 1.2 — chunking experiment. These tests define done. Offline: fake embedder, in-memory stores.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVectorStore } from "../src/adapters/memory/in-memory.store";
import type { SourceDocument } from "../src/core/types";
import { runChunkingExperiment } from "../src/rag/chunking-experiment";
import { FakeEmbedder, FakeLoader } from "./fakes";

const docs: SourceDocument[] = [
  {
    id: "leave.md",
    source: "leave.md",
    title: "Leave policy",
    text: [
      "Employees receive 22 days of paid annual leave per year.",
      "Sick leave is 10 days per year and needs a doctor note after three days.",
      "Parental leave is sixteen weeks for primary caregivers.",
      "Public holidays are paid in addition to annual leave.",
    ].join("\n\n"),
  },
  {
    id: "brewer.md",
    source: "brewer.md",
    title: "Brewer FAQ",
    text: [
      "Descale the espresso brewer every month with descaler.",
      "Error E7 means the grinder is jammed by oily beans.",
      "The warranty lasts two years, three with registration.",
    ].join("\n\n"),
  },
];

const QUESTIONS = ["how many days of annual leave?", "what does error E7 mean?"];
const SIZES = [80, 200, 1000];

async function run() {
  const embedder = new FakeEmbedder();
  let storesCreated = 0;
  const rows = await runChunkingExperiment(
    {
      loader: new FakeLoader(structuredClone(docs)),
      embedder,
      createStore: () => {
        storesCreated++;
        return new InMemoryVectorStore();
      },
    },
    { chunkSizes: SIZES, overlapRatio: 0.15, questions: QUESTIONS, topK: 2 },
  );
  return { rows, embedder, storesCreated };
}

describe("runChunkingExperiment (step 1.2)", () => {
  it("returns one row per chunk size, in order, with the derived overlap", async () => {
    const { rows } = await run();
    assert.deepEqual(
      rows.map((r) => [r.chunkSize, r.chunkOverlap]),
      [
        [80, 12],
        [200, 30],
        [1000, 150],
      ],
    );
  });

  it("smaller chunks → more chunks (each doc is ONE chunk at size 1000)", async () => {
    const { rows } = await run();
    const counts = rows.map((r) => r.chunkCount);
    assert.equal(counts[2], 2);
    assert.ok(counts[0]! > counts[1]! && counts[1]! > counts[2]!, `expected decreasing counts, got ${counts}`);
  });

  it("uses a fresh store for every chunk size (runs don't mix)", async () => {
    const { storesCreated } = await run();
    assert.equal(storesCreated, SIZES.length);
  });

  it("answers every question for every size, with at most topK hits", async () => {
    const { rows } = await run();
    for (const row of rows) {
      assert.deepEqual(
        row.results.map((r) => r.question),
        QUESTIONS,
      );
      for (const result of row.results) assert.ok(result.hits.length > 0 && result.hits.length <= 2);
    }
  });

  it("finds the right document for each question at every size", async () => {
    const { rows } = await run();
    for (const row of rows) {
      assert.equal(row.results[0]?.hits[0]?.metadata.source, "leave.md", `size ${row.chunkSize}`);
      assert.equal(row.results[1]?.hits[0]?.metadata.source, "brewer.md", `size ${row.chunkSize}`);
    }
  });

  it("contextChars = total text length of the hits (bigger chunks → more text in the prompt)", async () => {
    const { rows } = await run();
    for (const row of rows) {
      for (const result of row.results) {
        const expected = result.hits.reduce((sum, h) => sum + h.text.length, 0);
        assert.equal(result.contextChars, expected);
      }
    }
    assert.ok(rows[2]!.results[0]!.contextChars > rows[0]!.results[0]!.contextChars);
  });

  it("embeds each question only ONCE, not once per chunk size (saves API calls)", async () => {
    const { embedder } = await run();
    // Indexing: 1 embedDocuments call per document per size = 2 docs × 3 sizes = 6.
    // Questions: 1 embedQuery call per question = 2 (NOT 2 × 3 = 6).
    assert.equal(embedder.calls, docs.length * SIZES.length + QUESTIONS.length);
  });
});
