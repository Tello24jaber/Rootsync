# Phase 5 — Human Handoff

## Goal

Build the handoff service. When a message is unsafe for AI reply, update the lead's `workflow_status` to `needs_human`, create a handoff record, notify the CS team, and send a safe holding message to the customer.

## Exit Criteria

- [ ] `leads.workflow_status` set to `needs_human` in Supabase
- [ ] `human_handoffs` row created with correct urgency and reason
- [ ] Team notified via email (primary) or WhatsApp (optional)
- [ ] Holding message sent to customer and stored as outbound message
- [ ] Workflow completes without error for all handoff scenarios

---

## Files to Create

```
src/
  services/whatsapp.js  <- Shared WhatsApp send helper
  services/handoff.js   <- Human handoff logic
```

---

## `src/services/whatsapp.js`

Shared helper used by handoff, reply, and insights. Do not duplicate this in other services.

```js
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

module.exports = { sendWhatsAppMessage };
```

---

## `src/services/handoff.js`

```js
const supabase = require('../lib/supabase');
const { sendWhatsAppMessage } = require('./whatsapp');
const nodemailer = require('nodemailer');

async function notifyTeam({ lead, handoff_reason, recommended_next_action, urgency }) {
  const urgencyLabel = { high: '🔴 URGENT', medium: '🟡 Medium', low: '🟢 Low' }[urgency] || '🟡 Medium';
  const subject = `${urgencyLabel} — Human Handoff Required`;
  const body = `A customer message requires human review.

Name: ${lead?.name || 'Unknown'}
Phone: ${lead?.phone}
Channel: ${lead?.primary_channel}
Last message: ${lead?.last_message}
Reason: ${handoff_reason}
Suggested action: ${recommended_next_action}`;

  // Primary: email notification
  if (process.env.TEAM_NOTIFICATION_EMAIL) {
    const transporter = nodemailer.createTransport({ sendmail: true });
    await transporter.sendMail({
      from: process.env.NOTIFICATION_FROM_EMAIL || 'noreply@rootsync.app',
      to: process.env.TEAM_NOTIFICATION_EMAIL,
      subject,
      text: body
    }).catch(err => console.error('Email notification failed:', err));
  }

  // Optional: WhatsApp notification
  if (process.env.TEAM_WHATSAPP_NUMBER) {
    const waBody = `${urgencyLabel}\n\n${body}`;
    await sendWhatsAppMessage(process.env.TEAM_WHATSAPP_NUMBER, waBody)
      .catch(err => console.error('WhatsApp team notification failed:', err));
  }

  if (!process.env.TEAM_NOTIFICATION_EMAIL && !process.env.TEAM_WHATSAPP_NUMBER) {
    console.warn('Handoff: no TEAM_NOTIFICATION_EMAIL or TEAM_WHATSAPP_NUMBER configured.');
    console.warn('Handoff details:', { lead, handoff_reason, recommended_next_action, urgency });
  }
}

async function sendHandoff({
  lead_id, message_id, conversation_id,
  message_text, customer_phone, channel,
  handoff_reason, urgency = 'medium',
  recommended_next_action
}) {
  // 1. Update lead workflow_status
  await supabase.from('leads').update({
    workflow_status: 'needs_human',
    handoff_required: true,
    recommended_next_action,
    updated_at: new Date().toISOString()
  }).eq('id', lead_id);

  // 2. Insert human_handoffs record
  await supabase.from('human_handoffs').insert({
    lead_id,
    message_id,
    handoff_reason,
    urgency,
    recommended_next_action,
    notified_at: new Date().toISOString()
  });

  // 3. Fetch lead details for notification
  const { data: lead } = await supabase
    .from('leads')
    .select('name, phone, primary_channel, last_message')
    .eq('id', lead_id)
    .single();

  // 4. Notify team
  await notifyTeam({ lead, handoff_reason, recommended_next_action, urgency });

  // 5. Send holding message to customer
  const holdingMessage = urgency === 'high'
    ? 'شكراً لتواصلك. موضوعك يحتاج اهتمام عاجل وسيتواصل معك أحد المختصين خلال دقائق.'
    : 'شكراً لتواصلك. سيتواصل معك أحد فريقنا قريباً لمساعدتك.';

  let whatsappMsgId = null;
  let sendStatus = 'pending';
  let sendError = null;
  try {
    const waSent = await sendWhatsAppMessage(customer_phone, holdingMessage);
    whatsappMsgId = waSent?.messages?.[0]?.id;
    sendStatus = 'sent';
  } catch (err) {
    console.error('Holding message send failed:', err);
    sendStatus = 'failed';
    sendError = err.message;
  }

  // 6. Store holding message in DB
  await supabase.from('messages').insert({
    lead_id,
    conversation_id,
    channel,
    direction: 'outbound',
    message_type: 'text',
    text: holdingMessage,
    platform_message_id: whatsappMsgId,
    responder_type: 'system',
    reply_type: 'handoff',
    send_status: sendStatus,
    send_error: sendError,
    sent_at: sendStatus === 'sent' ? new Date().toISOString() : null
  });
}

module.exports = { sendHandoff };
```

---

## Setup

```bash
npm install nodemailer
```

Add to `.env`:
```
TEAM_NOTIFICATION_EMAIL=team@yourcompany.com
# Optional:
TEAM_WHATSAPP_NUMBER=962XXXXXXXXX
```

---

## Testing

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d @tests/test_messages/needs_human.json
```

Check:
- `leads.workflow_status` = `needs_human`
- `human_handoffs` row created
- Outbound holding message in `messages` table with `send_status`
- Team email or WhatsApp notification received

---

## Checklist

- [ ] `src/services/whatsapp.js` created (shared helper)
- [ ] `src/services/handoff.js` created
- [ ] `leads.workflow_status` updated to `needs_human`
- [ ] `human_handoffs` row inserted
- [ ] Team notified via email (and optionally WhatsApp)
- [ ] Holding message sent to customer and stored
- [ ] `send_status` tracked on outbound message

