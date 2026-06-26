import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, ActionButton, LoadingState, EmptyState } from '../components/UI';

const TABS = [
  { key: null, label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
];

export default function ActionsPage() {
  const [actions, setActions] = useState([]);
  const [tab, setTab] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = (status) => {
    setLoading(true);
    api.getActions(status)
      .then(d => setActions(d.actions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]);

  const handleComplete = async (id) => {
    await api.completeAction(id);
    load(tab);
  };

  return (
    <div>
      <PageHeader
        title="Pending Actions"
        description="Action Center — tasks extracted from your emails"
      />

      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.key ?? 'all'}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : (
        <div className="space-y-3">
          {actions.length > 0
            ? actions.map(a => (
                <ActionButton key={a.id} action={a} onComplete={handleComplete} />
              ))
            : <EmptyState message="No actions in this category" />}
        </div>
      )}
    </div>
  );
}
