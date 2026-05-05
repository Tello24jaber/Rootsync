# Phase 0 — Project Setup & Prerequisites

## Goal

Get the full development environment ready before writing a single line of code. Everything in this phase is one-time setup.

## Exit Criteria

- [ ] Supabase project exists and is accessible
- [ ] Node.js project initialized with dependencies installed
- [ ] All third-party accounts are created (see Phase 2 for detail)
- [ ] `.env` is filled in locally
- [ ] Git repo is initialized and `.gitignore` is confirmed
- [ ] VS Code MCP connection (Supabase) is confirmed working

---

## Step-by-Step

### 0.1 — Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Create a new project named `rootsync-system1`.
3. Choose a region closest to Jordan (e.g. `eu-central-1` Frankfurt).
4. Set a strong database password and save it.
5. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
6. From **Project Settings → Database**, copy the direct connection string for migrations.

### 0.2 — Enable pgvector

Run this in the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

Confirm both extensions appear under **Database → Extensions**.

### 0.3 — Node.js Project Setup

In the repo root:

```bash
npm init -y
npm install express @supabase/supabase-js openai dotenv
npm install --save-dev nodemon
```

Create `src/index.js`:

```js
require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Routes added per phase
const webhookRouter = require('./routes/webhook');
app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RootSync server running on port ${PORT}`));
```

Add to `package.json` scripts:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

### 0.4 — Supabase Client Singleton

Create `src/lib/supabase.js`:

```js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
```

### 0.5 — OpenAI Client Singleton

Create `src/lib/openai.js`:

```js
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = openai;
```

### 0.6 — Environment File

Create `.env` (never commit this):

```
SUPABASE_URL=https://bynwpzxxkutvxdkcydfx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
OPENAI_API_KEY=<from OpenAI dashboard>
WHATSAPP_TOKEN=<from Meta dashboard>
WHATSAPP_PHONE_NUMBER_ID=<from Meta dashboard>
WEBHOOK_VERIFY_TOKEN=<choose any random string>
PORT=3000
```

Leave WhatsApp/OpenAI keys blank until Phase 2.

### 0.7 — Git Repository

1. Confirm the repo is at: `https://github.com/Tello24jaber/Rootsync`
2. Confirm `.gitignore` includes `.env` and `node_modules/`
3. Push initial structure:

```bash
git add .
git commit -m "chore: switch to Node.js/Express — remove n8n"
git push origin main
```

---

## Checklist

- [ ] Supabase project created
- [ ] pgvector + uuid-ossp extensions enabled
- [ ] Node.js project initialized (`npm install` done)
- [ ] `src/lib/supabase.js` and `src/lib/openai.js` created
- [ ] `.env` file filled in locally
- [ ] `.env` and `node_modules/` are in `.gitignore`
- [ ] `npm run dev` starts the server without errors
- [ ] Initial git commit pushed
