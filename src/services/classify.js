const supabase = require('../lib/supabase');
const openai = require('../lib/openai');

const SYSTEM_PROMPT = `أنت نظام داخلي متخصص في تصنيف رسائل العملاء لعيادة استشارات صحية في الأردن.
مهمتك تحليل رسالة العميل وإرجاع تصنيف دقيق بصيغة JSON فقط.

═══ قواعد lead_temperature ═══
القيم المسموحة فقط: "cold" | "hot" | "not_interested"

• cold  → العميل يتصفح، يسأل عموماً، لم يُظهر نية شراء أو حجز. هذه هي القيمة الافتراضية لأي رسالة جديدة أو غير واضحة.
• hot   → العميل أبدى نية واضحة للتحرك: طلب موعد، مكالمة، زيارة، دفع، تسجيل، سعر خدمة، "كيف أحجز", "أبي أجي", "متى متاح", "كم السعر وأنا مهتم". أي رسالة تحمل intent شراء أو commitment فعلي.
• not_interested → العميل صرّح بعدم اهتمامه أو أنه لن يكمل.

═══ قواعد صارمة ═══
- لا تستخدم "unknown" أبداً — استخدم "cold" بدلاً منها.
- لا تشخّص أي مرض أبداً.
- لا توصي بأدوية أو علاجات محددة.
- لا تفسّر تحاليل أو صور طبية.
- اضبط should_ai_reply = false فقط إذا كانت الرسالة تحتوي على أعراض طارئة (ألم صدر، ضيق نفس، إغماء، نزيف شديد).
- للرسائل العادية مثل التحية والاستفسار، اضبط should_ai_reply = true دائماً.

═══ قاعدة الحجز والتواصل ═══
- إذا كانت الرسالة hot (موعد، مكالمة، دفع، حجز، زيارة، تسجيل، متابعة) →
  اضبط lead_temperature = "hot" و should_ai_reply = true و send_bridge_reply = true.
  send_bridge_reply = true: ملاك ترد بجملة تأكيد قصيرة ثم يتولى الموظف البشري.

- أرجع JSON فقط بدون أي نص إضافي.`;

async function callOpenAI(messageText, channel, customerId, history) {
  const historyText = history && history.length
    ? '\n\nسياق المحادثة (آخر ' + history.length + ' رسائل، من الأقدم للأحدث):\n' +
      history.map(m => `[${m.direction === 'inbound' ? 'عميل' : 'ملاك'}]: ${m.text}`).join('\n')
    : '';
  const userPrompt = `رسالة العميل:\n${messageText}${historyText}\n\nمعلومات إضافية:\n- القناة: ${channel}\n- رقم الهاتف / المعرّف: ${customerId}\n\nأرجع JSON بالهيكل التالي فقط:\n{\n  "lead_temperature": "",\n  "service_interest": "",\n  "tags": [],\n  "health_topic": "",\n  "urgency": "",\n  "sentiment": "",\n  "should_ai_reply": true,\n  "send_bridge_reply": false,\n  "handoff_reason": null,\n  "recommended_next_action": "",\n  "confidence": 0.0\n}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  });
  return res.choices[0].message.content;
}

function parseClassification(raw) {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // Only hand off when AI explicitly says so (emergency, unsafe, or very low confidence)
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
  } catch {
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

async function classifyAndRoute({ lead_id, message_id, message_text, channel, customer_id }) {
  // Fetch last 10 messages for context (the current message is already stored before this call)
  const { data: historyRows } = await supabase
    .from('messages')
    .select('direction, text, created_at')
    .eq('lead_id', lead_id)
    .not('text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(11); // 11 so we can drop the current message at index 0
  // Remove the just-inserted inbound message (most recent) to avoid duplication, keep rest oldest-first
  const history = (historyRows || []).slice(1).reverse();

  const raw = await callOpenAI(message_text, channel, customer_id, history);
  const classification = parseClassification(raw);

  // Update lead with classification results
  await supabase.from('leads').update({
    lead_temperature: classification.lead_temperature,
    service_interest: classification.service_interest,
    workflow_status: classification.workflow_status,
    tags: classification.tags || [],
    health_topic: classification.health_topic,
    recommended_next_action: classification.recommended_next_action,
    handoff_required: classification.workflow_status === 'needs_human',
    updated_at: new Date().toISOString()
  }).eq('id', lead_id);

  return classification;
}

module.exports = { classifyAndRoute };
