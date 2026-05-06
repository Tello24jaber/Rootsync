# System 1 — Full Implementation Plan Index

## Overview

System 1 is the AI Messaging & Lead Intelligence layer for RootSync.
This folder contains the complete, phase-by-phase implementation plan.

Each phase is self-contained, has clear entry/exit criteria, and maps directly to code modules in the `src/` folder.

The backend is a **Node.js (Express)** server. Each "workflow" from the original design becomes a route handler or a service module.

---

## Phase Map

| Phase | Name | Milestone |
|---|---|---|
| [Phase 0](./phase0_project_setup.md) | Project Setup & Prerequisites | Dev environment ready |
| [Phase 1](./phase1_database_schema.md) | Database Schema | All tables created in Supabase |
| [Phase 2](./phase2_third_party_integrations.md) | Third-Party Integrations | All external services connected & tested |
| [Phase 3](./phase3_webhook_normalization.md) | Webhook & Message Normalization | Fake message → DB row |
| [Phase 4](./phase4_ai_classification.md) | AI Lead Classification | Message → AI classification → lead updated |
| [Phase 5](./phase5_human_handoff.md) | Human Handoff | Unsafe message → team notified |
| [Phase 6](./phase6_ai_reply_and_send.md) | AI Safe Reply & Send | Safe message → Arabic reply returned in demo flow |
| [Phase 7](./phase7_lead_table_sync.md) | Lead Table Sync | Lead data visible to CS team |
| [Phase 8](./phase8_embeddings.md) | Message Embeddings & Vector Search | Messages searchable semantically |
| [Phase 9](./phase9_weekly_insights.md) | Weekly Insights Report | Sunday report delivered automatically |

---

## Build Sequence

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
                                                              ↓
                                               Phase 7 → Phase 8 → Phase 9
```

Phases 0–6 are the MVP (core system).
Phases 7–9 are the intelligence layer (run after MVP is stable).

---

## Project Structure (target)

```
src/
  index.js              ← Express server entry point
  routes/
    webhook.js          ← POST /webhook/whatsapp  (Phase 3)
  services/
    normalize.js        ← Parse raw WhatsApp payload (Phase 3)
    classify.js         ← OpenAI classification call (Phase 4)
    reply.js            ← OpenAI safe reply call (Phase 6)
    handoff.js          ← Human handoff logic (Phase 5)
    whatsapp.js         ← Shared WhatsApp send helper (Phase 5)
    embed.js            ← Embedding pipeline (Phase 8)
    insights.js         ← Weekly insights cron (Phase 9)
  db/
    leads.js            ← Supabase calls for leads table
    messages.js         ← Supabase calls for messages table
    conversations.js    ← Supabase calls for conversations table
  lib/
    supabase.js         ← Supabase client singleton
    openai.js           ← OpenAI client singleton
.env                    ← Environment variables (never committed)
package.json
```

---

## Key Principles

- Build and test one phase at a time before moving to the next.
- Never deploy Phase 6 (live send) before Phase 4 and 5 are fully tested.
- AI must never send a message autonomously until safety validation is confirmed.
- All test messages in `tests/test_messages/` must pass before going live.
