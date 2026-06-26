import { Router } from 'express';
import { processHistoryUpdate } from '../../core/pipeline/email-pipeline.js';
import { pubsubRepo, syncRepo, historyRepo } from '../../db/repositories.js';
import { createLogger } from '../../utils/logger.js';

const router = Router();
const log = createLogger('pubsub');

/**
 * Gmail Pub/Sub push notification webhook.
 * Responds 200 immediately, processes async.
 * Deduplicates by Pub/Sub message ID and Gmail history ID.
 */
router.post('/', async (req, res) => {
  res.status(200).send('OK');

  const message = req.body?.message;
  const pubsubMessageId = message?.messageId || message?.message_id;

  if (pubsubMessageId && pubsubRepo.wasProcessed(pubsubMessageId)) {
    log.info(`Skipped duplicate Pub/Sub message: ${pubsubMessageId}`);
    return;
  }

  try {
    if (!message?.data) {
      log.warn('Received push without message data');
      return;
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8'),
    );

    const historyId = decoded.historyId;
    const emailAddress = decoded.emailAddress || 'unknown';

    log.info(`Notification received for ${emailAddress}, historyId: ${historyId || 'missing'}`);

    if (pubsubMessageId) {
      pubsubRepo.record(pubsubMessageId, historyId, emailAddress);
    }

    syncRepo.recordNotification();

    if (!historyId) {
      log.warn('Pub/Sub payload missing historyId');
      if (pubsubMessageId) pubsubRepo.markProcessed(pubsubMessageId);
      return;
    }

    if (historyRepo.wasProcessed(historyId)) {
      log.info(`Skipped duplicate history ID: ${historyId}`);
      if (pubsubMessageId) pubsubRepo.markProcessed(pubsubMessageId);
      return;
    }

    const result = await processHistoryUpdate(historyId);

    if (result.success) {
      historyRepo.markProcessed(historyId);
      if (pubsubMessageId) pubsubRepo.markProcessed(pubsubMessageId);
      log.info(`History ${historyId} processed successfully`);
    } else {
      log.warn(`History ${historyId} deferred for retry: ${result.error || 'unknown error'}`);
    }
  } catch (err) {
    log.error(`Push processing failed: ${err?.stack || err}`);
  }
});

export default router;
