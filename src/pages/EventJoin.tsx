import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { eventInviteInfo, joinEvent, setPendingEventInvite, type EventInviteInfo } from '../eventMembers'
import { AccountSection } from '../components/Account'
import { Empty, PageHeader } from '../components/ui'
import { useSyncState } from '../sync'

export default function EventJoin() {
  const { token } = useParams()
  const navigate = useNavigate()
  const sync = useSyncState()
  const [info, setInfo] = useState<EventInviteInfo | null>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setInfo(undefined); setErr('')
    if (sync.ready && token) eventInviteInfo(token).then((data) => { if (!cancelled) setInfo(data) })
      .catch((e) => { if (!cancelled) setErr(e.message) })
    return () => { cancelled = true }
  }, [token, sync.ready, sync.user?.id, attempt])
  useEffect(() => {
    if (sync.ready && token && info) setPendingEventInvite(sync.user ? null : token)
  }, [sync.ready, sync.user?.id, token, info])

  async function join() {
    setBusy(true); setErr('')
    try {
      const result = await joinEvent(token!)
      setPendingEventInvite(null)
      navigate(result.own ? `/items/${result.item_id}` : result.scope === 'trip' ? `/trips/${result.trip_id}` : `/events/${result.owner_id}/${result.item_id}`, { replace: true })
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  if (info === undefined) return <Empty icon="🔗"><p>{err || 'Открываю приглашение…'}</p>{err && <button className="btn" onClick={() => setAttempt((n) => n + 1)}>Повторить</button>}</Empty>
  if (info === null) return <Empty icon="🔗"><p>Приглашение больше не действует. Попросите прислать новую ссылку.</p><Link to="/trips" className="btn" onClick={() => setPendingEventInvite(null)}>К поездкам</Link></Empty>
  return <>
    <PageHeader title="Приглашение на событие" />
    <div className="invite-card">
      <h2 className="invite-title">{info.title}</h2>
      <p>{info.owner_name ? `${info.owner_name} приглашает вас на событие.` : 'Вас приглашают на событие.'}</p>
      <p>{info.scope === 'event' ? 'Вы увидите только это событие: место, время, заметки и прикреплённые файлы.' : `Вы получите доступ ко всей поездке: событиям, броням, билетам и файлам.${info.role === 'editor' ? ' Вы также сможете их добавлять и менять.' : ' Только просмотр.'}`}</p>
      {sync.user && <div className="form-actions"><button className="btn btn-primary" onClick={join} disabled={busy}>{busy ? 'Присоединяюсь…' : info.own || info.joined ? 'Открыть' : 'Присоединиться'}</button><Link to="/trips" className="btn" onClick={() => setPendingEventInvite(null)}>Не сейчас</Link></div>}
      {err && <p className="error" role="alert">{err}</p>}
    </div>
    {!sync.user && <><p className="muted">Чтобы присоединиться, войдите или зарегистрируйтесь.</p><AccountSection /></>}
  </>
}
