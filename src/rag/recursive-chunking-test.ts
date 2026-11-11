import { splitIntoRecursiveChunks } from "./recursive-chunking.js";
import type { Document } from "./retrieval.js";

const documents: Document[] = [
  {
    id: "test-1",
    source: "test",
    content:
      "Fastify validates request bodies using JSON schema.\n\n" +
      "Missing payloads can cause validation errors.\n\n" +
      "The error response depends on the configured schema.",
  },
];

const chunks = splitIntoRecursiveChunks(documents, 60, 15);

for (const [index, chunk] of chunks.entries()) {
  console.log({
    rank: index + 1,
    id: chunk.id,
    length: chunk.content.length,
    content: chunk.content,
  });
}