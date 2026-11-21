import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Spinner } from './ui/kit.jsx';
import Layout from './layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Home from './pages/Home.jsx';
import { LeadList, LeadForm, LeadDetail, Agenda } from './pages/Leads.jsx';
import { CustomerList, CustomerDetail } from './pages/Customers.jsx';
import { QuotationList, QuotationForm, QuotationView } from './pages/Quotations.jsx';
import { Targets, Expenses, Commissions, CallAnalysis } from './pages/Sales.jsx';
import { MyTasks, TaskDashboard, TeamTasks, Todo, Timeline, CalendarPage, PredefinedTasks } from './pages/Tasks.jsx';
import { CrmDashboard, Executives, Forecast, Reports, ReportView } from './pages/Insights.jsx';
import { Chat, Mail, Assistant, Attendance, Locations, Notifications } from './pages/Team.jsx';
import { ProjectList, ProjectWizard, ProjectDetail } from './pages/Projects.jsx';
import { TemplateGallery, TemplateEditor } from './pages/ProjectTemplates.jsx';
import { Masters, UsersPage, Roles, SettingsPage, ImportPage, Tokens, Billing, Audit, Support, WhatsNew, Profile } from './pages/Admin.jsx';

export default function App() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  // visitors hitting the base URL land on the marketing page (public/welcome); /login opens the sign-in form
  if (loc.pathname === '/welcome') { window.location.replace('/welcome/'); return <Spinner />; }
  if (!user && loc.pathname === '/') { window.location.replace('/welcome/'); return <Spinner />; }
  if (!user && loc.pathname === '/signup') return <Signup />;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/leads" element={<LeadList />} /><Route path="/leads/new" element={<LeadForm />} /><Route path="/leads/:id" element={<LeadDetail />} /><Route path="/leads/:id/edit" element={<LeadForm />} />
        <Route path="/followups" element={<Agenda />} />
        <Route path="/customers" element={<CustomerList />} /><Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/quotations" element={<QuotationList />} /><Route path="/quotations/new" element={<QuotationForm />} /><Route path="/quotations/:id" element={<QuotationView />} /><Route path="/quotations/:id/edit" element={<QuotationForm />} />
        <Route path="/targets" element={<Targets />} /><Route path="/expenses" element={<Expenses />} /><Route path="/commissions" element={<Commissions />} /><Route path="/call-analysis" element={<CallAnalysis />} />
        <Route path="/my-tasks" element={<MyTasks />} /><Route path="/task-dashboard" element={<TaskDashboard />} /><Route path="/team-tasks" element={<TeamTasks />} /><Route path="/todo" element={<Todo />} /><Route path="/task-timeline" element={<Timeline />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/predefined-tasks" element={<PredefinedTasks />} />
        <Route path="/dashboard" element={<CrmDashboard />} /><Route path="/executive" element={<Executives />} /><Route path="/forecast" element={<Forecast />} /><Route path="/reports" element={<Reports />} /><Route path="/reports/:name" element={<ReportView />} />
        <Route path="/projects" element={<ProjectList />} /><Route path="/projects/new" element={<ProjectWizard />} /><Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/project-templates" element={<TemplateGallery />} /><Route path="/project-templates/new" element={<TemplateEditor />} /><Route path="/project-templates/:id" element={<TemplateEditor />} />
        <Route path="/chat" element={<Chat />} /><Route path="/mail" element={<Mail />} /><Route path="/assistant" element={<Assistant />} /><Route path="/attendance" element={<Attendance />} /><Route path="/locations" element={<Locations />} /><Route path="/notifications" element={<Notifications />} />
        <Route path="/master" element={<Masters />} /><Route path="/users" element={<UsersPage />} /><Route path="/roles" element={<Roles />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/import" element={<ImportPage />} />
        <Route path="/tokens" element={<Tokens />} /><Route path="/billing" element={<Billing />} /><Route path="/audit" element={<Audit />} /><Route path="/support" element={<Support />} /><Route path="/whats-new" element={<WhatsNew />} /><Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}
