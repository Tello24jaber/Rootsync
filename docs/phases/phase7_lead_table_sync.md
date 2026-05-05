# Phase 7 — Lead Table Sync (MVP Dashboard)

## Goal

Keep the customer service team's Google Sheet in sync with the `leads` table in Supabase. Every time a lead is created or updated, the sheet is updated automatically by calling the sync service.

## Exit Criteria

- [ ] Google Sheet has correct column headers
- [ ] New lead creates a new row in the sheet
- [ ] Updated lead updates the existing row
- [ ] All relevant columns populated correctly
- [ ] Sheet updates within a few seconds of a lead change

---

## Files to Create

```
src/
  services/sync.js   <- Google Sheets sync logic
```

---

## Setup

```bash
npm install googleapis
```

Create a Google Service Account (see Phase 2), share your Google Sheet with the service account email.

---

## `src/services/sync.js`

```js
const { google } = require('googleapis');
const supabase = require('../lib/supabase');

function getSheets() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

function leadToRow(lead) {
  return [
    lead.id,
    lead.name || '',
    lead.phone || '',
    lead.primary_channel || '',
    lead.lead_status || '',
    (lead.tags || []).join(', '),
    lead.health_topic || '',
    lead.service_interest || '',
    lead.last_message || '',
    lead.last_message_at || '',
    lead.recommended_next_action || '',
    lead.priority || '',
    lead.handoff_required ? 'Yes' : 'No',
    lead.assigned_to || '',
    lead.notes || '',
    lead.updated_at || ''
  ];
}

async function syncLead(leadId) {
  const { data: lead, error } = await supabase
    .from('leads').select('*').eq('id', leadId).single();
  if (error || !lead) return console.error('syncLead: lead not found', leadId);

  const sheets = getSheets();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  // Read column A to find existing row
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A:A'
  });
  const rows = readRes.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === leadId);

  const rowData = leadToRow(lead);

  if (rowIndex > 0) {
    // Update existing row (1-indexed, skip header row at index 0)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!A${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] }
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] }
    });
  }
}

module.exports = { syncLead };
```

---

## Calling the Sync Service

Call `syncLead(leadId)` at the end of:
- `src/db/leads.js` — after `findOrCreateLead` creates a new lead
- `src/services/classify.js` — after updating lead classification

```js
const { syncLead } = require('./sync');
// after lead update:
syncLead(lead_id).catch(err => console.error('Sheets sync failed:', err));
```

---

## Google Sheet Column Mapping

| Column | Field |
|---|---|
| A | lead_id |
| B | name |
| C | phone |
| D | channel |
| E | lead_status |
| F | tags (comma-separated) |
| G | health_topic |
| H | service_interest |
| I | last_message |
| J | last_message_at |
| K | recommended_next_action |
| L | priority |
| M | handoff_required |
| N | assigned_to |
| O | notes |
| P | updated_at |

---

## Checklist

- [ ] `googleapis` installed
- [ ] Google Sheet created with header row matching column mapping
- [ ] Service account has Editor access to the sheet
- [ ] Credentials in `.env`
- [ ] `src/services/sync.js` created
- [ ] `syncLead` called after lead create and after classification
- [ ] New lead appears in sheet
- [ ] Updated lead updates existing row
