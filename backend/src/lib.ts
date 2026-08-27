import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 150;

export async function extractPdfText(filePath: string): Promise<string> {
  const parser = new PDFParse({ data: readFileSync(filePath) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function titleForPolicy(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bcopy\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectCenter(text: string): string {
  if (/Johnson County/i.test(text)) return "johnson-county";
  if (/\bDCCC\b|Dubois County/i.test(text)) return "dubois-county";
  if (/State of Colorado|Colorado Community Corrections/i.test(text)) return "colorado-statewide";
  return "general";
}

export function extractPolicyNumber(text: string): string | undefined {
  return text.match(/Policy Number\s*[:#]?\s*(\d+)/i)?.[1];
}

export function splitIntoChunks(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer: string[] = [];
  let bufferLen = 0;

  const flush = () => {
    if (buffer.length > 0) {
      chunks.push(buffer.join("\n"));
      buffer = [];
      bufferLen = 0;
    }
  };

  const pushLine = (line: string) => {
    const addLen = bufferLen === 0 ? line.length : line.length + 1;
    if (bufferLen + addLen > CHUNK_SIZE && buffer.length > 0) {
      const carry: string[] = [];
      let carryLen = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        const prev = buffer[i]!;
        if (carryLen + prev.length > CHUNK_OVERLAP) break;
        carry.unshift(prev);
        carryLen += prev.length;
      }
      chunks.push(buffer.join("\n"));
      buffer = carry;
      bufferLen = carryLen;
    }
    buffer.push(line);
    bufferLen += line.length + 1;
  };

  for (const line of lines) {
    if (line.length <= CHUNK_SIZE) {
      pushLine(line);
      continue;
    }
    flush();
    const sentences = line.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [line];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      if (trimmed.length <= CHUNK_SIZE) pushLine(trimmed);
      else pushLine(trimmed.slice(0, CHUNK_SIZE));
    }
  }
  flush();
  return chunks;
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
