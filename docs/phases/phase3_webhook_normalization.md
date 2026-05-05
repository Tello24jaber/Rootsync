# Phase 3 — Webhook & Message Normalization

## Goal

Build the webhook route in Express. Receive a WhatsApp webhook payload, respond 200 immediately, normalize the message, deduplicate, find or create the lead and conversation, and store the inbound message in Supabase. Then call the classification service.

## Exit Criteria

- [ ] GET `/webhook/whatsapp` responds with `hub.challenge` for Meta verification
- [ ] POST `/webhook/whatsapp` processes fake payload without error
- [ ] Normalized message object is correctly structured
- [ ] Duplicate message (same `platform_message_id`) is skipped without error
- [ ] New lead row created in `leads` table
- [ ] New conversation row created in `conversations` table
- [ ] Inbound message row created in `messages` table
- [ ] Server responds 200 OK immediately (before classification)

---

## Files to Create

```
src/
  routes/webhook.js          <- Express router for /webhook/whatsapp
  services/normalize.js      <- Parse raw WhatsApp payload
  db/leads.js                <- Supabase helpers for leads table
  db/messages.js             <- Supabase helpers for messages table
  db/conversations.js        <- Supabase helpers for conversations table
```

---

## Step-by-Step

### Step 1: `src/services/normalize.js`

```js
function normalizeWhatsAppMessage(body) {
  const change = body.entry?.[0]?.changes?.[0]?.value;
  if (!change?.messages?.length) return null; // status update, not a message

  const message = change.messages[0];
  const contact = change.contacts?.[0];

  return {
    platform_message_id: message.id,
    channel: 'whatsapp',
    direction: 'inbound',
    message_type: message.type,
    text: message.type === 'text' ? message.text.body
        : message.type === 'interactive' ? message.interactive?.button_reply?.title || null
        : message.type === 'button' ? message.button?.text || null
        : null,
    raw_payload: body,
    customer_phone: message.from,
    customer_name: contact?.profile?.name || null,
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString()
  };
}

module.exports = { normalizeWhatsAppMessage };
```

---

### Step 2: `src/db/leads.js`

```js
const supabase = require('../lib/supabase');

async function findOrCreateLead({ phone, name }) {
  const { data: existing } = await supabase
    .from('leads').select('id, lead_status').eq('phone', phone).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase.from('leads').insert({
    phone, name, primary_channel: 'whatsapp', lead_status: 'new'
  }).select('id, lead_status').single();

  if (error) throw error;
  return data;
}

async function updateLeadLastMessage(leadId, text, timestamp) {
  await supabase.from('leads').update({
    last_message: text,
    last_message_at: timestamp,
    updated_at: new Date().toISOString()
  }).eq('id', leadId);
}

module.exports = { findOrCreateLead, updateLeadLastMessage };
```

---

### Step 3: `src/db/conversations.js`

```js
const supabase = require('../lib/supabase');

async function findOrCreateConversation(leadId, channel) {
  const { data: existing } = await supabase
    .from('conversations').select('id')
    .eq('lead_id', leadId).eq('channel', channel).eq('status', 'open')
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase.from('conversations').insert({
    lead_id: leadId, channel, status: 'open'
  }).select('id').single();

  if (error) throw error;
  return data;
}

module.exports = { findOrCreateConversation };
```

---

### Step 4: `src/db/messages.js`

```js
const supabase = require('../lib/supabase');

async function isDuplicateMessage(platformMessageId) {
  const { data } = await supabase
    .from('messages').select('id').eq('platform_message_id', platformMessageId).maybeSingle();
  return !!data;
}

async function insertMessage(msg) {
  const { data, error } = await supabase.from('messages').insert(msg).select('id').single();
  if (error) throw error;
  return data;
}

module.exports = { isDuplicateMessage, insertMessage };
```

---

### Step 5: `src/routes/webhook.js`

```js
const express = require('express');
const router = express.Router();
const { normalizeWhatsAppMessage } = require('../services/normalize');
const { findOrCreateLead, updateLeadLastMessage } = require('../db/leads');
const { findOrCreateConversation } = require('../db/conversations');
const { isDuplicateMessage, insertMessage } = require('../db/messages');
const { classifyAndRoute } = require('../services/classify'); // added in Phase 4

// GET — Meta webhook verification
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST — Incoming WhatsApp message
router.post('/whatsapp', async (req, res) => {
  res.sendStatus(200); // Respond immediately — WhatsApp retries if no 200

  try {
    const normalized = normalizeWhatsAppMessage(req.body);
    if (!normalized) return;

    if (await isDuplicateMessage(normalized.platform_message_id)) return;

    const lead = await findOrCreateLead({
      phone: normalized.customer_phone,
      name: normalized.customer_name
    });

    const conversation = await findOrCreateConversation(lead.id, normalized.channel);

    const message = await insertMessage({
      lead_id: lead.id,
      conversation_id: conversation.id,
      channel: normalized.channel,
      platform_message_id: normalized.platform_message_id,
      direction: 'inbound',
      message_type: normalized.message_type,
      text: normalized.text,
      raw_payload: normalized.raw_payload,
      responder_type: 'customer'
    });

    await updateLeadLastMessage(lead.id, normalized.text, normalized.timestamp);

    await classifyAndRoute({
      lead_id: lead.id,
      message_id: message.id,
      conversation_id: conversation.id,
      message_text: normalized.text,
      message_type: normalized.message_type,
      channel: normalized.channel,
      customer_phone: normalized.customer_phone
    });

  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

module.exports = router;
```

---

## Testing

### Test 1 — Meta Webhook Verification

```
GET http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123
```
Expected: responds with `test123` as plain text.

### Test 2 — Fake Inbound Message

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d @tests/test_messages/hot_lead.json
```

Expected: `200 OK`, lead/conversation/message rows created in Supabase.

### Test 3 — Duplicate Message

Send same payload twice. Second call should be skipped silently.

---

## Error Handling

| Error | Handling |
|---|---|
| Supabase insert fails | `console.error`, do nothing (200 already sent) |
| Normalization returns null | Return early (status update, not a message) |
| Duplicate `platform_message_id` | Return early silently |
| Classification fails | Log error — webhook already responded 200 |

---

## Checklist

- [ ] `src/services/normalize.js` created and tested
- [ ] `src/db/leads.js`, `messages.js`, `conversations.js` created
- [ ] `src/routes/webhook.js` registered in `src/index.js`
- [ ] GET verification returns hub.challenge
- [ ] Duplicate check working
- [ ] Lead/conversation/message rows created on first message
- [ ] Server responds 200 immediately
- [ ] All 3 test cases pass
