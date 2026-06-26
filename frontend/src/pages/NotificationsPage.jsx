import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, LoadingState, EmptyState } from '../components/UI';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotifications()
      .then(d => setNotifications(d.notifications || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Notification History"
        description="All Telegram notifications sent by SmartMail AI"
      />
      <div className="space-y-3">
        {notifications.length > 0
          ? notifications.map(n => (
              <div key={n.id} className="card">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="badge bg-brand-500/20 text-brand-300">
                      {n.notification_type}
                    </span>
                    <p className="text-white mt-2">{n.message_preview}</p>
                    {n.subject && (
                      <p className="text-sm text-slate-400 mt-1">
                        {n.from_address} — {n.subject}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {new Date(n.sent_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          : <EmptyState message="No notifications sent yet" />}
      </div>
    </div>
  );
}
