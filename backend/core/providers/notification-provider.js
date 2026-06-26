/**
 * Abstract notification provider interface.
 * Implement for Telegram, Slack, Discord, Teams, push, etc.
 */
export class NotificationProvider {
  async sendInstant(message, metadata = {}) {
    throw new Error('sendInstant() not implemented');
  }

  async sendDailySummary(content) {
    throw new Error('sendDailySummary() not implemented');
  }

  async sendWeeklyReport(content) {
    throw new Error('sendWeeklyReport() not implemented');
  }

  async sendDeadlineReminder(content) {
    throw new Error('sendDeadlineReminder() not implemented');
  }
}
