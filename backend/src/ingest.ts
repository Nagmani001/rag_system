import { dirname } from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { Metadata } from "chromadb";
import { chromaClient } from "./chroma";
import {
  extractPdfText,
  titleForPolicy,
  detectCenter,
  extractPolicyNumber,
  splitIntoChunks,
  parseTranscriptFilename,
} from "./lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(__dirname, "..", "docments");
const POLICIES_DIR = join(DATA_ROOT, "docs_for_test", "docs_for_test");
const TRANSCRIPTS_DIR = join(DATA_ROOT, "transcriptions_for_test", "transcriptions_for_test");


async function ingestPolicies() {
  const collection = chromaClient.createCollection({ name: "policies" });
  const files = readdirSync(POLICIES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => ({ name: f, path: join(POLICIES_DIR, f) }));;

  let totalRecords = 0;

  for (const file of files) {
    const text = await extractPdfText(file.path);
    const policyId = uuidv4();

    const chunks = splitIntoChunks(text);
    const center = detectCenter(text);
    const policyNumber = extractPolicyNumber(text);

    const ids: string[] = [];
    const documents: string[] = [];
    const metadatas: Metadata[] = [];

    chunks.forEach((chunk, index) => {
      ids.push(`${policyId}__chunk-${index}`);
      documents.push(chunk);
      metadatas.push({
        docType: "policy",
        policyId,
        title: titleForPolicy(file.name),
        sourceFile: file.name,
        center,
        ...(policyNumber ? { policyNumber } : {}),
        chunkIndex: index,
        totalChunks: chunks.length,
      });
    });

    await collection.add({ ids, metadatas, documents });
    totalRecords += chunks.length;
    console.log(
      `[policies] ${file.name} -> center=${center} chunks=${chunks.length} chars=${text.length}`
    );
  }

  console.log(`[policies] done, ${totalRecords} records in 'policies'`);
}

async function ingestTranscripts() {
  const collection = chromaClient.createCollection({ name: "transcripts" });
  const files = readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => ({ name: f, path: join(TRANSCRIPTS_DIR, f) }));;

  let totalRecords = 0;

  for (const file of files) {
    const info = parseTranscriptFilename(file.name);
    if (!info) {
      console.warn(`[transcripts] skipping unparsable filename: ${file.name}`);
      continue;
    }

    const text = await extractPdfText(file.path);
    const transcriptId = uuidv4();
    const chunks = splitIntoChunks(text);

    const ids: string[] = [];
    const documents: string[] = [];
    const metadatas: Metadata[] = [];

    chunks.forEach((chunk, index) => {
      ids.push(`${transcriptId}__chunk-${index}`);
      documents.push(chunk);
      metadatas.push({
        docType: "transcript",
        transcriptId,
        client: info.client,
        sessionDate: `${info.month}-${info.day}`,
        sessionMmdd: info.mmdd,
        sourceFile: file.name,
        chunkIndex: index,
        totalChunks: chunks.length,
      });
    });

    await collection.add({ ids, metadatas, documents });
    totalRecords += chunks.length;
    console.log(
      `[transcripts] ${file.name} -> client=${info.client} date=${info.month}-${info.day} chunks=${chunks.length} chars=${text.length}`
    );
  }

  console.log(`[transcripts] done, ${totalRecords} records in 'transcripts'`);
}

async function main() {
  await ingestPolicies();
  await ingestTranscripts();

  const policies = await chromaClient.getCollection({ name: "policies" });
  const transcripts = await chromaClient.getCollection({ name: "transcripts" });
  console.log(`[ingest] final counts: policies=${await policies.count()} transcripts=${await transcripts.count()}`);
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});
