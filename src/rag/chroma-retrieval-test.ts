import { retrieveFromChroma } from "./chroma-retrieval.js";

const query = "Why does the request handler receive an empty payload?";

const results = await retrieveFromChroma(query, 3);

console.log("\n=== Chroma Retrieval Test ===");
console.log(`Query: ${query}`);
console.log(`Retrieved ${results.length} chunks\n`);

for (const [index, result] of results.entries()) {
  console.log({
    rank: index + 1,
    id: result.id,
    source: result.source,
    score: result.score.toFixed(4),
    content: result.content,
  });
}