# Phase 4 — AI Lead Classification

## Goal

Build the classification service. Take a normalized inbound message, call the AI classifier, parse and validate the JSON response, update the lead record, and store classification artifacts. Route to the reply service (Phase 6) or human handoff service (Phase 5) based on the result.

## Exit Criteria

- [ ] Classification prompt produces valid JSON for all 5 test messages
- [ ] Low-confidence results (< 0.65) correctly fall back to `needs_human`
- [ ] Lead status updated in Supabase after every classification
- [ ] `lead_status_history` row inserted on every status change
- [ ] `message_topics` rows inserted correctly
- [ ] Routing to reply or handoff works correctly
- [ ] All 5 test cases in `tests/test_messages/` produce expected outputs

---

## Files to Create

```
src/
  services/classify.js   <- Main classification logic + routing
```

---

## Step-by-Step

### `src/services/classify.js`

```js
const supabase = require('../lib/supabase');
const { sendHandoff } = require('./handoff');
const { sendReply } = require('./reply');
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../../prompts/classification_prompt.md'), 'utf8'
);

async function callClaude(messageText, channel, customerPhone) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `رسالة العميل:\n${messageText}\n\nمعلومات إضافية:\n- القناة: ${channel}\n- رقم الهاتف: ${customerPhone}\n\nأرجع JSON فقط.`
      }]
    })
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

function parseClassification(raw) {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    if (!result.confidence || result.confidence < 0.65) {
      result.lead_status = 'needs_human';
      result.should_ai_reply = false;
      result.handoff_reason = result.handoff_reason || 'Low confidence score';
    }
    return result;
  } catch {
    return {
      lead_status: 'needs_human',
      tags: [],
      health_topic: null,
      service_interest: 'unclear',
      urgency: 'medium',
      sentiment: 'neutral',
      should_ai_reply: false,
      handoff_reason: 'AI response could not be parsed',
      recommended_next_action: 'Human review required',
      confidence: 0
    };
  }
}

async function classifyAndRoute({ lead_id, message_id, conversation_id, message_text, message_type, channel, customer_phone }) {
  // Non-text messages go straight to handoff
  if (message_type !== 'text' || !message_text) {
    return sendHandoff({
      lead_id, message_id, conversation_id,
      message_text, customer_phone, channel,
      handoff_reason: 'Non-text message — requires human review',
      urgency: 'medium',
      recommended_next_action: 'Review media message and respond manually',
      lead_status: 'needs_human'
    });
  }

  // Get current lead status (for history record)
  const { data: lead } = await supabase
    .from('leads').select('lead_status').eq('id', lead_id).single();
  const previousStatus = lead?.lead_status;

  // Call Claude
  const raw = await callClaude(message_text, channel, customer_phone);
  const classification = parseClassification(raw);

  // Update lead
  await supabase.from('leads').update({
    lead_status: classification.lead_status,
    tags: classification.tags,
    health_topic: classification.health_topic,
    service_interest: classification.service_interest,
    priority: classification.urgency === 'high' ? 'high' : 'medium',
    recommended_next_action: classification.recommended_next_action,
    updated_at: new Date().toISOString()
  }).eq('id', lead_id);

  // Insert lead_status_history if status changed
  if (previousStatus !== classification.lead_status) {
    await supabase.from('lead_status_history').insert({
      lead_id,
      previous_status: previousStatus,
      new_status: classification.lead_status,
      changed_by: 'ai',
      reason: `AI classification — confidence: ${classification.confidence}`
    });
  }

  // Insert message_topics
  if (classification.tags?.length) {
    await supabase.from('message_topics').insert(
      classification.tags.map(topic => ({ message_id, lead_id, topic }))
    );
  }

  // Route
  const context = {
    lead_id, message_id, conversation_id,
    message_text, customer_phone, channel,
    lead_status: classification.lead_status,
    service_interest: classification.service_interest,
    health_topic: classification.health_topic,
    sentiment: classification.sentiment,
    urgency: classification.urgency,
    recommended_next_action: classification.recommended_next_action
  };

  if (classification.should_ai_reply) {
    return sendReply(context);
  } else {
    return sendHandoff({ ...context, handoff_reason: classification.handoff_reason });
  }
}

module.exports = { classifyAndRoute };
```

---

## Testing

Run each test message through the webhook and check Supabase for correct classification results:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d @tests/test_messages/hot_lead.json
```

Check that `leads.lead_status`, `lead_status_history`, and `message_topics` match `tests/expected_outputs/hot_lead_expected.json`.

---

## Checklist

- [ ] `src/services/classify.js` created
- [ ] Claude API call working (returns valid JSON)
- [ ] Parse fallback handles malformed responses
- [ ] Low-confidence fallback to `needs_human` works
- [ ] Lead record updated after classification
- [ ] `lead_status_history` inserted on status change
- [ ] `message_topics` inserted
- [ ] Routing to `sendReply` vs `sendHandoff` correct
- [ ] All 5 test cases produce expected outputs
