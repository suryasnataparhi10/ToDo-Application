import { useEffect, useState } from 'react';
import { Navigate, NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadMe, logout, toggleTheme, clearMsg } from '../state/store';
export default function Layout() {
  const d = useDispatch(),
    { user, token } = useSelector((s) => s.auth),
    theme = useSelector((s) => s.theme),
    msg = useSelector((s) => s.ui.msg),
    [open, setOpen] = useState(false),
    [globalSearch, setGlobalSearch] = useState(''),
    navigate = useNavigate();
  useEffect(() => {
    document.documentElement.dataset.bsTheme = theme;
  }, [theme]);
  useEffect(() => {
    if (token) d(loadMe());
  }, [token]);
  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => d(clearMsg()), 3000);
      return () => clearTimeout(t);
    }
  }, [msg]);
  if (!token) return <Navigate to="/login" />;
  const submitSearch = (event) => {
    event.preventDefault();
    const term = globalSearch.trim();
    navigate(term ? `/expenses?search=${encodeURIComponent(term)}` : '/expenses');
    setOpen(false);
  };
  return (
    <div className="app-shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <Link className="brand" to="/dashboard">
          <span className="brand-mark">
            <i className="bi bi-wallet2" />
          </span>
          pocketwise
        </Link>
        <div className="nav-caption">YOUR SPACE</div>
        <NavLink to="/dashboard" onClick={() => setOpen(false)}>
          <i className="bi bi-grid-1x2" />
          Overview
        </NavLink>
        <NavLink to="/expenses" onClick={() => setOpen(false)}>
          <i className="bi bi-receipt" />
          Expenses
        </NavLink>
        <NavLink to="/income" onClick={() => setOpen(false)}>
          <i className="bi bi-cash-stack" />
          Income
        </NavLink>
        <div className="nav-caption nav-caption-spaced">PLAN AHEAD</div>
        <NavLink to="/budgets" onClick={() => setOpen(false)}>
          <i className="bi bi-speedometer2" />
          Budgets
        </NavLink>
        <NavLink to="/reminders" onClick={() => setOpen(false)}>
          <i className="bi bi-calendar2-check" />
          Reminders
        </NavLink>
        <NavLink to="/messages" onClick={() => setOpen(false)}>
          <span className="scheduled-nav-icon" aria-hidden="true">
            <i className="bi bi-send-fill" />
            <i className="bi bi-clock-fill" />
          </span>
          Scheduled messages
        </NavLink>
        <NavLink to="/reports" onClick={() => setOpen(false)}>
          <i className="bi bi-graph-up-arrow" />
          Reports
        </NavLink>
        <div className="side-bottom">
          <div className="side-profile">
            <div className="avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
            <div className="profile-copy">
              <b>{user?.name || 'Your account'}</b>
              <small>{user?.email}</small>
            </div>
          </div>
          <button className="side-action" onClick={() => d(toggleTheme())}>
            <i className={'bi bi-' + (theme === 'dark' ? 'sun' : 'moon-stars')} />
            {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
          </button>
          <button className="side-action logout" onClick={() => d(logout())}>
            <i className="bi bi-box-arrow-left" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(!open)}>
            <i className="bi bi-list" />
          </button>
          <div className="topbar-label">PERSONAL FINANCE</div>
          <form className="global-search" onSubmit={submitSearch} role="search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              aria-label="Search all expenses"
              placeholder="Search all expenses..."
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          <div className="topbar-date">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      {open && (
        <button aria-label="Close menu" className="nav-scrim" onClick={() => setOpen(false)} />
      )}
      {msg && <div className="toast show position-fixed bottom-0 end-0 m-3 p-3 shadow">{msg}</div>}
    </div>
  );
}
