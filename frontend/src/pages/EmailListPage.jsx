import { useState, useEffect } from 'react';
import api from '../api';
import { PageHeader, EmailCard, LoadingState, EmptyState } from '../components/UI';

export default function EmailListPage({ title, description, fetchParams }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEmails(fetchParams)
      .then(d => setEmails(d.emails || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [JSON.stringify(fetchParams)]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="space-y-3">
        {emails.length > 0
          ? emails.map(e => <EmailCard key={e.id} email={e} />)
          : <EmptyState message="No emails found in this category" />}
      </div>
    </div>
  );
}
