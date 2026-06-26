import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Mail, User, Briefcase, GraduationCap,
  Clock, CheckSquare, Bell, FileText, Calendar, Shield,
  Settings, BarChart3, MailOpen,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/important', icon: Mail, label: 'Important Emails' },
  { to: '/personal', icon: User, label: 'Personal Emails' },
  { to: '/internships', icon: Briefcase, label: 'Internships' },
  { to: '/academic', icon: GraduationCap, label: 'Academic Notices' },
  { to: '/deadlines', icon: Clock, label: 'Upcoming Deadlines' },
  { to: '/actions', icon: CheckSquare, label: 'Pending Actions' },
  { to: '/notifications', icon: Bell, label: 'Notification History' },
  { to: '/daily-summaries', icon: FileText, label: 'Daily Summaries' },
  { to: '/weekly-reports', icon: Calendar, label: 'Weekly Reports' },
  { to: '/spam-recovery', icon: Shield, label: 'Spam Recovery' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
              <MailOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">SmartMail</h1>
              <p className="text-xs text-slate-500">AI Agent</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link-active' : 'nav-link-inactive'
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 ml-64">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
