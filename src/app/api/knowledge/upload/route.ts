import { NextRequest, NextResponse } from 'next/server';
import { createClientFromToken, extractToken, createServiceClient } from '@/lib/supabase/server';
import { ingestFile } from '@/lib/rag/ingest';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspace
    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const sourceId = uuidv4();

    // Create knowledge source record
    await serviceClient.from('knowledge_sources').insert({
      id: sourceId,
      workspace_id: userData.workspace_id,
      type: 'file',
      name: file.name,
      status: 'pending',
      metadata: { mimeType: file.type, size: file.size },
    });

    // Upload file to Supabase storage
    const buffer = Buffer.from(await file.arrayBuffer());
    await serviceClient.storage
      .from('knowledge-files')
      .upload(`${userData.workspace_id}/${sourceId}/${file.name}`, buffer, {
        contentType: file.type,
      });

    // Start async ingestion (non-blocking)
    ingestFile(buffer, file.name, file.type, sourceId, userData.workspace_id).catch(err =>
      console.error('Async ingest error:', err)
    );

    return NextResponse.json({ sourceId, status: 'pending' });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
