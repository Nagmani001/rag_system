import { ChromaClient } from "chromadb";

export const chromaClient = new ChromaClient({
  path: process.env.CHROMA_DB_URL ?? "http://localhost:8000"
});
