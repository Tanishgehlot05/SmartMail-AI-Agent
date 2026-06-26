import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('gemini');

const genAI = config.gemini.apiKey
  ? new GoogleGenerativeAI(config.gemini.apiKey)
  : null;

const ANALYSIS_PROMPT = `You are SmartMail AI, a smart personal email assistant for an undergraduate B.Tech student.
Analyze the email and return ONLY valid JSON (no markdown fences):

{
  "category": "academic|career|personal|informational|spam|promotional|deadline|form|fee|exam|assignment|registration|interview|scholarship|circular",
  "subcategory": "specific type e.g. internship, college_circular, google_form, fee_circular",
  "importance_score": 0.0 to 1.0,
  "ai_confidence": 0.0 to 1.0,
  "notify_instant": true/false,
  "is_personal": true/false,
  "is_spam_rescued": true/false,
  "is_ignored": true/false,
  "summary": "one clear sentence summary",
  "reasoning": "brief reason for notify/ignore decision",
  "deadlines": [{"title": "string", "deadline_at": "ISO8601 date or null", "source": "email body/subject"}],
  "actions": [{"type": "register|fill_form|reply|upload_document|pay_fees|accept_invitation|book_slot|apply|other", "title": "string", "description": "string", "due_date": "ISO8601 or null", "link": "url or null"}],
  "extracted": {
    "company": "for internships/jobs or null",
    "stipend": "for internships or null",
    "apply_link": "url or null",
    "eligibility": "string or null",
    "form_link": "Google/Microsoft/Typeform/Unstop/Internshala/LinkedIn/Wellfound link or null",
    "exam_date": "ISO8601 or null",
    "exam_time": "string or null",
    "exam_venue": "string or null",
    "payment_deadline": "ISO8601 or null",
    "purpose": "for forms or null"
  },
  "thread_update_significant": true/false
}

NOTIFY INSTANTLY (notify_instant=true):
- College circulars affecting undergrad B.Tech students
- Internships: extract company, stipend, apply link, eligibility, deadline
- Scholarships
- Fee circulars with payment deadline
- Google Forms / Microsoft Forms / Typeform / Unstop / Internshala / LinkedIn Jobs / Wellfound links
- Exams: extract date, time, venue
- Assignments with deadline
- Registrations with deadline
- Interviews (notify immediately)
- Personal human emails: friend, senior, professor personally addressing student, recruiter personally contacting, collaborator, club member — even without deadline

PERSONAL EMAIL DETECTION:
Set is_personal=true for genuine human communication directed at the student.
NOT personal: automated noreply, newsletters, bulk announcements.

ALMOST NEVER NOTIFY (is_ignored=true, notify_instant=false):
OTP, newsletters, Amazon, Flipkart, promotions, ads, GitHub notifications, LinkedIn digest, YouTube, marketing, surveys, bank promotions, random department announcements, thesis/synopsis, PhD seminars, research talks, faculty publications, conference announcements, general newsletters, circulars unrelated to undergraduate B.Tech students.

SPAM RESCUE:
If email is in SPAM label but contains internship, scholarship, personal email, recruiter, interview, or college deadline — set is_spam_rescued=true and notify_instant=true.

THREAD AWARENESS:
If this is a reply in an existing thread, read previous context.
Set thread_update_significant=false for trivial replies ("Thanks", "OK", "Noted") with no new info.
Only notify if something meaningful changed (new deadline, new question, status change).

DEADLINE EXTRACTION:
Support absolute dates, relative dates ("tomorrow", "next Friday"), "time extended", deadline updates.
Parse form links from Google Forms, Microsoft Forms, Typeform, Unstop, Internshala, LinkedIn Jobs, Wellfound.

Today's reference date: {today}

Email to analyze:
From: {from}
Subject: {subject}
Date: {date}
Gmail Labels: {labels}
Body:
{body}`;

const DAILY_SUMMARY_PROMPT = `You are SmartMail AI. Create a beautiful daily email summary for the last 24 hours.
Group intelligently — do NOT list emails one by one.

Use this exact section order (skip empty sections):

⚠ Deadlines
Tomorrow
• item

Within 3 Days
• item

🏫 College
• academic notices, circulars, exams

💼 Internships
• opportunities with company and deadline if known

👤 Personal
• human emails worth noting

📋 Other
• remaining important items

Keep concise. Use bullet points. Include deadlines prominently.

Emails from the last 24 hours:
{emails}`;

