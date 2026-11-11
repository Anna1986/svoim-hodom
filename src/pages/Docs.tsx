import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addAttachments, db, deleteDoc, DOC_KINDS, newId, type Doc, type DocKind } from '../db'
import { formatDate } from '../format'
import { expiryHint } from '../trip'
import { CopyValue, Empty, Fab, PageHeader } from '../components/ui'
import { Attachments, PendingFiles } from '../components/Attachments'
import { DocIcon } from '../components/icons'

const KIND_ORDER = Object.keys(DOC_KINDS) as DocKind[]

/* ---------------- Список ---------------- */

export function DocsList() {
  const docs = useLiveQuery(() => db.docs.toArray(), [])
  if (!docs) return null
  const sorted = [...docs].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title))

  return (
    <>
      <PageHeader title="Мои документы">
        <Link to="/docs/new" className="btn btn-primary hide-mobile">+ Добавить документ</Link>
      </PageHeader>
      <p className="muted lead">Паспорта, права, полисы — всегда под рукой в любой поездке.</p>

      {sorted.length === 0 ? (
        <Empty icon="🛂">
          <p>Добавьте загранпаспорт и другие документы. Можно прикрепить фото или скан.</p>
          <Link to="/docs/new" className="btn btn-primary">Добавить документ</Link>
        </Empty>
      ) : (
        <div className="rows">
          {sorted.map((d) => {
            const hint = expiryHint(d.expiryDate)
            return (
              <Link key={d.id} to={`/docs/${d.id}`} className="row">
                <DocIcon k={d.kind} size={44} />
                <span className="row-body">
                  <span className="row-title">{d.title}</span>
                  {d.holder && <span className="row-sub">{d.holder}</span>}
                  {d.expiryDate && (
                    <span className={`row-sub ${hint ? `hint-${hint.tone}` : ''}`}>
                      до {formatDate(d.expiryDate)}{hint && ` · ${hint.text}`}
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}
      <Fab to="/docs/new" label="Добавить документ" />
    </>
  )
}

/* ---------------- Карточка ---------------- */

export function DocView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const doc = useLiveQuery(async () => (await db.docs.get(id!)) ?? null, [id])
  if (doc === undefined) return null
  if (doc === null) return <Empty icon="🤷"><p>Документ не найден.</p><Link to="/docs" className="btn">К документам</Link></Empty>

  const hint = expiryHint(doc.expiryDate)

  async function remove() {
    if (!window.confirm(`Удалить «${doc!.title}» вместе с файлами?`)) return
    await deleteDoc(doc!.id)
    navigate('/docs', { replace: true })
  }

  return (
    <>
      <PageHeader title={doc.title} back="/docs" backLabel="← Документы" />
      <div className="kind-label"><DocIcon k={doc.kind} size={36} /> {DOC_KINDS[doc.kind].label}</div>
      <dl className="details">
        {doc.holder && (<><dt>Владелец</dt><dd>{doc.holder}</dd></>)}
        {doc.number && (<><dt>Номер</dt><dd><CopyValue value={doc.number} /></dd></>)}
        {doc.expiryDate && (
          <><dt>Действует до</dt><dd className="strong">{formatDate(doc.expiryDate)}{hint && <span className={`hint-${hint.tone}`}> · {hint.text}</span>}</dd></>
        )}
      </dl>
      {doc.notes && <p className="description">{doc.notes}</p>}
      <Attachments ownerType="doc" ownerId={doc.id} />
      <div className="form-actions">
        <Link to={`/docs/${doc.id}/edit`} className="btn btn-primary">Редактировать</Link>
        <button className="btn btn-danger" onClick={remove}>Удалить</button>
      </div>
    </>
  )
}

/* ---------------- Форма ---------------- */

type Draft = Pick<Doc, 'kind' | 'title' | 'holder' | 'number' | 'expiryDate' | 'notes'>
const EMPTY: Draft = { kind: 'intl-passport', title: '', holder: '', number: '', expiryDate: '', notes: '' }

export function DocForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [files, setFiles] = useState<File[]>([])
  const [loaded, setLoaded] = useState(!id)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    db.docs.get(id).then((d) => {
      if (!d) return navigate('/docs', { replace: true })
      setDraft({ kind: d.kind, title: d.title, holder: d.holder, number: d.number, expiryDate: d.expiryDate, notes: d.notes })
      setLoaded(true)
    })
  }, [id, navigate])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setError('') }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const title = draft.title.trim() || DOC_KINDS[draft.kind].label
    const clean = { ...draft, title, holder: draft.holder.trim(), number: draft.number.trim(), notes: draft.notes.trim() }
    const now = Date.now()
    try {
      if (id) {
        await db.docs.update(id, { ...clean, updatedAt: now })
        navigate(`/docs/${id}`, { replace: true })
      } else {
        const docId = newId()
        await db.docs.add({ id: docId, ...clean, createdAt: now, updatedAt: now })
        if (files.length) await addAttachments('doc', docId, files)
        navigate(`/docs/${docId}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('Не получилось сохранить. Возможно, на устройстве закончилось место.')
    }
  }

  if (!loaded) return null
  const back = id ? `/docs/${id}` : '/docs'

  return (
    <>
      <PageHeader title={id ? 'Редактировать документ' : 'Новый документ'} back={back} />
      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Тип</span>
          <select value={draft.kind} onChange={(e) => set('kind', e.target.value as DocKind)}>
            {KIND_ORDER.map((k) => <option key={k} value={k}>{DOC_KINDS[k].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Название</span>
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder={DOC_KINDS[draft.kind].label} />
        </label>
        <label className="field">
          <span>Чей документ</span>
          <input value={draft.holder} onChange={(e) => set('holder', e.target.value)} placeholder="Например, Анна или имя ребёнка" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Номер</span>
            <input value={draft.number} onChange={(e) => set('number', e.target.value)} />
          </label>
          <label className="field">
            <span>Действует до</span>
            <input type="date" value={draft.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Заметки</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        {!id && <PendingFiles files={files} onChange={setFiles} />}
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Сохранить</button>
          <Link to={back} className="btn">Отмена</Link>
        </div>
      </form>
    </>
  )
}
