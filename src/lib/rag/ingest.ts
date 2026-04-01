import { createServiceClient } from '@/lib/supabase/server';
import { chunkText } from './chunker';
import { generateEmbeddings } from './embeddings';

export async function ingestFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  sourceId: string,
  workspaceId: string
): Promise<void> {
  const supabase = await createServiceClient();

  try {
    // Update status to processing
    await supabase
      .from('knowledge_sources')
      .update({ status: 'processing' })
      .eq('id', sourceId);

    // Extract text based on file type
    let text = '';

    if (mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule: any = await import('pdf-parse');
      const pdfParseFn = pdfParseModule.default || pdfParseModule;
      const result = await pdfParseFn(fileBuffer);
      text = result.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
    } else if (mimeType === 'text/csv') {
      text = fileBuffer.toString('utf-8');
    } else {
      // Plain text
      text = fileBuffer.toString('utf-8');
    }

    if (!text.trim()) {
      throw new Error('No text extracted from file');
    }

    // Chunk the text
    const chunks = chunkText(text);

    // Generate embeddings in batches of 20
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await generateEmbeddings(batch.map(c => c.content));

      const rows = batch.map((chunk, j) => ({
        source_id: sourceId,
        workspace_id: workspaceId,
        content: chunk.content,
        embedding: JSON.stringify(embeddings[j]),
        metadata: { ...chunk.metadata, fileName },
      }));

      const { error } = await supabase.from('knowledge_chunks').insert(rows);
      if (error) throw error;
    }

    // Update status to completed
    await supabase
      .from('knowledge_sources')
      .update({ status: 'completed' })
      .eq('id', sourceId);
  } catch (error) {
    console.error('Ingest error:', error);
    await supabase
      .from('knowledge_sources')
      .update({
        status: 'error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error', failedAt: new Date().toISOString() }
      })
      .eq('id', sourceId);
    throw error;
  }
}

export async function ingestFAQ(
  question: string,
  answer: string,
  sourceId: string,
  workspaceId: string
): Promise<void> {
  const supabase = await createServiceClient();
  const content = `Question: ${question}\nRéponse: ${answer}`;
  const embeddings = await generateEmbeddings([content]);

  const { error } = await supabase.from('knowledge_chunks').insert({
    source_id: sourceId,
    workspace_id: workspaceId,
    content,
    embedding: JSON.stringify(embeddings[0]),
    metadata: { type: 'faq', question, answer },
  });

  if (error) throw error;
}

export async function ingestWebPage(
  url: string,
  content: string,
  sourceId: string,
  workspaceId: string
): Promise<void> {
  const supabase = await createServiceClient();
  const chunks = chunkText(content);
  const batchSize = 20;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await generateEmbeddings(batch.map(c => c.content));

    const rows = batch.map((chunk, j) => ({
      source_id: sourceId,
      workspace_id: workspaceId,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[j]),
      metadata: { ...chunk.metadata, url },
    }));

    const { error } = await supabase.from('knowledge_chunks').insert(rows);
    if (error) throw error;
  }
}
