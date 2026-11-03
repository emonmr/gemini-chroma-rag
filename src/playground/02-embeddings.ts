/**
 * LESSON 2 — see what embeddings actually do.  Run: npm run embeddings
 *
 * We embed a few sentences and print a similarity matrix. Sentences that MEAN the
 * same thing score high even when they share no words — that's semantic search.
 *
 * Try: add your own sentences, try another language (Bangla!), try a typo.
 */
import { handleCliError } from "../cli/shared";
import { loadEnv } from "../config/env";
import { createModels } from "../container";
import { cosineSimilarity, topK } from "../shared/vector";

const sentences = [
  "How many vacation days do employees get?",
  "Staff receive 22 days of paid annual leave.",
  "The espresso machine needs descaling every month.",
  "আমি কত দিন ছুটি পাব?", // "How many days of leave will I get?" in Bangla
  // TODO (step 0.3): add your own sentences, then predict each score BEFORE you run it:
  // TODO: a typo version of sentence 1, e.g. "How mny vacaton days do employes get?"
  // TODO: a NEGATION, e.g. "Employees get no paid leave." (does the model notice "no"?)
  // TODO: an UNRELATED Bangla sentence (about weather, food…) → language vs. meaning
  // TODO: one sentence of your choice that should be related but shares no words
  "আজকের আবহাওয়া কেমন?", // "How is the weather today?" in Bangla,
  "How much money for office equipment for my home office?",
  "If employees work in holidays, do they get paid?",
  "How many days for sick leave?"
];

async function main() {
  const env = loadEnv();
  // Uses whichever embedder LLM_PROVIDER selects (Gemini or Ollama). Compare the two!
  const { embedder } = createModels(env);
  console.log(`Embedding model: ${embedder.modelId}`);

  const vectors = await embedder.embedDocuments(sentences.map((text) => ({ title: "none", text })));
  console.log(`${vectors.length} vectors × ${vectors[0]?.length} dimensions`);
  console.log(`first 5 numbers of vector #1: [${vectors[0]?.slice(0, 5).map((n) => n.toFixed(4)).join(", ")}, …]\n`);

  console.log("Cosine similarity (1.0 = same meaning):\n");
  sentences.forEach((a, i) => {
    sentences.forEach((b, j) => {
      if (j <= i) return;
      const score = cosineSimilarity(vectors[i]!, vectors[j]!);
      console.log(`${score.toFixed(3)}  "${a}"  ↔  "${b}"`);
    });
  });

  // Asymmetric retrieval: a QUESTION embedded as a query vs. documents
  const query = await embedder.embedQuery("how much time off do I get?");
  console.log("\nQuery 'how much time off do I get?' vs each sentence:");
  sentences.forEach((s, i) => console.log(`${cosineSimilarity(query, vectors[i]!).toFixed(3)}  ${s}`));

  // TODO (step 0.3): once topK() passes its tests, print the top 3 sentences for the query
  // using topK(query, vectors, 3). That's a mini vector DB: what Chroma does in `npm run ask`.
  return topK(query, vectors, 3);
}

main().catch(handleCliError);
