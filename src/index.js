require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const supabase = require('./lib/supabase');
const { classifyAndRoute } = require('./services/classify');
const { generateReply } = require('./services/reply');
const { sendHandoff } = require('./services/handoff');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── API routes ─────────────────────────────────────────────────────────────
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// ─── Serve agent dashboard at /dashboard ────────────────────────────────────
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../dashboard/index.html')));

// ─── Serve test UI at root ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../test-ui')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, service: 'rootsync-system1' }));

// ─── Main demo endpoint — accepts test-ui messages ──────────────────────────
// POST / with { text, user_id, name }
// Returns { reply, classification, needs_human, lead_id }
app.post('/', async (req, res) => {
  const { text, user_id, name } = req.body || {};

  if (!text) return res.status(400).json({ error: 'Missing text field' });

  const channel = 'demo';
  const customer_phone = user_id || 'demo_user';
  const customer_name = name || 'Demo User';

  try {
    // ── 1. Upsert lead ────────────────────────────────────────────────────
    // Try to find existing lead first, then insert or update
    let lead_id;
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, workflow_status')
      .eq('phone', customer_phone)
      .single();

    if (existingLead) {
      lead_id = existingLead.id;
      await supabase.from('leads').update({
        name: customer_name,
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', lead_id);
    } else {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          phone: customer_phone,
          name: customer_name,
          primary_channel: channel,
          lead_temperature: 'cold',
          last_message: text,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (leadError) throw leadError;
      lead_id = newLead.id;
    }

    // ── 2. Upsert conversation ────────────────────────────────────────────
    let conversation_id = null;
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('lead_id', lead_id)
      .eq('channel', channel)
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (conv) {
      conversation_id = conv.id;
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ lead_id, channel, status: 'open', started_at: new Date().toISOString() })
        .select('id')
        .single();
      conversation_id = newConv?.id;
    }

    // ── 3. Store inbound message ──────────────────────────────────────────
    const { data: message } = await supabase
      .from('messages')
      .insert({
        lead_id,
        conversation_id,
        channel,
        direction: 'inbound',
        message_type: 'text',
        text,
        responder_type: 'customer',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    const message_id = message?.id;

    // ── 4a. Skip AI if a human has manually taken over this lead ─────────
    if (['needs_human', 'human_active'].includes(existingLead?.workflow_status)) {
      console.log(`[index] Lead ${lead_id} is under human control (${existingLead.workflow_status}) — skipping AI`);
      return res.json({ reply: null, needs_human: true, lead_id, classification: null });
    }

    // ── 4. Classify ───────────────────────────────────────────────────────
    const classification = await classifyAndRoute({
      lead_id,
      message_id,
      message_text: text,
      channel,
      customer_id: customer_phone
    });

    const needs_human = classification.workflow_status === 'needs_human';

    // ── 5a. Handoff path ──────────────────────────────────────────────────
    if (needs_human) {
      // If bridge reply needed (booking/appointment/call) — Malak acknowledges first, then human takes over
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
        return res.json({
          reply: bridgeResult.reply_text,
          classification,
          needs_human: true,
          lead_id
        });
      }

      // Silent handoff — emergency or unsafe (no reply to customer)
      await sendHandoff({
        lead_id,
        message_id,
        conversation_id,
        handoff_reason: classification.handoff_reason || 'AI flagged for human review',
        urgency: classification.urgency || 'medium',
        recommended_next_action: classification.recommended_next_action,
        channel
      });
      return res.json({
        reply: null,
        classification,
        needs_human: true,
        lead_id
      });
    }

    // ── 5b. AI reply path ─────────────────────────────────────────────────
    const replyResult = await generateReply({
      lead_id,
      conversation_id,
      message_text: text,
      channel,
      classification
    });

    // If reply generation itself decided handoff
    if (!replyResult.should_send || replyResult.reply_type === 'handoff') {
      const holdingMessage = await sendHandoff({
        lead_id,
        message_id,
        conversation_id,
        handoff_reason: replyResult.reason || 'AI reply flagged unsafe',
        urgency: classification.urgency || 'medium',
        recommended_next_action: classification.recommended_next_action,
        channel
      });
      return res.json({
        reply: null,
        classification,
        needs_human: true,
        lead_id
      });
    }

    return res.json({
      reply: replyResult.reply_text,
      classification,
      needs_human: false,
      lead_id
    });

  } catch (err) {
    console.error('Error processing message:', err);
    return res.status(500).json({
      reply: 'عذراً، حدث خطأ في النظام. سيتواصل معك أحد فريقنا قريباً.',
      error: err.message,
      needs_human: true
    });
  }
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`RootSync System 1 running on http://localhost:${PORT}`);
  console.log(`Opening browser → ${url}`);
  // Auto-open browser (Windows)
  exec(`start ${url}`, err => { if (err) console.warn('Could not auto-open browser:', err.message); });
});
