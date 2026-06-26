import config from '../../config/index.js';
import { EmailProvider } from '../../core/providers/email-provider.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('gmail');
const FETCH_TIMEOUT_MS = 30000;

function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getGmailConfig() {
  const { clientId, clientSecret, refreshToken } = config.gmail;
  if (!clientId || !clientSecret || !refreshToken) {
    throw createHttpError('Missing Gmail OAuth credentials in environment', 500);
  }
  return { clientId, clientSecret, refreshToken };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function decodeBase64Url(data) {
  if (!data) return '';
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = decodeBase64Url(part.body.data);
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (part.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

function extractAttachments(payload) {
  const attachments = [];

  function walk(part) {
    if (!part) return;

    if (part.filename) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || null,
        size: part.body?.size || 0,
        attachmentId: part.body?.attachmentId || null,
      });
    }

    for (const child of part.parts || []) {
      walk(child);
    }
  }

  walk(payload);
  return attachments;
}

function parseFromAddress(fromHeader) {
  const match = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, '').trim(), address: match[2] };
  return { name: fromHeader, address: fromHeader };
}

export class GmailProvider extends EmailProvider {
  constructor() {
    super();
    this._accessToken = null;
    this._tokenExpiry = 0;
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    if (!forceRefresh && this._accessToken && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }

    const { clientId, clientSecret, refreshToken } = getGmailConfig();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw createHttpError(
        `Gmail OAuth failed: ${err.error_description || err.error || response.statusText}`,
        502,
      );
    }

    const data = await response.json();
    this._accessToken = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._accessToken;
  }

  getTokenStatus() {
    return {
      hasCachedAccessToken: Boolean(this._accessToken),
      expiresAt: this._tokenExpiry ? new Date(this._tokenExpiry).toISOString() : null,
      expiresInSeconds: this._tokenExpiry ? Math.max(0, Math.round((this._tokenExpiry - Date.now()) / 1000)) : 0,
    };
  }

  async apiRequest(url, options = {}, attempt = 1) {
    const token = await this.getAccessToken({ forceRefresh: attempt > 1 });
    let response;

    try {
      response = await fetchWithTimeout(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch (err) {
      if (attempt < 3) {
        log.warn(`Network error (attempt ${attempt}), retrying: ${err.message}`);
        await sleep(500 * attempt);
        return this.apiRequest(url, options, attempt + 1);
      }
      throw err;
    }

    if (response.status === 401 && attempt < 2) {
      this._accessToken = null;
      this._tokenExpiry = 0;
      return this.apiRequest(url, options, attempt + 1);
    }

    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
      log.warn(`Gmail API ${response.status}, retry attempt ${attempt + 1}`);
      await sleep(750 * attempt);
      return this.apiRequest(url, options, attempt + 1);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err.error?.message || err.error_description || response.statusText;
      const error = createHttpError(`Gmail API error: ${message}`, response.status);
      error.apiResponse = err;
      throw error;
    }

    return response.json();
  }

  async verifyOAuth() {
    await this.getAccessToken({ forceRefresh: true });
    const profile = await this.apiRequest('https://gmail.googleapis.com/gmail/v1/users/me/profile');
    return {
      emailAddress: profile.emailAddress,
      historyId: profile.historyId,
      messagesTotal: profile.messagesTotal,
      threadsTotal: profile.threadsTotal,
      token: this.getTokenStatus(),
    };
  }

  async fetchLatestMessage() {
    const data = await this.apiRequest(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1',
    );

    const messageId = data.messages?.[0]?.id;
    if (!messageId) return null;

    return this.fetchMessage(messageId);
  }

  async fetchMessage(messageId) {
    const data = await this.apiRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    );

    const headers = data.payload?.headers || [];
    const from = parseFromAddress(getHeader(headers, 'From'));
    const bodyText = extractBody(data.payload);
    const labelIds = data.labelIds || [];

    return {
      id: data.id,
      threadId: data.threadId,
      fromAddress: from.address,
      fromName: from.name,
      subject: getHeader(headers, 'Subject') || '(no subject)',
      bodySnippet: data.snippet || '',
      bodyText: bodyText.slice(0, 8000),
      receivedAt: new Date(parseInt(data.internalDate, 10)).toISOString(),
      labelIds,
      attachments: extractAttachments(data.payload),
      isSpam: labelIds.includes('SPAM'),
      isImportant: labelIds.includes('IMPORTANT'),
      isUnread: labelIds.includes('UNREAD'),
    };
  }

  async fetchHistorySince(startHistoryId) {
    const messageIds = new Set();
    let pageToken = null;
    let latestHistoryId = startHistoryId;

    do {
      const params = new URLSearchParams({
        startHistoryId: String(startHistoryId),
        historyTypes: 'messageAdded',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const data = await this.apiRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`,
      );

      latestHistoryId = data.historyId || latestHistoryId;

      for (const record of data.history || []) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) messageIds.add(added.message.id);
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return { messageIds: [...messageIds], historyId: latestHistoryId };
  }

  async setupPushNotifications() {
    const topic = config.gmail.pubsubTopic;
    if (!topic) throw createHttpError('GMAIL_PUBSUB_TOPIC not configured', 500);

    const data = await this.apiRequest(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      {
        method: 'POST',
        body: JSON.stringify({
          topicName: topic,
          labelIds: ['INBOX', 'SPAM', 'IMPORTANT', 'UNREAD'],
          labelFilterBehavior: 'include',
        }),
      },
    );

    return {
      historyId: data.historyId,
      expiration: data.expiration,
    };
  }

  async renewPushNotifications() {
    return this.setupPushNotifications();
  }

  async stopPushNotifications() {
    return this.apiRequest(
      'https://gmail.googleapis.com/gmail/v1/users/me/stop',
      { method: 'POST', body: '{}' },
    );
  }
}

export const gmailProvider = new GmailProvider();
