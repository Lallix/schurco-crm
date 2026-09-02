import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '0.5rem 0.9rem',
  borderRadius: 8,
  textDecoration: 'none',
  color: isActive ? '#fff' : 'var(--ink)',
  background: isActive ? 'var(--green)' : 'transparent',
  fontWeight: 500,
})

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <strong style={{ color: 'var(--green)', fontSize: '13pt' }}>Schurco CRM</strong>
          <nav style={{ display: 'flex', gap: '0.25rem' }}>
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
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/team" style={navLinkStyle}>
                Team
              </NavLink>
            )}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '9pt' }}>
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
      </header>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
