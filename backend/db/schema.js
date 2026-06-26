export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT,
    email            TEXT NOT NULL UNIQUE,
    google_id        TEXT UNIQUE,
    refresh_token    TEXT,
    access_token     TEXT,
    history_id       TEXT,
    watch_expiration TEXT,
    telegram_chat_id TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_accounts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    gmail_email      TEXT NOT NULL,
    google_id        TEXT,
    refresh_token    TEXT NOT NULL,
    history_id       TEXT,
    watch_expiration TEXT,
    last_sync_at     TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, gmail_email),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id                    INTEGER PRIMARY KEY,
    internship_notifications   TEXT DEFAULT 'true',
    academic_notifications     TEXT DEFAULT 'true',
    personal_notifications     TEXT DEFAULT 'true',
    placement_notifications    TEXT DEFAULT 'true',
    fee_notifications          TEXT DEFAULT 'true',
    mess_notifications         TEXT DEFAULT 'true',
    scholarship_notifications  TEXT DEFAULT 'true',
    spam_rescue                TEXT DEFAULT 'true',
    general_announcements      TEXT DEFAULT 'false',
    research_opportunities     TEXT DEFAULT 'true',
    hostel_notices             TEXT DEFAULT 'true',
    summary_time               TEXT DEFAULT '21:00',
    created_at                 TEXT DEFAULT (datetime('now')),
    updated_at                 TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_accounts_gmail ON email_accounts(gmail_email);

  CREATE TABLE IF NOT EXISTS emails (
    id              TEXT PRIMARY KEY,
    thread_id       TEXT NOT NULL,
    from_address    TEXT,
    from_name       TEXT,
    subject         TEXT,
    body_snippet    TEXT,
    body_text       TEXT,
    received_at     TEXT NOT NULL,
    category        TEXT,
    subcategory     TEXT,
    importance_score REAL DEFAULT 0,
    ai_confidence   REAL DEFAULT 0,
    notify_instant  INTEGER DEFAULT 0,
    is_personal     INTEGER DEFAULT 0,
    is_spam_rescued INTEGER DEFAULT 0,
    is_ignored      INTEGER DEFAULT 0,
    summary         TEXT,
    raw_analysis    TEXT,
    processed_at    TEXT DEFAULT (datetime('now')),
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
  CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
  CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);
  CREATE INDEX IF NOT EXISTS idx_emails_notify ON emails(notify_instant);

  CREATE TABLE IF NOT EXISTS deadlines (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT NOT NULL,
    deadline_at      TEXT NOT NULL,
    email_id         TEXT,
    completed_status INTEGER DEFAULT 0,
    source           TEXT,
    reminder_sent    INTEGER DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(email_id) REFERENCES emails(id)
  );

  CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(deadline_at);
  CREATE INDEX IF NOT EXISTS idx_deadlines_completed ON deadlines(completed_status);

  CREATE TABLE IF NOT EXISTS pending_actions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id         TEXT,
    action_type      TEXT NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    due_date         TEXT,
    status           TEXT DEFAULT 'pending',
    completed_at     TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(email_id) REFERENCES emails(id)
  );

  CREATE INDEX IF NOT EXISTS idx_actions_status ON pending_actions(status);

  CREATE TABLE IF NOT EXISTS notification_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id         TEXT,
    thread_id        TEXT,
    notification_type TEXT NOT NULL,
    message_preview  TEXT,
    sent_at          TEXT DEFAULT (datetime('now')),
    UNIQUE(email_id, notification_type)
  );

  CREATE INDEX IF NOT EXISTS idx_notif_thread ON notification_history(thread_id);

  CREATE TABLE IF NOT EXISTS daily_summaries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_date TEXT NOT NULL UNIQUE,
    content     TEXT NOT NULL,
    email_count INTEGER DEFAULT 0,
    sent_at     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start   TEXT NOT NULL,
    week_end     TEXT NOT NULL,
    content      TEXT NOT NULL,
    stats        TEXT,
    sent_at      TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analytics_daily (
    date                    TEXT PRIMARY KEY,
    emails_analyzed         INTEGER DEFAULT 0,
    emails_ignored          INTEGER DEFAULT 0,
    notifications_sent      INTEGER DEFAULT 0,
    spam_recovered          INTEGER DEFAULT 0,
    personal_detected       INTEGER DEFAULT 0,
    academic_emails         INTEGER DEFAULT 0,
    career_emails           INTEGER DEFAULT 0,
    forms_detected          INTEGER DEFAULT 0,
    deadlines_detected      INTEGER DEFAULT 0,
    confidence_sum          REAL DEFAULT 0,
    confidence_count        INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sender_stats (
    sender_address TEXT PRIMARY KEY,
    email_count    INTEGER DEFAULT 0,
    last_seen      TEXT
  );

  CREATE TABLE IF NOT EXISTS category_stats (
    category    TEXT PRIMARY KEY,
    email_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gmail_sync_state (
    id                   INTEGER PRIMARY KEY CHECK (id = 1),
    history_id           TEXT,
    watch_expiry         TEXT,
    last_notification_at TEXT,
    updated_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pubsub_notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id    TEXT UNIQUE,
    history_id    TEXT,
    email_address TEXT,
    received_at   TEXT DEFAULT (datetime('now')),
    processed     INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_pubsub_history ON pubsub_notifications(history_id);

  CREATE TABLE IF NOT EXISTS processed_history_ids (
    history_id    TEXT PRIMARY KEY,
    processed_at  TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES
    ('daily_summary_time', '21:00'),
    ('weekly_summary_day', '0'),
    ('weekly_summary_time', '20:00'),
    ('deadline_reminder_time', '08:00'),
    ('instant_notify_threshold', '0.7'),
    ('notifications_enabled', 'true');
`;
