import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchGuestEvent, removeEventMember } from '../eventMembers'
import { useSyncState } from '../sync'
import { CatIcon } from '../components/icons'
import { Empty, Linkify, PageHeader, CopyValue } from '../components/ui'
import { CATEGORIES, eventTypeOf } from '../db'
import { formatDateTime, formatSize } from '../format'
import { useMapProvider } from '../geo'
import { placeInfo } from './ItemView'

export default function GuestEvent() {
  const { ownerId, itemId } = useParams()
  const sync = useSyncState()
  const navigate = useNavigate()
  const provider = useMapProvider()
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchGuestEvent>>>()
  const [err, setErr] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    setData(undefined); setErr('')
    if (sync.user && ownerId && itemId) fetchGuestEvent(ownerId, itemId).then((result) => { if (!cancelled) setData(result) })
      .catch((e) => { if (!cancelled) setErr(e.message) })
    return () => { cancelled = true }
  }, [ownerId, itemId, sync.user?.id, attempt])
  async function leave() {
    if (!leaving) { setLeaving(true); return }
    setBusy(true); setErr('')
    try { await removeEventMember(ownerId!, itemId!, sync.user!.id); navigate('/trips', { replace: true }) }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  if (!sync.ready) return null
  if (!sync.user) return <Empty icon="🔒"><p>Войдите в аккаунт, с которым вы присоединились к событию.</p><Link to="/settings" className="btn btn-primary">Войти</Link></Empty>
  if (data === undefined) return <Empty icon="🎟️"><p>{err || 'Открываю событие…'}</p>{err && <button className="btn" onClick={() => setAttempt((n) => n + 1)}>Повторить</button>}</Empty>
  if (data === null) return <Empty icon="🔒"><p>Событие удалено или доступ к нему закрыт.</p><Link to="/trips" className="btn">К поездкам</Link></Empty>
  const { item, files } = data
  const cfg = CATEGORIES[item.category]
  const place = item.place ? placeInfo(item.category, item.place, provider, item.placeLL) : null
  return <>
    <PageHeader title={item.title} back="/trips" backLabel="← Мои поездки и события" />
    <div className="kind-label"><CatIcon c={item.category} size={36} />{eventTypeOf(item)?.label ?? cfg.one}</div>
    <p className="muted small">Приглашённое событие · только просмотр</p>
    <dl className="details">
      {place && <><dt>{cfg.place || 'Место'}</dt><dd><a className="link" href={place.href} target="_blank" rel="noopener">{place.text}</a></dd></>}
      {item.startDate && <><dt>{cfg.start}</dt><dd>{formatDateTime(item.startDate, item.startTime)}</dd></>}
      {(item.endDate || item.endTime) && <><dt>{cfg.end}</dt><dd>{formatDateTime(item.endDate || item.startDate, item.endTime)}</dd></>}
      {item.bookingRef && <><dt>{cfg.ref}</dt><dd><CopyValue value={item.bookingRef} /></dd></>}
      {item.link && <><dt>Ссылка</dt><dd><a className="link break" href={item.link} target="_blank" rel="noopener">{item.link}</a></dd></>}
    </dl>
    {item.notes && <p className="description"><Linkify text={item.notes} /></p>}
    <section className="section"><h2>Файлы</h2>{!files.length ? <p className="muted">Файлов нет.</p> : <ul className="att-list">{files.map((f) => <li key={f.id} className="att">
      <a href={f.url} target="_blank" rel="noopener" className="att-preview">{f.mime.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <span className="att-icon">📄</span>}</a>
      <div className="att-info"><a href={f.url} target="_blank" rel="noopener" className="att-name">{f.name}</a><span className="att-size">{formatSize(f.size)}</span></div>
      <a href={f.url} target="_blank" rel="noopener" className="icon-btn" aria-label={`Открыть ${f.name}`}>↗</a>
    </li>)}</ul>}<button className="link-btn" onClick={() => setAttempt((n) => n + 1)}>Обновить событие и файлы</button></section>
    <button className="btn btn-danger" onClick={leave} disabled={busy}>{leaving ? 'Точно выйти из события?' : 'Выйти из события'}</button>
    {err && <p className="error" role="alert">{err}</p>}
  </>
}
