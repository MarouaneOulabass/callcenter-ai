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

  // Escalation: if no relevant context was found, the agent is guessing
  const hasRelevantContext = chunks && chunks.length > 0;

  // Check conversation history for consecutive no-context responses
  const recentMessages = conversationHistory.slice(-4);
  const recentAssistantMsgs = recentMessages.filter(m => m.role === 'assistant');

  const systemPrompts: Record<string, (name: string, tone: string, context: string) => string> = {
    fr: (name, tone, context) => `Tu es l'assistant support de ${name}.
Tu réponds uniquement sur la base des informations fournies dans le contexte ci-dessous.
Si tu ne sais pas ou si l'information n'est pas dans le contexte, dis-le clairement et propose un transfert à un humain.
${tone}

CONTEXTE:
${context}`,
    en: (name, tone, context) => `You are the support assistant for ${name}.
You answer only based on the information provided in the context below.
If you don't know or the information is not in the context, say so clearly and offer to transfer to a human.
${tone}

CONTEXT:
${context}`,
    ar: (name, tone, context) => `أنت مساعد الدعم لـ ${name}.
أجب فقط بناءً على المعلومات المقدمة في السياق أدناه.
إذا كنت لا تعرف أو المعلومة غير موجودة في السياق، قل ذلك بوضوح واقترح التحويل إلى إنسان.
${tone}

السياق:
${context}`,
  };

  const toneDescriptions: Record<string, Record<string, string>> = {
    fr: {
      formal: 'Utilise un ton professionnel et formel.',
      casual: 'Utilise un ton décontracté et amical.',
      neutral: 'Utilise un ton neutre et clair.',
    },
    en: {
      formal: 'Use a professional and formal tone.',
      casual: 'Use a casual and friendly tone.',
      neutral: 'Use a neutral and clear tone.',
    },
    ar: {
      formal: 'استخدم نبرة مهنية ورسمية.',
      casual: 'استخدم نبرة ودية وغير رسمية.',
      neutral: 'استخدم نبرة محايدة وواضحة.',
    },
  };

  const toneText = toneDescriptions[workspace.language]?.[workspace.tone]
    || toneDescriptions['fr'][workspace.tone];
  const buildPrompt = systemPrompts[workspace.language] || systemPrompts['fr'];
  const contextText = context || (workspace.language === 'ar' ? 'لا توجد معلومات متاحة في قاعدة المعرفة.' : workspace.language === 'en' ? 'No information available in the knowledge base.' : 'Aucune information disponible dans la base de connaissance.');
  const systemPrompt = buildPrompt(workspace.name, toneText, contextText);

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
      model: 'gemini-2.5-flash',
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

  // If we have no context AND the previous response also had no context marker
  const escalated = !hasRelevantContext && recentAssistantMsgs.length >= 2;

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
