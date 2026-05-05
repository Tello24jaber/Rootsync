# Phase 9 — Weekly Insights Report

## Goal

Build a scheduled cron job that runs every Sunday at 9 AM. Aggregate the last 7 days of data from Supabase, send samples to Claude for qualitative analysis, generate a full Arabic weekly report, store it, and deliver it to management.

## Exit Criteria

- [ ] Cron fires correctly every Sunday at 9 AM Jordan time
- [ ] All numeric aggregations are accurate (from DB, not invented by AI)
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
const cron = require('node-cron');

async function getWeekStats(weekStart, weekEnd) {
  const [messages, leadStatuses, topics] = await Promise.all([
    supabase.rpc('weekly_message_stats', { week_start: weekStart, week_end: weekEnd }),
    supabase.from('leads')
      .select('lead_status')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd),
    supabase.from('message_topics')
      .select('topic')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
  ]);

  // Count lead statuses
  const statusCounts = {};
  for (const l of (leadStatuses.data || [])) {
    statusCounts[l.lead_status] = (statusCounts[l.lead_status] || 0) + 1;
  }

  // Top topics
  const topicCounts = {};
  for (const t of (topics.data || [])) {
    topicCounts[t.topic] = (topicCounts[t.topic] || 0) + 1;
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10);

  return { messages: messages.data, statusCounts, topTopics };
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

async function callClaudeInsights(stats, sampleMessages) {
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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude insights error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
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

  const reportText = await callClaudeInsights(stats, sampleMessages);

  // Store in weekly_insights table
  await supabase.from('weekly_insights').insert({
    week_start: weekStart,
    week_end: weekEnd,
    stats_json: stats,
    report_text: reportText,
    generated_at: now.toISOString()
  });

  // Send to management (WhatsApp)
  if (process.env.MANAGEMENT_WHATSAPP_NUMBER) {
    const summary = reportText.substring(0, 1000); // WhatsApp message limit
    await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: process.env.MANAGEMENT_WHATSAPP_NUMBER,
          type: 'text',
          text: { body: summary }
        })
      }
    );
  }

  console.log('Weekly insights generated and delivered.');
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
MANAGEMENT_WHATSAPP_NUMBER=962XXXXXXXXX
```

---

## Checklist

- [ ] `node-cron` installed
- [ ] `src/services/insights.js` created
- [ ] `startInsightsCron()` called in `src/index.js`
- [ ] Stats aggregation returns correct counts
- [ ] Claude returns meaningful Arabic report text
- [ ] Report stored in `weekly_insights` table
- [ ] Management notification sent (or logged)
- [ ] Manual test run completes without errors
