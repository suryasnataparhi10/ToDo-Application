import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes } from 'react-router-dom';
import Auth from './components/Auth';
import Layout from './layout/Layout';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import Budgets from './pages/Budgets';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import ScheduledMessages from './pages/ScheduledMessages';

export default function App() {
  const theme = useSelector((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.bsTheme = theme;
  }, [theme]);

  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route path="/forgot-password" element={<Auth mode="forgot" />} />
      <Route path="/reset-password/:token" element={<Auth mode="reset" />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/income" element={<Income />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/messages" element={<ScheduledMessages />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
