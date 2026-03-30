import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const provider = process.env.AI_PROVIDER || 'gemini';

// --- OpenAI (paid) ---
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function openaiEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function openaiEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

// --- Gemini (free) ---
function getGemini() {
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
}

async function geminiEmbedding(text: string): Promise<number[]> {
  const model = getGemini().getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return padOrTruncate(result.embedding.values, 1536);
}

async function geminiEmbeddings(texts: string[]): Promise<number[][]> {
  const model = getGemini().getGenerativeModel({ model: 'text-embedding-004' });
  const results = await Promise.all(
    texts.map(text => model.embedContent(text))
  );
  return results.map(r => padOrTruncate(r.embedding.values, 1536));
}

// Gemini text-embedding-004 outputs 768 dims, pgvector expects 1536
// Pad with zeros to match the vector(1536) column
function padOrTruncate(values: number[], targetSize: number): number[] {
  if (values.length >= targetSize) return values.slice(0, targetSize);
  return [...values, ...new Array(targetSize - values.length).fill(0)];
}

// --- Public API (auto-switches based on AI_PROVIDER) ---
export async function generateEmbedding(text: string): Promise<number[]> {
  return provider === 'anthropic' ? openaiEmbedding(text) : geminiEmbedding(text);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return provider === 'anthropic' ? openaiEmbeddings(texts) : geminiEmbeddings(texts);
}
