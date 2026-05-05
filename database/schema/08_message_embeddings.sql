-- 08_message_embeddings.sql
-- Vector embeddings for semantic search (pgvector)

CREATE TABLE message_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  channel TEXT,
  embedding vector(1536) NOT NULL,
  health_topic TEXT,
  customer_intent TEXT,
  lead_temperature TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
