# Architecture

## Overview

SmartMail AI Agent is a monorepo with a Node.js backend and React frontend. Gmail push notifications trigger real-time email analysis via Gemini AI, with results stored in SQLite and delivered through Telegram.

```
┌─────────────┐     Pub/Sub Push      ┌──────────────────┐
│  Gmail API  │ ───────────────────▶  │  Express Server  │
└─────────────┘                       │  (backend/)      │
       ▲                              └────────┬─────────┘
       │ OAuth + Watch                          │
       │                                        ▼
┌──────┴──────┐                    ┌──────────────────────┐
│ Google Cloud│                    │   Email Pipeline     │
│   Pub/Sub   │                    │  fetch → analyze →   │
└─────────────┘                    │  store → notify      │
                                   └──────────┬───────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
             ┌──────────┐            ┌──────────────┐           ┌────────────┐
             │  Gemini  │            │    SQLite    │           │  Telegram  │
             │    AI    │            │   Database   │           │    Bot     │
             └──────────┘            └──────────────┘           └────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │   React Dashboard    │
                                   │     (frontend/)      │
                                   └──────────────────────┘
```

## Backend Structure

```
backend/
├── config/           # Environment config and validation
├── core/
│   ├── pipeline/     # Email processing pipeline
│   └── providers/    # EmailProvider, NotificationProvider interfaces
├── db/
│   ├── schema.js     # SQLite schema + SaaS-ready tables
│   ├── index.js      # Database connection + migrations
│   └── repositories.js
├── jobs/             # Cron: daily/weekly summaries, deadline reminders
├── routes/
│   ├── api/          # REST API for dashboard
│   ├── webhooks/     # Gmail Pub/Sub webhook
│   └── debug.js      # Debug/status endpoints
├── services/
│   ├── ai/           # Gemini analysis
│   ├── gmail/        # Gmail API client
│   ├── notifications/# Telegram dispatcher
│   ├── telegram/     # Telegram bot (commands)
│   ├── startup.js    # Startup checks + health report
│   └── user-context.js # Multi-user context (future auth)
├── utils/
│   └── logger.js     # Prefixed logging
└── server.js         # Express entry point
```

## Email Pipeline

1. **Gmail Push** → Pub/Sub delivers base64 notification to `/webhooks/gmail`
2. **Deduplication** → Skip duplicate Pub/Sub message IDs and history IDs
3. **History Fetch** → Gmail API `history.list` from last stored history ID
4. **Fetch Message** → Full email content for each new message ID
5. **Gemini Analysis** → Classification, deadline extraction, notify decision
6. **Store** → Save to SQLite (emails, deadlines, actions, analytics)
7. **Notify** → Send Telegram instant notification if warranted
8. **Update State** → Save new history ID, mark notification processed

## Recovery Paths

| Failure | Recovery |
|---------|----------|
| Expired history ID (404) | Re-establish watch, process latest email |
| Invalid/expired watch | Auto-renew on startup and every 6 hours |
| Gmail 429/500 | Retry with backoff; next push retries |
| Duplicate push | Ignored via message ID and history ID tracking |
| Gmail 429/500/timeout | Retry with backoff; history ID **not** marked processed until success |
| Network timeout | Gmail client retries up to 3 times with 30s timeout per request |

## Multi-User SaaS Preparation

The database schema supports future multi-tenancy without changing current behavior:

- `users` — one row per SaaS user (auth added later)
- `email_accounts` — multiple Gmail accounts per user
- `user_settings` — per-user notification preferences
- `user_id` column on emails, deadlines, notifications (nullable today)

Current single-tenant mode uses environment variables for Gmail credentials and `gmail_sync_state` for watch/history. The `user-context` service bridges to the multi-user schema.

## Cron Jobs

| Job | Default Schedule | Purpose |
|-----|-----------------|---------|
| Daily summary | 9 PM daily | Grouped Telegram summary |
| Weekly report | Sunday 8 PM | Weekly overview + action items |
| Deadline reminders | 8 AM daily | Upcoming deadline alerts |
| Expired cleanup | Midnight | Remove past deadlines |
| Watch renewal | Every 6 hours | Keep Gmail push active |

## Provider Pattern

- `EmailProvider` — abstract email fetching (Gmail implemented)
- `NotificationProvider` — abstract notifications (Telegram implemented)

Enables future Outlook/Yahoo email and Slack/Discord notifications without rewriting the pipeline.

## Logging

All important events use prefixed logs:

```
[GMAIL] Watch renewed
[PUBSUB] Notification received
[PIPELINE] Email processed
[GEMINI] Analysis complete
[TELEGRAM] Message sent
[NOTIFY] Instant notification sent
```

## Security

- No secrets exposed in debug endpoints
- `.env` and `*.db` files gitignored
- Helmet middleware on Express
- Debug routes show status only, never tokens
