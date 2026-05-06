-- 03_conversations.sql
-- Tracks conversation sessions per lead per channel

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  platform_conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX conversations_channel_platform_conversation_id_uidx
  ON conversations (channel, platform_conversation_id)
  WHERE platform_conversation_id IS NOT NULL;

CREATE INDEX conversations_lead_channel_status_idx
  ON conversations (lead_id, channel, status, started_at DESC);
