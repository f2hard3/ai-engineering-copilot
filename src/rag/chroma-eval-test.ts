import { splitIntoChunks, type Document } from "./retrieval.js";
import { retrieveFromChroma } from "./chroma-retrieval.js";

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

const testCases = [
  {
    query: "PUT request body undefined",
    expectedDocumentIds: ["fastify-7038"],
  },
  {
    query: "database connection pool",
    expectedDocumentIds: [],
  },
  {
    query: "Content-Type missing returns 415",
    expectedDocumentIds: ["fastify-7038"],
  },
  {
    query: "Why does the request handler receive an empty payload?",
    expectedDocumentIds: ["fastify-7038"],
  },
  {
    query: "Why does GET request body validation fail?",
    expectedDocumentIds: ["fastify-3266"],
  },
  {
    query: "Does Fastify parse GET request payloads?",
    expectedDocumentIds: ["fastify-3266"],
  },
  {
    query: "How can I define separate validation schemas for application/json and text/plain?",
    expectedDocumentIds: [
      "fastify-content-type-docs",
    ],
  },
  {
    query: "How does Fastify select a schema based on the request MIME type?",
    expectedDocumentIds: [
      "fastify-content-type-docs",
    ],
  },
];

async function main() {
  const chunks = splitIntoChunks(documents, 180, 30);

  let reciprocalRankSum = 0;
  let recallSum = 0;
  let positiveQueryCount = 0;

  let noResultCorrect = 0;
  let noResultCount = 0;

  for (const testCase of testCases) {
    const results = await retrieveFromChroma(
      testCase.query,
      3,
      0.4,
      "fastify_issues_basic",
    );

    const retrievedDocumentIds = Array.from(
      new Set(
        results.map((result) => {
          return result.id.split("-chunk-")[0];
        }),
      ),
    );

    const rankedResults = results.map((result, index) => ({
      rank: index + 1,
      id: result.id,
      score: result.score.toFixed(4),
    }));

    if (testCase.expectedDocumentIds.length === 0) {
      noResultCount++;

      const passed = results.length === 0;

      if (passed) {
        noResultCorrect++;
      }

      console.log({
        query: testCase.query,
        expected: "No results",
        retrieved: rankedResults,
        passed,
      });

      continue;
    }

    positiveQueryCount++;

    const relevantRanks = testCase.expectedDocumentIds
      .map((id) => retrievedDocumentIds.indexOf(id))
      .filter((rank) => rank !== -1);

    const firstRelevantRank =
      relevantRanks.length > 0 ? Math.min(...relevantRanks) : -1;

    const reciprocalRank =
      firstRelevantRank === -1 ? 0 : 1 / (firstRelevantRank + 1);

    const recall =
      relevantRanks.length / testCase.expectedDocumentIds.length;

    reciprocalRankSum += reciprocalRank;
    recallSum += recall;

    console.log({
      query: testCase.query,
      expected: testCase.expectedDocumentIds,
      retrieved: rankedResults,
      reciprocalRank,
      recall,
    });
  }

  console.log("\n=== Chroma Vector Search Evaluation ===");

  console.log({
    documents: documents.length,
    chunks: chunks.length,
    testCases: testCases.length,
    MRR: reciprocalRankSum / positiveQueryCount,
    averageRecallAt3: recallSum / positiveQueryCount,
    noResultAccuracy: noResultCorrect / noResultCount,
  });
}

main().catch((error: unknown) => {
  console.error("Chroma evaluation failed:", error);
  process.exitCode = 1;
});