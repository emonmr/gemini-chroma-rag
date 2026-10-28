import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cosineSimilarity, l2Normalize, magnitude } from "../src/shared/vector";

describe("vector math", () => {
  it("cosine similarity is 1 for the same direction, 0 for orthogonal, -1 for opposite", () => {
    assert.equal(cosineSimilarity([1, 2, 3], [2, 4, 6]).toFixed(6), "1.000000");
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
    assert.equal(cosineSimilarity([1, 1], [-1, -1]).toFixed(6), "-1.000000");
  });

  it("l2Normalize produces a unit vector", () => {
    assert.equal(magnitude(l2Normalize([3, 4])).toFixed(6), "1.000000");
    assert.deepEqual(l2Normalize([0, 0]), [0, 0]);
  });

  it("throws on length mismatch", () => {
    assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]));
  });
});
