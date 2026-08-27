import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 64;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ["\n\n", "\n", ". ", "? ", "! "],
});

export async function extractPdfText(filePath: string): Promise<string> {
  const parser = new PDFParse({ data: readFileSync(filePath) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}


export async function splitIntoChunks(text: string): Promise<string[]> {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return textSplitter.splitText(normalized);
}

export type TranscriptInfo = {
  client: string;
  month: string;
  day: string;
  mmdd: number;
};

export function parseTranscriptFilename(name: string): TranscriptInfo | null {
  const m = name.match(/^([a-z]+)-(\d{1,2})-(\d{1,2})/i);
  if (!m) return null;
  const month = parseInt(m[2]!, 10);
  const day = parseInt(m[3]!, 10);
  return {
    client: m[1]!.toLowerCase(),
    month: String(month).padStart(2, "0"),
    day: String(day).padStart(2, "0"),
    mmdd: month * 100 + day,
  };
}
