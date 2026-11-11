
import "dotenv/config";
import { splitIntoChunks, retrieveChunks } from "./retrieval.js";
import { retrieveChunksByEmbedding } from "./embedding-retrieval.js";

const documents = [
  {
    id: "fastify-7038",
    source: "GitHub issue #7038",
    content: `
      Fastify issue #7038: A PUT request reaches the route handler with body undefined.

      The route schema defines specific content types such as application/json and text/plain.

      When the request has no Content-Type header and no body, validation unexpectedly passes, and the route handler receives body undefined.

      When the request has no Content-Type header but includes a body, Fastify returns 415 Unsupported Media Type.

      When the request includes a Content-Type header but no body, Fastify returns 400 Bad Request.

      The expected behavior is to reject the invalid request with HTTP 400 or 415.
          `,
  },
];

const chunks = splitIntoChunks(documents, 180, 30);

const query = "Why does the request handler receive an empty payload?";

console.log("\n=== Keyword Retrieval ===");

const keywordResults = retrieveChunks(query, chunks, 3);

for (const [index, result] of keywordResults.entries()) {
  console.log({
    rank: index + 1,
    id: result.id,
    score: result.score,
    content: result.content,
  });
}

console.log("\n=== Embedding Retrieval ===");

const embeddingResults = await retrieveChunksByEmbedding(query, chunks, 3);

for (const [index, result] of embeddingResults.entries()) {
  console.log({
    rank: index + 1,
    id: result.id,
    score: result.score.toFixed(4),
    content: result.content,
  });
}
