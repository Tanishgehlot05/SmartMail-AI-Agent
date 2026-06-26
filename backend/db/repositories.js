import db from './index.js';

export const userRepo = {
  findAll() {
    return db.prepare('SELECT id, name, email, telegram_chat_id, created_at FROM users ORDER BY id ASC').all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  upsertFromGoogle(profile, refreshToken = null, accessToken = null) {
    const existing = profile.email ? this.findByEmail(profile.email) : null;

    if (existing) {
      db.prepare(`
        UPDATE users SET
          name = COALESCE(?, name),
          google_id = COALESCE(?, google_id),
          refresh_token = COALESCE(?, refresh_token),
          access_token = COALESCE(?, access_token),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(profile.name || null, profile.googleId || null, refreshToken, accessToken, existing.id);
      return this.findById(existing.id);
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, google_id, refresh_token, access_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(profile.name || null, profile.email, profile.googleId || null, refreshToken, accessToken);

    userSettingsRepo.ensure(result.lastInsertRowid);
    return this.findById(result.lastInsertRowid);
  },

  updateTokens(userId, refreshToken, accessToken = null) {
    return db.prepare(`
      UPDATE users SET
        refresh_token = COALESCE(?, refresh_token),
        access_token = COALESCE(?, access_token),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(refreshToken, accessToken, userId);
  },

  updateWatch(userId, historyId, watchExpiration) {
    return db.prepare(`
      UPDATE users SET
        history_id = COALESCE(?, history_id),
        watch_expiration = COALESCE(?, watch_expiration),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(historyId || null, watchExpiration || null, userId);
  },
};

export const emailAccountRepo = {
  findByUser(userId) {
    return db.prepare(`
      SELECT id, user_id, gmail_email, google_id, history_id, watch_expiration, last_sync_at, created_at, updated_at
      FROM email_accounts
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(id);
  },

  upsert(userId, account) {
    const existing = db.prepare(`
      SELECT * FROM email_accounts WHERE user_id = ? AND gmail_email = ?
    `).get(userId, account.gmailEmail);

    if (existing) {
      db.prepare(`
        UPDATE email_accounts SET
          google_id = COALESCE(?, google_id),
          refresh_token = COALESCE(?, refresh_token),
          history_id = COALESCE(?, history_id),
          watch_expiration = COALESCE(?, watch_expiration),
          last_sync_at = COALESCE(?, last_sync_at),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        account.googleId || null,
        account.refreshToken || null,
        account.historyId || null,
        account.watchExpiration || null,
        account.lastSyncAt || null,
        existing.id,
      );
      return this.findById(existing.id);
    }

    const result = db.prepare(`
      INSERT INTO email_accounts (user_id, gmail_email, google_id, refresh_token, history_id, watch_expiration, last_sync_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      account.gmailEmail,
      account.googleId || null,
      account.refreshToken,
      account.historyId || null,
      account.watchExpiration || null,
      account.lastSyncAt || null,
    );

    return this.findById(result.lastInsertRowid);
  },

  updateWatch(accountId, historyId, watchExpiration) {
    return db.prepare(`
      UPDATE email_accounts SET
        history_id = COALESCE(?, history_id),
        watch_expiration = COALESCE(?, watch_expiration),
        last_sync_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(historyId || null, watchExpiration || null, accountId);
  },
};

export const userSettingsRepo = {
  ensure(userId) {
    return db.prepare(`
      INSERT INTO user_settings (user_id) VALUES (?)
      ON CONFLICT(user_id) DO NOTHING
    `).run(userId);
  },

  get(userId) {
    this.ensure(userId);
    return db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  },

  update(userId, updates) {
    this.ensure(userId);
    const allowed = [
      'internship_notifications',
      'academic_notifications',
      'personal_notifications',
      'placement_notifications',
      'fee_notifications',
      'mess_notifications',
      'scholarship_notifications',
      'spam_rescue',
      'general_announcements',
      'research_opportunities',
      'hostel_notices',
      'summary_time',
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        db.prepare(`UPDATE user_settings SET ${key} = ?, updated_at = datetime('now') WHERE user_id = ?`)
          .run(String(updates[key]), userId);
      }
    }

    return this.get(userId);
  },
};

export const emailRepo = {
  insert(email) {
    return db.prepare(`
      INSERT OR REPLACE INTO emails (
        id, thread_id, from_address, from_name, subject, body_snippet, body_text,
        received_at, category, subcategory, importance_score, ai_confidence,
        notify_instant, is_personal, is_spam_rescued, is_ignored, summary, raw_analysis
      ) VALUES (
        @id, @threadId, @fromAddress, @fromName, @subject, @bodySnippet, @bodyText,
        @receivedAt, @category, @subcategory, @importanceScore, @aiConfidence,
        @notifyInstant, @isPersonal, @isSpamRescued, @isIgnored, @summary, @rawAnalysis
      )
    `).run({
      id: email.id,
      threadId: email.threadId,
      fromAddress: email.fromAddress || null,
      fromName: email.fromName || null,
      subject: email.subject || null,
      bodySnippet: email.bodySnippet || null,
      bodyText: email.bodyText || null,
      receivedAt: email.receivedAt,
      category: email.category || null,
      subcategory: email.subcategory || null,
      importanceScore: email.importanceScore ?? 0,
      aiConfidence: email.aiConfidence ?? 0,
      notifyInstant: email.notifyInstant ? 1 : 0,
      isPersonal: email.isPersonal ? 1 : 0,
      isSpamRescued: email.isSpamRescued ? 1 : 0,
      isIgnored: email.isIgnored ? 1 : 0,
      summary: email.summary || null,
      rawAnalysis: email.rawAnalysis ? JSON.stringify(email.rawAnalysis) : null,
    });
  },

  findById(id) {
    return db.prepare('SELECT * FROM emails WHERE id = ?').get(id);
  },

  findByThread(threadId) {
    return db.prepare('SELECT * FROM emails WHERE thread_id = ? ORDER BY received_at DESC').all(threadId);
  },

  findRecent(hours = 24) {
    return db.prepare(`
      SELECT * FROM emails
      WHERE datetime(received_at) >= datetime('now', ?)
      ORDER BY received_at DESC
    `).all(`-${hours} hours`);
  },

  findLatest() {
    return db.prepare('SELECT * FROM emails ORDER BY received_at DESC LIMIT 1').get();
  },

  findByCategory(category, limit = 50) {
    return db.prepare(`
      SELECT * FROM emails WHERE category = ? ORDER BY received_at DESC LIMIT ?
    `).all(category, limit);
  },

  findImportant(limit = 50) {
    return db.prepare(`
      SELECT * FROM emails
      WHERE notify_instant = 1 OR importance_score >= 0.7
      ORDER BY received_at DESC LIMIT ?
    `).all(limit);
  },

  findPersonal(limit = 50) {
    return db.prepare(`
      SELECT * FROM emails WHERE is_personal = 1 ORDER BY received_at DESC LIMIT ?
    `).all(limit);
  },

  findSpamRescued(limit = 50) {
    return db.prepare(`
      SELECT * FROM emails WHERE is_spam_rescued = 1 ORDER BY received_at DESC LIMIT ?
    `).all(limit);
  },

  countAll() {
    return db.prepare('SELECT COUNT(*) as count FROM emails').get().count;
  },
};

export const deadlineRepo = {
  insert(deadline) {
    return db.prepare(`
      INSERT INTO deadlines (title, deadline_at, email_id, source)
      SELECT @title, @deadlineAt, @emailId, @source
      WHERE NOT EXISTS (
        SELECT 1 FROM deadlines
        WHERE email_id = @emailId AND title = @title AND deadline_at = @deadlineAt
      )
    `).run(deadline);
  },

  findUpcoming(days = 3) {
    return db.prepare(`
      SELECT * FROM deadlines
      WHERE completed_status = 0
        AND date(deadline_at) <= date('now', '+' || ? || ' days')
        AND date(deadline_at) >= date('now')
      ORDER BY deadline_at ASC
    `).all(days);
  },

  findAll(includeCompleted = false) {
    const sql = includeCompleted
      ? 'SELECT * FROM deadlines ORDER BY deadline_at ASC'
      : 'SELECT * FROM deadlines WHERE completed_status = 0 ORDER BY deadline_at ASC';
    return db.prepare(sql).all();
  },

  markCompleted(id) {
    return db.prepare(`
      UPDATE deadlines SET completed_status = 1 WHERE id = ?
    `).run(id);
  },

  removeExpired() {
    return db.prepare(`
      DELETE FROM deadlines
      WHERE completed_status = 0 AND date(deadline_at) < date('now')
    `).run();
  },
};

export const actionRepo = {
  insert(action) {
    return db.prepare(`
      INSERT INTO pending_actions (email_id, action_type, title, description, due_date, status)
      SELECT @emailId, @actionType, @title, @description, @dueDate, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM pending_actions
        WHERE email_id = @emailId AND action_type = @actionType AND title = @title
      )
    `).run(action);
  },

  findByStatus(status) {
    return db.prepare(`
      SELECT pa.*, e.subject, e.from_address
      FROM pending_actions pa
      LEFT JOIN emails e ON e.id = pa.email_id
      WHERE pa.status = ?
      ORDER BY pa.due_date IS NULL, pa.due_date ASC, pa.created_at DESC
    `).all(status);
  },

  findAll() {
    return db.prepare(`
      SELECT pa.*, e.subject, e.from_address
      FROM pending_actions pa
      LEFT JOIN emails e ON e.id = pa.email_id
      ORDER BY
        CASE pa.status WHEN 'pending' THEN 0 WHEN 'overdue' THEN 1 ELSE 2 END,
        pa.due_date IS NULL, pa.due_date ASC
    `).all();
  },

  markCompleted(id) {
    return db.prepare(`
      UPDATE pending_actions SET status = 'completed', completed_at = datetime('now') WHERE id = ?
    `).run(id);
  },

  updateOverdue() {
    return db.prepare(`
      UPDATE pending_actions
      SET status = 'overdue'
      WHERE status = 'pending' AND due_date IS NOT NULL AND date(due_date) < date('now')
    `).run();
  },
};

export const notificationRepo = {
  wasNotified(emailId, type) {
    return !!db.prepare(`
      SELECT 1 FROM notification_history WHERE email_id = ? AND notification_type = ?
    `).get(emailId, type);
  },

  wasThreadNotified(threadId, type) {
    return !!db.prepare(`
      SELECT 1 FROM notification_history WHERE thread_id = ? AND notification_type = ?
    `).get(threadId, type);
  },

  record(emailId, threadId, type, preview) {
    return db.prepare(`
      INSERT OR IGNORE INTO notification_history (email_id, thread_id, notification_type, message_preview)
      VALUES (?, ?, ?, ?)
    `).run(emailId, threadId, type, preview);
  },

  findRecent(limit = 100) {
    return db.prepare(`
      SELECT nh.*, e.subject, e.from_address
      FROM notification_history nh
      LEFT JOIN emails e ON e.id = nh.email_id
      ORDER BY nh.sent_at DESC LIMIT ?
    `).all(limit);
  },

  findLatest() {
    return db.prepare(`
      SELECT nh.*, e.subject, e.from_address
      FROM notification_history nh
      LEFT JOIN emails e ON e.id = nh.email_id
      ORDER BY nh.sent_at DESC LIMIT 1
    `).get();
  },

  countSent() {
    return db.prepare('SELECT COUNT(*) as count FROM notification_history').get().count;
  },
};

export const summaryRepo = {
  saveDaily(date, content, emailCount) {
    return db.prepare(`
      INSERT OR REPLACE INTO daily_summaries (summary_date, content, email_count, sent_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(date, content, emailCount);
  },

  findDaily(limit = 30) {
    return db.prepare(`
      SELECT * FROM daily_summaries ORDER BY summary_date DESC LIMIT ?
    `).all(limit);
  },

  saveWeekly(weekStart, weekEnd, content, stats) {
    return db.prepare(`
      INSERT INTO weekly_reports (week_start, week_end, content, stats, sent_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(weekStart, weekEnd, content, JSON.stringify(stats));
  },

  findWeekly(limit = 12) {
    return db.prepare(`
      SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT ?
    `).all(limit);
  },
};

export const analyticsRepo = {
  incrementToday(field, amount = 1) {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO analytics_daily (date) VALUES (?)
      ON CONFLICT(date) DO NOTHING
    `).run(today);
    db.prepare(`
      UPDATE analytics_daily SET ${field} = ${field} + ? WHERE date = ?
    `).run(amount, today);
  },

  addConfidence(score) {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`INSERT INTO analytics_daily (date) VALUES (?) ON CONFLICT(date) DO NOTHING`).run(today);
    db.prepare(`
      UPDATE analytics_daily SET confidence_sum = confidence_sum + ?, confidence_count = confidence_count + 1
      WHERE date = ?
    `).run(score, today);
  },

  trackSender(address) {
    if (!address) return;
    db.prepare(`
      INSERT INTO sender_stats (sender_address, email_count, last_seen) VALUES (?, 1, datetime('now'))
      ON CONFLICT(sender_address) DO UPDATE SET
        email_count = email_count + 1,
        last_seen = datetime('now')
    `).run(address);
  },

  trackCategory(category) {
    if (!category) return;
    db.prepare(`
      INSERT INTO category_stats (category, email_count) VALUES (?, 1)
      ON CONFLICT(category) DO UPDATE SET email_count = email_count + 1
    `).run(category);
  },

  getOverview() {
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(emails_analyzed), 0) as emails_analyzed,
        COALESCE(SUM(emails_ignored), 0) as emails_ignored,
        COALESCE(SUM(notifications_sent), 0) as notifications_sent,
        COALESCE(SUM(spam_recovered), 0) as spam_recovered,
        COALESCE(SUM(personal_detected), 0) as personal_detected,
        COALESCE(SUM(academic_emails), 0) as academic_emails,
        COALESCE(SUM(career_emails), 0) as career_emails,
        COALESCE(SUM(forms_detected), 0) as forms_detected,
        COALESCE(SUM(deadlines_detected), 0) as deadlines_detected,
        COALESCE(SUM(confidence_sum), 0) as confidence_sum,
        COALESCE(SUM(confidence_count), 0) as confidence_count
      FROM analytics_daily
    `).get();

    const topSenders = db.prepare(`
      SELECT sender_address, email_count FROM sender_stats ORDER BY email_count DESC LIMIT 10
    `).all();

    const topCategories = db.prepare(`
      SELECT category, email_count FROM category_stats ORDER BY email_count DESC LIMIT 10
    `).all();

    return {
      ...totals,
      avg_confidence: totals.confidence_count > 0
        ? (totals.confidence_sum / totals.confidence_count).toFixed(2)
        : 0,
      top_senders: topSenders,
      top_categories: topCategories,
      total_emails: emailRepo.countAll(),
      notifications_sent_total: notificationRepo.countSent(),
    };
  },

  getDailyTrend(days = 14) {
    return db.prepare(`
      SELECT * FROM analytics_daily
      WHERE date >= date('now', '-' || ? || ' days')
      ORDER BY date ASC
    `).all(days);
  },
};

export const settingsRepo = {
  get(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  },

  set(key, value) {
    return db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  },

  getAll() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
};

export const pubsubRepo = {
  wasProcessed(messageId) {
    if (!messageId) return false;
    return !!db.prepare('SELECT 1 FROM pubsub_notifications WHERE message_id = ?').get(messageId);
  },

  record(messageId, historyId, emailAddress) {
    return db.prepare(`
      INSERT OR IGNORE INTO pubsub_notifications (message_id, history_id, email_address)
      VALUES (?, ?, ?)
    `).run(messageId, historyId || null, emailAddress || null);
  },

  markProcessed(messageId) {
    return db.prepare(`
      UPDATE pubsub_notifications SET processed = 1 WHERE message_id = ?
    `).run(messageId);
  },

  findRecent(limit = 20) {
    return db.prepare(`
      SELECT id, message_id, history_id, email_address, received_at, processed
      FROM pubsub_notifications ORDER BY received_at DESC LIMIT ?
    `).all(limit);
  },

  getLastReceived() {
    return db.prepare(`
      SELECT * FROM pubsub_notifications ORDER BY received_at DESC LIMIT 1
    `).get();
  },
};

export const historyRepo = {
  wasProcessed(historyId) {
    if (!historyId) return false;
    return !!db.prepare('SELECT 1 FROM processed_history_ids WHERE history_id = ?').get(String(historyId));
  },

  markProcessed(historyId) {
    return db.prepare(`
      INSERT OR IGNORE INTO processed_history_ids (history_id) VALUES (?)
    `).run(String(historyId));
  },

  findRecent(limit = 20) {
    return db.prepare(`
      SELECT history_id, processed_at FROM processed_history_ids
      ORDER BY processed_at DESC LIMIT ?
    `).all(limit);
  },
};

export const syncRepo = {
  getState() {
    return db.prepare('SELECT * FROM gmail_sync_state WHERE id = 1').get();
  },

  saveHistoryId(historyId) {
    db.prepare(`
      INSERT INTO gmail_sync_state (id, history_id, updated_at) VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET history_id = excluded.history_id, updated_at = datetime('now')
    `).run(historyId);
  },

  saveWatchExpiry(expiry) {
    db.prepare(`
      INSERT INTO gmail_sync_state (id, watch_expiry, updated_at) VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET watch_expiry = excluded.watch_expiry, updated_at = datetime('now')
    `).run(expiry);
  },

  saveState({ historyId, watchExpiry }) {
    db.prepare(`
      INSERT INTO gmail_sync_state (id, history_id, watch_expiry, updated_at)
      VALUES (1, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        history_id = COALESCE(excluded.history_id, gmail_sync_state.history_id),
        watch_expiry = COALESCE(excluded.watch_expiry, gmail_sync_state.watch_expiry),
        updated_at = datetime('now')
    `).run(historyId || null, watchExpiry || null);
  },

  recordNotification() {
    db.prepare(`
      INSERT INTO gmail_sync_state (id, last_notification_at, updated_at)
      VALUES (1, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        last_notification_at = datetime('now'),
        updated_at = datetime('now')
    `).run();
  },
};
