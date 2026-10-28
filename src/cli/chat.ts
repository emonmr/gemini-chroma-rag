/**
 * npm run chat — interactive multi-turn chat over your documents.
 * Commands: /sources (show sources of the last answer), /clear (forget history), /exit
 */
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { createContainer } from "../container";
import type { ChatMessage, RetrievedChunk } from "../core/types";
import { describeError } from "../shared/retry";
import { formatSources, handleCliError } from "./shared";

/** Keep the last N messages so the prompt doesn't grow forever. */
const MAX_HISTORY_MESSAGES = 6;

async function main() {
  const app = createContainer();
  const count = await app.store.count();
  const rl = readline.createInterface({ input, output });

  console.log(`Chatting with ${count} chunk(s) using ${app.chat.modelId}. Type /exit to quit.\n`);
  if (count === 0) console.log("⚠ The collection is empty — run `npm run ingest` first.\n");

  let history: ChatMessage[] = [];
  let lastSources: RetrievedChunk[] = [];

  rl.setPrompt("you › ");
  rl.prompt();

  // Each line you type arrives here (also works with piped input and ends on Ctrl+D / Ctrl+Z).
  for await (const line of rl) {
    const question = line.trim();
    if (question === "/exit") break;

    if (question === "/clear") {
      history = [];
      console.log("History cleared.\n");
    } else if (question === "/sources") {
      console.log(`${formatSources(lastSources)}\n`);
    } else if (question) {
      const answer = await streamAnswer(question);
      if (answer !== undefined) {
        // Store the RAW question (not the context-stuffed prompt) to keep history small.
        history = [...history, { role: "user" as const, text: question }, { role: "model" as const, text: answer }].slice(
          -MAX_HISTORY_MESSAGES,
        );
      }
    }
    rl.prompt();
  }
  rl.close();

  async function streamAnswer(question: string): Promise<string | undefined> {
    let answer = "";
    output.write("ai  › ");
    try {
      for await (const event of app.ask.askStream(question, history)) {
        if (event.type === "sources") lastSources = event.sources;
        else {
          answer += event.text;
          output.write(event.text);
        }
      }
      output.write("\n\n");
      return answer;
    } catch (error) {
      console.log(`\n✖ ${describeError(error)}\n`);
      return undefined;
    }
  }
}

main().catch(handleCliError);
