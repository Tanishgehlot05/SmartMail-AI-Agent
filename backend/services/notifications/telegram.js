import { NotificationProvider } from '../../core/providers/notification-provider.js';
import config from '../../config/index.js';
import { getTelegramChatId } from '../telegram/bot.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('telegram');

export class TelegramProvider extends NotificationProvider {
  constructor() {
    super();
    this.baseUrl = config.telegram.botToken
      ? `https://api.telegram.org/bot${config.telegram.botToken}`
      : null;
    this.chatId = config.telegram.chatId;
  }

  isConfigured() {
    return Boolean(this.baseUrl && (this.chatId || getTelegramChatId()));
  }

  getChatId() {
    return getTelegramChatId() || this.chatId || config.telegram.chatId;
  }

  async verifyConnection() {
    if (!this.baseUrl) {
      return { ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' };
    }

    const response = await fetch(`${this.baseUrl}/getMe`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Telegram getMe failed: ${data.description || response.statusText}`);
    }

    return {
      ok: true,
      username: data.result?.username,
      hasChatId: Boolean(this.chatId),
    };
  }

  async sendMessage(text, parseMode = 'HTML') {
    const chatId = this.getChatId();
    if (!this.baseUrl || !chatId) {
      log.warn('Not configured (missing token or chat ID), skipping message');
      return null;
    }

    const chunks = this.splitMessage(text, 4000);
    const results = [];

    for (const chunk of chunks) {
      results.push(await this.sendChunkWithRetry(chatId, chunk, parseMode));
    }

    return results;
  }

  async sendChunkWithRetry(chatId, chunk, parseMode) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: parseMode,
            disable_web_page_preview: true,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(`Telegram API error: ${err.description || response.statusText}`);
        }

        log.info('Message sent');
        return response.json();
      } catch (err) {
        lastError = err;
        log.error(`Send attempt ${attempt} failed: ${err.message}`);
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    throw lastError;
  }

  splitMessage(text, maxLen) {
    if (text.length <= maxLen) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt < maxLen * 0.5) splitAt = maxLen;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
  }

  buildInstantMessage(metadata = {}) {
    const {
      fromName, from, subject, summary, category, subcategory,
      isPersonal, isSpamRescued, bodyPreview, extracted, deadlines,
    } = metadata;

    const lines = [];

    if (isPersonal) {
      lines.push('👤 <b>Personal Email</b>');
    } else if (isSpamRescued) {
      lines.push('🛡 <b>Spam Rescue — Important Email</b>');
    } else {
      const emoji = {
        academic: '📚', career: '💼', personal: '👤', deadline: '⏰',
        fee: '💰', form: '📋', exam: '📝', assignment: '📄',
        registration: '📝', interview: '🎯', scholarship: '🎓',
        circular: '🏫', informational: 'ℹ️',
      };
      lines.push(`${emoji[category] || '📧'} <b>${formatCategory(category, subcategory)}</b>`);
    }

    lines.push('');
    lines.push(`<b>From:</b>\n${escapeHtml(fromName || from || 'Unknown')}`);
    lines.push(`<b>Subject:</b>\n${escapeHtml(subject || 'No subject')}`);
    lines.push('');
    lines.push('<b>Summary:</b>');
    lines.push(escapeHtml(summary || 'No summary'));

    if (extracted) {
      const details = [];
      if (extracted.company) details.push(`Company: ${extracted.company}`);
      if (extracted.stipend) details.push(`Stipend: ${extracted.stipend}`);
      if (extracted.eligibility) details.push(`Eligibility: ${extracted.eligibility}`);
      if (extracted.apply_link) details.push(`Apply: ${extracted.apply_link}`);
      if (extracted.form_link) details.push(`Form: ${extracted.form_link}`);
      if (extracted.exam_date) details.push(`Exam Date: ${extracted.exam_date}`);
      if (extracted.exam_time) details.push(`Time: ${extracted.exam_time}`);
      if (extracted.exam_venue) details.push(`Venue: ${extracted.exam_venue}`);
      if (extracted.payment_deadline) details.push(`Payment Deadline: ${extracted.payment_deadline}`);
      if (extracted.purpose) details.push(`Purpose: ${extracted.purpose}`);

      if (details.length > 0) {
        lines.push('');
        lines.push('<b>Details:</b>');
        lines.push(escapeHtml(details.join('\n')));
      }
    }

    if (deadlines?.length > 0) {
      lines.push('');
      lines.push('<b>Deadlines:</b>');
      for (const dl of deadlines.slice(0, 3)) {
        lines.push(`• ${escapeHtml(dl.title)}${dl.deadline_at ? ` — ${escapeHtml(dl.deadline_at)}` : ''}`);
      }
    }

    if (isPersonal && bodyPreview) {
      const preview = truncatePreview(bodyPreview, 300);
      lines.push('');
      lines.push('<b>Message Preview:</b>');
      lines.push(`"${escapeHtml(preview)}"`);
    }

    return lines.join('\n');
  }

  async sendInstant(message, metadata = {}) {
    const text = this.buildInstantMessage({ ...metadata, summary: metadata.summary || message });
    return this.sendMessage(text);
  }

  async sendDailySummary(content) {
    const text = `🌙 <b>Daily Email Summary</b>\n<i>Last 24 hours</i>\n\n${escapeHtml(content)}`;
    return this.sendMessage(text);
  }

  async sendWeeklyReport(content) {
    const text = `📅 <b>Weekly Email Report</b>\n\n${escapeHtml(content)}`;
    return this.sendMessage(text);
  }

  async sendDeadlineReminder(content) {
    const text = `⏰ <b>Upcoming Deadlines</b>\n\n${escapeHtml(content)}`;
    return this.sendMessage(text);
  }
}

function formatCategory(category, subcategory) {
  if (subcategory && subcategory !== category) {
    return `${capitalize(category)} — ${subcategory.replace(/_/g, ' ')}`;
  }
  return capitalize(category || 'Important Email');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function truncatePreview(text, maxLen) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3)}...`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const telegramProvider = new TelegramProvider();
