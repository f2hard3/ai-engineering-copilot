import "dotenv/config";
import { ChromaClient } from "chromadb";
import { createEmbeddings } from "./embedding-retrieval.js";
import type { RetrievedChunk } from "./retrieval.js";

const chroma = new ChromaClient({
  host: "localhost",
  port: 8000,
  ssl: false,
});

export async function retrieveFromChroma(
  query: string,
  topK = 3,
  minScore = 0,
  collectionName = "fastify_issues",
): Promise<RetrievedChunk[]> {
  if (!query.trim() || topK <= 0) {
    return [];
  }

  const collection = await chroma.getCollection({
    name: collectionName,
  });

  const [queryEmbedding] = await createEmbeddings([query]);

  if (!queryEmbedding) {
    throw new Error("Failed to create query embedding");
  }

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

  const ids = results.ids[0] ?? [];
  const distances = results.distances?.[0] ?? [];
  const documents = results.documents?.[0] ?? [];
  const metadatas = results.metadatas?.[0] ?? [];

  return ids.flatMap((id, index) => {
    const content = documents[index];
  
    if (content === null || content === undefined) {
      return [];
    }
  
    const metadata = metadatas[index];
    const source =
      metadata && typeof metadata.source === "string"
        ? metadata.source
        : "unknown";
  
    const distance = distances[index];
    const score =
      distance === null || distance === undefined
        ? 0
        : 1 - distance;
  
    if (score < minScore) {
      return [];
    }
  
    return [{
      id,
      source,
      content,
      score,
    }];
  });
}