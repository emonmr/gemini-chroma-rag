/**
 * Tiny vector-math helpers. Worth reading slowly: this IS what "semantic search" is.
 */

export function dot(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

export function magnitude(v: readonly number[]): number {
  return Math.sqrt(dot(v, v));
}

/** Scales a vector to length 1 so only its direction (= meaning) matters. */
export function l2Normalize(v: readonly number[]): number[] {
  const m = magnitude(v);
  return m === 0 ? [...v] : v.map((x) => x / m);
}

/**
 * Cosine similarity: 1 = same direction (same meaning), 0 = unrelated, -1 = opposite.
 * Chroma's "cosine" space stores DISTANCE = 1 - similarity.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const denom = magnitude(a) * magnitude(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

export interface ScoredIndex {
  /** Position of the vector in the input array. */
  index: number;
  /** Cosine similarity to the query. */
  score: number;
}

/**
 * Brute-force nearest neighbours: the `k` vectors most similar to `query`, best first.
 * SQL mental model: SELECT index, cosine(query, v) AS score ORDER BY score DESC LIMIT k.
 * Chroma does the same thing, but uses an HNSW index so it doesn't have to scan every row.
 */
export function topK(query: readonly number[], vectors: readonly (readonly number[])[], k: number): ScoredIndex[] {
  // TODO: score every vector against the query with cosineSimilarity (keep its index).
  // TODO: sort by score, highest first.
  // TODO: return at most k results. k <= 0 → []. k larger than the list → all of them.
  // Edge case to think about: should a length mismatch throw? (cosineSimilarity already decides.)
  void query; void vectors; void k;
  throw new Error("TODO: implement topK");
}
