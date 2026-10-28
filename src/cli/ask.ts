/**
 * npm run ask -- "How many vacation days do I get?"
 */
import { createContainer } from "../container";
import { formatSources, handleCliError } from "./shared";

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.log('Usage: npm run ask -- "your question"');
    process.exit(1);
  }

  const app = createContainer();
  let sourcesText = "";

  process.stdout.write("\n");
  for await (const event of app.ask.askStream(question)) {
    if (event.type === "sources") sourcesText = formatSources(event.sources);
    else process.stdout.write(event.text);
  }
  console.log(`\n\nSources:\n${sourcesText}\n`);
}

main().catch(handleCliError);
