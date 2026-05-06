-- 06_lead_status_history.sql
-- Audit trail of every lead status change

CREATE TABLE lead_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  previous_temperature TEXT,
  new_temperature TEXT,
  previous_workflow_status TEXT,
  new_workflow_status TEXT,
  previous_service_interest TEXT,
  new_service_interest TEXT,
  reason TEXT,
  classification_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX lead_status_history_lead_created_at_idx
  ON lead_status_history (lead_id, created_at DESC);
