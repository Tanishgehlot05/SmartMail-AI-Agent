import config, { validateRequiredEnv } from '../config/index.js';
import db from '../db/index.js';
import { emailRepo, notificationRepo, syncRepo, deadlineRepo } from '../db/repositories.js';
import { gmailProvider } from './gmail/client.js';
import { telegramProvider } from './notifications/telegram.js';
import { verifyGemini } from './ai/gemini.js';
import { initTelegramBot, getTelegramBot, getTelegramChatId } from './telegram/bot.js';
import { ensureGmailWatch } from '../core/pipeline/email-pipeline.js';
import { ensureDefaultUser, getActiveMonitoredAccounts, syncDefaultUserFromOAuth } from './user-context.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('startup');

const serviceStatus = {
  database: { ok: false, error: null },
  gemini: { ok: false, error: null },
  telegram: { ok: false, error: null },
  gmailOAuth: { ok: false, error: null },
  gmailWatch: { ok: false, error: null },
  pubsub: { ok: false, error: null },
};

export function getServiceStatus() {
  return { ...serviceStatus };
}

export async function buildHealthReport() {
  const env = validateRequiredEnv();
  const syncState = syncRepo.getState();
  const watchExpiry = syncState?.watch_expiry ? new Date(syncState.watch_expiry).getTime() : 0;
  const latestEmail = emailRepo.findLatest();
  const latestNotification = notificationRepo.findLatest();
  const pendingDeadlines = deadlineRepo.findUpcoming(30);
  const monitoredAccounts = getActiveMonitoredAccounts();

  let gmailOAuth = null;
  let gmailOAuthError = null;
  try {
    if (serviceStatus.gmailOAuth.ok) {
      gmailOAuth = await gmailProvider.verifyOAuth();
    }
  } catch (err) {
    gmailOAuthError = err.message;
  }

  const allCoreOk = env.ok
    && serviceStatus.database.ok
    && serviceStatus.gemini.ok
    && serviceStatus.telegram.ok
    && serviceStatus.gmailOAuth.ok
    && serviceStatus.gmailWatch.ok
    && serviceStatus.pubsub.ok;

  return {
    status: allCoreOk ? 'ok' : 'degraded',
    service: 'SmartMail AI Agent',
    time: new Date().toISOString(),
    environment: config.nodeEnv,
    services: { ...serviceStatus },
    database: {
      connected: serviceStatus.database.ok,
      path: db.name,
    },
    gemini: {
      configured: Boolean(config.gemini.apiKey),
      ready: serviceStatus.gemini.ok,
      model: config.gemini.model,
      error: serviceStatus.gemini.error,
    },
    telegram: {
      configured: telegramProvider.isConfigured() || Boolean(config.telegram.botToken),
      connected: serviceStatus.telegram.ok,
      botInitialized: Boolean(getTelegramBot()),
      chatIdAvailable: Boolean(getTelegramChatId() || config.telegram.chatId),
      error: serviceStatus.telegram.error,
    },
    gmail: {
      oauthConfigured: Boolean(config.gmail.clientId && config.gmail.clientSecret && config.gmail.refreshToken),
      oauthVerified: serviceStatus.gmailOAuth.ok,
      oauthError: gmailOAuthError || serviceStatus.gmailOAuth.error,
      emailAddress: gmailOAuth?.emailAddress || null,
      token: gmailProvider.getTokenStatus(),
      lastHistoryId: syncState?.history_id || null,
      watchExpiration: syncState?.watch_expiry || null,
      watchActive: Boolean(watchExpiry && watchExpiry > Date.now()),
      error: serviceStatus.gmailWatch.error,
    },
    pubsub: {
      configured: serviceStatus.pubsub.ok,
      topic: config.gmail.pubsubTopic || null,
      webhookPaths: ['/webhooks/gmail', '/api/gmail/webhook'],
      error: serviceStatus.pubsub.error,
    },
    watch: {
      active: Boolean(watchExpiry && watchExpiry > Date.now()),
      expiration: syncState?.watch_expiry || null,
      historyId: syncState?.history_id || null,
      lastNotificationAt: syncState?.last_notification_at || null,
    },
    lastProcessedEmail: latestEmail ? {
      id: latestEmail.id,
      subject: latestEmail.subject,
      from: latestEmail.from_address,
      receivedAt: latestEmail.received_at,
      processedAt: latestEmail.processed_at,
    } : null,
    lastNotification: latestNotification ? {
      id: latestNotification.id,
      type: latestNotification.notification_type,
      subject: latestNotification.subject,
      sentAt: latestNotification.sent_at,
    } : null,
    pendingDeadlines: pendingDeadlines.length,
    pendingDeadlinesPreview: pendingDeadlines.slice(0, 5).map(d => ({
      id: d.id,
      title: d.title,
      deadlineAt: d.deadline_at,
    })),
    activeMonitoredAccounts: monitoredAccounts,
    env: {
      ok: env.ok,
      missing: env.missing,
      warnings: env.warnings,
    },
  };
}

