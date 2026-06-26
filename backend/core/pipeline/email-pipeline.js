import { gmailProvider } from '../../services/gmail/client.js';
import { emailRepo, syncRepo } from '../../db/repositories.js';
import { analyzeEmail } from '../../services/ai/gemini.js';
import {
  shouldNotify, sendInstantNotification, storeExtractedData, trackAnalytics,
} from '../../services/notifications/dispatcher.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('pipeline');

/**
 * Core email processing pipeline.
 * Gmail → Fetch → Gemini Analysis → Classification → Notify/Save
 */
export async function processEmail(messageId) {
  const existing = emailRepo.findById(messageId);
  if (existing) {
    log.info(`Skipped duplicate email: ${messageId}`);
    return existing;
  }

  log.info(`Processing email: ${messageId}`);

  const rawEmail = await gmailProvider.fetchMessage(messageId);
  const threadEmails = emailRepo.findByThread(rawEmail.threadId);

  const analysis = await analyzeEmail(rawEmail, threadEmails);
  log.info(`Gemini analyzed: ${analysis.category} (score ${analysis.importance_score})`);
  if (analysis.deadlines?.length) {
    log.info(`Deadline extracted: ${analysis.deadlines.map(d => d.title).join(', ')}`);
  }

  const emailRecord = {
    id: rawEmail.id,
    threadId: rawEmail.threadId,
    fromAddress: rawEmail.fromAddress,
    fromName: rawEmail.fromName,
    subject: rawEmail.subject,
    bodySnippet: rawEmail.bodySnippet,
    bodyText: rawEmail.bodyText,
    receivedAt: rawEmail.receivedAt,
    category: analysis.category,
    subcategory: analysis.subcategory,
    importanceScore: analysis.importance_score,
    aiConfidence: analysis.ai_confidence,
    notifyInstant: analysis.notify_instant,
    isPersonal: analysis.is_personal,
    isSpamRescued: analysis.is_spam_rescued,
    isIgnored: analysis.is_ignored,
    summary: analysis.summary,
    rawAnalysis: { ...analysis, gmailLabels: rawEmail.labelIds, attachments: rawEmail.attachments },
  };

  emailRepo.insert(emailRecord);
  trackAnalytics(rawEmail, analysis);
  storeExtractedData(rawEmail.id, analysis);

  const notifyDecision = shouldNotify(rawEmail, analysis, threadEmails);
  if (notifyDecision.notify) {
    const sent = await sendInstantNotification(rawEmail, analysis);
    if (sent) log.info('Telegram notification sent');
  } else {
    log.info(`Not notifying: ${notifyDecision.reason}`);
  }

  return { ...emailRecord, notifyDecision };
}

function isRetryableError(err) {
  if (!err) return false;
  if ([429, 500, 502, 503, 504].includes(err.statusCode)) return true;
  if (err.name === 'AbortError') return true;
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') return true;
  return false;
}

export async function processHistoryUpdate(historyId) {
  const state = syncRepo.getState();
  const startId = state?.history_id || historyId;

  try {
    log.info(`Fetching history from ${startId} (push historyId: ${historyId})`);
    const { messageIds, historyId: newHistoryId } = await gmailProvider.fetchHistorySince(startId);

    log.info(`History fetched: ${messageIds.length} new message(s)`);

    const results = [];
    for (const id of messageIds) {
      try {
        const result = await processEmail(id);
        results.push(result);
        log.info(`Email processed: ${id}`);
      } catch (err) {
        log.error(`Failed to process ${id}: ${err?.stack || err}`);
      }
    }

    if (newHistoryId) {
      syncRepo.saveHistoryId(newHistoryId);
      log.info(`History ID updated to ${newHistoryId}`);
    }

    return { success: true, results, messageCount: messageIds.length };
  } catch (err) {
    if (err.statusCode === 404) {
      log.warn('History ID expired, re-establishing watch and recovering...');
      const recovered = await recoverFromExpiredHistory();
      return { success: true, recovered: true, results: recovered, messageCount: recovered.length };
    }

    if (isRetryableError(err)) {
      log.warn(`Temporary Gmail error (${err.statusCode || err.code || err.name}), will retry on next push`);
      return { success: false, retryable: true, error: err.message };
    }

    log.error(`History update failed: ${err?.stack || err}`);
    return { success: false, retryable: true, error: err.message };
  }
}

async function recoverFromExpiredHistory() {
  try {
    const watchResult = await setupGmailWatch();
    log.info(`Watch re-established, historyId: ${watchResult.historyId}`);

    const latest = await gmailProvider.fetchLatestMessage();
    if (latest?.id) {
      log.info(`Recovered latest email after expired history: ${latest.id}`);
      return [await processEmail(latest.id)];
    }
  } catch (recoveryErr) {
    log.error(`Recovery failed: ${recoveryErr?.stack || recoveryErr}`);
  }
  return [];
}

export async function setupGmailWatch() {
  const result = await gmailProvider.setupPushNotifications();
  const watchExpiry = new Date(parseInt(result.expiration, 10)).toISOString();
  syncRepo.saveState({ historyId: result.historyId, watchExpiry });
  log.info(`Watch established, historyId: ${result.historyId}, expires: ${watchExpiry}`);
  return result;
}

export async function renewGmailWatch() {
  const result = await gmailProvider.renewPushNotifications();
  const watchExpiry = new Date(parseInt(result.expiration, 10)).toISOString();
  syncRepo.saveState({ historyId: result.historyId, watchExpiry });
  log.info(`Watch renewed, expires: ${watchExpiry}`);
  return result;
}

export async function ensureGmailWatch() {
  const state = syncRepo.getState();
  const expiryTime = state?.watch_expiry ? new Date(state.watch_expiry).getTime() : 0;
  const renewBeforeMs = 24 * 60 * 60 * 1000;
  const shouldRenew = !expiryTime || Number.isNaN(expiryTime) || expiryTime - Date.now() < renewBeforeMs;

  try {
    if (shouldRenew) {
      log.info('Watch missing or expiring soon, renewing...');
      return renewGmailWatch();
    }

    log.info(`Watch active until ${state.watch_expiry}`);
    return {
      historyId: state.history_id,
      expiration: String(expiryTime),
    };
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      log.warn('Watch invalid or expired, stopping and re-establishing...');
      try {
        await gmailProvider.stopPushNotifications();
      } catch (stopErr) {
        log.warn(`Stop watch failed (continuing): ${stopErr.message}`);
      }
      return renewGmailWatch();
    }
    throw err;
  }
}

export async function runLatestEmailThroughPipeline() {
  const latest = await gmailProvider.fetchLatestMessage();
  if (!latest?.id) {
    return { processed: false, reason: 'No Gmail messages found' };
  }

  const result = await processEmail(latest.id);
  return { processed: true, messageId: latest.id, result };
}
