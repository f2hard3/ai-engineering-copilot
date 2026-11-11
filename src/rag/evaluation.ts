import type { RetrievedChunk } from "./retrieval.js";

export type EvaluationTestCase = {
  query: string;
  expectedDocumentIds: string[];
};

type EvaluationResult = {
  passed: number;
  total: number;
  mrr: number;
  averageRecallAtK: number;
  averagePrecisionAtK: number;
  noResultAccuracy: number;
};

type QueryResult = {
  query: string;
  success: boolean;
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
};

type SearchFunction = (
  query: string,
  topK: number,
) => RetrievedChunk[] | Promise<RetrievedChunk[]>;

export async function evaluateRetrieval(
  testCases: EvaluationTestCase[],
  search: SearchFunction,
  topK = 3,
): Promise<{
  summary: EvaluationResult;
  results: QueryResult[];
}> {
  let passed = 0;
  let positiveQueryCount = 0;
  let noResultQueryCount = 0;
  let noResultCorrectCount = 0;

  let totalReciprocalRank = 0;
  let totalRecallAtK = 0;
  let totalPrecisionAtK = 0;

  const results: QueryResult[] = [];

  for (const testCase of testCases) {
    const retrievedChunks = await search(testCase.query, topK);
    const expectedDocumentIds = testCase.expectedDocumentIds;

    const retrievedDocumentIds = Array.from(
      new Set(
        retrievedChunks
          .map((chunk) => chunk.id.split("-chunk-")[0])
          .filter((id): id is string => id !== undefined),
      ),
    );

    if (expectedDocumentIds.length === 0) {
      noResultQueryCount++;

      const success = retrievedChunks.length === 0;

      if (success) {
        noResultCorrectCount++;
        passed++;
      }

      results.push({
        query: testCase.query,
        success,
        recallAtK: 0,
        precisionAtK: 0,
        reciprocalRank: 0,
      });

      continue;
    }

    positiveQueryCount++;

    const relevantRetrievedCount = expectedDocumentIds.filter(
      (id) => retrievedDocumentIds.includes(id),
    ).length;

    const recallAtK =
      relevantRetrievedCount / expectedDocumentIds.length;

    const relevantChunkCount = retrievedChunks.filter((chunk) => {
      const documentId = chunk.id.split("-chunk-")[0];

      return (
        documentId !== undefined &&
        expectedDocumentIds.includes(documentId)
      );
    }).length;

    const precisionAtK = relevantChunkCount / topK;

    const relevantIndex = retrievedChunks.findIndex((chunk) => {
      const documentId = chunk.id.split("-chunk-")[0];

      return (
        documentId !== undefined &&
        expectedDocumentIds.includes(documentId)
      );
    });

    const reciprocalRank =
      relevantIndex >= 0 ? 1 / (relevantIndex + 1) : 0;

    const success =
      relevantRetrievedCount === expectedDocumentIds.length;

    if (success) {
      passed++;
    }

    totalRecallAtK += recallAtK;
    totalPrecisionAtK += precisionAtK;
    totalReciprocalRank += reciprocalRank;

    results.push({
      query: testCase.query,
      success,
      recallAtK,
      precisionAtK,
      reciprocalRank,
    });
  }

  return {
    summary: {
      passed,
      total: testCases.length,
      mrr:
        positiveQueryCount > 0
          ? totalReciprocalRank / positiveQueryCount
          : 0,
      averageRecallAtK:
        positiveQueryCount > 0
          ? totalRecallAtK / positiveQueryCount
          : 0,
      averagePrecisionAtK:
        positiveQueryCount > 0
          ? totalPrecisionAtK / positiveQueryCount
          : 0,
      noResultAccuracy:
        noResultQueryCount > 0
          ? noResultCorrectCount / noResultQueryCount
          : 0,
    },
    results,
  };
}