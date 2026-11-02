import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { topK } from "../src/shared/vector";

// Tiny 2-D "embeddings" so you can picture them as arrows on paper.
const vectors = [
  [1, 0], // 0: points right
  [0, 1], // 1: points up
  [1, 1], // 2: diagonal
  [-1, 0], // 3: points left (opposite of 0)
];

describe("topK (step 0.3)", () => {
  it("returns the most similar vectors first, with their original index", () => {
    const result = topK([1, 0.1], vectors, 2);
    assert.deepEqual(
      result.map((r) => r.index),
      [0, 2],
    );
    assert.ok(result[0]!.score > result[1]!.score, "scores must be sorted descending");
  });

  it("puts the opposite vector last with a negative score", () => {
    const result = topK([1, 0], vectors, vectors.length);
    const last = result.at(-1)!;
    assert.equal(last.index, 3);
    assert.equal(last.score.toFixed(6), "-1.000000");
  });

  it("returns everything when k is larger than the list", () => {
    assert.equal(topK([1, 0], vectors, 10).length, vectors.length);
  });

  it("returns [] when k is 0 or the list is empty", () => {
    assert.deepEqual(topK([1, 0], vectors, 0), []);
    assert.deepEqual(topK([1, 0], [], 3), []);
  });

  it("does not reorder the caller's array", () => {
    const copy = vectors.map((v) => [...v]);
    topK([0, 1], vectors, 4);
    assert.deepEqual(vectors, copy);
  });
});
