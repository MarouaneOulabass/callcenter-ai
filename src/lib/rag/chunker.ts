export interface Chunk {
  content: string;
  metadata: Record<string, unknown>;
}

export function chunkText(text: string, options?: { chunkSize?: number; overlap?: number }): Chunk[] {
  const chunkSize = options?.chunkSize ?? 1000;
  const overlap = options?.overlap ?? 200;
  const chunks: Chunk[] = [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { chunkIndex: chunkIndex++ },
      });
      // Keep overlap from end of previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = Math.ceil(overlap / 5); // Approximate words for overlap
      currentChunk = words.slice(-overlapWords).join(' ') + '\n\n' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { chunkIndex: chunkIndex },
    });
  }

  // Handle case where text has no paragraph breaks
  if (chunks.length === 0 && text.trim()) {
    const words = text.trim().split(/\s+/);
    for (let i = 0; i < words.length; i += Math.floor(chunkSize / 5)) {
      const slice = words.slice(i, i + Math.floor(chunkSize / 5));
      if (slice.length > 0) {
        chunks.push({
          content: slice.join(' '),
          metadata: { chunkIndex: chunks.length },
        });
      }
    }
  }

  return chunks;
}
