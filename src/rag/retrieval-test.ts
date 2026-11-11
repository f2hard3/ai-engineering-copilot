
import {
  splitIntoChunks,
  retrieveChunks,
  type Document,
} from "./retrieval.js";

const documents: Document[] = [
  {
    id: "fastify-7038",
    source: "https://github.com/fastify/fastify/issues/7038",
    content: `
      Fastify issue #7038 reports that a PUT request can reach
      the route handler with body undefined.

      The route schema defines specific content types, such as
      application/json and text/plain.

      When the request has no Content-Type header and no body,
      validation unexpectedly passes and the route handler receives
      body undefined.

      A request without Content-Type but with a body returns 415.
      A request with Content-Type but without a body returns 400.

      Expected behavior: reject the request with HTTP 400 or 415.
    `,
  },
];

const chunks = splitIntoChunks(documents, 180, 30);

const query = "PUT request body undefined";

const results = retrieveChunks(query, chunks, 3);

console.log("Total chunks:", chunks.length);
console.log("\nQuery:", query);
console.log("\nRetrieved chunks:");
console.log(JSON.stringify(results, null, 2));
