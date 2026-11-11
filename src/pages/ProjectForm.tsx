import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { db, newId, PROJECT_STATUSES, type Project } from '../db'
import { todayISO } from '../format'

type Draft = Pick<Project, 'name' | 'description' | 'client' | 'status' | 'startDate' | 'dueDate'>

const EMPTY: Draft = {
  name: '',
  description: '',
  client: '',
  status: 'planned',
  startDate: todayISO(),
  dueDate: '',
}

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loaded, setLoaded] = useState(!isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    db.projects.get(id).then((p) => {
      if (!p) return navigate('/projects', { replace: true })
      const { name, description, client, status, startDate, dueDate } = p
      setDraft({ name, description, client, status, startDate, dueDate })
      setLoaded(true)
    })
  }, [id, navigate])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return setError('Введите название проекта')
    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate)
      return setError('Срок окончания не может быть раньше даты начала')

    const now = Date.now()
    const clean = { ...draft, name, client: draft.client.trim(), description: draft.description.trim() }
    if (id) {
      await db.projects.update(id, { ...clean, updatedAt: now })
      navigate(`/projects/${id}`, { replace: true })
    } else {
      const newProjectId = newId()
      await db.projects.add({ id: newProjectId, ...clean, createdAt: now, updatedAt: now })
      navigate(`/projects/${newProjectId}`, { replace: true })
    }
  }

  if (!loaded) return null

  return (
    <>
      <header className="page-header">
        <Link to={id ? `/projects/${id}` : '/projects'} className="back">← Назад</Link>
        <h1>{isEdit ? 'Редактировать проект' : 'Новый проект'}</h1>
      </header>

      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Название *</span>
          <input
            value={draft.name}
            onChange={(e) => { set('name', e.target.value); setError('') }}
            placeholder="Например, Запуск сайта для клиента"
            autoFocus={!isEdit}
          />
        </label>

        <label className="field">
          <span>Заказчик</span>
          <input value={draft.client} onChange={(e) => set('client', e.target.value)} placeholder="Компания или человек" />
        </label>

        <label className="field">
          <span>Статус</span>
          <select value={draft.status} onChange={(e) => set('status', e.target.value as Draft['status'])}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span>Начало</span>
            <input type="date" value={draft.startDate} onChange={(e) => { set('startDate', e.target.value); setError('') }} />
          </label>
          <label className="field">
            <span>Срок окончания</span>
            <input type="date" value={draft.dueDate} onChange={(e) => { set('dueDate', e.target.value); setError('') }} />
          </label>
        </div>

        <label className="field">
          <span>Описание</span>
          <textarea
            rows={5}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Цели, результат, важные договорённости"
          />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{isEdit ? 'Сохранить' : 'Создать проект'}</button>
          <Link to={id ? `/projects/${id}` : '/projects'} className="btn">Отмена</Link>
        </div>
      </form>
    </>
  )
}
