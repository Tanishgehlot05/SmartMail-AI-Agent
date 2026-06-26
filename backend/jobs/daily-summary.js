import { emailRepo, summaryRepo } from '../db/repositories.js';
import { generateDailySummary } from '../services/ai/gemini.js';
import { telegramProvider } from '../services/notifications/telegram.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cron');

export async function runDailySummary() {
  log.info('Running daily summary...');

  const emails = emailRepo.findRecent(24);
  if (emails.length === 0) {
    log.info('No emails in last 24 hours, skipping daily summary');
    return null;
  }

  const content = await generateDailySummary(emails);
  const today = new Date().toISOString().slice(0, 10);

  summaryRepo.saveDaily(today, content, emails.length);

  if (telegramProvider.isConfigured()) {
    await telegramProvider.sendDailySummary(content);
    log.info('Daily summary sent via Telegram');
  }

  return { date: today, emailCount: emails.length, content };
}
