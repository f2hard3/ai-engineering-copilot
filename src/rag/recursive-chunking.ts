import type { Document, Chunk } from "./retrieval.js";

const separators = ["\n\n", "\n", ". ", " ", ""];

export function splitIntoRecursiveChunks(
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

    if (!content) continue;

    const parts = splitText(content, chunkSize);
    const mergedChunks = mergeParts(parts, chunkSize, overlap);

    mergedChunks.forEach((text, index) => {
      chunks.push({
        id: `${document.id}-chunk-${index + 1}`,
        source: document.source,
        content: text,
      });
    });
  }

  return chunks;
}

function splitText(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const separator = separators.find((item) => {
    return item !== "" && text.includes(item);
  });

  if (!separator) {
    return splitByCharacter(text, chunkSize);
  }

  const rawParts = text.split(separator);

  const parts = rawParts
    .map((part, index) => {
      return index < rawParts.length - 1
        ? `${part}${separator}`
        : part;
    })
    .filter(Boolean);

  return parts.flatMap((part) => {
    if (part.length <= chunkSize) {
      return [part];
    }

    return splitText(part, chunkSize);
  });
}

function splitByCharacter(
  text: string,
  chunkSize: number,
): string[] {
  const parts: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    parts.push(text.slice(i, i + chunkSize));
  }

  return parts;
}

function mergeParts(
  parts: string[],
  chunkSize: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  for (const part of parts) {
    const candidate = currentChunk
      ? `${currentChunk}${part}`
      : part;

    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    const availableLength = Math.min(
      overlap,
      currentChunk.length,
      chunkSize - part.length,
    );
    
    const words = currentChunk.split(/(\s+)/);
    let overlapText = "";
    
    for (let i = words.length - 1; i >= 0; i--) {
      const candidate = words[i] + overlapText;
    
      if (candidate.length > availableLength) {
        break;
      }
    
      overlapText = candidate;
    }

    overlapText = overlapText.trimStart();

    if (!overlapText.trim()) {
      overlapText = "";
    }

    currentChunk = `${overlapText}${part}`;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}