import { existsSync } from "node:fs";
import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
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

export function fileExtension(name: string): string {
  return (name.match(/\.[^.\\/]+$/)?.[0] ?? "").toLowerCase();
}

export const SUPPORTED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

/**
 * Load an uploaded file (a web `Blob`/`File`) into LangChain `Document`s,
 * dispatching on the file extension. PDFs keep per-page splitting (with
 * `loc.pageNumber`); docx/txt/md become a single text Document (no page).
 * The loaders set `metadata.source = "blob"` for Blob input, so we overwrite
 * it with the real file name for citations and the document list.
 */
export async function loadUploadedFile(blob: Blob, name: string): Promise<Document[]> {
  const ext = fileExtension(name);
  let docs: Document[];
  switch (ext) {
    case ".pdf":
      docs = await new PDFLoader(blob, { splitPages: true }).load();
      break;
    case ".docx":
      docs = await new DocxLoader(blob).load();
      break;
    case ".txt":
    case ".md":
      docs = await new TextLoader(blob).load();
      break;
    default:
      throw new Error(`Unsupported file type "${ext || name}". Allowed: PDF, DOCX, TXT, MD.`);
  }
  for (const d of docs) d.metadata = { ...d.metadata, source: name };
  return docs;
}

/**
 * Load a source into LangChain `Document`s (used by the CLI).
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
