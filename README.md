# RootSync MVP

## Current Scope

This repository contains a **demo MVP** with exactly two features:

1. **AI Lead Intelligence**
   - Test message input
   - AI classification
   - Message storage
   - Customer service dashboard
   - Stop AI / human takeover controls

2. **Multi-platform Social Posting (Demo)**
   - Upload a post/video from UI
   - Select supported social platforms
   - Submit through upload-post service

This MVP is currently in **demo mode**.
It is **not connected to real WhatsApp, Instagram, TikTok, or YouTube APIs yet**.

## AI Provider

- Current AI provider: **OpenAI**
- Optional future provider: **Anthropic Claude**

Required env var:

```env
OPENAI_API_KEY=
```

## Demo Mode Behavior

- `APP_MODE=demo` enables demo-only messaging flow.
- Demo endpoint: `POST /`
- In demo mode, outbound AI replies are stored with `send_status = demo_returned`.
- If human takeover is active (`workflow_status = needs_human` or `human_active`):
  - incoming messages are still stored
  - AI does not generate or send replies

## Social Posting Platform Support

Supported in MVP:

- Instagram
- TikTok
- Facebook

Planned later:

- YouTube Shorts
- Threads

Backend validates selected platforms and rejects unsupported values.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| AI/LLM | OpenAI (`gpt-4o-mini`) |
| Social publishing | `upload-post` |
| UI | Static HTML dashboards (`test-ui`, `dashboard`) |

## Environment Setup

Copy `.env.example` to `.env` and fill values.

Key MVP variables:

```env
PORT=3000
APP_MODE=demo
AUTO_OPEN_BROWSER=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
UPLOAD_POST_USER=
UPLOAD_POST_API_KEY=
```

## Database Setup

Run SQL files in `database/schema` order (`01` to `09`) on a fresh Supabase project.

Core tables used by the MVP:

- `leads`
- `conversations`
- `messages`
- `lead_status_history`
- `human_handoffs`

## Lead Model

Lead model naming is standardized across code/docs:

- `lead_temperature`
- `workflow_status`
- `service_interest`
- `tags`
