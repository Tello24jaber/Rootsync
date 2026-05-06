const supabase = require('../lib/supabase');
const { classifyAndRoute } = require('./classify');
const { generateReply } = require('./reply');
const { sendHandoff } = require('./handoff');

async function processIncomingMessage(input = {}) {
  const { text, user_id, name } = input;

  if (!text) {
    throw new Error('Missing text field');
  }

  const now = new Date().toISOString();
  const channel = 'demo';
  const customer_phone = user_id || 'demo_user';
  const customer_name = name || 'Demo User';

  // 1) Upsert lead
  let lead_id;
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, workflow_status')
    .eq('phone', customer_phone)
    .single();

  if (existingLead) {
    lead_id = existingLead.id;
    await supabase
      .from('leads')
      .update({
        name: customer_name,
        last_message: text,
        last_message_at: now,
        updated_at: now
      })
      .eq('id', lead_id);
  } else {
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        phone: customer_phone,
        name: customer_name,
        primary_channel: channel,
        lead_temperature: 'cold',
        workflow_status: 'new',
        service_interest: 'unclear',
        tags: [],
        last_message: text,
        last_message_at: now,
        updated_at: now
      })
      .select('id')
      .single();

    if (leadError) throw leadError;
    lead_id = newLead.id;
  }

  // 2) Upsert conversation
  let conversation_id = null;
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('lead_id', lead_id)
    .eq('channel', channel)
    .eq('status', 'open')
    .limit(1)
    .single();

  if (conv) {
    conversation_id = conv.id;
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        lead_id,
        channel,
        status: 'open'
      })
      .select('id')
      .single();

    if (convError) throw convError;
    conversation_id = newConv?.id;
  }

  // 3) Store inbound message (always stored, even when human has taken over)
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      lead_id,
      conversation_id,
      channel,
      direction: 'inbound',
      message_type: 'text',
      text,
      responder_type: 'customer',
      created_at: now
    })
    .select('id')
    .single();

  if (msgError) throw msgError;

  const message_id = message?.id;

  // 4) If a human has taken over, skip AI completely.
  if (['needs_human', 'human_active'].includes(existingLead?.workflow_status)) {
    return {
      reply: null,
      classification: null,
      needs_human: true,
      lead_id
    };
  }

  // 5) AI classification
  const classification = await classifyAndRoute({
    lead_id,
    message_id,
    message_text: text,
    channel,
    customer_id: customer_phone
  });

  const needs_human = classification.workflow_status === 'needs_human';

  // 6a) Handoff flow
  if (needs_human) {
    if (classification.should_ai_reply !== false && classification.send_bridge_reply === true) {
      const bridgeResult = await generateReply({
        lead_id,
        conversation_id,
        message_text: text,
        channel,
        classification
      });

      await sendHandoff({
        lead_id,
        message_id,
        conversation_id,
        handoff_reason: classification.handoff_reason || 'Customer requested appointment/call',
        urgency: classification.urgency || 'medium',
        recommended_next_action: classification.recommended_next_action,
        channel
      });

      return {
        reply: bridgeResult.reply_text,
        classification,
        needs_human: true,
        lead_id
      };
    }

    await sendHandoff({
      lead_id,
      message_id,
      conversation_id,
      handoff_reason: classification.handoff_reason || 'AI flagged for human review',
      urgency: classification.urgency || 'medium',
      recommended_next_action: classification.recommended_next_action,
      channel
    });

    return {
      reply: null,
      classification,
      needs_human: true,
      lead_id
    };
  }

  // 6b) AI reply flow
  const replyResult = await generateReply({
    lead_id,
    conversation_id,
    message_text: text,
    channel,
    classification
  });

  if (!replyResult.should_send || replyResult.reply_type === 'handoff') {
    await sendHandoff({
      lead_id,
      message_id,
      conversation_id,
      handoff_reason: replyResult.reason || 'AI reply flagged unsafe',
      urgency: classification.urgency || 'medium',
      recommended_next_action: classification.recommended_next_action,
      channel
    });

    return {
      reply: null,
      classification,
      needs_human: true,
      lead_id
    };
  }

  return {
    reply: replyResult.reply_text,
    classification,
    needs_human: false,
    lead_id
  };
}

module.exports = { processIncomingMessage };
