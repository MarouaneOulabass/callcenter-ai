import { NextRequest, NextResponse } from 'next/server';
import { createClientFromToken, extractToken, createServiceClient } from '@/lib/supabase/server';
import { ingestFAQ } from '@/lib/rag/ingest';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const { question, answer } = await request.json();
    if (!question || !answer) {
      return NextResponse.json({ error: 'Question and answer required' }, { status: 400 });
    }

    const sourceId = uuidv4();

    // Create knowledge source
    await serviceClient.from('knowledge_sources').insert({
      id: sourceId,
      workspace_id: userData.workspace_id,
      type: 'faq',
      name: question.substring(0, 100),
      status: 'processing',
      metadata: { question, answer },
    });

    // Ingest FAQ
    await ingestFAQ(question, answer, sourceId, userData.workspace_id);

    // Update status
    await serviceClient
      .from('knowledge_sources')
      .update({ status: 'completed' })
      .eq('id', sourceId);

    return NextResponse.json({ sourceId, status: 'completed' });
  } catch (error) {
    console.error('FAQ error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const { data: faqs } = await serviceClient
      .from('knowledge_sources')
      .select('*')
      .eq('workspace_id', userData.workspace_id)
      .eq('type', 'faq')
      .order('created_at', { ascending: false });

    return NextResponse.json(faqs || []);
  } catch (error) {
    console.error('FAQ list error:', error);
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
    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID required' }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Delete chunks first
    await serviceClient
      .from('knowledge_chunks')
      .delete()
      .eq('source_id', sourceId)
      .eq('workspace_id', userData.workspace_id);

    // Delete source
    await serviceClient
      .from('knowledge_sources')
      .delete()
      .eq('id', sourceId)
      .eq('workspace_id', userData.workspace_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('FAQ delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
