# Phase 2 — Third-Party Integrations

## Goal

Set up and verify every external service that System 1 depends on. No workflow will work correctly if any integration is misconfigured. This phase must be completed before Phase 3.

## Exit Criteria

- [ ] WhatsApp Business Cloud webhook verified (Meta sends and receives)
- [ ] Claude or OpenAI API key tested (returns valid response)
- [ ] Supabase credentials tested from the Node.js client (SELECT returns data)
- [ ] Notification channel ready (WhatsApp or email to team)
- [ ] Google Sheets access confirmed (for MVP dashboard, Phase 7)
- [ ] All credentials saved in `.env` (never hardcoded in source files)

---

## Integration 1 — WhatsApp Business Cloud (Meta)

### Why

WhatsApp is the primary inbound message channel for version 1. All customer messages arrive as webhook POST requests from Meta's API.

### Account Requirements

- A Facebook Business account (verified)
- A Meta Developer account at [https://developers.facebook.com](https://developers.facebook.com)
- A dedicated phone number (cannot be a number already registered in WhatsApp personal)

### Setup Steps

**1. Create Meta App**

1. Go to [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **Create App** → Choose **Business** type
3. Add the **WhatsApp** product to the app
4. Go to **WhatsApp → Getting Started**

**2. Get Credentials**

From the WhatsApp Getting Started page, copy:

| Variable | Where to Find |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number section |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID |
| `WHATSAPP_ACCESS_TOKEN` | Temporary token (or generate Permanent token via System User) |
| `WHATSAPP_VERIFY_TOKEN` | You define this yourself — any random string |

> For production: create a **System User** under Business Settings and generate a permanent token. Do not use the temporary 24-hour token in production.

**3. Configure Webhook in Meta**

1. In Meta Developer Console → WhatsApp → Configuration → Webhooks
2. Set **Callback URL** to:
   ```
   https://<your-deployed-url>/webhook/whatsapp
   ```
3. Set **Verify Token** to match your `WHATSAPP_VERIFY_TOKEN` value
4. Subscribe to these webhook fields:
   - `messages`
   - `message_deliveries` (optional)
   - `message_reads` (optional)

**4. Verify Webhook**

Meta will send a GET request with `hub.challenge`. Your Express route must respond with the challenge value. This is handled in `src/routes/webhook.js` (Phase 3).

**5. Configure Callback URL**

Set **Callback URL** in Meta Console to your deployed server URL:
```
https://<your-deployed-url>/webhook/whatsapp
```
For local testing use [ngrok](https://ngrok.com): `ngrok http 3000`

**6. Test with Real Message**

Send a WhatsApp message from a different number to your registered business number. Confirm the POST payload arrives at your Express server.

### Credential in `.env`

```
WHATSAPP_ACCESS_TOKEN=<your token>
WHATSAPP_PHONE_NUMBER_ID=<your phone number id>
WEBHOOK_VERIFY_TOKEN=<your chosen verify token>
```

### Sample Inbound Payload (WhatsApp)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<BUSINESS_ACCOUNT_ID>",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "<PHONE_NUMBER_ID>" },
        "contacts": [{ "profile": { "name": "أحمد" }, "wa_id": "962700000001" }],
        "messages": [{
          "id": "wamid.xxx",
          "from": "962700000001",
          "timestamp": "1746000000",
          "text": { "body": "مرحبا بدي أحجز استشارة" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

## Integration 2 — Claude API (Anthropic)

### Why

Claude is the primary LLM for lead classification and reply generation. It produces reliable, structured JSON output in Arabic.

### Setup Steps

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Go to **API Keys** → Create a new key
4. Copy the key → save as `CLAUDE_API_KEY` in `.env`

### Recommended Model

`claude-3-5-haiku-20241022` — fast, cost-effective, strong JSON output, supports Arabic well.

For highest accuracy (at higher cost): `claude-opus-4-5` or `claude-sonnet-4-5`.

### Configuration in Code

The OpenAI SDK supports Claude-compatible APIs, or use `axios`/`node-fetch` directly:

```js
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 600, messages: [...] })
});
```

Add to `.env`: `CLAUDE_API_KEY=<your key>`

### Test Request Body

```json
{
  "model": "claude-3-5-haiku-20241022",
  "max_tokens": 500,
  "messages": [
    {
      "role": "user",
      "content": "رد بـ JSON فقط: {\"status\": \"ok\"}"
    }
  ]
}
```

Expected: valid JSON response with `status: ok` inside `content[0].text`.

---

## Integration 3 — OpenAI API (Alternative / Embeddings)

### Why

OpenAI is used as a fallback LLM and as the primary embeddings provider (`text-embedding-3-small`).

### Setup Steps

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Save as `OPENAI_API_KEY` in `.env`

### Models

| Use Case | Model |
|---|---|
| Classification / Reply (fallback) | `gpt-4o-mini` |
| Embeddings | `text-embedding-3-small` (1536 dimensions) |

### Configuration in Code

```
npm install openai
```

Add to `.env`: `OPENAI_API_KEY=<your key>`

The `src/lib/openai.js` singleton (Phase 0) handles this.

### Test Embedding Call

```json
{
  "model": "text-embedding-3-small",
  "input": "مرحبا بدي أحجز استشارة"
}
```

Expected: array of 1536 floats in `data[0].embedding`.

---

## Integration 4 — Supabase (PostgreSQL)

### Why

The primary database for all leads, messages, conversations, and analytics data.

### Supabase Connection in Code

Use the `@supabase/supabase-js` client (already set up in `src/lib/supabase.js`):

```js
const supabase = require('../lib/supabase');
const { data, error } = await supabase.from('leads').select('*').limit(1);
```

For complex SQL queries (aggregations, joins), use `supabase.rpc()` or the `postgres` npm package with the direct connection string.

Add to `.env`:
```
SUPABASE_URL=https://bynwpzxxkutvxdkcydfx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```

### Test

Run `node -e "require('dotenv').config(); const s = require('./src/lib/supabase'); s.from('leads').select('id').limit(1).then(r => console.log(r))"`

---

## Integration 5 — Team Notification Channel

### Why

When a human handoff is triggered, the customer service team must be notified immediately.

### Option A — WhatsApp Notification (Recommended for MVP)

Send a notification message to a team WhatsApp number via the same WhatsApp Business Cloud API.

- Use a dedicated employee number registered to receive notifications
- Or use a WhatsApp group (requires Group ID, more complex)

### Option B — Email (SMTP / Gmail)

- Node type: **Gmail** or **Send Email**
- Set up a Google Service Account or Gmail OAuth2 credential
- Credential name: `Gmail Notifications`

### Option C — Telegram (Simple Alternative)

- Create a Telegram Bot via BotFather
- Use `node-fetch` to POST to `https://api.telegram.org/bot<TOKEN>/sendMessage`
- Fast to set up, good for internal team alerts

> For MVP: start with WhatsApp notification (same API already set up) or Telegram (simplest setup). Add email later.

---

## Integration 6 — Google Sheets (MVP Lead Dashboard)

### Why

The customer service team needs a simple table of all leads. Google Sheets is the fastest MVP before building a proper dashboard.

### Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Sheets API** and **Google Drive API**
4. Create a **Service Account** → Generate a JSON key
5. Copy `client_email` and `private_key` from the JSON key
6. Create a Google Sheet, name it `RootSync — Leads`
7. Share the sheet with the `client_email` (Editor access)
8. Copy the Sheet ID from the URL

### Sheet Columns

| Column | Header |
|---|---|
| A | lead_id |
| B | name |
| C | phone_or_username |
| D | channel |
| E | lead_status |
| F | tags |
| G | health_topic |
| H | service_interest |
| I | last_message |
| J | last_message_at |
| K | recommended_next_action |
| L | priority |
| M | handoff_required |
| N | assigned_to |
| O | notes |
| P | updated_at |

### Configuration in Code

```
npm install googleapis
```

Add to `.env`:
```
GOOGLE_SHEETS_ID=<sheet id from URL>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email from JSON key>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key from JSON key>
```

---

## Integration Summary

| Integration | Used In | Priority | Status |
|---|---|---|---|
| WhatsApp Business Cloud | routes/webhook, services/reply, services/handoff | Critical (MVP) | Setup in this phase |
| Claude API | services/classify, services/reply, services/insights | Critical (MVP) | Setup in this phase |
| OpenAI API | services/embed | Required for Phase 8 | Setup now, use later |
| Supabase JS Client | All services | Critical (MVP) | Already configured in Phase 0 |
| Team Notification (WhatsApp / Telegram / Email) | services/handoff | Required for Phase 5 | Setup in this phase |
| Google Sheets API | services/sync | MVP dashboard | Setup before Phase 7 |

---

## Checklist

- [ ] Meta Developer App created, WhatsApp product added
- [ ] WhatsApp Phone Number ID, Business Account ID, Access Token saved in `.env`
- [ ] Webhook URL registered in Meta, verify token confirmed
- [ ] Claude API key created and saved in `.env`
- [ ] OpenAI API key created and saved in `.env` (for embeddings)
- [ ] Supabase connection tested from Node.js
- [ ] Team notification channel chosen and configured
- [ ] Google Sheets created, service account has editor access, saved in `.env`
- [ ] All credentials in `.env`, never in source files
- [ ] Each integration tested individually with a simple script
