
export type Document = {
  id: string;
  source: string;
  content: string;
};

export type Chunk = {
  id: string;
  source: string;
  content: string;
};

export type RetrievedChunk = Chunk & {
  score: number;
};

export function splitIntoChunks(
  documents: Document[],
  chunkSize = 500,
  overlap = 100,
): Chunk[] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be >= 0 and less than chunkSize");
  }

  const chunks: Chunk[] = [];

  for (const document of documents) {
    const content = document.content.trim();

    if (!content) {
      continue;
    }

    const step = chunkSize - overlap;

    let chunkIndex = 1;

    for (let start = 0; start < content.length; start += step) {
      const text = content.slice(start, start + chunkSize).trim();

      if (!text) {
        continue;
      }

      chunks.push({
        id: `${document.id}-chunk-${chunkIndex}`,
        source: document.source,
        content: text,
      });

      chunkIndex++;
    }
  }

  return chunks;
}

export function retrieveChunks(
  query: string,
  chunks: Chunk[],
  topK = 3,
): RetrievedChunk[] {
  if (topK <= 0) {
    return [];
  }

  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9_#.-]+/)
        .filter((term) => term.length > 1),
    ),
  ];

  if (terms.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const content = chunk.content.toLowerCase();

      const score = terms.reduce((total, term) => {
        return total + (content.includes(term) ? 1 : 0);
      }, 0);

      return {
        ...chunk,
        score,
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
