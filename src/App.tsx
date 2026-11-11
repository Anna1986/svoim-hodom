import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import ProjectsList from './pages/ProjectsList'
import ProjectView from './pages/ProjectView'
import ProjectForm from './pages/ProjectForm'
import Placeholder from './pages/Placeholder'

const NAV = [
  { to: '/projects', label: 'Проекты', icon: '📁' },
  { to: '/tasks', label: 'Задачи', icon: '✅' },
  { to: '/contacts', label: 'Контакты', icon: '👥' },
  { to: '/dashboard', label: 'Сводка', icon: '📊' },
]

export default function App() {
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">СУП</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className="nav-item">
            <span className="nav-icon" aria-hidden>{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/new" element={<ProjectForm />} />
          <Route path="/projects/:id" element={<ProjectView />} />
          <Route path="/projects/:id/edit" element={<ProjectForm />} />
          <Route path="/tasks" element={<Placeholder title="Задачи" text="Канбан-доска и список задач появятся на следующем шаге." />} />
          <Route path="/contacts" element={<Placeholder title="Контакты" text="Здесь будут исполнители и заказчики." />} />
          <Route path="/dashboard" element={<Placeholder title="Сводка" text="Прогресс по проектам и просроченные задачи — скоро." />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </main>
    </div>
  )
}
