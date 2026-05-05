# Credentials Reference

## Required Environment Variables

All credentials are stored in `.env` (never committed to git).

| Variable | Description | Used In |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp access token | routes/webhook, services/handoff, services/reply |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID | services/handoff, services/reply |
| `WEBHOOK_VERIFY_TOKEN` | Your chosen verify token for Meta webhook | routes/webhook |
| `SUPABASE_URL` | Supabase project URL | lib/supabase (all services) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | lib/supabase (all services) |
| `OPENAI_API_KEY` | OpenAI API key — classification, reply, insights, embeddings | services/classify, services/reply, services/insights, services/embed |
| `OPENAI_API_KEY` | OpenAI API key | lib/openai, services/embed |
| `GOOGLE_SHEETS_ID` | Google Sheet ID from URL | services/sync |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email | services/sync |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account private key | services/sync |
| `TEAM_WHATSAPP_NUMBER` | CS team number for handoff alerts | services/handoff |
| `MANAGEMENT_WHATSAPP_NUMBER` | Management number for weekly reports | services/insights |

## WhatsApp Setup Notes

- Go to Meta for Developers → Create App → WhatsApp product
- Get: Phone Number ID, Business Account ID, Access Token
- Set webhook Callback URL to: `https://<your-deployed-url>/webhook/whatsapp`
- Set verify token to match `WEBHOOK_VERIFY_TOKEN` in .env

## Supabase Setup Notes

- Project URL and service role key from Supabase dashboard
- Enable pgvector extension in Supabase SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
