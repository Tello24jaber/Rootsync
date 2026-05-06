-- 07_human_handoffs.sql
-- Records every human handoff event

CREATE TABLE human_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  channel TEXT,
  handoff_reason TEXT,
  urgency TEXT DEFAULT 'medium',
  recommended_next_action TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  notified_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX human_handoffs_lead_created_at_idx
  ON human_handoffs (lead_id, created_at DESC);
