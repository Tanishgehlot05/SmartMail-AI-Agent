import { userRepo, emailAccountRepo } from '../db/repositories.js';
import config from '../config/index.js';

/**
 * Multi-user context for future SaaS auth.
 * Today: single default user from env-backed Gmail account.
 * Later: resolve from session/JWT without changing pipeline code.
 */
let defaultUserId = null;

export function getDefaultUserId() {
  return defaultUserId;
}

export function ensureDefaultUser() {
  if (defaultUserId) return defaultUserId;

  const email = config.defaultUser?.email;
  if (email) {
    let user = userRepo.findByEmail(email);
    if (!user) {
      user = userRepo.upsertFromGoogle({ name: 'Default User', email });
    }
    defaultUserId = user.id;
    return defaultUserId;
  }

  const users = userRepo.findAll?.() || [];
  if (users.length > 0) {
    defaultUserId = users[0].id;
    return defaultUserId;
  }

  return null;
}

export function syncDefaultUserFromOAuth(oauth) {
  if (!oauth?.emailAddress) return null;

  const user = userRepo.upsertFromGoogle(
    { name: 'Default User', email: oauth.emailAddress },
    config.gmail.refreshToken,
  );
  defaultUserId = user.id;

  emailAccountRepo.upsert(user.id, {
    gmailEmail: oauth.emailAddress,
    refreshToken: config.gmail.refreshToken,
  });

  return user.id;
}

export function getActiveMonitoredAccounts() {
  const userId = ensureDefaultUser();
  if (!userId) {
    return [{
      source: 'env',
      gmailEmail: config.defaultUser?.email || 'from-env-credentials',
      configured: Boolean(config.gmail.clientId && config.gmail.refreshToken),
    }];
  }

  const accounts = emailAccountRepo.findByUser(userId);
  if (accounts.length === 0) {
    return [{
      source: 'env',
      userId,
      gmailEmail: config.defaultUser?.email || 'from-env-credentials',
      configured: Boolean(config.gmail.clientId && config.gmail.refreshToken),
    }];
  }

  return accounts.map(a => ({
    source: 'database',
    userId,
    accountId: a.id,
    gmailEmail: a.gmail_email,
    historyId: a.history_id,
    watchExpiration: a.watch_expiration,
    lastSyncAt: a.last_sync_at,
  }));
}
