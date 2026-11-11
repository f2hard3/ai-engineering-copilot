
import OpenAI from "openai";
import "dotenv/config";
import type { Chunk, RetrievedChunk } from "./retrieval.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export function cosineSimilarity(
  a: number[],
  b: number[],
): number {
  if (a.length === 0 || a.length !== b.length) {
    throw new Error("Vectors must have the same non-zero dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  
  for (let i = 0; i < a.length; i++) {
    const valueA = a[i];
    const valueB = b[i];

    if (valueA === undefined || valueB === undefined) {
      throw new Error("Vector contains an undefined value");
    }

    dotProduct += valueA * valueB;
    normA += valueA ** 2;
    normB += valueB ** 2;
  }


  if (normA === 0 || normB === 0) {
    throw new Error("Cosine similarity is undefined for zero vectors");
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveChunksByEmbedding(
  query: string,
  chunks: Chunk[],
  topK = 3,
): Promise<RetrievedChunk[]> {
  if (topK <= 0 || chunks.length === 0 || !query.trim()) {
    return [];
  }

  const [queryEmbedding] = await createEmbeddings([query]);

  if (!queryEmbedding) {
    throw new Error("Failed to create query embedding");
  }

  const chunkEmbeddings = await createEmbeddings(
    chunks.map((chunk) => chunk.content),
  );

  
  return chunks
    .map((chunk, index) => {
      const chunkEmbedding = chunkEmbeddings[index];

      if (!chunkEmbedding) {
        throw new Error(`Missing embedding for chunk: ${chunk.id}`);
      }

      return {
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunkEmbedding),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
