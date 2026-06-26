import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ENV_SPECS = [
  { key: 'GOOGLE_CLIENT_ID', required: true, service: 'gmail', description: 'Google OAuth client ID' },
  { key: 'GOOGLE_CLIENT_SECRET', required: true, service: 'gmail', description: 'Google OAuth client secret' },
  { key: 'GOOGLE_REFRESH_TOKEN', required: true, service: 'gmail', description: 'Gmail OAuth refresh token' },
  { key: 'GMAIL_PUBSUB_TOPIC', required: true, service: 'pubsub', description: 'Pub/Sub topic (projects/PROJECT/topics/TOPIC)' },
  { key: 'GEMINI_API_KEY', required: true, service: 'gemini', description: 'Google Gemini API key' },
  { key: 'TELEGRAM_BOT_TOKEN', required: true, service: 'telegram', description: 'Telegram bot token from @BotFather' },
  { key: 'TELEGRAM_CHAT_ID', required: false, service: 'telegram', description: 'Telegram chat ID (optional if bot learns it from /start)' },
  { key: 'TELEGRAM_WEBHOOK_URL', required: false, service: 'telegram', description: 'Production webhook URL for Telegram updates' },
  { key: 'GEMINI_MODEL', required: false, service: 'gemini', description: 'Gemini model name' },
  { key: 'PORT', required: false, service: 'server', description: 'HTTP port (Railway sets this automatically)' },
  { key: 'NODE_ENV', required: false, service: 'server', description: 'development | production' },
  { key: 'DB_PATH', required: false, service: 'database', description: 'SQLite database file path' },
  { key: 'DEFAULT_USER_EMAIL', required: false, service: 'saas', description: 'Default user email for single-tenant mode' },
  { key: 'DAILY_SUMMARY_CRON', required: false, service: 'cron', description: 'Daily summary cron schedule' },
  { key: 'WEEKLY_SUMMARY_CRON', required: false, service: 'cron', description: 'Weekly summary cron schedule' },
  { key: 'DEADLINE_REMINDER_CRON', required: false, service: 'cron', description: 'Deadline reminder cron schedule' },
  { key: 'EXPIRED_CLEANUP_CRON', required: false, service: 'cron', description: 'Expired deadline cleanup cron schedule' },
  { key: 'GMAIL_WATCH_CRON', required: false, service: 'cron', description: 'Gmail watch renewal cron schedule' },
  { key: 'INSTANT_NOTIFY_THRESHOLD', required: false, service: 'settings', description: 'Min importance score for instant notify (0-1)' },
  { key: 'DAILY_SUMMARY_TIME', required: false, service: 'settings', description: 'Display default for daily summary time' },
  { key: 'WEEKLY_SUMMARY_DAY', required: false, service: 'settings', description: 'Display default for weekly summary day (0=Sunday)' },
  { key: 'WEEKLY_SUMMARY_TIME', required: false, service: 'settings', description: 'Display default for weekly summary time' },
  { key: 'DEADLINE_REMINDER_TIME', required: false, service: 'settings', description: 'Display default for deadline reminder time' },
];

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  gmail: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    pubsubTopic: process.env.GMAIL_PUBSUB_TOPIC,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  },

  defaultUser: {
    email: process.env.DEFAULT_USER_EMAIL || null,
  },

  db: {
    path: process.env.DB_PATH || null,
  },

  schedules: {
    dailySummary: process.env.DAILY_SUMMARY_CRON || '0 21 * * *',
    weeklySummary: process.env.WEEKLY_SUMMARY_CRON || '0 20 * * 0',
    deadlineReminders: process.env.DEADLINE_REMINDER_CRON || '0 8 * * *',
    expiredCleanup: process.env.EXPIRED_CLEANUP_CRON || '0 0 * * *',
    gmailWatchRenewal: process.env.GMAIL_WATCH_CRON || '0 */6 * * *',
  },

  settings: {
    dailySummaryTime: process.env.DAILY_SUMMARY_TIME || '21:00',
    weeklySummaryDay: process.env.WEEKLY_SUMMARY_DAY || '0',
    weeklySummaryTime: process.env.WEEKLY_SUMMARY_TIME || '20:00',
    deadlineReminderTime: process.env.DEADLINE_REMINDER_TIME || '08:00',
    instantNotifyThreshold: parseFloat(process.env.INSTANT_NOTIFY_THRESHOLD || '0.7'),
  },
};

export function validateRequiredEnv() {
  const required = ENV_SPECS.filter(s => s.required);
  const missing = required.filter(s => !process.env[s.key]).map(s => s.key);
  const warnings = ENV_SPECS.filter(s => !s.required && !process.env[s.key]);

  const byService = {};
  for (const spec of ENV_SPECS) {
    if (!byService[spec.service]) byService[spec.service] = { ok: true, missing: [], configured: [] };
    if (process.env[spec.key]) {
      byService[spec.service].configured.push(spec.key);
    } else if (spec.required) {
      byService[spec.service].ok = false;
      byService[spec.service].missing.push(spec.key);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings: warnings.map(s => s.key),
    byService,
    specs: ENV_SPECS.map(s => ({
      key: s.key,
      required: s.required,
      service: s.service,
      description: s.description,
      configured: Boolean(process.env[s.key]),
    })),
  };
}

export function getEnvSpec() {
  return ENV_SPECS;
}

export default config;
