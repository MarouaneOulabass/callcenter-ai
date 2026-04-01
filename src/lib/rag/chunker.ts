export interface Chunk {
  content: string;
  metadata: Record<string, unknown>;
}

export function chunkText(text: string, options?: { chunkSize?: number; overlap?: number }): Chunk[] {
  const chunkSize = options?.chunkSize ?? 1000;
  const overlap = options?.overlap ?? 200;
  const chunks: Chunk[] = [];

  if (!text.trim()) return chunks;

  // Split into sentences (handles ., !, ?, and newlines)
  const sentences = text.split(/(?<=[.!?。\n])\s+/).filter(s => s.trim());

  if (sentences.length === 0) {
    chunks.push({ content: text.trim(), metadata: { chunkIndex: 0 } });
    return chunks;
  }

  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 1 > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkIndex: chunkIndex++ },
      });

      // Build overlap from end of current chunk (by sentences)
      const overlapSentences = currentChunk.split(/(?<=[.!?。\n])\s+/);
      let overlapText = '';
      for (let i = overlapSentences.length - 1; i >= 0; i--) {
        const candidate = overlapSentences[i] + ' ' + overlapText;
        if (candidate.length > overlap) break;
        overlapText = candidate;
      }
      currentChunk = overlapText.trim() + ' ' + trimmed;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { chunkIndex },
    });
  }

  return chunks;
}
