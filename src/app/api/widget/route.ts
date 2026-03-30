import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { queryRAG } from '@/lib/rag/engine';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversation_id, token } = body;

    if (!message || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Token = workspace ID for MVP simplicity
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', token)
      .single();

    if (error || !workspace) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get or create conversation
    let convId = conversation_id;
    if (!convId) {
      convId = uuidv4();
      await supabase.from('conversations').insert({
        id: convId,
        workspace_id: workspace.id,
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

    // Get history
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (history || [])
      .slice(0, -1)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const result = await queryRAG(message, workspace as Workspace, conversationHistory);

    // Save response
    await supabase.from('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'assistant',
      content: result.reply,
      created_at: new Date().toISOString(),
    });

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
    console.error('Widget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET config for widget (colors, name, etc.)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, primary_color, language, logo_url')
    .eq('id', token)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  return NextResponse.json(workspace);
}
