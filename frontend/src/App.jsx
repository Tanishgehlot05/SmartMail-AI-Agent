import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EmailListPage from './pages/EmailListPage';
import DeadlinesPage from './pages/DeadlinesPage';
import ActionsPage from './pages/ActionsPage';
import NotificationsPage from './pages/NotificationsPage';
import DailySummariesPage from './pages/DailySummariesPage';
import WeeklyReportsPage from './pages/WeeklyReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="important" element={
          <EmailListPage
            title="Important Emails"
            description="Emails flagged for instant notification or high importance"
            fetchParams={{ type: 'important' }}
          />
        } />
        <Route path="personal" element={
          <EmailListPage
            title="Personal Emails"
            description="Human-written personal messages"
            fetchParams={{ type: 'personal' }}
          />
        } />
        <Route path="internships" element={
          <EmailListPage
            title="Internships & Career"
            description="Career opportunities, internships, and job alerts"
            fetchParams={{ category: 'career' }}
          />
        } />
        <Route path="academic" element={
          <EmailListPage
            title="Academic Notices"
            description="University notices, exams, registrations, and academic updates"
            fetchParams={{ category: 'academic' }}
          />
        } />
        <Route path="deadlines" element={<DeadlinesPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="daily-summaries" element={<DailySummariesPage />} />
        <Route path="weekly-reports" element={<WeeklyReportsPage />} />
        <Route path="spam-recovery" element={
          <EmailListPage
            title="Spam Recovery"
            description="Important emails rescued from spam filters"
            fetchParams={{ type: 'spam-rescued' }}
          />
        } />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
