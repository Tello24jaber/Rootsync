-- 04_messages.sql
-- Stores every inbound and outbound message

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  platform_message_id TEXT UNIQUE,
  direction TEXT NOT NULL,         -- inbound | outbound
  message_type TEXT DEFAULT 'text',
  text TEXT,
  raw_payload JSONB,
  responder_type TEXT,             -- customer | ai | human | system
  reply_type TEXT,

  -- Send tracking (outbound only)
  send_status TEXT DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed', 'demo_returned', 'not_sent_handoff')),   -- pending | sent | failed | demo_returned | not_sent_handoff
  send_error TEXT,
  sent_at TIMESTAMPTZ,

  embedded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
