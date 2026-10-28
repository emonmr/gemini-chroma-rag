/**
 * ADAPTER: ChatModel → Google Gemini (via the official @google/genai SDK).
 * This is the ONLY place that knows Gemini's request/response shapes.
 */
import type { Content, GoogleGenAI } from "@google/genai";
import type { ChatModel, GenerateRequest } from "../../core/ports";
import type { ChatMessage } from "../../core/types";
import { withRetry } from "../../shared/retry";

export class GeminiChatModel implements ChatModel {
  readonly modelId: string;
  private readonly ai: GoogleGenAI;

  constructor(ai: GoogleGenAI, modelId: string) {
    this.ai = ai;
    this.modelId = modelId;
  }

  async generate(request: GenerateRequest): Promise<string> {
    const response = await withRetry(() =>
      this.ai.models.generateContent({
        model: this.modelId,
        contents: toGeminiContents(request.messages),
        config: this.toConfig(request),
      }),
    );
    return response.text ?? "";
  }

  async *stream(request: GenerateRequest): AsyncGenerator<string> {
    // Only the initial request is retried; a stream that breaks mid-way surfaces the error.
    const stream = await withRetry(() =>
      this.ai.models.generateContentStream({
        model: this.modelId,
        contents: toGeminiContents(request.messages),
        config: this.toConfig(request),
      }),
    );
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }

  private toConfig(request: GenerateRequest) {
    return {
      systemInstruction: request.system,
      // Google recommends keeping Gemini 3.x at its default temperature, so we only send it when asked.
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };
  }
}

function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}
