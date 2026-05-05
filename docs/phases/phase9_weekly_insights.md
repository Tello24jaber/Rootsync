# Phase 9 — Weekly Insights Report

## Goal

Build a scheduled cron job that runs every Sunday at 9 AM Jordan time. Aggregate the last 7 days of data from Supabase using direct queries (no RPC), pass samples to OpenAI for qualitative analysis, generate a full Arabic weekly report, store it, and deliver it to management.

## Exit Criteria

- [ ] Cron fires correctly every Sunday at 9 AM Jordan time
- [ ] All numeric aggregations are accurate (direct DB queries, not invented by AI)
- [ ] AI generates meaningful Arabic text for qualitative sections only
- [ ] Report is stored in `weekly_insights` table
- [ ] Report is delivered to management (WhatsApp or email)
- [ ] Report contains all required sections

---

## Files to Create

```
src/
  services/insights.js   <- Weekly insights cron job
```

---

## Setup

```bash
npm install node-cron
```

---

## `src/services/insights.js`

```js
const supabase = require('../lib/supabase');
const openai = require('../lib/openai');
const cron = require('node-cron');
const { sendWhatsAppMessage } = require('./whatsapp');

async function getWeekStats(weekStart, weekEnd) {
  // Direct queries — no supabase.rpc needed
  const [messagesRes, leadsRes, topicsRes] = await Promise.all([
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd),
    supabase
      .from('leads')
      .select('lead_temperature, workflow_status')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd),
    supabase
      .from('message_topics')
      .select('topic')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
  ]);

  const totalMessages = messagesRes.count || 0;
  const leads = leadsRes.data || [];

  // Count by lead_temperature
  const hot_leads = leads.filter(l => l.lead_temperature === 'hot').length;
  const cold_leads = leads.filter(l => l.lead_temperature === 'cold').length;
  const not_interested = leads.filter(l => l.lead_temperature === 'not_interested').length;
  const needs_human = leads.filter(l => l.workflow_status === 'needs_human').length;
  const new_leads = leads.length;

  // Top topics
  const topicCounts = {};
  for (const t of (topicsRes.data || [])) {
    topicCounts[t.topic] = (topicCounts[t.topic] || 0) + 1;
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10);

  return { totalMessages, new_leads, hot_leads, cold_leads, not_interested, needs_human, topTopics };
}

async function getSampleMessages(weekStart, weekEnd) {
  const { data } = await supabase
    .from('messages')
    .select('text')
    .eq('direction', 'inbound')
    .eq('message_type', 'text')
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)
    .not('text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data || []).map(m => m.text);
}

async function callOpenAIInsights(stats, sampleMessages) {
  const prompt = `أنت محلل بيانات. فيما يلي إحصائيات أسبوعية لمنصة رعاية صحية:

الإحصائيات:
${JSON.stringify(stats, null, 2)}

عينة من رسائل العملاء (${sampleMessages.length} رسالة):
${sampleMessages.slice(0, 20).join('\n---\n')}

اكتب تقرير أسبوعي باللغة العربية يتضمن:
1. ملخص الأداء الأسبوعي
2. أبرز الاهتمامات الصحية
3. تحليل جودة العملاء المحتملين
4. توصيات للأسبوع القادم

الأرقام مقدمة لك — لا تخترع أرقاماً. ركز على التحليل النوعي فقط.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });
  return res.choices[0].message.content;
}

async function generateWeeklyInsights() {
  const now = new Date();
  const weekEnd = now.toISOString();
  const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Generating weekly insights for ${weekStart} to ${weekEnd}`);

  const [stats, sampleMessages] = await Promise.all([
    getWeekStats(weekStart, weekEnd),
    getSampleMessages(weekStart, weekEnd)
  ]);

  const reportText = await callOpenAIInsights(stats, sampleMessages);

  // Store in weekly_insights table
  await supabase.from('weekly_insights').insert({
    week_start: weekStart,
    week_end: weekEnd,
    total_messages: stats.totalMessages,
    new_leads: stats.new_leads,
    hot_leads: stats.hot_leads,
    cold_leads: stats.cold_leads,
    not_interested: stats.not_interested,
    needs_human: stats.needs_human,
    stats_json: stats,
    report_text: reportText,
    generated_at: now.toISOString()
  });

  // Deliver to management via WhatsApp (optional)
  if (process.env.MANAGEMENT_WHATSAPP_NUMBER) {
    const summary = reportText.substring(0, 1000); // WhatsApp message limit
    await sendWhatsAppMessage(process.env.MANAGEMENT_WHATSAPP_NUMBER, summary)
      .catch(err => console.error('Management WhatsApp delivery failed:', err));
  } else {
    console.log('No MANAGEMENT_WHATSAPP_NUMBER set. Report stored in DB only.');
  }

  console.log('Weekly insights generated and stored.');
}

// Schedule: Every Sunday at 09:00 AM Jordan time (UTC+3 = 06:00 UTC)
function startInsightsCron() {
  cron.schedule('0 6 * * 0', () => {
    generateWeeklyInsights().catch(err => console.error('Weekly insights error:', err));
  }, { timezone: 'UTC' });
  console.log('Weekly insights cron scheduled (Sundays 09:00 Jordan time)');
}

module.exports = { generateWeeklyInsights, startInsightsCron };
```

---

## Register the Cron in `src/index.js`

```js
const { startInsightsCron } = require('./services/insights');
startInsightsCron();
```

---

## Manual Test Run

```bash
node -e "require('dotenv').config(); require('./src/services/insights').generateWeeklyInsights()"
```

---

## Required `.env` additions

```
# Optional: WhatsApp number for management weekly report
MANAGEMENT_WHATSAPP_NUMBER=962XXXXXXXXX
```

---

## Checklist

- [ ] `node-cron` installed
- [ ] `src/services/insights.js` created
- [ ] `startInsightsCron()` called in `src/index.js`
- [ ] Stats use direct Supabase queries (no RPC)
- [ ] All numeric columns populated in `weekly_insights` insert
- [ ] OpenAI returns meaningful Arabic report text
- [ ] Report stored in `weekly_insights` table with all fields
- [ ] Management WhatsApp delivery uses shared `sendWhatsAppMessage`
- [ ] Manual test run completes without errors

