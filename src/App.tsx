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
import { AccountBadge, Avatar } from './components/Account'
import { useSyncState } from './sync'
import { IconDoc, IconSuitcase, IconUser } from './components/icons'

const NAV = [
  { to: '/trips', match: ['/trips', '/items'], label: 'Поездки', Icon: IconSuitcase },
  { to: '/docs', match: ['/docs'], label: 'Документы', Icon: IconDoc },
]

export default function App() {
  const { pathname } = useLocation()
  const sync = useSyncState()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand"><IconSuitcase size={26} /> Путешествия</div>
        <NavLink to="/settings" className="nav-account">
          {sync.user ? <AccountBadge /> : <span className="nav-login"><Avatar size={36} /> Войти в кабинет</span>}
        </NavLink>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={() => `nav-item ${n.match.some((m) => pathname.startsWith(m)) ? 'active' : ''}`}
          >
            <span className="nav-icon" aria-hidden><n.Icon size={26} /></span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={() => `nav-item nav-profile ${pathname.startsWith('/settings') ? 'active' : ''}`}
        >
          <span className="nav-icon" aria-hidden>{sync.user ? <Avatar size={26} /> : <IconUser size={26} />}</span>
          <span className="nav-label">{sync.user ? 'Профиль' : 'Войти'}</span>
        </NavLink>
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
