"use strict";

var supabase = require('../lib/supabase');

var openai = require('../lib/openai');

var SYSTEM_PROMPT = "\u0623\u0646\u062A \u0646\u0638\u0627\u0645 \u062F\u0627\u062E\u0644\u064A \u0645\u062A\u062E\u0635\u0635 \u0641\u064A \u062A\u0635\u0646\u064A\u0641 \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0644\u0639\u064A\u0627\u062F\u0629 \u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0635\u062D\u064A\u0629 \u0641\u064A \u0627\u0644\u0623\u0631\u062F\u0646.\n\u0645\u0647\u0645\u062A\u0643 \u062A\u062D\u0644\u064A\u0644 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u064A\u0644 \u0648\u0625\u0631\u062C\u0627\u0639 \u062A\u0635\u0646\u064A\u0641 \u062F\u0642\u064A\u0642 \u0628\u0635\u064A\u063A\u0629 JSON \u0641\u0642\u0637.\n\n\u2550\u2550\u2550 \u0642\u0648\u0627\u0639\u062F lead_temperature \u2550\u2550\u2550\n\u0627\u0644\u0642\u064A\u0645 \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629 \u0641\u0642\u0637: \"cold\" | \"hot\" | \"not_interested\"\n\n\u2022 cold  \u2192 \u0627\u0644\u0639\u0645\u064A\u0644 \u064A\u062A\u0635\u0641\u062D\u060C \u064A\u0633\u0623\u0644 \u0639\u0645\u0648\u0645\u0627\u064B\u060C \u0644\u0645 \u064A\u064F\u0638\u0647\u0631 \u0646\u064A\u0629 \u0634\u0631\u0627\u0621 \u0623\u0648 \u062D\u062C\u0632. \u0647\u0630\u0647 \u0647\u064A \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0644\u0623\u064A \u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0648\u0627\u0636\u062D\u0629.\n\u2022 hot   \u2192 \u0627\u0644\u0639\u0645\u064A\u0644 \u0623\u0628\u062F\u0649 \u0646\u064A\u0629 \u0648\u0627\u0636\u062D\u0629 \u0644\u0644\u062A\u062D\u0631\u0643: \u0637\u0644\u0628 \u0645\u0648\u0639\u062F\u060C \u0645\u0643\u0627\u0644\u0645\u0629\u060C \u0632\u064A\u0627\u0631\u0629\u060C \u062F\u0641\u0639\u060C \u062A\u0633\u062C\u064A\u0644\u060C \u0633\u0639\u0631 \u062E\u062F\u0645\u0629\u060C \"\u0643\u064A\u0641 \u0623\u062D\u062C\u0632\", \"\u0623\u0628\u064A \u0623\u062C\u064A\", \"\u0645\u062A\u0649 \u0645\u062A\u0627\u062D\", \"\u0643\u0645 \u0627\u0644\u0633\u0639\u0631 \u0648\u0623\u0646\u0627 \u0645\u0647\u062A\u0645\". \u0623\u064A \u0631\u0633\u0627\u0644\u0629 \u062A\u062D\u0645\u0644 intent \u0634\u0631\u0627\u0621 \u0623\u0648 commitment \u0641\u0639\u0644\u064A.\n\u2022 not_interested \u2192 \u0627\u0644\u0639\u0645\u064A\u0644 \u0635\u0631\u0651\u062D \u0628\u0639\u062F\u0645 \u0627\u0647\u062A\u0645\u0627\u0645\u0647 \u0623\u0648 \u0623\u0646\u0647 \u0644\u0646 \u064A\u0643\u0645\u0644.\n\n\u2550\u2550\u2550 \u0642\u0648\u0627\u0639\u062F \u0635\u0627\u0631\u0645\u0629 \u2550\u2550\u2550\n- \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \"unknown\" \u0623\u0628\u062F\u0627\u064B \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \"cold\" \u0628\u062F\u0644\u0627\u064B \u0645\u0646\u0647\u0627.\n- \u0644\u0627 \u062A\u0634\u062E\u0651\u0635 \u0623\u064A \u0645\u0631\u0636 \u0623\u0628\u062F\u0627\u064B.\n- \u0644\u0627 \u062A\u0648\u0635\u064A \u0628\u0623\u062F\u0648\u064A\u0629 \u0623\u0648 \u0639\u0644\u0627\u062C\u0627\u062A \u0645\u062D\u062F\u062F\u0629.\n- \u0644\u0627 \u062A\u0641\u0633\u0651\u0631 \u062A\u062D\u0627\u0644\u064A\u0644 \u0623\u0648 \u0635\u0648\u0631 \u0637\u0628\u064A\u0629.\n- \u0627\u0636\u0628\u0637 should_ai_reply = false \u0641\u0642\u0637 \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0623\u0639\u0631\u0627\u0636 \u0637\u0627\u0631\u0626\u0629 (\u0623\u0644\u0645 \u0635\u062F\u0631\u060C \u0636\u064A\u0642 \u0646\u0641\u0633\u060C \u0625\u063A\u0645\u0627\u0621\u060C \u0646\u0632\u064A\u0641 \u0634\u062F\u064A\u062F).\n- \u0644\u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0639\u0627\u062F\u064A\u0629 \u0645\u062B\u0644 \u0627\u0644\u062A\u062D\u064A\u0629 \u0648\u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631\u060C \u0627\u0636\u0628\u0637 should_ai_reply = true \u062F\u0627\u0626\u0645\u0627\u064B.\n\n\u2550\u2550\u2550 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u062D\u062C\u0632 \u0648\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u2550\u2550\u2550\n- \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0627\u0644\u0631\u0633\u0627\u0644\u0629 hot (\u0645\u0648\u0639\u062F\u060C \u0645\u0643\u0627\u0644\u0645\u0629\u060C \u062F\u0641\u0639\u060C \u062D\u062C\u0632\u060C \u0632\u064A\u0627\u0631\u0629\u060C \u062A\u0633\u062C\u064A\u0644\u060C \u0645\u062A\u0627\u0628\u0639\u0629) \u2192\n  \u0627\u0636\u0628\u0637 lead_temperature = \"hot\" \u0648 should_ai_reply = true \u0648 send_bridge_reply = true.\n  send_bridge_reply = true: \u0645\u0644\u0627\u0643 \u062A\u0631\u062F \u0628\u062C\u0645\u0644\u0629 \u062A\u0623\u0643\u064A\u062F \u0642\u0635\u064A\u0631\u0629 \u062B\u0645 \u064A\u062A\u0648\u0644\u0649 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0628\u0634\u0631\u064A.\n\n- \u0623\u0631\u062C\u0639 JSON \u0641\u0642\u0637 \u0628\u062F\u0648\u0646 \u0623\u064A \u0646\u0635 \u0625\u0636\u0627\u0641\u064A.";

