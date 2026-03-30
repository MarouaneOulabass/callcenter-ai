-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces (clients)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'ar', 'en')),
  tone TEXT DEFAULT 'neutral' CHECK (tone IN ('formal', 'casual', 'neutral')),
  twilio_number TEXT,
  vapi_assistant_id TEXT,
  custom_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'member', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge sources
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'faq', 'web')),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge chunks with vector embeddings
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('voice', 'chat', 'whatsapp')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  escalated BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_knowledge_sources_workspace ON knowledge_sources(workspace_id);
CREATE INDEX idx_knowledge_chunks_workspace ON knowledge_chunks(workspace_id);
CREATE INDEX idx_knowledge_chunks_source ON knowledge_chunks(source_id);
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_channel ON conversations(workspace_id, channel);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at);

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS Policies
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can access their own workspace
CREATE POLICY "Users can view own workspace" ON workspaces
  FOR SELECT USING (
    id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update own workspace" ON workspaces
  FOR UPDATE USING (
    id IN (SELECT workspace_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users table policies
CREATE POLICY "Users can view workspace members" ON users
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- Knowledge sources policies
CREATE POLICY "Users can view workspace sources" ON knowledge_sources
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert workspace sources" ON knowledge_sources
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete workspace sources" ON knowledge_sources
  FOR DELETE USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update workspace sources" ON knowledge_sources
  FOR UPDATE USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- Knowledge chunks policies
CREATE POLICY "Users can view workspace chunks" ON knowledge_chunks
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert workspace chunks" ON knowledge_chunks
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete workspace chunks" ON knowledge_chunks
  FOR DELETE USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- Conversations policies
CREATE POLICY "Users can view workspace conversations" ON conversations
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert workspace conversations" ON conversations
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- Messages policies
CREATE POLICY "Users can view conversation messages" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert conversation messages" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_workspace_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_name TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    ks.name AS source_name,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_sources ks ON kc.source_id = ks.id
  WHERE kc.workspace_id = match_workspace_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Storage bucket for knowledge files
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-files', 'knowledge-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can upload to their workspace folder
CREATE POLICY "Users can upload knowledge files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'knowledge-files'
  );

CREATE POLICY "Users can read knowledge files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'knowledge-files'
  );
