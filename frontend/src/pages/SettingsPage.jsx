import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, LoadingState } from '../components/UI';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [syncState, setSyncState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getSettings()
      .then(d => {
        setSettings(d.settings || {});
        setSyncState(d.syncState);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await api.updateSettings(settings);
      setSettings(result.settings);
      setMessage('Settings saved successfully');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSetupWatch = async () => {
    setMessage('');
    try {
      const result = await api.setupGmailWatch();
      setSyncState({ history_id: result.result.historyId });
      setMessage('Gmail push notifications enabled');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure notification schedules and preferences"
      />

      {message && (
        <div className={`card mb-6 text-sm ${message.startsWith('Error') ? 'border-red-500/30 text-red-300' : 'border-green-500/30 text-green-300'}`}>
          {message}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Notification Schedule</h3>

          <label className="block">
            <span className="text-sm text-slate-400">Daily Summary Time</span>
            <input
              type="time"
              value={settings.daily_summary_time || '21:00'}
              onChange={e => handleChange('daily_summary_time', e.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Weekly Summary Time</span>
            <input
              type="time"
              value={settings.weekly_summary_time || '20:00'}
              onChange={e => handleChange('weekly_summary_time', e.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Deadline Reminder Time</span>
            <input
              type="time"
              value={settings.deadline_reminder_time || '08:00'}
              onChange={e => handleChange('deadline_reminder_time', e.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Instant Notify Threshold (0-1)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={settings.instant_notify_threshold || '0.7'}
              onChange={e => handleChange('instant_notify_threshold', e.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.notifications_enabled !== 'false'}
              onChange={e => handleChange('notifications_enabled', e.target.checked ? 'true' : 'false')}
              className="rounded bg-slate-800 border-slate-700"
            />
            <span className="text-sm text-slate-300">Enable notifications</span>
          </label>

          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Gmail Push Notifications</h3>
          <p className="text-sm text-slate-400">
            Real-time email processing via Google Cloud Pub/Sub. Requires GMAIL_PUBSUB_TOPIC configured.
          </p>

          <div className="bg-slate-800/50 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">History ID</span>
              <span className="text-slate-300 font-mono text-xs">
                {syncState?.history_id || 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Watch Expiry</span>
              <span className="text-slate-300 text-xs">
                {syncState?.watch_expiry
                  ? new Date(syncState.watch_expiry).toLocaleString()
                  : 'Not active'}
              </span>
            </div>
          </div>

          <button onClick={handleSetupWatch} className="btn-primary">
            Enable Gmail Push
          </button>
        </div>
      </div>
    </div>
  );
}