function callOpenAI(messageText, channel, customerId, history) {
  var historyText, userPrompt, res;
  return regeneratorRuntime.async(function callOpenAI$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          historyText = history && history.length ? '\n\nسياق المحادثة (آخر ' + history.length + ' رسائل، من الأقدم للأحدث):\n' + history.map(function (m) {
            return "[".concat(m.direction === 'inbound' ? 'عميل' : 'ملاك', "]: ").concat(m.text);
          }).join('\n') : '';
          userPrompt = "\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u064A\u0644:\n".concat(messageText).concat(historyText, "\n\n\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629:\n- \u0627\u0644\u0642\u0646\u0627\u0629: ").concat(channel, "\n- \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 / \u0627\u0644\u0645\u0639\u0631\u0651\u0641: ").concat(customerId, "\n\n\u0623\u0631\u062C\u0639 JSON \u0628\u0627\u0644\u0647\u064A\u0643\u0644 \u0627\u0644\u062A\u0627\u0644\u064A \u0641\u0642\u0637:\n{\n  \"lead_temperature\": \"\",\n  \"service_interest\": \"\",\n  \"tags\": [],\n  \"health_topic\": \"\",\n  \"urgency\": \"\",\n  \"sentiment\": \"\",\n  \"should_ai_reply\": true,\n  \"send_bridge_reply\": false,\n  \"handoff_reason\": null,\n  \"recommended_next_action\": \"\",\n  \"confidence\": 0.0\n}");
          _context.next = 4;
          return regeneratorRuntime.awrap(openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            response_format: {
              type: 'json_object'
            },
            messages: [{
              role: 'system',
              content: SYSTEM_PROMPT
            }, {
              role: 'user',
              content: userPrompt
            }]
          }));

        case 4:
          res = _context.sent;
          return _context.abrupt("return", res.choices[0].message.content);

        case 6:
        case "end":
          return _context.stop();
      }
    }
  });
}

function parseClassification(raw) {
  try {
    var cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    var result = JSON.parse(cleaned); // Only hand off when AI explicitly says so (emergency, unsafe, or very low confidence)
    // Don't override for normal low-confidence greetings / unclear messages

    if (result.should_ai_reply === false) {
      result.workflow_status = 'needs_human';
    } else if (result.send_bridge_reply === true) {
      // Booking/call/appointment — Malak replies with acknowledgment, then human takes over
      result.workflow_status = 'needs_human';
    } else {
      result.workflow_status = 'new';
    }

    return result;
  } catch (_unused) {
    return {
      lead_temperature: 'cold',
      service_interest: 'unclear',
      workflow_status: 'new',
      tags: [],
      health_topic: null,
      urgency: 'low',
      sentiment: 'neutral',
      should_ai_reply: true,
      send_bridge_reply: false,
      handoff_reason: null,
      recommended_next_action: 'Follow up later',
      confidence: 0
    };
  }
}

function classifyAndRoute(_ref) {
  var lead_id, message_id, message_text, channel, customer_id, _ref2, historyRows, history, raw, classification;

  return regeneratorRuntime.async(function classifyAndRoute$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          lead_id = _ref.lead_id, message_id = _ref.message_id, message_text = _ref.message_text, channel = _ref.channel, customer_id = _ref.customer_id;
          _context2.next = 3;
          return regeneratorRuntime.awrap(supabase.from('messages').select('direction, text, created_at').eq('lead_id', lead_id).not('text', 'is', null).order('created_at', {
            ascending: false
          }).limit(11));

        case 3:
          _ref2 = _context2.sent;
          historyRows = _ref2.data;
          // 11 so we can drop the current message at index 0
          // Remove the just-inserted inbound message (most recent) to avoid duplication, keep rest oldest-first
          history = (historyRows || []).slice(1).reverse();
          _context2.next = 8;
          return regeneratorRuntime.awrap(callOpenAI(message_text, channel, customer_id, history));

        case 8:
          raw = _context2.sent;
          classification = parseClassification(raw); // Update lead with classification results

          _context2.next = 12;
          return regeneratorRuntime.awrap(supabase.from('leads').update({
            lead_temperature: classification.lead_temperature,
            service_interest: classification.service_interest,
            workflow_status: classification.workflow_status,
            tags: classification.tags || [],
            health_topic: classification.health_topic,
            recommended_next_action: classification.recommended_next_action,
            handoff_required: classification.workflow_status === 'needs_human',
            updated_at: new Date().toISOString()
          }).eq('id', lead_id));

        case 12:
          return _context2.abrupt("return", classification);

        case 13:
        case "end":
          return _context2.stop();
      }
    }
  });
}

module.exports = {
  classifyAndRoute: classifyAndRoute
};