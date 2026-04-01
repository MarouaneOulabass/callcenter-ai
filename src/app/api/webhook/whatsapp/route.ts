import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { queryRAG } from '@/lib/rag/engine';
import { sendWhatsAppMessage } from '@/lib/twilio/client';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace } from '@/types';
import { webhookRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await webhookRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const to = formData.get('To') as string;

    if (!from || !body || body.length === 0 || body.length > MAX_MESSAGE_LENGTH) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const supabase = await createServiceClient();

    // Find workspace by Twilio number
    const twilioNumber = to?.replace('whatsapp:', '');
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('twilio_number', twilioNumber)
      .single();

    if (!workspace) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const senderNumber = from.replace('whatsapp:', '');

    // Find or create conversation for this sender
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('channel', 'whatsapp')
      .eq('metadata->>phoneNumber', senderNumber)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    let convId = existingConv?.id;
    if (!convId) {
      convId = uuidv4();
      await supabase.from('conversations').insert({
        id: convId,
        workspace_id: workspace.id,
        channel: 'whatsapp',
        started_at: new Date().toISOString(),
        escalated: false,
        metadata: { phoneNumber: senderNumber },
      });
    }

    // Save user message
    await supabase.from('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'user',
      content: body,
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

    // Query RAG
    const result = await queryRAG(body, workspace as Workspace, conversationHistory);

    // Save assistant response
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

    // Send reply via WhatsApp
    await sendWhatsAppMessage(senderNumber, result.reply);

    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    logger.error('WhatsApp webhook error', { error: error instanceof Error ? error.message : String(error) });
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
