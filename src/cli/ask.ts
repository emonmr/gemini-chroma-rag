/**
 * npm run ask -- "How many vacation days do I get?"
 * npm run ask:debug -- "How many vacation days do I get?"   ← also prints the chunks + the exact prompt
 */
import { createContainer } from "../container";
import { formatSources, handleCliError, parseAskArgs } from "./shared";

async function main() {
  const { question, debug } = parseAskArgs(process.argv.slice(2));
  if (!question) {
    console.log('Usage: npm run ask -- "your question"   (or ask:debug)');
    process.exit(1);
  }

  const app = createContainer();
  let sourcesText = "";

  process.stdout.write("\n");
  for await (const event of app.ask.askStream(question)) {
    if (event.type === "sources") {
      sourcesText = formatSources(event.sources);
      if (debug) {
        for (const [i, s] of event.sources.entries()) {
          console.log(`\nChunk ${i + 1}:`);
          console.log(`Source: ${s.metadata.source}`);
          console.log(`Chunk Index: ${s.metadata.chunkIndex}`);
          console.log(`Score: ${s.score.toFixed(3)}`);
          console.log(`Text: ${s.text}`);
        }
      }

    } else if (event.type === "prompt") {

      if (debug) {
        console.log("\n===== SYSTEM =====");
        console.log(event.request.system);
        console.log("\n===== MESSAGES =====");
        for (const [i, msg] of event.request.messages.entries()) {
          console.log(`\nMessage ${i + 1}:`);
          console.log(`Role: ${msg.role}`);
          console.log(`Text: ${msg.text}`);
        }
        console.log("===== Answer =====");
      }
    } else {
      process.stdout.write(event.text);
    }
  }
  console.log(`\n\nSources:\n${sourcesText}\n`);
}

main().catch(handleCliError);
