# RootSync — System 1: AI Messaging & Lead Intelligence

## Overview

System 1 handles all incoming customer messages, AI-assisted replies, lead classification, message storage, and conversation analytics.

**It does NOT include:** doctor dashboard, patient profiles, appointments, medical reports, or treatment programs (those are System 2).

---

## Architecture

```
Incoming Message (WhatsApp / Instagram)
  → n8n Webhook
  → Normalize Message
  → Find or Create Lead
  → Store Inbound Message
  → Lead Classification (AI)
  → Update Lead Status
  → AI Reply or Human Handoff
  → Send Message
  → Update Lead Table
  → Store for Analytics / Vector Search
```

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Workflow    | n8n (self-hosted or cloud)        |
| Database    | Supabase PostgreSQL               |
| Embeddings  | pgvector                          |
| AI/LLM      | Claude API / OpenAI               |
| Channels    | WhatsApp Business Cloud (v1)      |
| Dashboard   | Google Sheets (MVP) → Next.js     |

---

## Project Structure

```
rootsync-system1/
├── database/           # SQL schema, migrations, seeds
├── n8n/                # Workflow JSON exports and code nodes
├── prompts/            # AI prompt templates
├── docs/               # Architecture and reference docs
└── tests/              # Test messages and expected outputs
```

---

## MVP Build Order

1. Database schema
2. Webhook test with fake payload
3. Normalize message code node
4. Insert lead/message to DB
5. AI classification
6. Parse classification JSON
7. Update lead table
8. Human handoff
9. AI safe reply
10. Send WhatsApp reply
11. Embeddings
12. Weekly insights

---

## Supported Channels

- **v1:** WhatsApp Business Cloud
- **v1.5:** Instagram DMs, Facebook Messenger
- **Later:** TikTok, Threads
