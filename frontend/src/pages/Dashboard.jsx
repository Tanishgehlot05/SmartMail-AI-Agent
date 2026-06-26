import { useState, useEffect } from 'react';
import { Mail, Bell, Shield, GraduationCap, Briefcase, TrendingUp } from 'lucide-react';
import api from '../api';
import { PageHeader, StatCard, EmailCard, LoadingState } from '../components/UI';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const a = data?.analytics || {};

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your AI-powered email intelligence at a glance"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Emails Analyzed" value={a.emails_analyzed} icon={Mail} />
        <StatCard label="Notifications Sent" value={a.notifications_sent_total} icon={Bell} color="text-green-400" />
        <StatCard label="Spam Rescued" value={a.spam_recovered} icon={Shield} color="text-orange-400" />
        <StatCard label="Academic" value={a.academic_emails} icon={GraduationCap} color="text-blue-400" />
        <StatCard label="Career" value={a.career_emails} icon={Briefcase} color="text-purple-400" />
        <StatCard label="Avg Confidence" value={`${a.avg_confidence || 0}%`} icon={TrendingUp} color="text-cyan-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Emails (24h)</h2>
          <div className="space-y-3">
            {data?.recentEmails?.length > 0
              ? data.recentEmails.map(e => (
                  <EmailCard key={e.id} email={e} />
                ))
              : <p className="text-slate-500 text-sm">No emails in the last 24 hours</p>}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Notifications</h2>
          <div className="space-y-3">
            {data?.recentNotifications?.length > 0
              ? data.recentNotifications.map(n => (
                  <div key={n.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="badge bg-brand-500/20 text-brand-300">
                          {n.notification_type}
                        </span>
                        <p className="text-sm text-white mt-2">{n.message_preview}</p>
                        {n.subject && (
                          <p className="text-xs text-slate-500 mt-1">{n.subject}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(n.sent_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              : <p className="text-slate-500 text-sm">No notifications yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
