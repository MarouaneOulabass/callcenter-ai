import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { userId, email, companyName, language, tone } = await request.json();

    if (!userId || !email || !companyName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const workspaceId = uuidv4();

    // Create workspace
    const { error: wsError } = await supabase.from('workspaces').insert({
      id: workspaceId,
      name: companyName,
      primary_color: '#2563eb',
      language: language || 'fr',
      tone: tone || 'neutral',
    });

    if (wsError) throw wsError;

    // Create user record
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      workspace_id: workspaceId,
      email,
      role: 'admin',
    });

    if (userError) throw userError;

    return NextResponse.json({ workspaceId });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