const WEEKLY_REPORT_PROMPT = `You are SmartMail AI. Create a comprehensive weekly email report.

Include these sections in order:

📊 Overview
• emails analyzed, notifications sent, spam rescued (from stats)

⭐ Most Important Emails This Week
• top 3-5 emails with one line each

⏰ Deadlines This Week
• deadlines due in the next 7 days

📋 Pending Forms
• unfilled Google Forms, registrations, applications

📬 Unread Important Emails
• important emails that may need action

😔 Missed Opportunities
• internships/scholarships that may have passed (if any)

💼 Internships & Scholarships
• career opportunities

👤 Personal Emails
• notable personal communications

End with:
✅ What should you do this week?
• actionable item 1
• actionable item 2

Stats: {stats}
Emails this week: {emails}`;

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse AI response as JSON');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clampScore(value, fallback = 0.5) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeAnalysis(raw, email) {
  const fallback = fallbackAnalysis(email);
  const allowedCategories = new Set([
    'academic', 'career', 'personal', 'informational', 'spam', 'promotional',
    'deadline', 'form', 'fee', 'exam', 'assignment', 'registration',
    'interview', 'scholarship', 'circular',
  ]);
  const category = allowedCategories.has(raw?.category) ? raw.category : fallback.category;

  return {
    category,
    subcategory: raw?.subcategory || category,
    importance_score: clampScore(raw?.importance_score, fallback.importance_score),
    ai_confidence: clampScore(raw?.ai_confidence, fallback.ai_confidence),
    notify_instant: Boolean(raw?.notify_instant),
    is_personal: Boolean(raw?.is_personal),
    is_spam_rescued: Boolean(raw?.is_spam_rescued) || (email.isSpam && category !== 'spam' && category !== 'promotional' && clampScore(raw?.importance_score, fallback.importance_score) >= 0.7),
    is_ignored: Boolean(raw?.is_ignored),
    summary: raw?.summary || fallback.summary,
    reasoning: raw?.reasoning || fallback.reasoning,
    deadlines: Array.isArray(raw?.deadlines) ? raw.deadlines : [],
    actions: Array.isArray(raw?.actions) ? raw.actions : [],
    extracted: raw?.extracted || {},
    thread_update_significant: raw?.thread_update_significant !== false,
  };
}

