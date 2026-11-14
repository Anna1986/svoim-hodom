import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { inviteInfo, joinTrip, setPendingInvite, type InviteInfo } from '../members'
import { AccountSection } from '../components/Account'
import { Empty, PageHeader } from '../components/ui'
import { useSyncState } from '../sync'

/** Страница ссылки-приглашения в поездку. */
export default function Join() {
  const { token } = useParams()
  const navigate = useNavigate()
  const sync = useSyncState()
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!sync.ready || !token) return
    inviteInfo(token).then(setInfo).catch((e) => setErr(e.message))
  }, [token, sync.ready, sync.user?.id])

  // До входа запоминаем приглашение, чтобы вернуться к нему после входа или подтверждения почты
  useEffect(() => {
    if (sync.ready && token && info) setPendingInvite(sync.user ? null : token)
  }, [sync.ready, sync.user?.id, token, info])

  // Своя поездка или уже участник — сразу открываем
  useEffect(() => {
    if (sync.user && info && (info.own || info.joined)) { setPendingInvite(null); navigate(`/trips/${info.trip_id}`, { replace: true }) }
  }, [sync.user?.id, info])

  async function join() {
    setBusy(true); setErr('')
    try {
      const tripId = await joinTrip(token!)
      setPendingInvite(null)
      navigate(`/trips/${tripId}`, { replace: true })
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  if (err && info === undefined) return <Empty icon="📡"><p>{err}</p><Link to="/trips" className="btn">К поездкам</Link></Empty>
  if (info === undefined) return null
  if (info === null || !info.title) {
    return <Empty icon="🔗"><p>Приглашение больше не действует. Попросите прислать новую ссылку.</p><Link to="/trips" className="btn">К поездкам</Link></Empty>
  }

  return (
    <>
      <PageHeader title="Приглашение в поездку" />
      <div className="invite-card">
        <div className="invite-title">{info.title}</div>
        <p>
          {info.owner_name ? <><b>{info.owner_name}</b> приглашает вас в поездку.</> : 'Вас приглашают в поездку.'}{' '}
          {info.role === 'editor'
            ? 'Вы сможете смотреть её и добавлять свои брони, билеты и события.'
            : 'Вы сможете смотреть план, брони и билеты.'}
        </p>
        {sync.user && (
          <div className="form-actions">
            <button className="btn btn-primary" onClick={join} disabled={busy}>{busy ? 'Присоединяюсь…' : 'Присоединиться'}</button>
            <Link to="/trips" className="btn" onClick={() => setPendingInvite(null)}>Не сейчас</Link>
          </div>
        )}
        {err && <div className="error">{err}</div>}
      </div>
      {!sync.user && (
        <>
          <p className="muted">Чтобы поездка появилась у вас, войдите или зарегистрируйтесь — это минута.</p>
          <AccountSection />
        </>
      )}
    </>
  )
}
