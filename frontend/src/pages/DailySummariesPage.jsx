import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, LoadingState, EmptyState } from '../components/UI';

function SummaryContent({ content }) {
  return (
    <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed">
      {content}
    </pre>
  );
}

export default function DailySummariesPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = () => {
    setLoading(true);
    api.getDailySummaries()
      .then(d => setSummaries(d.summaries || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.triggerDailySummary();
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
        title="Daily Summaries"
        description="AI-generated nightly email summaries (9:00 PM)"
        action={
          <button onClick={handleTrigger} disabled={triggering} className="btn-primary">
            {triggering ? 'Generating...' : 'Generate Now'}
          </button>
        }
      />
      <div className="space-y-4">
        {summaries.length > 0
          ? summaries.map(s => (
              <div key={s.id} className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">
                    {s.summary_date}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {s.email_count} emails
                  </span>
                </div>
                <SummaryContent content={s.content} />
              </div>
            ))
          : <EmptyState message="No daily summaries yet. They are generated every night at 9 PM." />}
      </div>
    </div>
  );
}