async function generateWithRetry(model, prompt, label) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      lastError = err;
      log.error(`${label} attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await sleep(750 * attempt);
    }
  }

  throw lastError;
}

export async function verifyGemini() {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = genAI.getGenerativeModel({ model: config.gemini.model });
  const result = await model.generateContent('Reply with exactly: OK');
  const text = result.response.text().trim();

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return { ok: true, model: config.gemini.model };
}

export async function analyzeEmail(email, threadContext = []) {
  if (!genAI) {
    return fallbackAnalysis(email);
  }

  const model = genAI.getGenerativeModel({ model: config.gemini.model });

  const threadInfo = threadContext.length > 0
    ? `\n\nPrevious messages in thread:\n${threadContext.map(e => `- ${e.subject}: ${e.summary || e.body_snippet}`).join('\n')}`
    : '';

  const prompt = ANALYSIS_PROMPT
    .replace('{from}', `${email.fromName} <${email.fromAddress}>`)
    .replace('{subject}', email.subject)
    .replace('{date}', email.receivedAt)
    .replace('{labels}', (email.labelIds || []).join(', ') || 'none')
    .replace('{today}', new Date().toISOString().slice(0, 10))
    .replace('{body}', (email.bodyText || email.bodySnippet).slice(0, 4000) + threadInfo);

  try {
    const result = await generateWithRetry(model, prompt, 'Analysis');
    const text = result.response.text();
    return normalizeAnalysis(parseJsonResponse(text), email);
  } catch (err) {
    log.error(`Analysis failed: ${err.message}`);
    return fallbackAnalysis(email);
  }
}

export async function generateDailySummary(emails) {
  if (!genAI || emails.length === 0) {
    return formatFallbackDailySummary(emails);
  }

  const model = genAI.getGenerativeModel({ model: config.gemini.model });
  const emailList = emails.map(e =>
    `[${e.category || 'unknown'}] From: ${e.from_address || e.fromAddress} | Subject: ${e.subject} | ${e.summary || e.body_snippet}`
  ).join('\n');

  const prompt = DAILY_SUMMARY_PROMPT.replace('{emails}', emailList);

  try {
    const result = await generateWithRetry(model, prompt, 'Daily summary');
    return result.response.text();
  } catch (err) {
    log.error(`Daily summary failed: ${err.message}`);
    return formatFallbackDailySummary(emails);
  }
}

export async function generateWeeklyReport(emails, stats) {
  if (!genAI) {
    return formatFallbackWeeklyReport(emails, stats);
  }

  const model = genAI.getGenerativeModel({ model: config.gemini.model });
  const emailList = emails.slice(0, 100).map(e =>
    `[${e.category}] ${e.subject} - ${e.summary || e.body_snippet}`
  ).join('\n');

  const prompt = WEEKLY_REPORT_PROMPT
    .replace('{stats}', JSON.stringify(stats, null, 2))
    .replace('{emails}', emailList);

  try {
    const result = await generateWithRetry(model, prompt, 'Weekly report');
    return result.response.text();
  } catch (err) {
    log.error(`Weekly report failed: ${err.message}`);
    return formatFallbackWeeklyReport(emails, stats);
  }
}

function fallbackAnalysis(email) {
  const subject = (email.subject || '').toLowerCase();
  const body = (email.bodyText || email.bodySnippet || '').toLowerCase();
  const combined = `${subject} ${body}`;

  const isPersonal = !/noreply|no-reply|donotreply|notifications@|newsletter|marketing|unsubscribe/i.test(combined)
    && !/^(re:|fwd:)/i.test(email.subject || '');
  const isCareer = /internship|job|career|recruitment|hiring/i.test(combined);
  const isAcademic = /semester|exam|course|professor|assignment|registration/i.test(combined);
  const isFee = /fee|payment|payable|dues/i.test(combined);
  const isDeadline = /deadline|due date|last date|submit by/i.test(combined);
  const isForm = /form|application|register|registration|upload|submit/i.test(combined);
  const isSpamRescued = email.isSpam && (isCareer || isAcademic || isFee || isDeadline || isForm);

  let category = 'informational';
  if (isCareer) category = 'career';
  else if (isAcademic) category = 'academic';
  else if (isFee) category = 'fee';
  else if (isDeadline) category = 'deadline';
  else if (isForm) category = 'form';

  const importance = isCareer || isFee || isDeadline || isForm || isSpamRescued ? 0.85 : isAcademic ? 0.7 : 0.3;
  const notifyInstant = importance >= 0.7 || isPersonal;

  return {
    category,
    subcategory: category,
    importance_score: importance,
    ai_confidence: 0.5,
    notify_instant: notifyInstant,
    is_personal: isPersonal,
    is_spam_rescued: isSpamRescued,
    is_ignored: importance < 0.3,
    summary: email.subject,
    reasoning: 'Fallback rule-based analysis',
    deadlines: isDeadline ? [{ title: email.subject, deadline_at: null, source: 'subject' }] : [],
    actions: isForm ? [{ type: 'fill_form', title: email.subject, description: null, due_date: null }] : [],
    thread_update_significant: true,
  };
}

function formatFallbackDailySummary(emails) {
  const groups = {};
  for (const e of emails) {
    const cat = e.category || 'informational';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(`• ${e.subject}`);
  }

  const emoji = { academic: '📚', career: '💼', personal: '👤', informational: 'ℹ', deadline: '⚠', fee: '💰' };
  return Object.entries(groups)
    .map(([cat, items]) => `${emoji[cat] || '📧'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n${items.join('\n')}`)
    .join('\n\n');
}

function formatFallbackWeeklyReport(emails, stats) {
  return `📊 Weekly Overview
• Emails analyzed: ${stats.emails_analyzed || emails.length}
• Notifications sent: ${stats.notifications_sent || 0}

✅ Review your inbox for pending actions.`;
}

export function shouldNotifyInstant(analysis, settings = {}) {
  const threshold = parseFloat(settings.instant_notify_threshold || config.settings.instantNotifyThreshold);

  if (analysis.notify_instant) return true;
  if (analysis.importance_score >= threshold) return true;
  if ((analysis.deadlines || []).length > 0) return true;
  if ((analysis.actions || []).some(action => ['fill_form', 'register', 'pay_fees'].includes(action.type))) return true;
  if (analysis.is_personal) return true;
  if (analysis.is_spam_rescued && analysis.importance_score >= 0.5) return true;

  const instantCategories = [
    'career', 'deadline', 'fee', 'form', 'exam', 'assignment',
    'registration', 'interview', 'scholarship', 'circular', 'academic',
  ];
  if (instantCategories.includes(analysis.category) && analysis.importance_score >= 0.5) {
    return true;
  }

  if (analysis.category === 'interview') return true;

  return false;
}
