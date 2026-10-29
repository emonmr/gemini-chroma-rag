/**
 * LESSON 1 — your first LLM call.  Run: npm run hello
 *
 * Things to try (edit and re-run):
 *  - change the systemInstruction and see how the "personality" changes
 *  - ask about a fictional fact ("What is Nimbus Coffee's leave policy?") and watch it
 *    make something up → this is exactly the problem RAG solves
 *  - print `response.usageMetadata` to see token counts (tokens = cost + latency)
 */
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "../config/env";
import { handleCliError } from "../cli/shared";

async function main() {
  const env = loadEnv();
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  console.log(`Model: ${env.GEMINI_CHAT_MODEL}\n`);

  // 1) One-shot request/response
  const response = await ai.models.generateContent({
    model: env.GEMINI_CHAT_MODEL,
    contents: "In two sentences: what is an RAG, explained to a Seniour software engineer?",
    config: { systemInstruction: "You are a concise senior engineer." },
  });
  console.log("── generateContent ──");
  console.log(response.text);
  console.log("\nusage:", response.usageMetadata);

  // 2) Streaming — same call, but tokens arrive as they're generated
  console.log("\n── generateContentStream ──");
  const stream = await ai.models.generateContentStream({
    model: env.GEMINI_CHAT_MODEL,
    contents: "List 3 things that make an AI product feel fast. One line each.",
  });
  for await (const chunk of stream) process.stdout.write(chunk.text ?? "");
  console.log("\n");
}

main().catch(handleCliError);
