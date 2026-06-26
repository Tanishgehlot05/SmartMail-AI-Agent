# SmartMail AI Agent

An intelligent email assistant that uses **Gmail Push Notifications**, **Google Gemini AI**, and **Telegram** to deliver real-time alerts and daily/weekly summaries.

## Features

- **Instant notifications** — internships, deadlines, personal emails, forms, fee reminders
- **Personal email previews** — human emails include sender, summary, and ~300 char body preview
- **Spam rescue** — important emails in spam folder still get notified
- **Thread awareness** — skips trivial replies ("Thanks", "OK") in ongoing conversations
- **Daily & weekly summaries** — grouped intelligently, not raw email lists
- **Deadline tracking** — auto-extracted with morning reminders
- **Analytics dashboard** — React UI for emails, deadlines, actions, and stats
- **Production-ready** — health checks, debug endpoints, graceful degradation, structured logging

## Quick Start

```bash
npm run install:all
cp .env.example backend/.env
# Fill in credentials — see ENVIRONMENT.md

npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:5173
```

## Documentation

| Document | Description |
|----------|-------------|
| [ENVIRONMENT.md](./ENVIRONMENT.md) | All environment variables |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway deployment guide |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and data flow |
| [API.md](./API.md) | REST API and debug endpoints |

## Architecture

```
Gmail Push → Webhook → Pipeline → Gemini AI → SQLite + Telegram
                ↓
         Cron Jobs (summaries, deadlines)
                ↓
         React Dashboard
```

## Health Check

```bash
curl http://localhost:3001/health
```

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, node-cron
- **AI:** Google Gemini
- **Email:** Gmail API + Pub/Sub push
- **Notifications:** Telegram Bot API
- **Frontend:** React, Vite, Tailwind CSS

## License

MIT
