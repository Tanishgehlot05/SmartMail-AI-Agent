import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, LoadingState, EmptyState } from '../components/UI';

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = () => {
    setLoading(true);
    api.getWeeklyReports()
      .then(d => setReports(d.reports || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.triggerWeeklySummary();
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Weekly Reports"
        description="AI weekly overview generated every Sunday at 8 PM"
        action={
          <button onClick={handleTrigger} disabled={triggering} className="btn-primary">
            {triggering ? 'Generating...' : 'Generate Now'}
          </button>
        }
      />
      <div className="space-y-4">
        {reports.length > 0
          ? reports.map(r => (
              <div key={r.id} className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">
                    {r.week_start} — {r.week_end}
                  </h3>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed">
                  {r.content}
                </pre>
              </div>
            ))
          : <EmptyState message="No weekly reports yet. Generated every Sunday at 8 PM." />}
      </div>
    </div>
  );
}
