export interface Workspace {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  language: 'fr' | 'ar' | 'en';
  tone: 'formal' | 'casual' | 'neutral';
  twilio_number: string | null;
  vapi_assistant_id: string | null;
  created_at: string;
}

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member' | 'super_admin';
  created_at: string;
}

export interface KnowledgeSource {
  id: string;
  workspace_id: string;
  type: 'file' | 'faq' | 'web';
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeChunk {
  id: string;
  source_id: string;
  workspace_id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  channel: 'voice' | 'chat' | 'whatsapp';
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  escalated: boolean;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  workspace_id: string;
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  escalated: boolean;
}
