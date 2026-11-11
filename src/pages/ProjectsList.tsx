import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, PROJECT_STATUSES, statusLabel, type ProjectStatus } from '../db'
import { deadlineHint, formatDate } from '../format'

type Filter = 'all' | ProjectStatus

export default function ProjectsList() {
  const [filter, setFilter] = useState<Filter>('all')
  const projects = useLiveQuery(() => db.projects.toArray(), [])

  if (!projects) return null

  const visible = projects
    .filter((p) => filter === 'all' || p.status === filter)
    .sort((a, b) => {
      // завершённые — в конец, остальные — по ближайшему сроку
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return b.updatedAt - a.updatedAt
    })

  const count = (s: Filter) => (s === 'all' ? projects.length : projects.filter((p) => p.status === s).length)

  return (
    <>
      <header className="page-header">
        <h1>Проекты</h1>
        <Link to="/projects/new" className="btn btn-primary hide-mobile">+ Новый проект</Link>
      </header>

      {projects.length > 0 && (
        <div className="chips" role="tablist">
          {[{ value: 'all' as Filter, label: 'Все' }, ...PROJECT_STATUSES].map((s) => (
            <button
              key={s.value}
              className={`chip ${filter === s.value ? 'chip-active' : ''}`}
              onClick={() => setFilter(s.value)}
            >
              {s.label} <span className="chip-count">{count(s.value)}</span>
            </button>
          ))}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📁</div>
          <p>Пока нет ни одного проекта.</p>
          <Link to="/projects/new" className="btn btn-primary">Создать первый проект</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty"><p>В этом статусе проектов нет.</p></div>
      ) : (
        <ul className="cards">
          {visible.map((p) => {
            const hint = p.status !== 'done' ? deadlineHint(p.dueDate) : null
            return (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="card">
                  <div className="card-top">
                    <span className="card-title">{p.name}</span>
                    <span className={`badge badge-${p.status}`}>{statusLabel(p.status)}</span>
                  </div>
                  {p.client && <div className="card-sub">{p.client}</div>}
                  {p.dueDate && (
                    <div className="card-meta">
                      Срок: {formatDate(p.dueDate)}
                      {hint && <span className={`hint hint-${hint.tone}`}> · {hint.text}</span>}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Link to="/projects/new" className="fab show-mobile" aria-label="Новый проект">+</Link>
    </>
  )
}
