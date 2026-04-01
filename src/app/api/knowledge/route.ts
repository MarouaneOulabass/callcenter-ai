import { NextRequest, NextResponse } from 'next/server';
import { createClientFromToken, extractToken, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const { data: sources, count } = await serviceClient
      .from('knowledge_sources')
      .select('*', { count: 'exact' })
      .eq('workspace_id', userData.workspace_id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    return NextResponse.json({
      data: sources || [],
      pagination: { page, limit, total: count || 0 },
    });
  } catch (error) {
    console.error('Knowledge list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceId } = await request.json();
    const serviceClient = await createServiceClient();

    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    await serviceClient
      .from('knowledge_chunks')
      .delete()
      .eq('source_id', sourceId)
      .eq('workspace_id', userData.workspace_id);

    await serviceClient
      .from('knowledge_sources')
      .delete()
      .eq('id', sourceId)
      .eq('workspace_id', userData.workspace_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Knowledge delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
