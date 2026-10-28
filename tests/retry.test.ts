import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRetryableError, withRetry } from "../src/shared/retry";

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
const fast = { baseDelayMs: 1, maxDelayMs: 2, onRetry: () => {} };

describe("withRetry", () => {
  it("retries rate-limit errors and eventually succeeds", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw httpError(429);
      return "ok";
    }, fast);
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("does not retry a bad request", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw httpError(400);
      }, fast),
    );
    assert.equal(calls, 1);
  });

  it("gives up after the configured number of retries", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw httpError(503);
      }, { ...fast, retries: 2 }),
    );
    assert.equal(calls, 3);
  });
});

describe("isRetryableError", () => {
  it("recognises status codes and RESOURCE_EXHAUSTED messages", () => {
    assert.equal(isRetryableError(httpError(429)), true);
    assert.equal(isRetryableError(httpError(500)), true);
    assert.equal(isRetryableError(httpError(404)), false);
    assert.equal(isRetryableError(new Error("got status: RESOURCE_EXHAUSTED")), true);
    assert.equal(isRetryableError(new Error("invalid argument")), false);
  });
});
