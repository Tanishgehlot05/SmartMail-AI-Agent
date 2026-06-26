# Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example backend/.env
```

The backend loads environment from `backend/.env`. On Railway, set variables in the dashboard (no file needed).

## Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | Gmail | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Gmail | OAuth 2.0 client secret |
| `GOOGLE_REFRESH_TOKEN` | Gmail | Long-lived refresh token with Gmail scopes |
| `GMAIL_PUBSUB_TOPIC` | Pub/Sub | Full topic name: `projects/PROJECT/topics/TOPIC` |
| `GEMINI_API_KEY` | Gemini | API key from Google AI Studio |
| `TELEGRAM_BOT_TOKEN` | Telegram | Bot token from [@BotFather](https://t.me/BotFather) |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_CHAT_ID` | — | Your Telegram chat ID. Optional if you send `/start` to the bot first |
| `TELEGRAM_WEBHOOK_URL` | — | Production webhook URL. Leave empty in dev (uses polling) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `PORT` | `3001` | HTTP port (Railway sets automatically) |
| `NODE_ENV` | `development` | `development` or `production` |
| `DB_PATH` | `./smartmail.db` | SQLite database path. Use persistent volume on Railway |
| `DEFAULT_USER_EMAIL` | — | Default user email for future multi-user support |
| `INSTANT_NOTIFY_THRESHOLD` | `0.7` | Minimum importance score for instant notify |
| `DAILY_SUMMARY_CRON` | `0 21 * * *` | Daily summary cron (9 PM) |
| `WEEKLY_SUMMARY_CRON` | `0 20 * * 0` | Weekly summary cron (Sunday 8 PM) |
| `DEADLINE_REMINDER_CRON` | `0 8 * * *` | Deadline reminder cron (8 AM) |
| `EXPIRED_CLEANUP_CRON` | `0 0 * * *` | Expired deadline cleanup (midnight) |
| `GMAIL_WATCH_CRON` | `0 */6 * * *` | Gmail watch renewal (every 6 hours) |
| `INSTANT_NOTIFY_THRESHOLD` | `0.7` | Minimum importance score for instant notify |
| `DAILY_SUMMARY_TIME` | `21:00` | Default daily summary time (UI/settings) |
| `WEEKLY_SUMMARY_DAY` | `0` | Default weekly summary day (0=Sunday) |
| `WEEKLY_SUMMARY_TIME` | `20:00` | Default weekly summary time (UI/settings) |
| `DEADLINE_REMINDER_TIME` | `08:00` | Default deadline reminder time (UI/settings) |

## Validation

On startup, the server validates all required variables. Missing variables are logged clearly — the server still starts, but affected services run in degraded mode.

Check runtime status:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/debug/startup
```

## Gmail OAuth Scopes

Your refresh token must include:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify` (for watch)

## Pub/Sub Topic Permissions

Grant publish permission on your topic to:

```
gmail-api-push@system.gserviceaccount.com
```
