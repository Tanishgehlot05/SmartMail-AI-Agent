import {
  emailRepo, deadlineRepo, actionRepo, notificationRepo,
  analyticsRepo, settingsRepo,
} from '../../db/repositories.js';
import { shouldNotifyInstant } from '../ai/gemini.js';
import { telegramProvider } from './telegram.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('notify');

/**
 * AI Memory: prevents duplicate notifications and handles thread updates intelligently.
 */
export function shouldNotify(email, analysis, threadEmails = []) {
  if (notificationRepo.wasNotified(email.id, 'instant')) {
    return { notify: false, reason: 'Already notified for this email' };
  }

  if (threadEmails.length > 1) {
    const previousNotified = notificationRepo.wasThreadNotified(email.threadId, 'instant');
    if (previousNotified && !analysis.thread_update_significant) {
      return { notify: false, reason: 'Thread reply with no significant new information' };
    }

    const trivialPatterns = /^(thanks|thank you|ok|okay|noted|received|got it|sure|done)\.?!?$/i;
    const bodyPreview = (email.bodyText || email.bodySnippet || '').trim();
    if (trivialPatterns.test(bodyPreview) && !analysis.thread_update_significant) {
      return { notify: false, reason: 'Trivial thread reply' };
    }
  }

  const settings = settingsRepo.getAll();
  if (settings.notifications_enabled === 'false') {
    return { notify: false, reason: 'Notifications disabled' };
  }

  if (analysis.is_ignored && !analysis.is_spam_rescued) {
    return { notify: false, reason: 'Email marked as ignorable (newsletter/promo/spam)' };
  }

  if (!shouldNotifyInstant(analysis, settings)) {
    return { notify: false, reason: 'Saved for daily summary' };
  }

  return { notify: true, reason: analysis.reasoning || 'Important email' };
}

export async function sendInstantNotification(email, analysis) {
  try {
    const bodyPreview = (email.bodyText || email.bodySnippet || '').replace(/\s+/g, ' ').trim();

    await telegramProvider.sendInstant(analysis.summary, {
      from: email.fromAddress,
      fromName: email.fromName,
      subject: email.subject,
      summary: analysis.summary,
      category: analysis.category,
      subcategory: analysis.subcategory,
      isPersonal: analysis.is_personal,
      isSpamRescued: analysis.is_spam_rescued,
      bodyPreview,
      extracted: analysis.extracted,
      deadlines: analysis.deadlines,
    });

    notificationRepo.record(email.id, email.threadId, 'instant', analysis.summary);
    analyticsRepo.incrementToday('notifications_sent');

    log.info(`Telegram sent: ${email.subject}`);
    return true;
  } catch (err) {
    log.error(`Failed to send instant notification: ${err.message}`);
    return false;
  }
}

export function storeExtractedData(emailId, analysis) {
  for (const dl of analysis.deadlines || []) {
    if (dl.title) {
      deadlineRepo.insert({
        title: dl.title,
        deadlineAt: dl.deadline_at || new Date(Date.now() + 7 * 86400000).toISOString(),
        emailId,
        source: dl.source || 'ai',
      });
      analyticsRepo.incrementToday('deadlines_detected');
    }
  }

  for (const action of analysis.actions || []) {
    if (action.title) {
      actionRepo.insert({
        emailId,
        actionType: action.type || 'other',
        title: action.title,
        description: action.description || null,
        dueDate: action.due_date || null,
      });
      if (action.type === 'fill_form' || action.type === 'register') {
        analyticsRepo.incrementToday('forms_detected');
      }
    }
  }
}

export function trackAnalytics(email, analysis) {
  analyticsRepo.incrementToday('emails_analyzed');
  analyticsRepo.addConfidence(analysis.ai_confidence || 0.5);
  analyticsRepo.trackSender(email.fromAddress);
  analyticsRepo.trackCategory(analysis.category);

  if (analysis.is_ignored) analyticsRepo.incrementToday('emails_ignored');
  if (analysis.is_spam_rescued) analyticsRepo.incrementToday('spam_recovered');
  if (analysis.is_personal) analyticsRepo.incrementToday('personal_detected');
  if (analysis.category === 'academic') analyticsRepo.incrementToday('academic_emails');
  if (analysis.category === 'career') analyticsRepo.incrementToday('career_emails');
}
