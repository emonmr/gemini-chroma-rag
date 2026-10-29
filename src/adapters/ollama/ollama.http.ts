/**
 * Shared HTTP plumbing for the Ollama adapters: one POST helper that turns
 * the two common failures into errors that tell you what to do.
 */

export async function postToOllama(fetchFn: typeof fetch, host: string, path: string, body: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(`${host}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // fetch only throws on network failures (connection refused, DNS…), never on HTTP status codes.
    throw new Error(
      `Could not reach Ollama at ${host}. Is it running? Start the Ollama app (or run \`ollama serve\`) and try again.`,
      { cause: error },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const hint = response.status === 404 ? " Download the model first with `ollama pull <model>`." : "";
    throw new OllamaError(`Ollama returned ${response.status} for ${path}: ${detail.trim()}${hint}`, response.status);
  }
  return response;
}

/** Carries the HTTP status so withRetry / CLI hints can read it (same shape as SDK errors). */
export class OllamaError extends Error {
  override name = "OllamaError";
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
