import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addAttachments, CATEGORIES, CATEGORY_ORDER, db, newId, type Category, type Item } from '../db'
import { PageHeader } from '../components/ui'
import { PendingFiles } from '../components/Attachments'
import { CatIcon } from '../components/icons'

type Draft = Omit<Item, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

function emptyDraft(category: Category): Draft {
  return {
    category, title: '', place: '', placeTo: '',
    startDate: '', startTime: '', endDate: '', endTime: '',
    bookingRef: '', link: '', notes: '',
  }
}

export default function ItemForm() {
  const { id: tripIdParam, itemId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialCat = (params.get('category') as Category) in CATEGORIES ? (params.get('category') as Category) : 'other'

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(initialCat))
  const [tripId, setTripId] = useState(tripIdParam ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [loaded, setLoaded] = useState(!itemId)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!itemId) return
    db.items.get(itemId).then((it) => {
      if (!it) return navigate('/trips', { replace: true })
      const { id: _i, tripId: t, createdAt: _c, updatedAt: _u, ...rest } = it
      setDraft(rest)
      setTripId(t)
      setLoaded(true)
    })
  }, [itemId, navigate])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setError('') }
  const cfg = CATEGORIES[draft.category]

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return setError('Введите название')
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate)
      return setError(`«${cfg.end}» не может быть раньше, чем «${cfg.start}»`)
    setSaving(true)
    const clean: Draft = {
      ...draft,
      title,
      place: cfg.place ? draft.place.trim() : '',
      placeTo: cfg.placeTo ? draft.placeTo.trim() : '',
      startTime: cfg.withTime ? draft.startTime : '',
      endDate: cfg.end ? draft.endDate : '',
      endTime: cfg.end && cfg.withTime ? draft.endTime : '',
      bookingRef: cfg.ref ? draft.bookingRef.trim() : '',
      link: draft.link.trim(),
      notes: draft.notes.trim(),
    }
    const now = Date.now()
    try {
      if (itemId) {
        await db.items.update(itemId, { ...clean, updatedAt: now })
        navigate(`/items/${itemId}`, { replace: true })
      } else {
        const newItemId = newId()
        await db.items.add({ id: newItemId, tripId, ...clean, createdAt: now, updatedAt: now })
        if (files.length) await addAttachments('item', newItemId, files)
        navigate(`/items/${newItemId}`, { replace: true })
      }
    } catch (err) {
      setSaving(false)
      setError('Не получилось сохранить. Возможно, на устройстве закончилось место.')
      console.error(err)
    }
  }

  if (!loaded) return null
  const back = itemId ? `/items/${itemId}` : `/trips/${tripId}`

  return (
    <>
      <PageHeader title={itemId ? 'Редактировать' : <span className="title-with-icon"><CatIcon c={draft.category} size={44} /> {cfg.one}</span>} back={back} />
      <form className="form" onSubmit={onSubmit} noValidate>
        {itemId && (
          <label className="field">
            <span>Папка</span>
            <select value={draft.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
            </select>
          </label>
        )}

        <label className="field">
          <span>Название *</span>
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder={cfg.titlePlaceholder} autoFocus={!itemId} />
        </label>

        {(cfg.place || cfg.placeTo) && (
          <div className="field-row">
            {cfg.place && (
              <label className="field">
                <span>{cfg.place}</span>
                <input value={draft.place} onChange={(e) => set('place', e.target.value)} />
              </label>
            )}
            {cfg.placeTo && (
              <label className="field">
                <span>{cfg.placeTo}</span>
                <input value={draft.placeTo} onChange={(e) => set('placeTo', e.target.value)} />
              </label>
            )}
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>{cfg.start}</span>
            <input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </label>
          {cfg.withTime && (
            <label className="field field-time">
              <span>Время</span>
              <input type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </label>
          )}
        </div>

        {cfg.end && (
          <div className="field-row">
            <label className="field">
              <span>{cfg.end}</span>
              <input type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
            </label>
            {cfg.withTime && (
              <label className="field field-time">
                <span>Время</span>
                <input type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} />
              </label>
            )}
          </div>
        )}
        {cfg.withTime && <p className="hint-text">Время указывайте местное — как в билете или брони.</p>}

        {cfg.ref && (
          <label className="field">
            <span>{cfg.ref}</span>
            <input value={draft.bookingRef} onChange={(e) => set('bookingRef', e.target.value)} autoCapitalize="characters" />
          </label>
        )}

        <label className="field">
          <span>Ссылка</span>
          <input type="url" inputMode="url" value={draft.link} onChange={(e) => set('link', e.target.value)} placeholder="Ссылка на бронь, карту или сайт" />
        </label>

        <label className="field">
          <span>Заметки</span>
          <textarea rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Багаж, место, телефон отеля, как добраться…" />
        </label>

        {!itemId && <PendingFiles files={files} onChange={setFiles} />}

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
          <Link to={back} className="btn">Отмена</Link>
        </div>
      </form>
    </>
  )
}
