# API Reference

Base URL: `http://localhost:3001` (development) or your Railway domain (production).

## Health & Debug

### GET /health

Production health check. Returns `200` when all services ready, `503` when degraded.

```json
{
  "status": "ok",
  "services": { "database": { "ok": true }, "gemini": { "ok": true }, ... },
  "gmail": { "oauthVerified": true, "watchActive": true },
  "lastProcessedEmail": { "id": "...", "subject": "..." },
  "lastNotification": { "sentAt": "..." },
  "pendingDeadlines": 3,
  "activeMonitoredAccounts": [...]
}
```

### Debug Endpoints

Status-only endpoints — never expose secrets.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/debug/gmail` | Gmail OAuth, watch, latest email |
| GET | `/debug/pubsub` | Pub/Sub config, recent notifications |
| GET | `/debug/telegram` | Bot status, chat ID availability |
| GET | `/debug/gemini` | Gemini API readiness |
| GET | `/debug/database` | DB connection, counts |
| GET | `/debug/last-email` | Most recently processed email |
| GET | `/debug/last-notification` | Most recent Telegram notification |
| GET | `/debug/watch` | Gmail watch status and expiry |
| GET | `/debug/startup` | All service statuses + env validation |
| POST | `/debug/send-test` | Process latest Gmail message through pipeline |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/gmail` | Gmail Pub/Sub push (also at `/api/gmail/webhook`) |
| POST | `/webhooks/telegram` | Telegram bot updates (production webhook mode) |

## REST API

### Emails

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emails` | List emails. Query: `type`, `category`, `limit` |
| GET | `/api/emails/:id` | Single email detail |

### Deadlines

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/deadlines` | List deadlines |
| PUT | `/api/deadlines/:id/complete` | Mark deadline completed |

### Actions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/actions` | List pending actions |
| PUT | `/api/actions/:id/complete` | Mark action completed |

### Summaries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/summaries/daily` | Daily summaries |
| GET | `/api/summaries/weekly` | Weekly reports |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics` | Overview stats and trends |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Notification history |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Current settings + sync state |
| PUT | `/api/settings` | Update settings |
| POST | `/api/settings/gmail/watch` | Enable Gmail push watch |
| POST | `/api/settings/gmail/renew-watch` | Manually renew watch |

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request |
| 404 | Not found |
| 500 | Server error |
| 503 | Service unavailable (degraded component) |
