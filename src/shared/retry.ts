/**
 * Retry with exponential backoff + jitter.
 *
 * The Gemini free tier has low requests-per-minute limits, so you WILL see
 * 429 / RESOURCE_EXHAUSTED errors. Retrying transient errors is a core
 * production habit for any LLM app (like Polly in .NET).
 */

export interface RetryOptions {
  /** Extra attempts after the first one. */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 4, baseDelayMs = 2_000, maxDelayMs = 30_000, onRetry } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryableError(error)) throw error;

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delayMs = Math.round(backoff * (0.75 + Math.random() * 0.5)); // ±25% jitter
      if (onRetry) {
        onRetry({ attempt: attempt + 1, delayMs, error });
      } else {
        console.warn(`  ↻ ${describeError(error)} — retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${retries})`);
      }
      await sleep(delayMs);
    }
  }
}

/** Rate limits (429) and server hiccups (5xx) are worth retrying; bad requests (4xx) are not. */
export function isRetryableError(error: unknown): boolean {
  const status = getStatus(error);
  if (status !== undefined) return status === 429 || status >= 500;
  return /\b(429|RESOURCE_EXHAUSTED|500|502|503|504|UNAVAILABLE|overloaded|ECONNRESET|ETIMEDOUT)\b/i.test(
    describeError(error),
  );
}

export function getStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
