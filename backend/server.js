import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import { getTelegramBot } from './services/telegram/bot.js';
import { runDailySummary } from './jobs/daily-summary.js';
import { runWeeklySummary } from './jobs/weekly-summary.js';
import { runDeadlineReminders, cleanupExpiredDeadlines } from './jobs/deadline-reminders.js';
import { ensureGmailWatch } from './core/pipeline/email-pipeline.js';
import { buildHealthReport, initializeStartupServices } from './services/startup.js';
import { createLogger } from './utils/logger.js';

import emailsRouter from './routes/api/emails.js';
import deadlinesRouter from './routes/api/deadlines.js';
import actionsRouter from './routes/api/actions.js';
import summariesRouter from './routes/api/summaries.js';
import analyticsRouter from './routes/api/analytics.js';
import notificationsRouter from './routes/api/notifications.js';
import settingsRouter from './routes/api/settings.js';
import gmailPushRouter from './routes/webhooks/gmail-push.js';
import debugRouter from './routes/debug.js';

const log = createLogger('startup');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const report = await buildHealthReport();
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  } catch (err) {
    log.error(`Health check failed: ${err.message}`);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/debug', debugRouter);

app.use('/api/emails', emailsRouter);
app.use('/api/deadlines', deadlinesRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/webhooks/gmail', gmailPushRouter);
app.use('/api/gmail/webhook', gmailPushRouter);

app.post('/webhooks/telegram', (req, res) => {
  const bot = getTelegramBot();
  if (!bot) {
    return res.status(503).json({ ok: false, error: 'Telegram bot is not initialized.' });
  }
  bot.processUpdate(req.body);
  return res.sendStatus(200);
});

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/debug') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'), err => {
    if (err) next();
  });
});

function startCronJobs() {
  const { schedules } = config;
  const cronLog = createLogger('cron');

  cron.schedule(schedules.dailySummary, () => {
    runDailySummary().catch(err => cronLog.error(`Daily summary error: ${err.message}`));
  });
  cronLog.info(`Daily summary scheduled: ${schedules.dailySummary}`);

  cron.schedule(schedules.weeklySummary, () => {
    runWeeklySummary().catch(err => cronLog.error(`Weekly summary error: ${err.message}`));
  });
  cronLog.info(`Weekly summary scheduled: ${schedules.weeklySummary}`);

  cron.schedule(schedules.deadlineReminders, () => {
    runDeadlineReminders().catch(err => cronLog.error(`Deadline reminder error: ${err.message}`));
  });
  cronLog.info(`Deadline reminders scheduled: ${schedules.deadlineReminders}`);

  cron.schedule(schedules.expiredCleanup, () => {
    cleanupExpiredDeadlines().catch(err => cronLog.error(`Cleanup error: ${err.message}`));
  });
  cronLog.info(`Expired cleanup scheduled: ${schedules.expiredCleanup}`);

  if (config.gmail.pubsubTopic) {
    cron.schedule(schedules.gmailWatchRenewal, () => {
      ensureGmailWatch().catch(err => cronLog.error(`Gmail watch renewal error: ${err.message}`));
    });
    cronLog.info(`Gmail watch renewal scheduled: ${schedules.gmailWatchRenewal}`);
  }
}

app.listen(config.port, () => {
  log.info(`SmartMail AI Agent running on http://localhost:${config.port}`);
  log.info(`Environment: ${config.nodeEnv}`);

  initializeStartupServices()
    .then(() => startCronJobs())
    .catch(err => log.error(`Initialization failed: ${err?.stack || err}`));
});

export default app;
