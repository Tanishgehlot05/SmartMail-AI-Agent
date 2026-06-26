import { emailRepo, summaryRepo, analyticsRepo } from '../db/repositories.js';
import { generateWeeklyReport } from '../services/ai/gemini.js';
import { telegramProvider } from '../services/notifications/telegram.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cron');

export async function runWeeklySummary() {
  log.info('Running weekly summary...');

  const emails = emailRepo.findRecent(24 * 7);
  const stats = analyticsRepo.getOverview();

  const weekEnd = new Date();
  const weekStart = new Date(Date.now() - 7 * 86400000);

  const content = await generateWeeklyReport(emails, stats);

  summaryRepo.saveWeekly(
    weekStart.toISOString().slice(0, 10),
    weekEnd.toISOString().slice(0, 10),
    content,
    stats,
  );

  if (telegramProvider.isConfigured()) {
    await telegramProvider.sendWeeklyReport(content);
    log.info('Weekly report sent via Telegram');
  }

  return { weekStart, weekEnd, emailCount: emails.length, content };
}
