import { NextRequest, NextResponse } from 'next/server';
import { extractToken, createClientFromToken, createServiceClient } from '@/lib/supabase/server';
import { queryRAG } from '@/lib/rag/engine';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace, ChatRequest } from '@/types';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    // Look up user's workspace
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const workspace_id = userData.workspace_id;

    const body: ChatRequest = await request.json();
    const { message, conversation_id } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (message.length === 0 || message.length > 5000) {
      return NextResponse.json({ error: 'Message must be between 1 and 5000 characters' }, { status: 400 });
    }

    // Get workspace
    const { data: workspace, error: wsError } = await serviceClient
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
      await serviceClient.from('conversations').insert({
        id: convId,
        workspace_id,
        channel: 'chat',
        started_at: new Date().toISOString(),
        escalated: false,
      });
    }

    // Save user message
    await serviceClient.from('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    });

    // Get conversation history
    const { data: history } = await serviceClient
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
    await serviceClient.from('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'assistant',
      content: result.reply,
      created_at: new Date().toISOString(),
    });

    // Update escalation status
    if (result.escalated) {
      await serviceClient
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
    logger.error('Chat error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
