import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, DeadlineCard, LoadingState, EmptyState } from '../components/UI';

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDeadlines(true)
      .then(d => setDeadlines(d.deadlines || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleComplete = async (id) => {
    await api.completeDeadline(id);
    setDeadlines(prev => prev.filter(d => d.id !== id));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Upcoming Deadlines"
        description="Track and manage all extracted deadlines"
      />
      <div className="space-y-3">
        {deadlines.length > 0
          ? deadlines.map(d => (
              <DeadlineCard key={d.id} deadline={d} onComplete={handleComplete} />
            ))
          : <EmptyState message="No upcoming deadlines" />}
      </div>
    </div>
  );
}
