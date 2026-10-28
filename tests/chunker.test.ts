import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkDocument, normalizeWhitespace } from "../src/rag/chunker";
import type { SourceDocument } from "../src/core/types";

const doc = (text: string): SourceDocument => ({ id: "doc.md", source: "doc.md", title: "Doc", text });

describe("chunkDocument", () => {
  it("keeps a short document as a single chunk", () => {
    const chunks = chunkDocument(doc("Hello world.\n\nSecond paragraph."), { chunkSize: 500, chunkOverlap: 50 });
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.text, "Hello world.\n\nSecond paragraph.");
  });

  it("never produces a chunk longer than chunkSize", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about coffee beans.`).join(" ");
    const chunks = chunkDocument(doc(text), { chunkSize: 200, chunkOverlap: 40 });
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) assert.ok(chunk.text.length <= 200, `chunk too long: ${chunk.text.length}`);
  });

  it("starts the next chunk with an overlap from the previous one", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(30)).join("\n\n");
    const chunks = chunkDocument(doc(paragraphs), { chunkSize: 300, chunkOverlap: 60 });
    assert.ok(chunks.length >= 2);
    const tailOfFirst = chunks[0]!.text.slice(-20).trim();
    assert.ok(chunks[1]!.text.includes(tailOfFirst), "second chunk should repeat the end of the first");
  });

  it("hard-splits a single word longer than chunkSize", () => {
    const chunks = chunkDocument(doc("x".repeat(250)), { chunkSize: 100, chunkOverlap: 0 });
    assert.deepEqual(
      chunks.map((c) => c.text.length),
      [100, 100, 50],
    );
  });

  it("creates deterministic ids and metadata", () => {
    const chunks = chunkDocument(doc("a ".repeat(300)), { chunkSize: 200, chunkOverlap: 20 });
    chunks.forEach((chunk, i) => {
      assert.equal(chunk.id, `doc.md#${i}`);
      assert.deepEqual(chunk.metadata, { source: "doc.md", title: "Doc", chunkIndex: i });
    });
  });

  it("returns no chunks for an empty document", () => {
    assert.deepEqual(chunkDocument(doc("  \n\n  "), { chunkSize: 100, chunkOverlap: 10 }), []);
  });

  it("rejects an overlap that is not smaller than the chunk size", () => {
    assert.throws(() => chunkDocument(doc("text"), { chunkSize: 100, chunkOverlap: 100 }));
  });
});

describe("normalizeWhitespace", () => {
  it("normalizes Windows line endings and collapses blank lines", () => {
    assert.equal(normalizeWhitespace("a\r\n\r\n\r\n\r\nb  \r\nc"), "a\n\nb\nc");
  });
});
