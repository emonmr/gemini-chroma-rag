/**
 * ADAPTER: ChatModel → a local LLM served by Ollama (default: qwen3:8b).
 *
 * API:  POST {host}/api/chat
 *   request  { model, messages: [{ role: "system" | "user" | "assistant", content }],
 *              stream: boolean, think?: boolean, options?: { temperature } }
 *   response (stream: false) { message: { role, content }, done: true, prompt_eval_count, eval_count, ... }
 *   response (stream: true)  NDJSON: one JSON object per line, each { message: { content }, done }
 * Docs: https://docs.ollama.com/api/chat
 *
 * Differences from Gemini you have to translate here (this is exactly what adapters are for):
 *  - The system prompt is not a separate config field: it's the first message, with role "system".
 *  - Our domain calls the assistant role "model" (Gemini's name); Ollama wants "assistant".
 *  - temperature goes inside `options`, not at the top level.
 *  - qwen3 is a "thinking" model: by default it reasons for a while before answering, which
 *    is slow on a 3060 Ti and unnecessary for "answer from this context". Send `think: false`.
 */
import type { ChatModel, GenerateRequest } from "../../core/ports";
import type { ChatMessage } from "../../core/types";
import { postToOllama } from "./ollama.http";

type ChatChunk = { message?: { content?: string }; done?: boolean; error?: string };

export class OllamaChatModel implements ChatModel {
  readonly modelId: string;
  private readonly host: string;
  private readonly fetchFn: typeof fetch;

  constructor(host: string, modelId: string, fetchFn: typeof fetch = fetch) {
    this.host = host.replace(/\/+$/, "");
    this.modelId = modelId;
    this.fetchFn = fetchFn;
  }

  async generate(request: GenerateRequest): Promise<string> {
    const response = await postToOllama(this.fetchFn, this.host, "/api/chat", this.toBody(request, false));
    const data = (await response.json()) as ChatChunk;
    if (data.error) throw new Error(`Ollama: ${data.error}`);
    return data.message?.content ?? "";
  }

  async *stream(request: GenerateRequest): AsyncGenerator<string> {
    const response = await postToOllama(this.fetchFn, this.host, "/api/chat", this.toBody(request, true));
    if (!response.body) throw new Error("Ollama returned an empty stream");

    const decoder = new TextDecoder();
    let buffer = "";
    for await (const bytes of response.body) {
      buffer += decoder.decode(bytes, { stream: true });
      // A network chunk can end mid-line: parse only complete lines, keep the rest for next time.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const text = parseLine(line);
        if (text) yield text;
      }
    }
    // The last line may arrive without a trailing "\n".
    const text = parseLine(buffer + decoder.decode());
    if (text) yield text;
  }

  private toBody(request: GenerateRequest, stream: boolean) {
    return {
      model: this.modelId,
      messages: toOllamaMessages(request.system, request.messages),
      stream,
      think: false,
      // Same rule as GeminiChatModel: undefined = keep the model's default.
      ...(request.temperature !== undefined ? { options: { temperature: request.temperature } } : {}),
    };
  }
}

/** Parses one NDJSON line and returns its text delta (throws if Ollama reported an error). */
function parseLine(line: string): string {
  if (!line.trim()) return "";
  const chunk = JSON.parse(line) as ChatChunk;
  if (chunk.error) throw new Error(`Ollama: ${chunk.error}`);
  return chunk.message?.content ?? "";
}

/** Domain messages → Ollama messages: system message first, "model" → "assistant". */
export function toOllamaMessages(system: string, messages: ChatMessage[]): { role: string; content: string }[] {
  return [
    { role: "system", content: system },
    ...messages.map((m) => ({ role: m.role === "model" ? "assistant" : m.role, content: m.text })),
  ];
}
