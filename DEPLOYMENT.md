# Deployment Guide

## Railway Deployment

### 1. Push to GitHub

Ensure the repository is clean and `.env` is not committed (it is in `.gitignore`).

### 2. Create Railway Project

1. Connect your GitHub repository
2. Railway auto-detects Node.js

### 3. Configure Build & Start

Railway settings:

- **Build command:** `npm run install:all && npm run build`
- **Start command:** `npm start`
- **Root directory:** `/` (project root)

### 4. Set Environment Variables

Add all required variables from [ENVIRONMENT.md](./ENVIRONMENT.md) in the Railway dashboard.

Important for production:

```
NODE_ENV=production
TELEGRAM_WEBHOOK_URL=https://YOUR-APP.up.railway.app/webhooks/telegram
DB_PATH=/data/smartmail.db
```

### 5. Persistent Storage (SQLite)

Attach a Railway volume mounted at `/data` and set:

```
DB_PATH=/data/smartmail.db
```

Without a volume, the database resets on every deploy.

### 6. Gmail Pub/Sub Push Subscription (Manual)

After deployment, create a Pub/Sub push subscription in Google Cloud Console:

- **Topic:** your `GMAIL_PUBSUB_TOPIC`
- **Delivery type:** Push
- **Endpoint URL:** `https://YOUR-APP.up.railway.app/webhooks/gmail`
- **Acknowledgement deadline:** 10 seconds

The server responds `200 OK` immediately and processes asynchronously.

### 7. Verify Deployment

```bash
curl https://YOUR-APP.up.railway.app/health
curl https://YOUR-APP.up.railway.app/debug/gmail
curl https://YOUR-APP.up.railway.app/debug/telegram
```

Send `/start` to your Telegram bot, then test with a new email.

## Local Development

```bash
npm run install:all
cp .env.example backend/.env
# Edit backend/.env with your credentials

# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev:frontend
```

Frontend dev server: `http://localhost:5173` (proxies API to backend)

## Startup Behavior

On every boot the server automatically:

1. Validates environment variables
2. Connects to SQLite
3. Verifies Gemini API
4. Refreshes Gmail OAuth token
5. Renews Gmail watch if expiring within 24 hours
6. Verifies Pub/Sub topic is configured
7. Initializes Telegram bot (webhook in production, polling in dev)
8. Starts cron jobs

If one component fails, the server still starts — only that service is unavailable.

## Health Monitoring

Use `/health` for uptime checks. Returns `200` when all services are ready, `503` when degraded.

## Troubleshooting

| Issue | Check |
|-------|-------|
| No Telegram notifications | `/debug/telegram` — verify bot token and chat ID |
| No Gmail push | `/debug/watch` — verify watch is active; check Pub/Sub subscription |
| History ID expired | Server auto-recovers on next push; check `/debug/gmail` |
| Gemini errors | `/debug/gemini` — verify API key and model name |
