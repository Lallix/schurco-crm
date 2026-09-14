import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import GlobalSearch from './GlobalSearch'

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '0.5rem 0.9rem',
  borderRadius: 8,
  textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--ink)',
  background: isActive ? 'var(--green)' : 'transparent',
  fontWeight: 500,
})

const DUE_TASK_REFRESH_MS = 5 * 60 * 1000

export default function Layout() {
  const { profile, isAdmin, session, signOut } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function loadDueCount() {
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', session!.user.id)
        .eq('status', 'Open')
        .lte('due_date', today)
        .is('deleted_at', null)
      if (!cancelled) setDueCount(count ?? 0)
    }

    loadDueCount()
    const interval = setInterval(loadDueCount, DUE_TASK_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [session])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header className="app-header">
        <div className="app-header-top">
          <button
            className="hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? '×' : '☰'}
          </button>
          <strong className="brand">Schurco CRM</strong>
          <GlobalSearch />
          <div className="user-box">
            <span className="user-name" style={{ color: 'var(--muted)', fontSize: '9pt' }}>
              {profile?.name ?? profile?.email ?? '…'}
              {profile?.crm_role ? ` · ${profile.crm_role}` : ''}
            </span>
            <button
              onClick={() => signOut()}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className={`app-nav ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" end style={navLinkStyle}>
            Dashboard
          </NavLink>
          <NavLink to="/clients" style={navLinkStyle}>
            Clients
          </NavLink>
          <NavLink to="/contacts" style={navLinkStyle}>
            Contacts
          </NavLink>
          <NavLink to="/opportunities" style={navLinkStyle}>
            Opportunities
          </NavLink>
          <NavLink to="/contracts" style={navLinkStyle}>
            Contracts
          </NavLink>
          <NavLink to="/activities" style={navLinkStyle}>
            Activities
            {dueCount > 0 && <span className="nav-badge">{dueCount}</span>}
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/team" style={navLinkStyle}>
              Team
            </NavLink>
          )}
        </nav>
      </header>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
