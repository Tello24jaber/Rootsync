/**
 * WhatsApp send helper — DEMO MODE
 * In demo/test mode, messages are not sent to WhatsApp.
 * The reply is returned via HTTP response to the test UI instead.
 * Replace this with real API calls when going live.
 */
async function sendWhatsAppMessage(to, text) {
  console.log(`[WhatsApp DEMO] To: ${to} | Message: ${text.slice(0, 80)}...`);
  // No-op in demo mode — return a mock response
  return { messages: [{ id: 'demo_' + Date.now() }] };
}

module.exports = { sendWhatsAppMessage };
