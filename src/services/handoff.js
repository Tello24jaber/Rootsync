const supabase = require('../lib/supabase');

async function sendHandoff({
  lead_id, message_id, conversation_id,
  handoff_reason, urgency = 'medium',
  recommended_next_action, channel
}) {
  // 1. Insert human_handoffs record
  await supabase.from('human_handoffs').insert({
    lead_id,
    message_id,
    handoff_reason,
    urgency,
    recommended_next_action,
    notified_at: new Date().toISOString()
  });

  // 2. No message sent to customer — agent will reply directly as a human
  console.log(`[Handoff] Lead ${lead_id} | Urgency: ${urgency} | Reason: ${handoff_reason}`);

  return null;
}

module.exports = { sendHandoff };
