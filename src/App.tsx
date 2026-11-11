import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import TripsList from './pages/TripsList'
import TripForm from './pages/TripForm'
import TripView from './pages/TripView'
import AddItem from './pages/AddItem'
import ItemForm from './pages/ItemForm'
import ItemView from './pages/ItemView'
import { DocForm, DocsList, DocView } from './pages/Docs'
import Settings from './pages/Settings'

const NAV = [
  { to: '/trips', match: ['/trips', '/items'], label: 'Поездки', icon: '🧳' },
  { to: '/docs', match: ['/docs'], label: 'Документы', icon: '🛂' },
  { to: '/settings', match: ['/settings'], label: 'Настройки', icon: '⚙️' },
]

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">🧳 Путешествия</div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={() => `nav-item ${n.match.some((m) => pathname.startsWith(m)) ? 'active' : ''}`}
          >
            <span className="nav-icon" aria-hidden>{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsList />} />
          <Route path="/trips/new" element={<TripForm />} />
          <Route path="/trips/:id" element={<TripView />} />
          <Route path="/trips/:id/edit" element={<TripForm />} />
          <Route path="/trips/:id/add" element={<AddItem />} />
          <Route path="/trips/:id/items/new" element={<ItemForm />} />
          <Route path="/items/:itemId" element={<ItemView />} />
          <Route path="/items/:itemId/edit" element={<ItemForm />} />
          <Route path="/docs" element={<DocsList />} />
          <Route path="/docs/new" element={<DocForm />} />
          <Route path="/docs/:id" element={<DocView />} />
          <Route path="/docs/:id/edit" element={<DocForm />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/trips" replace />} />
        </Routes>
      </main>
    </div>
  )
}
