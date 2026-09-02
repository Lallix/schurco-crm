import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Layout from './components/Layout'
import ClientsPage from './pages/Clients/ClientsPage'
import ContactsPage from './pages/Contacts/ContactsPage'
import OpportunitiesPage from './pages/Opportunities/OpportunitiesPage'
import ContractsPage from './pages/Contracts/ContractsPage'
import ActivitiesPage from './pages/Activities/ActivitiesPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <p style={{ padding: '2rem', color: 'var(--muted)' }}>Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/" element={<Navigate to="/clients" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
