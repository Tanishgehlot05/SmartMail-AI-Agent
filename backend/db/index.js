import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'smartmail.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

function runMigrations() {
  const userIdTables = [
    'emails', 'deadlines', 'pending_actions', 'notification_history',
    'daily_summaries', 'weekly_reports', 'analytics_daily',
  ];

  for (const table of userIdTables) {
    if (!columnExists(table, 'user_id')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`);
    }
  }

  if (!columnExists('gmail_sync_state', 'last_notification_at')) {
    db.exec('ALTER TABLE gmail_sync_state ADD COLUMN last_notification_at TEXT');
  }
}

runMigrations();

export default db;
