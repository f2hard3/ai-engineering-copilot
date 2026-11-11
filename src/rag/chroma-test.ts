
import "dotenv/config";
import { ChromaClient } from "chromadb";
import { splitIntoChunks } from "./retrieval.js";
import { splitIntoRecursiveChunks } from "./recursive-chunking.js";
import { createEmbeddings } from "./embedding-retrieval.js";
import { retrieveFromChroma } from "./chroma-retrieval.js";

const chroma = new ChromaClient({
  host: "localhost",
  port: 8000,
  ssl: false,
});

const documents = [
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
  {
    id: "fastify-3266",
    source: "https://github.com/fastify/fastify/issues/3266",
    content: `
      Fastify issue #3266 reports a GET request payload validation error.

      Fastify version 3.20.1 did not parse request payloads
      for GET requests.

      However, developers could still define a body validation
      schema for a GET route.

      As a result, Fastify attempted to validate a body that
      had not been parsed.

      The request body was null, so validation failed with
      the error: body should be object.

      The issue discusses the difference between GET and DELETE
      request payload parsing behavior.
    `,
  },
  {
    id: "fastify-content-type-docs",
    source: "https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/",
    content: `
      Fastify uses a schema-based approach for request validation.

      Validation is only attempted if the content type is
      application/json, unless the body schema uses the content
      property to specify validation per content type.

      When the body schema defines a content field, it must
      enumerate the content types the application expects to handle.

      Body validation can be configured separately for
      application/json and text/plain.

      When using custom content type parsers, the parsed body
      is validated only when the request content type matches
      a key in the schema content map.

      Schema selection uses an exact match on the request's
      essence MIME type.
    `,
  },
];

async function storeChunks(
  collectionName: string,
  chunks: {
    id: string;
    source: string;
    content: string;
  }[],
) {
  const embeddings = await createEmbeddings(
    chunks.map((chunk) => chunk.content),
  );

  try {
    await chroma.deleteCollection({
      name: collectionName,
    });

    console.log(`Deleted existing collection: ${collectionName}`);
  } catch {
    console.log(`No existing collection to delete: ${collectionName}`);
  }

  const collection = await chroma.createCollection({
    name: collectionName,
    configuration: {
      hnsw: {
        space: "cosine",
      },
    },
  });

  await collection.upsert({
    ids: chunks.map((chunk) => chunk.id),
    embeddings,
    documents: chunks.map((chunk) => chunk.content),
    metadatas: chunks.map((chunk) => ({
      source: chunk.source,
    })),
  });

  console.log(
    `Stored ${await collection.count()} chunks in ${collectionName}`,
  );
}

async function main() {
  const basicChunks = splitIntoChunks(documents, 180, 30);
  const recursiveChunks = splitIntoRecursiveChunks(documents, 180, 30);

  console.log("Basic chunks:", basicChunks.length);
  console.log("Recursive chunks:", recursiveChunks.length);

  await storeChunks("fastify_issues_basic", basicChunks);
  await storeChunks("fastify_issues_recursive", recursiveChunks);

  const query = "Why does the request handler receive an empty payload?";

  const basicResults = await retrieveFromChroma(
    query,
    3,
    0,
    "fastify_issues_basic",
  );
  
  console.log("\n=== Basic Chroma Search Results ===");
  
  for (const [index, result] of basicResults.entries()) {
    console.log({
      rank: index + 1,
      id: result.id,
      score: result.score.toFixed(4),
      content: result.content,
    });
  }
  
  const recursiveResults = await retrieveFromChroma(
    query,
    3,
    0,
    "fastify_issues_recursive",
  );
  
  console.log("\n=== Recursive Chroma Search Results ===");
  
  for (const [index, result] of recursiveResults.entries()) {
    console.log({
      rank: index + 1,
      id: result.id,
      score: result.score.toFixed(4),
      content: result.content,
    });
  }
}

main().catch((error: unknown) => {
  console.error("Chroma test failed:", error);
  process.exitCode = 1;
});
