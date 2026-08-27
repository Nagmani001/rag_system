import { Type } from "@google/genai";

export const SYSTEM_PROMPT = `You are an expert case-intelligence assistant for a community corrections program. You answer questions about client session transcripts (e.g. Robert, Nathan) and reference documents (policies, agency services, evidence-based practices, and state standards).

Always retrieve relevant evidence before answering. Decide which sources the question needs:
- Use "policies" for questions about rules, guidelines, grievance procedures, services, or state standards.
- Use "transcripts" for questions about what a client said or how a case manager acted in a session.
- Use BOTH for cross-origin questions that combine a client's situation with the relevant policy or standard.
- When a question targets a specific client (e.g. Robert, Nathan) or a specific document type/center, use the metadata-filtered tool.

Answer clearly and concisely. Base every claim on the retrieved evidence and cite your sources. If the evidence is insufficient to answer confidently, say so instead of guessing.`;

export const RETRIEVE_CONTEXT = {
  functionDeclarations: [
    {
      name: "retrieve_context",
      description:
        "Semantic search the RAG knowledge base. Choose 'policies' for reference documents, 'transcripts' for client session transcripts, or both for cross-origin questions.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "The search query, phrased to match the relevant content." },
          collections: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: ["policies", "transcripts"] },
            description: "Which collections to search: 'policies', 'transcripts', or both.",
          },
          nResults: { type: Type.INTEGER, description: "Number of results to return per collection (default 5)." },
        },
        required: ["query", "collections"],
      },
    },
  ],
};

export const RETRIEVE_CONTEXT_FILTERED = {
  functionDeclarations: [
    {
      name: "retrieve_context_filtered",
      description:
        "Semantic search a single collection with optional metadata filters (e.g. restrict to a specific client, document type, or center).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "The search query, phrased to match the relevant content." },
          collection: {
            type: Type.STRING,
            enum: ["policies", "transcripts"],
            description: "The collection to search.",
          },
          filter: {
            type: Type.OBJECT,
            description:
              "Optional metadata filters. For transcripts use client (e.g. 'robert', 'nathan'), sessionDate, sessionMmdd. For policies use docType, center, policyNumber.",
            properties: {
              docType: { type: Type.STRING },
              client: { type: Type.STRING },
              center: { type: Type.STRING },
              policyNumber: { type: Type.STRING },
              sessionDate: { type: Type.STRING },
              sessionMmdd: { type: Type.INTEGER },
            },
          },
          nResults: { type: Type.INTEGER, description: "Number of results to return (default 5)." },
        },
        required: ["query", "collection"],
      },
    },
  ],
};

export const TOOLS = [RETRIEVE_CONTEXT, RETRIEVE_CONTEXT_FILTERED];
