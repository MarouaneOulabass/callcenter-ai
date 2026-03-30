import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
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
      return NextResponse.json({ error: 'No workspace' }, { status: 404 });
    }

    const { data: conversations } = await serviceClient
      .from('conversations')
      .select('*')
      .eq('workspace_id', userData.workspace_id)
      .order('started_at', { ascending: false })
      .limit(100);

    return NextResponse.json(conversations || []);
  } catch (error) {
    console.error('Conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
