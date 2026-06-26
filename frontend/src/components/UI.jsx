const CATEGORY_COLORS = {
  academic: 'bg-blue-500/20 text-blue-300',
  career: 'bg-purple-500/20 text-purple-300',
  personal: 'bg-green-500/20 text-green-300',
  informational: 'bg-slate-500/20 text-slate-300',
  deadline: 'bg-red-500/20 text-red-300',
  fee: 'bg-amber-500/20 text-amber-300',
  form: 'bg-cyan-500/20 text-cyan-300',
  spam: 'bg-orange-500/20 text-orange-300',
  promotional: 'bg-pink-500/20 text-pink-300',
};

export function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.informational;
  return (
    <span className={`badge ${color}`}>
      {category || 'unknown'}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, color = 'text-brand-400' }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
      </div>
      <span className="text-2xl font-bold text-white">{value ?? 0}</span>
    </div>
  );
}

export function EmailCard({ email }) {
  return (
    <div className="card hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CategoryBadge category={email.category} />
            {email.notifyInstant && (
              <span className="badge bg-red-500/20 text-red-300">instant</span>
            )}
          </div>
          <h3 className="font-medium text-white truncate">{email.subject}</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            {email.fromName || email.from}
          </p>
          {email.summary && (
            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{email.summary}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">
            {email.receivedAt
              ? new Date(email.receivedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : ''}
          </p>
          {email.importanceScore != null && (
            <p className="text-xs text-slate-600 mt-1">
              Score: {(email.importanceScore * 100).toFixed(0)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && <p className="text-slate-400 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="card text-center py-12">
      <p className="text-slate-500">{message}</p>
    </div>
  );
}

export function ActionButton({ action, onComplete }) {
  const statusColors = {
    pending: 'border-amber-500/30',
    overdue: 'border-red-500/30',
    completed: 'border-green-500/30 opacity-60',
  };

  return (
    <div className={`card ${statusColors[action.status] || ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="badge bg-slate-700 text-slate-300 mb-2">
            {action.action_type?.replace(/_/g, ' ')}
          </span>
          <h3 className="font-medium text-white">{action.title}</h3>
          {action.description && (
            <p className="text-sm text-slate-400 mt-1">{action.description}</p>
          )}
          {action.subject && (
            <p className="text-xs text-slate-500 mt-2">From: {action.subject}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {action.due_date && (
            <p className="text-xs text-slate-400">
              Due: {new Date(action.due_date).toLocaleDateString()}
            </p>
          )}
          {action.status !== 'completed' && (
            <button
              onClick={() => onComplete(action.id)}
              className="btn-primary mt-2 text-xs px-3 py-1.5"
            >
              Mark Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeadlineCard({ deadline, onComplete }) {
  const isPast = new Date(deadline.deadline_at) < new Date();
  const daysLeft = Math.ceil(
    (new Date(deadline.deadline_at) - new Date()) / 86400000,
  );

  return (
    <div className={`card ${isPast ? 'border-red-500/30' : daysLeft <= 1 ? 'border-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-white">{deadline.title}</h3>
          {deadline.source && (
            <p className="text-xs text-slate-500 mt-1">Source: {deadline.source}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-medium ${isPast ? 'text-red-400' : daysLeft <= 1 ? 'text-amber-400' : 'text-slate-300'}`}>
            {new Date(deadline.deadline_at).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </p>
          {!deadline.completed_status && (
            <button
              onClick={() => onComplete(deadline.id)}
              className="btn-ghost mt-2 text-xs px-3 py-1.5"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
