# Phase 1 — Database Schema

## Goal

Create all PostgreSQL tables in Supabase that System 1 depends on. This is the data foundation — no workflow code runs until this phase is complete and verified.

## Exit Criteria

- [ ] All 9 tables created without errors
- [ ] All indexes created
- [ ] Row Level Security (RLS) disabled for service role (or policies configured)
- [ ] Seed test data inserted successfully
- [ ] Tables verified via Supabase Table Editor

---

## Tables to Create (in order)

| Order | File | Table | Purpose |
|---|---|---|---|
| 1 | `01_extensions.sql` | — | Enable uuid-ossp, vector |
| 2 | `02_leads.sql` | `leads` | Core customer/lead record |
| 3 | `03_conversations.sql` | `conversations` | Per-channel conversation sessions |
| 4 | `04_messages.sql` | `messages` | Every inbound + outbound message |
| 5 | `05_message_topics.sql` | `message_topics` | AI-extracted topics per message |
| 6 | `06_lead_status_history.sql` | `lead_status_history` | Audit trail of status changes |
| 7 | `07_human_handoffs.sql` | `human_handoffs` | Handoff events and team notifications |
| 8 | `08_message_embeddings.sql` | `message_embeddings` | pgvector embeddings (Phase 8) |
| 9 | `09_weekly_insights.sql` | `weekly_insights` | Weekly report storage (Phase 9) |

> Tables 8–9 can be skipped in MVP and run before their respective phases.

---

## Full Schema Specification

### Table: `leads`

```sql
CREATE TABLE leads (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      TEXT,
  phone                     TEXT,
  platform_user_id          TEXT,
  primary_channel           TEXT NOT NULL DEFAULT 'whatsapp',
  lead_status               TEXT NOT NULL DEFAULT 'new',
  tags                      TEXT[] DEFAULT '{}',
  health_topic              TEXT,
  service_interest          TEXT DEFAULT 'unclear',
  last_message              TEXT,
  last_message_at           TIMESTAMPTZ,
  recommended_next_action   TEXT,
  priority                  TEXT DEFAULT 'medium',
  handoff_required          BOOLEAN DEFAULT FALSE,
  assigned_to               TEXT,
  notes                     TEXT,
  last_reply_at             TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(lead_status);
CREATE INDEX idx_leads_channel ON leads(primary_channel);
CREATE INDEX idx_leads_last_message_at ON leads(last_message_at);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_platform_user_id ON leads(platform_user_id);
```

### Table: `conversations`

```sql
CREATE TABLE conversations (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id                     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel                     TEXT NOT NULL,
  platform_conversation_id    TEXT,
  status                      TEXT NOT NULL DEFAULT 'open',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
```

### Table: `messages`

```sql
CREATE TABLE messages (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id                 UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id         UUID REFERENCES conversations(id),
  channel                 TEXT NOT NULL,
  platform_message_id     TEXT UNIQUE,
  direction               TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type            TEXT NOT NULL DEFAULT 'text',
  text                    TEXT,
  raw_payload             JSONB,
  responder_type          TEXT CHECK (responder_type IN ('customer', 'ai', 'human', 'system')),
  reply_type              TEXT CHECK (reply_type IN ('auto_reply', 'suggested_reply', 'handoff', NULL)),
  classification_result   JSONB,
  embedded                BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_platform_message_id ON messages(platform_message_id);
```

### Table: `message_topics`

```sql
CREATE TABLE message_topics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  intent      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_topics_lead_id ON message_topics(lead_id);
CREATE INDEX idx_message_topics_topic ON message_topics(topic);
```

### Table: `lead_status_history`

```sql
CREATE TABLE lead_status_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  previous_status   TEXT,
  new_status        TEXT NOT NULL,
  changed_by        TEXT NOT NULL CHECK (changed_by IN ('ai', 'human', 'system')),
  reason            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_status_history_lead_id ON lead_status_history(lead_id);
```

### Table: `human_handoffs`

```sql
CREATE TABLE human_handoffs (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id                   UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_id                UUID REFERENCES messages(id),
  handoff_reason            TEXT NOT NULL,
  urgency                   TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  recommended_next_action   TEXT,
  notified_at               TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,
  resolved_by               TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_human_handoffs_lead_id ON human_handoffs(lead_id);
CREATE INDEX idx_human_handoffs_urgency ON human_handoffs(urgency);
```

### Table: `message_embeddings` (Phase 8)

```sql
CREATE TABLE message_embeddings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lead_id           UUID NOT NULL REFERENCES leads(id),
  conversation_id   UUID REFERENCES conversations(id),
  channel           TEXT,
  embedding         vector(1536),
  health_topic      TEXT,
  customer_intent   TEXT,
  lead_status       TEXT,
  message_timestamp TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_embeddings_message_id ON message_embeddings(message_id);
```

### Table: `weekly_insights` (Phase 9)

```sql
CREATE TABLE weekly_insights (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start                DATE NOT NULL,
  week_end                  DATE NOT NULL,
  total_messages            INT DEFAULT 0,
  new_leads                 INT DEFAULT 0,
  hot_leads                 INT DEFAULT 0,
  cold_leads                INT DEFAULT 0,
  not_interested            INT DEFAULT 0,
  needs_human               INT DEFAULT 0,
  top_questions             JSONB,
  top_health_topics         JSONB,
  most_common_objections    JSONB,
  best_channel              TEXT,
  suggested_content         TEXT,
  suggested_improvements    TEXT,
  report_text               TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Execution Order

Run each file in the Supabase SQL Editor in this order:

```
1. database/schema/01_extensions.sql
2. database/schema/02_leads.sql
3. database/schema/03_conversations.sql
4. database/schema/04_messages.sql
5. database/schema/05_message_topics.sql
6. database/schema/06_lead_status_history.sql
7. database/schema/07_human_handoffs.sql
8. (optional now) database/schema/08_message_embeddings.sql
9. (optional now) database/schema/09_weekly_insights.sql
```

After running, load `database/seeds/test_data.sql` to insert one test lead and one test message for verification.

---

## Verification Checklist

- [ ] All tables appear in Supabase Table Editor
- [ ] All foreign key relationships are intact
- [ ] All indexes visible under Database → Indexes
- [ ] Test seed data inserted without error
- [ ] Can SELECT from `leads`, `messages`, `conversations` via Supabase SQL Editor
