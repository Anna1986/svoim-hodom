import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, newId, type Trip } from '../db'
import { PageHeader } from '../components/ui'
import { autoCoverKey, COVERS } from '../covers'

type Draft = Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate' | 'notes'> & { cover: string }
const EMPTY: Draft = { title: '', destination: '', startDate: '', endDate: '', notes: '', cover: '' }

export default function TripForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loaded, setLoaded] = useState(!id)
  const [error, setError] = useState('')
  const [newTripId] = useState(() => newId())

  useEffect(() => {
    if (!id) return
    db.trips.get(id).then((t) => {
      if (!t) return navigate('/trips', { replace: true })
      setDraft({ title: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate, notes: t.notes, cover: t.cover ?? '' })
      setLoaded(true)
    })
  }, [id, navigate])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setError('') }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const title = draft.title.trim() || draft.destination.trim()
    if (!title) return setError('Введите название или направление поездки')
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate)
      return setError('Дата возвращения не может быть раньше даты начала')
    const clean = { ...draft, title, destination: draft.destination.trim(), notes: draft.notes.trim() }
    const now = Date.now()
    if (id) {
      await db.trips.update(id, { ...clean, updatedAt: now })
      navigate(`/trips/${id}`, { replace: true })
    } else {
      const tripId = newTripId
      await db.trips.add({ id: tripId, ...clean, createdAt: now, updatedAt: now })
      navigate(`/trips/${tripId}`, { replace: true })
    }
  }

  if (!loaded) return null
  const back = id ? `/trips/${id}` : '/trips'

  return (
    <>
      <PageHeader title={id ? 'Редактировать поездку' : 'Новая поездка'} back={back} />
      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Название *</span>
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Например, Италия на майские" autoFocus={!id} />
        </label>
        <label className="field">
          <span>Куда</span>
          <input value={draft.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Страна, города" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Начало</span>
            <input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </label>
          <label className="field">
            <span>Возвращение</span>
            <input type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
          </label>
        </div>
        <p className="hint-text hint-tight">Если билеты на самолёт или поезд выходят за эти даты, поездка расширится по билетам автоматически.</p>
        <label className="field">
          <span>Заметки</span>
          <textarea rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Что взять, важные контакты, идеи" />
        </label>
        <div className="field">
          <span>Обложка</span>
          <div className="cover-picker">
            {(() => {
              const auto = COVERS.find((c) => c.key === autoCoverKey({ id: id ?? newTripId, title: draft.title, destination: draft.destination }))!
              return (
                <button type="button" className={`cover-opt ${draft.cover === '' ? 'cover-opt-active' : ''}`} onClick={() => set('cover', '')}>
                  <img src={auto.src} alt="" style={{ objectPosition: auto.position }} />
                  <span>✨ Авто: {auto.label}</span>
                </button>
              )
            })()}
            {COVERS.map((c) => (
              <button type="button" key={c.key} className={`cover-opt ${draft.cover === c.key ? 'cover-opt-active' : ''}`} onClick={() => set('cover', c.key)}>
                <img src={c.src} alt="" loading="lazy" style={{ objectPosition: c.position }} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <p className="hint-text hint-tight">«Авто» подбирает обложку по направлению поездки.</p>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{id ? 'Сохранить' : 'Создать поездку'}</button>
          <Link to={back} className="btn">Отмена</Link>
        </div>
      </form>
    </>
  )
}
