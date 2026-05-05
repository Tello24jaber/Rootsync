# Phase 6 — AI Safe Reply & Send

## Goal

Build the reply service. Generate a safe, warm Arabic reply using AI, validate it, store it as an outbound message, and send it to the customer via WhatsApp. If the reply is unsafe or uncertain, route to human handoff instead.

## Exit Criteria

- [ ] AI generates valid JSON reply for all safe test messages
- [ ] Reply is only sent when `should_send = true` and `reply_type != handoff`
- [ ] Outbound message stored in Supabase before sending
- [ ] WhatsApp send call succeeds and `platform_message_id` saved
- [ ] `last_reply_at` updated on the lead record
- [ ] Unsafe replies route to handoff without sending
- [ ] End-to-end test: WhatsApp message -> reply received on phone

---

## Files to Create

```
src/
  services/reply.js   <- AI reply generation and WhatsApp send
```

---

## `src/services/reply.js`

```js
const supabase = require('../lib/supabase');
const { sendHandoff } = require('./handoff');
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../../prompts/reply_prompt.md'), 'utf8'
);

async function callClaudeReply({ message_text, lead_status, service_interest, health_topic, sentiment }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `رسالة العميل:\n${message_text}\n\nتصنيف الرسالة:\n- الحالة: ${lead_status}\n- الاهتمام بالخدمة: ${service_interest}\n- الموضوع الصحي: ${health_topic}\n- الطابع: ${sentiment}\n\nأرجع JSON فقط.`
      }]
    })
  });
  if (!res.ok) throw new Error(`Claude reply error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

function parseReply(raw) {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const reply = JSON.parse(cleaned);

    if (reply.reply_type === 'handoff') reply.should_send = false;
    if (!reply.reply_text?.trim()) {
      reply.should_send = false;
      reply.reply_type = 'handoff';
      reply.reason = 'Empty reply text — fallback to handoff';
    }
    return reply;
  } catch {
    return {
      reply_text: null,
      reply_type: 'handoff',
      should_send: false,
      reason: 'AI reply could not be parsed — fallback to handoff'
    };
  }
}

async function sendWhatsAppMessage(to, text) {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      })
    }
  );
  if (!res.ok) throw new Error(`WhatsApp send error: ${res.status}`);
  return res.json();
}

async function sendReply(context) {
  const {
    lead_id, message_id, conversation_id,
    message_text, customer_phone, channel,
    lead_status, service_interest, health_topic, sentiment, urgency,
    recommended_next_action
  } = context;

  let reply;
  try {
    const raw = await callClaudeReply({ message_text, lead_status, service_interest, health_topic, sentiment });
    reply = parseReply(raw);
  } catch (err) {
    console.error('Reply generation failed:', err);
    reply = { reply_text: null, reply_type: 'handoff', should_send: false, reason: err.message };
  }

  // Route to handoff if unsafe
  if (!reply.should_send || reply.reply_type === 'handoff') {
    return sendHandoff({
      lead_id, message_id, conversation_id,
      message_text, customer_phone, channel,
      handoff_reason: reply.reason || 'AI decided handoff',
      urgency: urgency || 'medium',
      recommended_next_action,
      lead_status
    });
  }

  // Store outbound message before sending
  const { data: outboundMsg, error } = await supabase.from('messages').insert({
    lead_id,
    conversation_id,
    channel,
    direction: 'outbound',
    message_type: 'text',
    text: reply.reply_text,
    responder_type: 'ai',
    reply_type: reply.reply_type
  }).select('id').single();

  if (error) throw error;

  // Send to WhatsApp
  const waSent = await sendWhatsAppMessage(customer_phone, reply.reply_text);
  const whatsappMsgId = waSent?.messages?.[0]?.id;

  // Update message with platform_message_id
  if (whatsappMsgId) {
    await supabase.from('messages')
      .update({ platform_message_id: whatsappMsgId })
      .eq('id', outboundMsg.id);
  }

  // Update lead last_reply_at
  await supabase.from('leads').update({
    last_reply_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', lead_id);
}

module.exports = { sendReply };
```

---

## Reply Type Behavior

| reply_type | should_send | Action |
|---|---|---|
| `auto_reply` | `true` | Send immediately via WhatsApp |
| `suggested_reply` | `false` | Store, notify human to review and send manually |
| `handoff` | `false` | Route to handoff service |

---

## Testing

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d @tests/test_messages/hot_lead.json
```

Expected: AI reply sent to customer WhatsApp, outbound message stored in `messages` table.

---

## Checklist

- [ ] `src/services/reply.js` created
- [ ] Claude reply call working
- [ ] Parse fallback routes to handoff correctly
- [ ] Outbound message stored before WhatsApp send
- [ ] `platform_message_id` saved after send
- [ ] `last_reply_at` updated on lead
- [ ] Unsafe replies route to `sendHandoff`
- [ ] End-to-end test passes with real WhatsApp
