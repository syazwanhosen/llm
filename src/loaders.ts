import { existsSync } from "node:fs";
import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Document } from "@langchain/core/documents";
import * as cheerio from "cheerio";
import { config } from "./config";

function extractText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, svg").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function isUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

/**
 * Load a source into LangChain `Document`s.
 *
 * - A local PDF path (the main use case) is read with `PDFLoader`, which pulls
 *   the PDF's *text layer* — no OCR/scanning. It returns one Document per page,
 *   tagged with `metadata.loc.pageNumber` so answers can cite pages.
 * - An `http(s)` URL is crawled with `RecursiveUrlLoader` and stripped to text.
 */
export async function loadSource(source: string = config.source): Promise<Document[]> {
  if (isUrl(source)) {
    console.log(`Crawling ${source} (maxDepth=${config.crawlMaxDepth})...`);
    const loader = new RecursiveUrlLoader(source, {
      extractor: extractText,
      maxDepth: config.crawlMaxDepth,
      timeout: 10_000,
      preventOutside: true,
    });
    const docs = await loader.load();
    console.log(`Fetched ${docs.length} page(s).`);
    return docs;
  }

  if (!existsSync(source)) {
    throw new Error(
      `PDF not found at "${source}". Pass a path, e.g.  npm run ingest -- ./my-doc.pdf`,
    );
  }
  console.log(`Reading PDF ${source}...`);
  const loader = new PDFLoader(source, { splitPages: true });
  const docs = await loader.load();
  console.log(`Read ${docs.length} page(s).`);
  return docs;
}
