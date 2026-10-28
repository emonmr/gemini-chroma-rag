/**
 * CHUNKING — split documents into pieces small enough to embed and to fit
 * several of them into a prompt.
 *
 * Strategy (a simplified "recursive character splitter"):
 *   1. split into paragraphs (blank lines)
 *   2. paragraphs that are too long → split into sentences
 *   3. sentences that are still too long → hard cut
 *   4. greedily pack pieces into chunks of at most `chunkSize` characters,
 *      starting each new chunk with the tail (`chunkOverlap`) of the previous
 *      one so an idea split across a boundary isn't lost.
 *
 * Pure function: no I/O, easy to unit test. Chunking quality has a BIG effect
 * on answer quality — experiment with CHUNK_SIZE / CHUNK_OVERLAP in .env.
 */
import type { Chunk, SourceDocument } from "../core/types";

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

/** A piece of text plus the separator to put in front of it when joined. */
interface Piece {
  text: string;
  joiner: string;
}

export function chunkDocument(doc: SourceDocument, options: ChunkOptions): Chunk[] {
  const { chunkSize, chunkOverlap } = options;
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap must be >= 0 and smaller than chunkSize");
  }

  const pieces = splitIntoPieces(normalizeWhitespace(doc.text), chunkSize);
  const texts = packPieces(pieces, options);

  return texts.map((text, chunkIndex) => ({
    id: `${doc.id}#${chunkIndex}`,
    text,
    metadata: { source: doc.source, title: doc.title, chunkIndex },
  }));
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoPieces(text: string, chunkSize: number): Piece[] {
  const pieces: Piece[] = [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (paragraph.length <= chunkSize) {
      pieces.push({ text: paragraph, joiner: "\n\n" });
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
    sentences.forEach((sentence, i) => {
      const joiner = i === 0 ? "\n\n" : " ";
      if (sentence.length <= chunkSize) {
        pieces.push({ text: sentence, joiner });
      } else {
        hardSplit(sentence, chunkSize).forEach((slice, j) => pieces.push({ text: slice, joiner: j === 0 ? joiner : "" }));
      }
    });
  }
  return pieces;
}

function hardSplit(text: string, size: number): string[] {
  const slices: string[] = [];
  for (let i = 0; i < text.length; i += size) slices.push(text.slice(i, i + size));
  return slices;
}

function packPieces(pieces: Piece[], { chunkSize, chunkOverlap }: ChunkOptions): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    const candidate = current ? current + piece.joiner + piece.text : piece.text;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }
    // `current` is full → emit it and start a new chunk seeded with its tail.
    chunks.push(current);
    const overlap = tailAtWordBoundary(current, chunkOverlap);
    current =
      overlap && overlap.length + 1 + piece.text.length <= chunkSize ? `${overlap} ${piece.text}` : piece.text;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Last ~`size` characters of `text`, without starting mid-word. */
function tailAtWordBoundary(text: string, size: number): string {
  if (size <= 0) return "";
  const tail = text.slice(-size);
  const firstSpace = tail.search(/\s/);
  return (firstSpace >= 0 ? tail.slice(firstSpace + 1) : tail).trim();
}
