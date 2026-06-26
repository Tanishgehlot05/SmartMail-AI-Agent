import { Router } from 'express';
import { settingsRepo, syncRepo } from '../../db/repositories.js';
import { setupGmailWatch, renewGmailWatch } from '../../core/pipeline/email-pipeline.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('gmail');
const router = Router();

router.get('/', (req, res) => {
  const settings = settingsRepo.getAll();
  const syncState = syncRepo.getState();
  res.json({ settings, syncState });
});

router.put('/', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid settings payload' });
  }

  for (const [key, value] of Object.entries(updates)) {
    settingsRepo.set(key, value);
  }

  res.json({ settings: settingsRepo.getAll() });
});

router.post('/gmail/watch', async (req, res) => {
  try {
    const result = await setupGmailWatch();
    res.json({ success: true, result });
  } catch (err) {
    log.error(`Gmail watch setup failed: ${err.message}`);
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

router.post('/gmail/renew-watch', async (req, res) => {
  try {
    const result = await renewGmailWatch();
    res.json({ success: true, result });
  } catch (err) {
    log.error(`Gmail watch renewal failed: ${err.message}`);
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

export default router;
