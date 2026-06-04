import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config } from "./config";
import { ingest } from "./ingest";
import { makeEmbeddings } from "./models";
import { loadStore } from "./vectorStore";
import { buildGraph } from "./graph";

async function runQuery(question: string): Promise<void> {
  const store = await loadStore(makeEmbeddings(), config.storePath);
  if (!store) {
    console.error(`No vector store found at "${config.storePath}".`);
    console.error(`Run ingestion first, e.g.:  npm run ingest -- ${config.sourceUrl}`);
    process.exitCode = 1;
    return;
  }

  const app = buildGraph(store);

  if (question) {
    const result = await app.invoke({ question });
    console.log(`\n${result.answer}\n`);
    return;
  }

  const rl = createInterface({ input, output });
  console.log('RAG ready. Ask a question about the indexed docs ("exit" to quit).');
  try {
    for (;;) {
      const q = (await rl.question("\n> ")).trim();
      if (!q) continue;
      if (q === "exit" || q === "quit") break;
      const result = await app.invoke({ question: q });
      console.log(`\n${result.answer}`);
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "ingest":
      await ingest(rest[0] ?? config.sourceUrl);
      break;
    case "query":
      await runQuery(rest.join(" ").trim());
      break;
    case undefined:
      await runQuery("");
      break;
    default:
      // Convenience: treat any other args as a one-shot question.
      await runQuery([command, ...rest].join(" ").trim());
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
