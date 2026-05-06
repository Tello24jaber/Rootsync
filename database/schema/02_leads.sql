-- 02_leads.sql
-- Core lead/customer table

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  phone TEXT UNIQUE NOT NULL,
  platform_user_id TEXT,
  primary_channel TEXT DEFAULT 'whatsapp',

  -- AI classification fields
  lead_temperature TEXT DEFAULT 'unknown',          -- hot | cold | not_interested | unknown
  service_interest TEXT DEFAULT 'unclear',          -- consultation | treatment_program | unclear
  workflow_status TEXT DEFAULT 'new',               -- new | needs_human | human_active | payment_link_sent | booked | converted | lost
  tags TEXT[] DEFAULT '{}',
  health_topic TEXT,

  -- Operational fields
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  recommended_next_action TEXT,
  handoff_required BOOLEAN DEFAULT FALSE,
  assigned_to TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
