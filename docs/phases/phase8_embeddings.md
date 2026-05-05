# Phase 8 — Message Embeddings & Vector Search

## Goal

Build the embedding pipeline. Generate vector embeddings for meaningful inbound customer messages and store them in pgvector (Supabase). This enables future semantic search and analytics.

## Exit Criteria

- [ ] Embedding pipeline runs without error
- [ ] Short/empty/duplicate messages are correctly skipped
- [ ] Valid embeddings (1536 dimensions) stored in `message_embeddings`
- [ ] `messages.embedded` set to `true` after successful embedding
- [ ] At least 20 real messages embedded and queryable
- [ ] Basic similarity search query returns relevant results

---

## Files to Create

```
src/
  services/embed.js   <- Embedding pipeline (batch + single)
```

---

## `src/services/embed.js`

```js
const supabase = require('../lib/supabase');
const openai = require('../lib/openai');

function shouldEmbed(text) {
  if (!text || text.trim().length < 10) return false;
  if (/^(ok|okay|تمام|شكراً|شكرا|thank)$/i.test(text.trim())) return false;
  return true;
}

async function embedMessage(message) {
  if (!shouldEmbed(message.text)) return;

  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: message.text
  });
  const embedding = embeddingRes.data[0].embedding;

  // Fetch lead metadata
  const { data: lead } = await supabase
    .from('leads')
    .select('lead_status, health_topic, service_interest')
    .eq('id', message.lead_id)
    .single();

  // Insert embedding
  await supabase.from('message_embeddings').insert({
    message_id: message.id,
    lead_id: message.lead_id,
    conversation_id: message.conversation_id,
    channel: message.channel,
    embedding,
    metadata: {
      lead_status: lead?.lead_status,
      health_topic: lead?.health_topic,
      service_interest: lead?.service_interest,
      message_preview: message.text.substring(0, 100)
    }
  });

  // Mark message as embedded
  await supabase.from('messages').update({ embedded: true }).eq('id', message.id);
}

// Batch mode: run via cron or manually
async function embedPendingMessages() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, lead_id, conversation_id, channel, text')
    .eq('embedded', false)
    .eq('direction', 'inbound')
    .eq('message_type', 'text')
    .not('text', 'is', null)
    .limit(50);

  if (error) return console.error('embedPendingMessages fetch error:', error);

  console.log(`Embedding ${messages.length} messages...`);
  for (const msg of messages) {
    await embedMessage(msg).catch(err =>
      console.error(`Failed to embed message ${msg.id}:`, err)
    );
  }
  console.log('Embedding batch complete.');
}

module.exports = { embedMessage, embedPendingMessages };
```

---

## Running the Batch

You can run the batch manually:

```bash
node -e "require('dotenv').config(); require('./src/services/embed').embedPendingMessages()"
```

Or add a scheduled cron using `node-cron`:

```bash
npm install node-cron
```

```js
// In src/index.js
const cron = require('node-cron');
const { embedPendingMessages } = require('./services/embed');

cron.schedule('*/15 * * * *', () => {
  embedPendingMessages().catch(console.error);
});
```

---

## Similarity Search (Example)

```sql
SELECT m.text, me.metadata,
       1 - (me.embedding <=> '[<your_query_vector>]') AS similarity
FROM message_embeddings me
JOIN messages m ON m.id = me.message_id
ORDER BY me.embedding <=> '[<your_query_vector>]'
LIMIT 10;
```

Run via `supabase.rpc()` or the Supabase SQL editor.

---

## Checklist

- [ ] `src/services/embed.js` created
- [ ] `shouldEmbed` filter working (skips short/trivial messages)
- [ ] OpenAI embedding call returns 1536-dimension vector
- [ ] Embedding stored in `message_embeddings`
- [ ] `messages.embedded` set to `true`
- [ ] Batch mode tested with 20+ messages
- [ ] Similarity search query returns sensible results
