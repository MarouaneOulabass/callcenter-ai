import { NextRequest, NextResponse } from 'next/server';
import { createClientFromToken, extractToken, createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    // Look up the user's workspace
    const { data: userData, error: userError } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.workspace_id) {
      return NextResponse.json({ error: 'User workspace not found' }, { status: 403 });
    }

    // Verify the conversation belongs to the user's workspace
    const { data: conversation, error: convError } = await serviceClient
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', userData.workspace_id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: messages } = await serviceClient
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json(messages || []);
  } catch (error) {
    console.error('Messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
