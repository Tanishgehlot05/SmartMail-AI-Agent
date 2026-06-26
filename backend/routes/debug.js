import { Router } from 'express';
import config from '../config/index.js';
import db from '../db/index.js';
import {
  emailRepo, notificationRepo, syncRepo, deadlineRepo,
  pubsubRepo, historyRepo,
} from '../db/repositories.js';
import { gmailProvider } from '../services/gmail/client.js';
import { telegramProvider } from '../services/notifications/telegram.js';
import { verifyGemini } from '../services/ai/gemini.js';
import { getTelegramBot, getTelegramChatId } from '../services/telegram/bot.js';
import { getServiceStatus } from '../services/startup.js';
import { getActiveMonitoredAccounts } from '../services/user-context.js';
import { runLatestEmailThroughPipeline } from '../core/pipeline/email-pipeline.js';
import { validateRequiredEnv } from '../config/index.js';

const router = Router();

function safeStatus(data) {
  return JSON.parse(JSON.stringify(data));
}

router.get('/gmail', async (_req, res) => {
  try {
    const syncState = syncRepo.getState();
    let oauth = null;
    let oauthError = null;

    try {
      oauth = await gmailProvider.verifyOAuth();
    } catch (err) {
      oauthError = err.message;
    }

    res.json(safeStatus({
      oauth: oauth ? {
        emailAddress: oauth.emailAddress,
        historyId: oauth.historyId,
        messagesTotal: oauth.messagesTotal,
        token: oauth.token,
      } : null,
      oauthError,
      token: gmailProvider.getTokenStatus(),
      watch: {
        historyId: syncState?.history_id || null,
        expiration: syncState?.watch_expiry || null,
        active: syncState?.watch_expiry ? new Date(syncState.watch_expiry).getTime() > Date.now() : false,
        lastNotificationAt: syncState?.last_notification_at || null,
      },
      pubsubTopic: config.gmail.pubsubTopic || null,
      latestProcessedEmail: emailRepo.findLatest() || null,
      latestNotification: notificationRepo.findLatest() || null,
      pendingDeadlines: deadlineRepo.findUpcoming(30),
      monitoredAccounts: getActiveMonitoredAccounts(),
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pubsub', (_req, res) => {
  const syncState = syncRepo.getState();
  res.json({
    configured: Boolean(config.gmail.pubsubTopic),
    topic: config.gmail.pubsubTopic || null,
    webhookPaths: ['/webhooks/gmail', '/api/gmail/webhook'],
    lastNotificationAt: syncState?.last_notification_at || null,
    recentNotifications: pubsubRepo.findRecent(20),
    recentHistoryIds: historyRepo.findRecent(20),
  });
});

router.get('/telegram', async (_req, res) => {
  try {
    let connection = null;
    let connectionError = null;

    if (config.telegram.botToken) {
      try {
        connection = await telegramProvider.verifyConnection();
      } catch (err) {
        connectionError = err.message;
      }
    }

    res.json({
      configured: Boolean(config.telegram.botToken),
      botInitialized: Boolean(getTelegramBot()),
      chatIdFromEnv: Boolean(config.telegram.chatId),
      chatIdAvailable: Boolean(getTelegramChatId() || config.telegram.chatId),
      webhookUrl: config.telegram.webhookUrl || null,
      connection,
      connectionError,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gemini', async (_req, res) => {
  try {
    let ready = false;
    let error = null;

    if (config.gemini.apiKey) {
      try {
        await verifyGemini();
        ready = true;
      } catch (err) {
        error = err.message;
      }
    }

    res.json({
      configured: Boolean(config.gemini.apiKey),
      model: config.gemini.model,
      ready,
      error,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/database', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      connected: true,
      path: db.name,
      emailCount: emailRepo.countAll(),
      notificationCount: notificationRepo.countSent(),
      pendingDeadlines: deadlineRepo.findAll(false).length,
    });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

router.get('/last-email', (_req, res) => {
  res.json({ email: emailRepo.findLatest() || null });
});

router.get('/last-notification', (_req, res) => {
  res.json({ notification: notificationRepo.findLatest() || null });
});

router.get('/watch', (_req, res) => {
  const syncState = syncRepo.getState();
  const expiry = syncState?.watch_expiry ? new Date(syncState.watch_expiry).getTime() : 0;

  res.json({
    historyId: syncState?.history_id || null,
    expiration: syncState?.watch_expiry || null,
    active: Boolean(expiry && expiry > Date.now()),
    expiresInHours: expiry ? Math.max(0, Math.round((expiry - Date.now()) / 3600000)) : null,
    lastNotificationAt: syncState?.last_notification_at || null,
  });
});

router.get('/startup', (_req, res) => {
  res.json({
    services: getServiceStatus(),
    env: validateRequiredEnv(),
  });
});

router.post('/send-test', async (_req, res) => {
  try {
    const result = await runLatestEmailThroughPipeline();
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
