/**
 * ADAPTER: DocumentLoader → .md / .txt files in a folder (recursively).
 * Roadmap idea: add a PdfLoader or WebPageLoader implementing the same port.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DocumentLoader } from "../../core/ports";
import type { SourceDocument } from "../../core/types";

const SUPPORTED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export class FileSystemLoader implements DocumentLoader {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async load(): Promise<SourceDocument[]> {
    const exists = await stat(this.rootDir).then((s) => s.isDirectory()).catch(() => false);
    if (!exists) throw new Error(`Docs folder not found: ${this.rootDir} (check DOCS_DIR in .env)`);

    const entries = await readdir(this.rootDir, { recursive: true });
    const files = entries
      .filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry).toLowerCase()))
      .sort();

    const documents: SourceDocument[] = [];
    for (const relativePath of files) {
      const text = await readFile(path.join(this.rootDir, relativePath), "utf8");
      // Forward slashes so ids are identical on Windows and Linux.
      const id = relativePath.split(path.sep).join("/");
      documents.push({ id, source: id, title: extractTitle(text, relativePath), text });
    }
    return documents;
  }
}

/** First markdown "# Heading", else the file name. */
export function extractTitle(text: string, filePath: string): string {
  const heading = /^#\s+(.+)$/m.exec(text);
  return heading?.[1]?.trim() ?? path.basename(filePath, path.extname(filePath));
}
