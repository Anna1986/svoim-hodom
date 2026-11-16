import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { myEvents, type GuestEvent } from '../eventMembers'
import { useSyncState } from '../sync'
import { formatDateTime } from '../format'
import { CatIcon } from './icons'

export function InvitedEvents() {
  const sync = useSyncState()
  const [events, setEvents] = useState<GuestEvent[]>([])
  const [err, setErr] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setEvents([]); setErr('')
    if (sync.user) myEvents().then((data) => { if (!cancelled) setEvents(data) })
      .catch((e) => { if (!cancelled) setErr(e.message) })
    return () => { cancelled = true }
  }, [sync.user?.id, sync.lastSync, attempt])
  if (!sync.user || (!events.length && !err)) return null
  return <section className="section">
    <h2>Приглашения на события</h2>
    {err ? <><p className="muted" role="status">{err}</p><button className="btn" onClick={() => setAttempt((n) => n + 1)}>Повторить</button></> : <div className="rows">{events.map(({ owner_id, item }) => <Link key={`${owner_id}/${item.id}`} to={`/events/${owner_id}/${item.id}`} className="row">
      <CatIcon c={item.category} size={44} /><span className="row-body"><span className="row-title">{item.title}</span>{item.startDate && <span className="row-sub">{formatDateTime(item.startDate, item.startTime)}</span>}{item.place && <span className="row-sub">{item.place}</span>}</span>
    </Link>)}</div>}
  </section>
}
