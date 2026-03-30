import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { queryRAG } from '@/lib/rag/engine';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace, ChatRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversation_id, workspace_id } = body;

    if (!message || !workspace_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Get workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get or create conversation
    let convId = conversation_id;
    if (!convId) {
      convId = uuidv4();
      await supabase.from('conversations').insert({
        id: convId,
        workspace_id,
        channel: 'chat',
        started_at: new Date().toISOString(),
        escalated: false,
      });
    }

    // Save user message
    await supabase.from('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    });

    // Get conversation history
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (history || [])
      .slice(0, -1) // Exclude the message we just added
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Query RAG engine
    const result = await queryRAG(message, workspace as Workspace, conversationHistory);

    // Save assistant response
    await supabase.from('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'assistant',
      content: result.reply,
      created_at: new Date().toISOString(),
    });

    // Update escalation status
    if (result.escalated) {
      await supabase
        .from('conversations')
        .update({ escalated: true })
        .eq('id', convId);
    }

    return NextResponse.json({
      reply: result.reply,
      conversation_id: convId,
      escalated: result.escalated,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
