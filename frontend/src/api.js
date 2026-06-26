const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  getDashboard: () => request('/analytics/dashboard'),
  getAnalytics: () => request('/analytics'),
  getTrend: (days = 14) => request(`/analytics/trend?days=${days}`),

  getEmails: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/emails?${qs}`);
  },

  getDeadlines: (upcoming) =>
    request(upcoming ? '/deadlines/upcoming' : '/deadlines'),

  completeDeadline: (id) =>
    request(`/deadlines/${id}/complete`, { method: 'PATCH' }),

  getActions: (status) => {
    const qs = status ? `?status=${status}` : '';
    return request(`/actions${qs}`);
  },

  completeAction: (id) =>
    request(`/actions/${id}/complete`, { method: 'PATCH' }),

  getDailySummaries: () => request('/summaries/daily'),
  getWeeklyReports: () => request('/summaries/weekly'),
  triggerDailySummary: () => request('/summaries/daily/trigger', { method: 'POST' }),
  triggerWeeklySummary: () => request('/summaries/weekly/trigger', { method: 'POST' }),

  getNotifications: () => request('/notifications'),
  getSettings: () => request('/settings'),
  updateSettings: (settings) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  setupGmailWatch: () =>
    request('/settings/gmail/watch', { method: 'POST' }),
};

export default api;
