import { deadlineRepo, actionRepo } from '../db/repositories.js';
import { telegramProvider } from '../services/notifications/telegram.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cron');

function formatDateLabel(deadlineDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(deadlineDate);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === 2) return '2 Days Left';
  if (diffDays === 3) return '3 Days Left';
  return `${diffDays} Days Left`;
}

function groupDeadlines(deadlines) {
  const groups = {};
  for (const dl of deadlines) {
    const label = formatDateLabel(dl.deadline_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(`• ${dl.title}`);
  }
  return groups;
}

export async function runDeadlineReminders() {
  log.info('Running deadline reminders...');

  actionRepo.updateOverdue();

  const deadlines = deadlineRepo.findUpcoming(3);
  if (deadlines.length === 0) {
    log.info('No upcoming deadlines');
    return null;
  }

  const groups = groupDeadlines(deadlines);
  const content = Object.entries(groups)
    .map(([label, items]) => `${label}\n${items.join('\n')}`)
    .join('\n\n');

  if (telegramProvider.isConfigured()) {
    await telegramProvider.sendDeadlineReminder(content);
    log.info('Deadline reminders sent via Telegram');
  }

  return { deadlineCount: deadlines.length, content };
}

export async function cleanupExpiredDeadlines() {
  log.info('Cleaning up expired deadlines...');
  const result = deadlineRepo.removeExpired();
  log.info(`Removed ${result.changes} expired deadlines`);
  return result.changes;
}
