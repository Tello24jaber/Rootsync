# MVP Build Order

Build System 1 in this exact sequence. Do not skip steps.

## Phase 0 — Project Setup

- [ ] Step 1: Create Supabase project
- [ ] Step 2: Enable pgvector + uuid-ossp extensions
- [ ] Step 3: Run `npm init -y` and install dependencies (`express`, `@supabase/supabase-js`, `openai`, `dotenv`, `nodemon`)
- [ ] Step 4: Create `src/index.js`, `src/lib/supabase.js`, `src/lib/openai.js`
- [ ] Step 5: Fill in `.env` with Supabase credentials
- [ ] Step 6: Confirm `npm run dev` starts the server

## Phase 1 — Database Schema

- [ ] Step 7: Run `01_extensions.sql`
- [ ] Step 8: Run `02_leads.sql`
- [ ] Step 9: Run `03_conversations.sql`
- [ ] Step 10: Run `04_messages.sql`
- [ ] Step 11: Run `05_message_topics.sql`
- [ ] Step 12: Run `06_lead_status_history.sql`
- [ ] Step 13: Run `07_human_handoffs.sql`

## Phase 2 — Third-Party Integrations

- [ ] Step 14: Set up Meta Developer App, get WhatsApp credentials
- [ ] Step 15: Get OpenAI API key, test with a simple request (classification/reply)
- [ ] Step 16: (Optional future) Add Anthropic Claude API key support
- [ ] Step 17: Fill all API keys into `.env`

## Phase 3 — Webhook & Message Normalization

- [ ] Step 18: Create `src/services/normalize.js`
- [ ] Step 19: Create `src/db/leads.js`, `conversations.js`, `messages.js`
- [ ] Step 20: Create `src/routes/webhook.js` (GET verification + POST handler)
- [ ] Step 21: Register webhook route in `src/index.js`
- [ ] Step 22: Test GET verification with ngrok
- [ ] Step 23: Test fake POST payload — confirm DB rows created

## Phase 4 — AI Classification

- [ ] Step 24: Create `src/services/classify.js`
- [ ] Step 25: Call `classifyAndRoute` from webhook route
- [ ] Step 26: Test all 5 test messages — confirm expected classification outputs

**Milestone 1:** WhatsApp message → Express → AI classification → DB row ✓

## Phase 5 — Human Handoff

- [ ] Step 27: Create `src/services/handoff.js`
- [ ] Step 28: Test with `needs_human.json` — confirm handoff record + holding message

## Phase 6 — AI Safe Reply

- [ ] Step 29: Create `src/services/reply.js`
- [ ] Step 30: Test with `hot_lead.json` — confirm AI reply is stored with `send_status = demo_returned` and returned to demo UI
- [ ] Step 31: Confirm unsafe replies fall back to handoff

**Milestone 2:** WhatsApp message → classification → lead table ✓
**Milestone 3:** WhatsApp message → safe AI reply or human handoff ✓

## Phase 7 — Lead Table Sync

- [ ] Step 32: Install `googleapis`, set up Google Sheets service account
- [ ] Step 33: Create `src/services/sync.js`
- [ ] Step 34: Call `syncLead` after lead create and after classification
- [ ] Step 35: Confirm new leads and updates appear in sheet

## Phase 8 — Embeddings (later)

- [ ] Step 36: Run `08_message_embeddings.sql`
- [ ] Step 37: Create `src/services/embed.js`
- [ ] Step 38: Install `node-cron`, schedule embedding batch every 15 min
- [ ] Step 39: Confirm embeddings stored in `message_embeddings`

## Phase 9 — Weekly Insights (later)

- [ ] Step 40: Run `09_weekly_insights.sql`
- [ ] Step 41: Create `src/services/insights.js`
- [ ] Step 42: Call `startInsightsCron()` in `src/index.js`
- [ ] Step 43: Run manual test — confirm report stored and delivered
