import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { queryRAG } from '@/lib/rag/engine';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Handle different Vapi webhook events
    switch (message.type) {
      case 'function-call': {
        // Handle custom function calls from Vapi
        return NextResponse.json({ result: 'ok' });
      }

      case 'assistant-request': {
        // Vapi is requesting assistant configuration
        // Extract workspace ID from assistant metadata
        const workspaceId = message.call?.assistantId
          ? await getWorkspaceFromAssistant(message.call.assistantId, supabase)
          : null;

        if (!workspaceId) {
          return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        return NextResponse.json({ assistant: { model: { provider: 'anthropic' } } });
      }

      case 'conversation-update': {
        const call = message.call;
        if (!call) return NextResponse.json({ ok: true });

        const workspaceId = await getWorkspaceFromAssistant(call.assistantId, supabase);
        if (!workspaceId) return NextResponse.json({ ok: true });

        // Get workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .single();

        if (!workspace) return NextResponse.json({ ok: true });

        // Get the latest user message from the conversation
        const messages = message.messages || [];
        const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user');

        if (!lastUserMessage) return NextResponse.json({ ok: true });

        // Query RAG
        const history = messages
          .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
          .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

        const result = await queryRAG(lastUserMessage.content, workspace as Workspace, history.slice(0, -1));

        return NextResponse.json({
          content: result.reply,
        });
      }

      case 'end-of-call-report': {
        // Call ended — save transcript and generate summary
        const call = message.call;
        if (!call) return NextResponse.json({ ok: true });

        const workspaceId = await getWorkspaceFromAssistant(call.assistantId, supabase);
        if (!workspaceId) return NextResponse.json({ ok: true });

        const transcript = message.transcript || '';
        const convId = uuidv4();

        // Generate summary
        let summary = '';
        if (transcript) {
          const summaryResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `Résume cet appel téléphonique en 2-3 phrases:\n\n${transcript}`,
            }],
          });
          summary = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : '';
        }

        // Save conversation
        await supabase.from('conversations').insert({
          id: convId,
          workspace_id: workspaceId,
          channel: 'voice',
          started_at: call.startedAt || new Date().toISOString(),
          ended_at: call.endedAt || new Date().toISOString(),
          summary,
          escalated: false,
          metadata: {
            callId: call.id,
            duration: call.duration,
            phoneNumber: call.customer?.number,
          },
        });

        // Save transcript as messages
        const transcriptMessages = message.messages || [];
        for (const msg of transcriptMessages) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            await supabase.from('messages').insert({
              id: uuidv4(),
              conversation_id: convId,
              role: msg.role,
              content: msg.content,
              created_at: msg.time || new Date().toISOString(),
            });
          }
        }

        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.error('Vapi webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getWorkspaceFromAssistant(assistantId: string, supabase: Awaited<ReturnType<typeof createServiceClient>>): Promise<string | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('vapi_assistant_id', assistantId)
    .single();
  return data?.id || null;
}