async function checkDatabase() {
  try {
    db.prepare('SELECT 1').get();
    serviceStatus.database = { ok: true, error: null };
    log.ok('Database connected');
    return true;
  } catch (err) {
    serviceStatus.database = { ok: false, error: err.message };
    log.fail(`Database connection failed: ${err.message}`);
    return false;
  }
}

async function checkGemini() {
  if (!config.gemini.apiKey) {
    serviceStatus.gemini = { ok: false, error: 'GEMINI_API_KEY missing' };
    log.fail('Gemini API key missing');
    return false;
  }

  try {
    await verifyGemini();
    serviceStatus.gemini = { ok: true, error: null };
    log.ok('Gemini ready');
    return true;
  } catch (err) {
    serviceStatus.gemini = { ok: false, error: err.message };
    log.fail(`Gemini verification failed: ${err.message}`);
    return false;
  }
}

async function checkTelegram() {
  if (!config.telegram.botToken) {
    serviceStatus.telegram = { ok: false, error: 'TELEGRAM_BOT_TOKEN missing' };
    log.fail('Telegram bot token missing');
    return false;
  }

  try {
    const bot = initTelegramBot();
    if (!bot) {
      serviceStatus.telegram = { ok: false, error: 'Bot initialization returned null' };
      log.fail('Telegram bot failed to initialize');
      return false;
    }

    const status = await telegramProvider.verifyConnection();
    serviceStatus.telegram = { ok: status.ok, error: status.ok ? null : status.error };
    if (status.ok) {
      log.ok(`Telegram connected (@${status.username || 'bot'})`);
    } else {
      log.fail(`Telegram verification failed: ${status.error}`);
    }
    return status.ok;
  } catch (err) {
    serviceStatus.telegram = { ok: false, error: err.message };
    log.fail(`Telegram verification failed: ${err.message}`);
    return false;
  }
}

async function checkGmailOAuth() {
  if (!config.gmail.clientId || !config.gmail.clientSecret || !config.gmail.refreshToken) {
    serviceStatus.gmailOAuth = { ok: false, error: 'Gmail OAuth credentials missing' };
    log.fail('Gmail OAuth credentials missing');
    return false;
  }

  try {
    const oauth = await gmailProvider.verifyOAuth();
    syncDefaultUserFromOAuth(oauth);
    serviceStatus.gmailOAuth = { ok: true, error: null, email: oauth.emailAddress };
    log.ok(`Gmail OAuth verified (${oauth.emailAddress})`);
    log.ok('Gmail access token refreshed');
    return true;
  } catch (err) {
    serviceStatus.gmailOAuth = { ok: false, error: err.message };
    log.fail(`Gmail OAuth verification failed: ${err.message}`);
    return false;
  }
}

async function checkGmailWatch() {
  if (!serviceStatus.gmailOAuth.ok) {
    serviceStatus.gmailWatch = { ok: false, error: 'Skipped — Gmail OAuth not ready' };
    log.warn('Gmail watch skipped (OAuth not ready)');
    return false;
  }

  try {
    await ensureGmailWatch();
    serviceStatus.gmailWatch = { ok: true, error: null };
    log.ok('Gmail watch active');
    return true;
  } catch (err) {
    serviceStatus.gmailWatch = { ok: false, error: err.message };
    log.fail(`Gmail watch setup failed: ${err.message}`);
    return false;
  }
}

function checkPubSub() {
  if (!config.gmail.pubsubTopic) {
    serviceStatus.pubsub = { ok: false, error: 'GMAIL_PUBSUB_TOPIC missing' };
    log.fail('Pub/Sub topic missing');
    return false;
  }

  if (!config.gmail.pubsubTopic.startsWith('projects/')) {
    serviceStatus.pubsub = { ok: false, error: 'GMAIL_PUBSUB_TOPIC must start with projects/' };
    log.fail('Pub/Sub topic format invalid');
    return false;
  }

  serviceStatus.pubsub = { ok: true, error: null };
  log.ok(`Pub/Sub configured (${config.gmail.pubsubTopic})`);
  return true;
}

export async function initializeStartupServices() {
  log.info('SmartMail AI Server starting...');

  const env = validateRequiredEnv();
  if (!env.ok) {
    log.fail(`Missing required environment variables: ${env.missing.join(', ')}`);
  }

  ensureDefaultUser();

  await checkDatabase();
  await checkGemini();
  await checkGmailOAuth();
  await checkGmailWatch();
  checkPubSub();
  await checkTelegram();

  const readyCount = Object.values(serviceStatus).filter(s => s.ok).length;
  const total = Object.keys(serviceStatus).length;

  if (readyCount === total) {
    log.ok('Server ready');
  } else {
    log.warn(`Server started in degraded mode (${readyCount}/${total} services ready)`);
  }

  return getServiceStatus();
}
