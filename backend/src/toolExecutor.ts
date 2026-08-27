import { chromaClient } from "./chroma";

const KNOWN_COLLECTIONS = ["policies", "transcripts"];

export async function executeTool(name: any, args: any): Promise<any> {
  if (name === "retrieve_context") {
    return retrieveContext(args);
  }
  if (name === "retrieve_context_filtered") {
    return retrieveContextFiltered(args);
  }
}

async function retrieveContext(args: any): Promise<any> {
  const query: any = String(args?.query ?? "");
  const requested: any = Array.isArray(args?.collections) ? args.collections : ["policies", "transcripts"];
  const collections: any = KNOWN_COLLECTIONS.filter((c: any) => requested.includes(c));
  const nResults: any = Number(args?.nResults ?? 5);
  return runQueries(query, collections, nResults);
}

async function retrieveContextFiltered(args: any): Promise<any> {
  const query: any = String(args?.query ?? "");
  const collection: any = String(args?.collection ?? "policies");
  const filter: any = args?.filter;
  const nResults: any = Number(args?.nResults ?? 5);
  return runQueries(query, [collection], nResults, filter);
}

async function runQueries(query: any, collections: any, nResults: any, where: any = undefined): Promise<any> {
  const sources: any[] = [];
  const output: any[] = [];

  for (const name of collections) {
    const collection = await chromaClient.getCollection({ name });
    const options: any = { queryTexts: [query], nResults };
    if (where) options.where = where;
    const result = await collection.query(options);

    const docs = result.documents?.[0] ?? [];
    const metas = result.metadatas?.[0] ?? [];
    const ids = result.ids?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];

    docs.forEach((text: any, i: any) => {
      if (!text) return;
      const source: any = { collection: name, text };
      if (ids[i]) source.id = ids[i];
      if (metas[i]) source.metadata = metas[i];
      if (typeof distances[i] === "number") source.distance = distances[i];
      sources.push(source);
      output.push(`[${name}] ${text}`);
    });
  }

  return { output: output.join("\n\n---\n\n"), sources };
}
