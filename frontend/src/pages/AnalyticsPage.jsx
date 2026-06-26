import { useState, useEffect } from 'react';
import {
  Mail, Bell, Shield, User, GraduationCap, Briefcase,
  FileText, Clock, TrendingUp,
} from 'lucide-react';
import api from '../api';
import { PageHeader, StatCard, LoadingState } from '../components/UI';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.getTrend(14)])
      .then(([a, t]) => {
        setAnalytics(a.analytics);
        setTrend(t.trend || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const a = analytics || {};

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Email intelligence metrics and trends"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Emails Analyzed" value={a.emails_analyzed} icon={Mail} />
        <StatCard label="Emails Ignored" value={a.emails_ignored} icon={Mail} color="text-slate-400" />
        <StatCard label="Notifications Sent" value={a.notifications_sent} icon={Bell} color="text-green-400" />
        <StatCard label="Spam Recovered" value={a.spam_recovered} icon={Shield} color="text-orange-400" />
        <StatCard label="Personal Detected" value={a.personal_detected} icon={User} color="text-green-400" />
        <StatCard label="Academic Emails" value={a.academic_emails} icon={GraduationCap} color="text-blue-400" />
        <StatCard label="Career Emails" value={a.career_emails} icon={Briefcase} color="text-purple-400" />
        <StatCard label="Forms Detected" value={a.forms_detected} icon={FileText} color="text-cyan-400" />
        <StatCard label="Deadlines Detected" value={a.deadlines_detected} icon={Clock} color="text-red-400" />
        <StatCard label="Avg AI Confidence" value={`${a.avg_confidence || 0}%`} icon={TrendingUp} color="text-brand-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Top Email Senders</h3>
          {a.top_senders?.length > 0 ? (
            <div className="space-y-2">
              {a.top_senders.map(s => (
                <div key={s.sender_address} className="flex justify-between text-sm">
                  <span className="text-slate-300 truncate">{s.sender_address}</span>
                  <span className="text-slate-500 shrink-0 ml-2">{s.email_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No sender data yet</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-white mb-4">Most Common Categories</h3>
          {a.top_categories?.length > 0 ? (
            <div className="space-y-2">
              {a.top_categories.map(c => (
                <div key={c.category} className="flex justify-between text-sm">
                  <span className="text-slate-300 capitalize">{c.category}</span>
                  <span className="text-slate-500">{c.email_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No category data yet</p>
          )}
        </div>
      </div>

      {trend.length > 0 && (
        <div className="card mt-6">
          <h3 className="font-semibold text-white mb-4">14-Day Trend</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">Analyzed</th>
                  <th className="text-right py-2">Notifications</th>
                  <th className="text-right py-2">Ignored</th>
                </tr>
              </thead>
              <tbody>
                {trend.map(row => (
                  <tr key={row.date} className="border-b border-slate-800/50">
                    <td className="py-2 text-slate-300">{row.date}</td>
                    <td className="py-2 text-right text-slate-400">{row.emails_analyzed}</td>
                    <td className="py-2 text-right text-slate-400">{row.notifications_sent}</td>
                    <td className="py-2 text-right text-slate-400">{row.emails_ignored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
