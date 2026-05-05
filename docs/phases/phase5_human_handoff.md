# Phase 5 — Human Handoff

## Goal

Build the handoff service. When a message is unsafe for AI reply, update the lead to `needs_human`, create a handoff record, notify the customer service team, and send a safe holding message to the customer.

## Exit Criteria

- [ ] Lead status set to `needs_human` in Supabase
- [ ] `human_handoffs` row created with correct urgency and reason
- [ ] Team notification sent with all required context
- [ ] Holding message sent to customer and stored as outbound message
- [ ] Workflow completes without error for all handoff scenarios

---

## Files to Create

```
src/
  services/handoff.js   <- Human handoff logic
```

---

## `src/services/handoff.js`

```js
const supabase = require('../lib/supabase');

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

async function sendHandoff({
  lead_id, message_id, conversation_id,
  message_text, customer_phone, channel,
  handoff_reason, urgency = 'medium',
  recommended_next_action, lead_status
}) {
  // 1. Update lead
  await supabase.from('leads').update({
    lead_status: 'needs_human',
    handoff_required: true,
    priority: urgency === 'high' ? 'high' : 'medium',
    recommended_next_action,
    updated_at: new Date().toISOString()
  }).eq('id', lead_id);

  // 2. Insert lead_status_history
  await supabase.from('lead_status_history').insert({
    lead_id,
    previous_status: lead_status,
    new_status: 'needs_human',
    changed_by: 'ai',
    reason: handoff_reason
  });

  // 3. Insert human_handoffs record
  await supabase.from('human_handoffs').insert({
    lead_id,
    message_id,
    handoff_reason,
    urgency,
    recommended_next_action,
    notified_at: new Date().toISOString()
  });

  // 4. Fetch lead details for notification
  const { data: lead } = await supabase
    .from('leads')
    .select('name, phone, primary_channel, last_message, tags')
    .eq('id', lead_id)
    .single();

  // 5. Build and send team notification
  const urgencyEmoji = { high: 'ðŸ"´', medium: 'ðŸŸ¡', low: 'ðŸŸ¢' }[urgency] || 'ðŸŸ¡';
  const notification = `${urgencyEmoji} *تنبيه: تحويل لموظف*

ðŸ'¤ الاسم: ${lead?.name || 'غير معروف'}
ðŸ"± الهاتف: ${lead?.phone}
ðŸ"² القناة: ${lead?.primary_channel}
ðŸ"© آخر رسالة: ${lead?.last_message}
ðŸ"Œ سبب التحويل: ${handoff_reason}
â¡ï¸ الإجراء المقترح: ${recommended_next_action}`;

  // Send to team number (or Telegram — configure as needed)
  if (process.env.TEAM_WHATSAPP_NUMBER) {
    await sendWhatsAppMessage(process.env.TEAM_WHATSAPP_NUMBER, notification).catch(err =>
      console.error('Team notification failed:', err)
    );
  }

  // 6. Send holding message to customer
  const holdingMessage = urgency === 'high'
    ? 'شكراً لتواصلك. موضوعك يحتاج اهتمام عاجل وسيتواصل معك أحد المختصين خلال دقائق.'
    : 'شكراً لتواصلك. سيتواصل معك أحد فريقنا قريباً لمساعدتك.';

  let whatsappMsgId = null;
  try {
    const waSent = await sendWhatsAppMessage(customer_phone, holdingMessage);
    whatsappMsgId = waSent?.messages?.[0]?.id;
  } catch (err) {
    console.error('Holding message send failed:', err);
  }

  // 7. Store holding message in DB
  await supabase.from('messages').insert({
    lead_id,
    conversation_id,
    channel,
    direction: 'outbound',
    message_type: 'text',
    text: holdingMessage,
    platform_message_id: whatsappMsgId,
    responder_type: 'ai',
    reply_type: 'handoff'
  });
}

module.exports = { sendHandoff };
```

---

## Configuration

Add to `.env`:
```
TEAM_WHATSAPP_NUMBER=962XXXXXXXXX   # team member number to receive alerts
```

---

## Testing

Trigger a handoff by sending a `needs_human` test message:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d @tests/test_messages/needs_human.json
```

Check:
- `leads.lead_status` = `needs_human`
- `human_handoffs` row created
- Outbound holding message in `messages` table
- Team notification received (if `TEAM_WHATSAPP_NUMBER` set)

---

## Checklist

- [ ] `src/services/handoff.js` created
- [ ] Lead status updated to `needs_human`
- [ ] `human_handoffs` row inserted
- [ ] `lead_status_history` row inserted
- [ ] Team notification sent (or logged if no number configured)
- [ ] Holding message sent to customer and stored
- [ ] Works for high, medium, and low urgency
