-- 09_weekly_insights.sql
-- Stores generated weekly insight reports

CREATE TABLE weekly_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,

  -- Numeric stats (pre-aggregated by code, not AI)
  total_messages INT DEFAULT 0,
  new_leads INT DEFAULT 0,
  hot_leads INT DEFAULT 0,
  cold_leads INT DEFAULT 0,
  not_interested INT DEFAULT 0,
  needs_human INT DEFAULT 0,

  -- Full stats object for flexible querying
  stats_json JSONB DEFAULT '{}',

  -- AI-generated qualitative text (Arabic)
  report_text TEXT,

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
