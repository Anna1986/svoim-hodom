import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, statusLabel } from '../db'
import { deadlineHint, formatDate } from '../format'

export default function ProjectView() {
  const { id } = useParams()
  const navigate = useNavigate()
  // undefined — ещё грузится, null — не найден
  const project = useLiveQuery(async () => (await db.projects.get(id!)) ?? null, [id])

  if (project === undefined) return null
  if (project === null) {
    return (
      <div className="empty">
        <p>Проект не найден.</p>
        <Link to="/projects" className="btn">К списку проектов</Link>
      </div>
    )
  }

  const hint = project.status !== 'done' ? deadlineHint(project.dueDate) : null

  async function remove() {
    if (!window.confirm(`Удалить проект «${project!.name}»? Это действие нельзя отменить.`)) return
    await db.projects.delete(project!.id)
    navigate('/projects', { replace: true })
  }

  return (
    <>
      <header className="page-header">
        <Link to="/projects" className="back">← Проекты</Link>
        <div className="title-row">
          <h1>{project.name}</h1>
          <span className={`badge badge-${project.status}`}>{statusLabel(project.status)}</span>
        </div>
      </header>

      <dl className="details">
        {project.client && (<><dt>Заказчик</dt><dd>{project.client}</dd></>)}
        {project.startDate && (<><dt>Начало</dt><dd>{formatDate(project.startDate)}</dd></>)}
        {project.dueDate && (
          <>
            <dt>Срок</dt>
            <dd>
              {formatDate(project.dueDate)}
              {hint && <span className={`hint hint-${hint.tone}`}> · {hint.text}</span>}
            </dd>
          </>
        )}
      </dl>

      {project.description && <p className="description">{project.description}</p>}

      <section className="section">
        <h2>Задачи</h2>
        <p className="muted">Задачи проекта появятся на следующем шаге.</p>
      </section>

      <div className="form-actions">
        <Link to={`/projects/${project.id}/edit`} className="btn btn-primary">Редактировать</Link>
        <button className="btn btn-danger" onClick={remove}>Удалить</button>
      </div>
    </>
  )
}
