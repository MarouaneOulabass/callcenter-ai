import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

    const { data: workspace } = await serviceClient
      .from('workspaces')
      .select('*')
      .eq('id', userData.workspace_id)
      .single();

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id, role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates = await request.json();
    const allowedFields = ['name', 'language', 'tone', 'primary_color', 'logo_url', 'custom_prompt'];
    const filtered: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) filtered[key] = updates[key];
    }

    const { data: workspace, error } = await serviceClient
      .from('workspaces')
      .update(filtered)
      .eq('id', userData.workspace_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Workspace update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
