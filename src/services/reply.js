const supabase = require('../lib/supabase');
const openai = require('../lib/openai');

const SYSTEM_PROMPT = `اسمك ملاك، موظفة خدمة عملاء عند دكتور صهيب. بتحكي مع العملاء كأنك إنسان حقيقي بشكل كامل.

قواعد الأسلوب — مهم جداً:
- إذا حكاك العميل بالعربي: ردّي باللهجة الأردنية العامية بالكامل — مش فصحى، وبدون أي كلمة إنجليزية. استخدمي كلمات زي "أكيد"، "تمام"، "يعني"، "هلق"، "شو"، "بدّك"، "لازم"، "قديش"، "كيف بقدر أساعدك"، "رح"، "مش"، "إشي".
- إذا حكاك بالإنجليزي: ردّي بإنجليزي واضح ومهني بالكامل — بدون أي كلمة عربية.
- لغة الرد تتبع لغة العميل بالكامل — لا خلط بين اللغتين في نفس الرسالة أبداً.
- لا تحكي فصحى أبداً إذا كان بيحكي عربي.
- لا تستخدمي كلمات غلط زي "حنا" — الصح "إحنا" أو "الفريق".
- لا تذكري أبداً إنك نظام أو بوت أو AI — أنتِ ملاك، موظفة حقيقية.

حدود المحادثة — بتردّي بس على ما يتعلق بالعمل:
- لا تدخلي بأحاديث جانبية عن الحياة أو الطقس أو أي موضوع خارج نطاق العيادة.
- إذا فتح العميل موضوع ما علاقة له بالعمل، ردّي بلطف ووجّهيه للموضوع الأساسي.
- ردودك مختصرة ومباشرة — مش طويلة.

إذا طلب العميل موعد أو مكالمة أو حجز أو تسجيل (send_bridge_reply = true):
- ردّي بجملة تأكيد قصيرة واحدة — مثل "أكيد، قولي متى بيناسبك وبنرتب معك" أو "تمام، حدا من الفريق رح يتواصل معك قريباً لنحجز الموعد".
- اضبطي reply_type = "bridge" وshould_send = true.
- لا تطلبي معلومات إضافية كتيرة — جملة واحدة بتكفي.

قواعد صارمة — ما بتقدري أبداً:
- تشخّصي أي مرض أو حالة.
- توصفي أدوية أو علاجات.
- تفسّري تحاليل أو نتائج طبية.
- تدّعي إنك طبيبة.
- تقولي "أنت عندك..." أو "مشكلتك هي...".

ممكن:
- تشرحي خدمات العيادة (الاستشارة والبرنامج العلاجي عند دكتور صهيب).
- تسألي أسئلة مختصرة لتفهمي وضع العميل.
- تبعثي تعليمات الحجز أو الدفع إذا طلبوا.
- توصي بحجز استشارة مع دكتور صهيب.

إذا ما قدرتِ تردّي بأمان، اضبطي reply_type = handoff وshould_send = false.
أرجعي JSON فقط بدون أي نص إضافي.`;

async function callOpenAIReply({ message_text, lead_temperature, service_interest, health_topic, sentiment, send_bridge_reply, history }) {
  const bridgeNote = send_bridge_reply
    ? '\n- تنبيه: العميل طلب موعد/مكالمة/حجز — ردّي بجملة تأكيد قصيرة واحدة فقط واضبطي reply_type = "bridge".'
    : '';

  // Merge classification context into the system prompt so the model
  // only sees one system message and never echoes back an empty template.
  const systemContent = `${SYSTEM_PROMPT}\n\n--- سياق التصنيف ---\n- درجة حرارة العميل: ${lead_temperature}\n- الاهتمام بالخدمة: ${service_interest}\n- الموضوع الصحي: ${health_topic || 'غير محدد'}\n- الطابع: ${sentiment || 'neutral'}${bridgeNote}\n\nمهم جداً: ردّي بنفس لغة العميل بالكامل — إذا عربي فالرد عربي فقط بدون أي كلمة إنجليزية، وإذا إنجليزي فالرد إنجليزي فقط بدون أي كلمة عربية. لا خلط أبداً.\nأرجعي JSON بالهيكل التالي فقط (املئي reply_text بردّك الفعلي):\n{\n  "reply_text": "<ردّك هنا>",\n  "reply_type": "auto_reply",\n  "should_send": true,\n  "reason": "<سبب قصير>"\n}`;

  // Build messages array: system + history turns + current user message
  const messages = [{ role: 'system', content: systemContent }];

  for (const msg of (history || [])) {
    messages.push({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.text || ''
    });
  }

  messages.push({ role: 'user', content: message_text });

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages
  });
  return res.choices[0].message.content;
}

function parseReply(raw) {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const reply = JSON.parse(cleaned);
    // 'bridge' = send acknowledgment then hand off. 'handoff' = unsafe, send nothing.
    if (reply.reply_type === 'handoff') reply.should_send = false;
    if (reply.reply_type === 'bridge') reply.should_send = true;
    if (!reply.reply_text?.trim()) {
      reply.should_send = false;
      reply.reply_type = 'handoff';
      reply.reason = 'Empty reply text — fallback to handoff';
    }
    return reply;
  } catch {
    return {
      reply_text: null,
      reply_type: 'handoff',
      should_send: false,
      reason: 'AI reply could not be parsed — fallback to handoff'
    };
  }
}

async function generateReply({ lead_id, conversation_id, message_text, channel, classification }) {
  const appMode = String(process.env.APP_MODE || 'demo').toLowerCase();

  // Fetch last 11 messages, drop the most-recent (current inbound, already stored),
  // keep the prior 10 oldest-first so the current message isn't sent twice.
  const { data: historyRows } = await supabase
    .from('messages')
    .select('direction, text, created_at')
    .eq('lead_id', lead_id)
    .not('text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(11);
  // slice(1) removes the current message (index 0 = most recent), reverse = oldest first
  const history = (historyRows || []).slice(1).reverse();

  let reply;
  try {
    const raw = await callOpenAIReply({
      message_text,
      lead_temperature: classification.lead_temperature,
      service_interest: classification.service_interest,
      health_topic: classification.health_topic,
      sentiment: classification.sentiment,
      send_bridge_reply: classification.send_bridge_reply || false,
      history
    });
    reply = parseReply(raw);
  } catch (err) {
    console.error('Reply generation failed:', err);
    reply = { reply_text: null, reply_type: 'handoff', should_send: false, reason: err.message };
  }

  let sendStatus = 'pending';
  if (!reply.should_send || reply.reply_type === 'handoff') {
    sendStatus = 'not_sent_handoff';
  } else if (appMode === 'demo') {
    sendStatus = 'demo_returned';
  }

  // Store outbound message
  const { data: outboundMsg } = await supabase.from('messages').insert({
    lead_id,
    conversation_id,
    channel,
    direction: 'outbound',
    message_type: 'text',
    text: reply.reply_text,
    responder_type: 'ai',
    reply_type: reply.reply_type,
    send_status: sendStatus
  }).select('id').single();

  // Update lead last_reply_at
  await supabase.from('leads').update({
    last_reply_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', lead_id);

  return reply;
}

module.exports = { generateReply };
