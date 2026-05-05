# RootSync — System 1: AI Messaging & Lead Intelligence

## Overview

System 1 handles all incoming customer messages, AI-assisted replies, lead classification, message storage, and conversation analytics.

**It does NOT include:** doctor dashboard, patient profiles, appointments, medical reports, or treatment programs (those are System 2).

---

## Architecture

```
Incoming Message (WhatsApp)
  → Express Webhook (POST /webhook/whatsapp)
  → Normalize Message
  → Find or Create Lead
  → Store Inbound Message
  → AI Classification (Claude)
  → Update Lead Record
  → AI Safe Reply or Human Handoff
  → Send Message via WhatsApp API
  → Store Outbound Message + Analytics
```

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Backend     | Node.js + Express                 |
| Database    | Supabase (PostgreSQL)             |
| Embeddings  | pgvector (1536-dim)               |
| AI/LLM      | OpenAI (gpt-4o-mini + text-embedding-3-small) |
| Channels    | WhatsApp Business Cloud API       |
| Dashboard   | Google Sheets (MVP) → Next.js     |

---

## Project Structure

```
rootsync-system1/
├── src/                # Node.js/Express application code
│   ├── index.js
│   ├── routes/
│   ├── services/
│   ├── db/
│   └── lib/
├── database/           # SQL schema, migrations, seeds
├── prompts/            # AI prompt templates
├── docs/               # Architecture and reference docs
└── tests/              # Test messages and expected outputs
```

---

## MVP Build Order

1. Database schema (run SQL files in Supabase)
2. Node.js project setup + client singletons
3. Express webhook route + message normalization
4. Insert lead/message to DB
5. AI classification service
6. Human handoff service
7. AI safe reply service
8. Embeddings pipeline (cron)
9. Weekly insights report (cron)

---

## Supported Channels

- **v1:** WhatsApp Business Cloud
- **v1.5:** Instagram DMs, Facebook Messenger
- **Later:** TikTok, Threads
