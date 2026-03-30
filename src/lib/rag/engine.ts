import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding } from './embeddings';
import { createServiceClient } from '@/lib/supabase/server';
import type { Workspace } from '@/types';

const provider = process.env.AI_PROVIDER || 'gemini';

interface RAGResult {
  reply: string;
  sources: string[];
  escalated: boolean;
}

export async function queryRAG(
  question: string,
  workspace: Workspace,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<RAGResult> {
  const supabase = await createServiceClient();

  // Generate embedding for the question
  const questionEmbedding = await generateEmbedding(question);

  // Search for relevant chunks using pgvector
  const { data: chunks, error } = await supabase.rpc('match_chunks', {
    query_embedding: questionEmbedding,
    match_workspace_id: workspace.id,
    match_threshold: 0.7,
    match_count: 5,
  });

  if (error) {
    console.error('Vector search error:', error);
    throw new Error('Failed to search knowledge base');
  }

  const context = chunks?.map((c: { content: string }) => c.content).join('\n\n---\n\n') || '';
  const sources: string[] = chunks?.map((c: { source_name: string }) => c.source_name) || [];

  // Check for consecutive "don't know" responses (escalation logic)
  const recentUnknowns = conversationHistory
    .slice(-4)
    .filter(m => m.role === 'assistant')
    .filter(m =>
      m.content.includes('je ne sais pas') ||
      m.content.includes('I don\'t know') ||
      m.content.includes('لا أعرف') ||
      m.content.includes('pas en mesure')
    );

  const toneMap = {
    formal: 'Utilise un ton professionnel et formel.',
    casual: 'Utilise un ton décontracté et amical.',
    neutral: 'Utilise un ton neutre et clair.',
  };

  const langMap = {
    fr: 'français',
    en: 'English',
    ar: 'العربية',
  };

  const systemPrompt = `Tu es l'assistant support de ${workspace.name}.
Tu réponds uniquement sur la base des informations fournies dans le contexte ci-dessous.
Si tu ne sais pas ou si l'information n'est pas dans le contexte, dis-le clairement et propose un transfert à un humain.
Langue : ${langMap[workspace.language]}.
${toneMap[workspace.tone]}

CONTEXTE:
${context || 'Aucune information disponible dans la base de connaissance.'}`;

  let reply = '';

  if (provider === 'anthropic') {
    // --- Claude (paid / production) ---
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: question },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    reply = response.content[0].type === 'text' ? response.content[0].text : '';
  } else {
    // --- Gemini (free / POC) ---
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    const history = conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(question);
    reply = result.response.text();
  }

  // Check if this response also indicates lack of knowledge
  const isUnknown = reply.includes('je ne sais pas') ||
    reply.includes('I don\'t know') ||
    reply.includes('لا أعرف') ||
    reply.includes('pas en mesure') ||
    reply.includes('don\'t have information');

  const escalated = isUnknown && recentUnknowns.length >= 1;

  return { reply, sources: [...new Set(sources)], escalated };
}

export async function summarizeTranscript(transcript: string): Promise<string> {
  const prompt = `Résume cet appel téléphonique en 2-3 phrases:\n\n${transcript}`;

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  } else {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
