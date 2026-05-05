"use strict";

var supabase = require('../lib/supabase');

function sendHandoff(_ref) {
  var lead_id, message_id, conversation_id, handoff_reason, _ref$urgency, urgency, recommended_next_action, channel;

  return regeneratorRuntime.async(function sendHandoff$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          lead_id = _ref.lead_id, message_id = _ref.message_id, conversation_id = _ref.conversation_id, handoff_reason = _ref.handoff_reason, _ref$urgency = _ref.urgency, urgency = _ref$urgency === void 0 ? 'medium' : _ref$urgency, recommended_next_action = _ref.recommended_next_action, channel = _ref.channel;
          _context.next = 3;
          return regeneratorRuntime.awrap(supabase.from('human_handoffs').insert({
            lead_id: lead_id,
            message_id: message_id,
            handoff_reason: handoff_reason,
            urgency: urgency,
            recommended_next_action: recommended_next_action,
            notified_at: new Date().toISOString()
          }));

        case 3:
          // 2. No message sent to customer — agent will reply directly as a human
          console.log("[Handoff] Lead ".concat(lead_id, " | Urgency: ").concat(urgency, " | Reason: ").concat(handoff_reason));
          return _context.abrupt("return", null);

        case 5:
        case "end":
          return _context.stop();
      }
    }
  });
}

module.exports = {
  sendHandoff: sendHandoff
};