import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getInvite, hasInvites, inviteUrl, listPeople, removeMember, revokeInvites, ROLE_LABEL, setMemberRole, type Person, type TripAccess,
} from '../members'
import type { Role } from '../access'
import { useSyncState } from '../sync'

export function MembersSheet({ tripId, title, access, onClose }: { tripId: string; title: string; access: TripAccess; onClose: () => void }) {
  const sync = useSyncState()
  const isOwner = access.role === 'owner'
  const [people, setPeople] = useState<Person[] | null>(null)
  const [role, setRole] = useState<Role>('editor')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [link, setLink] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [invites, setInvites] = useState(false)

  async function load() {
    if (!access.ownerId) return
    try {
      setPeople(await listPeople(access.ownerId, tripId))
      if (isOwner) setInvites(await hasInvites(tripId))
    } catch (e) { setErr((e as Error).message) }
  }
  useEffect(() => { if (sync.user) void load() }, [tripId, sync.user?.id])

  async function invite() {
    setBusy(true); setErr(''); setMsg(''); setLink('')
    try {
      const url = inviteUrl(await getInvite(tripId, role))
      setLink(url); setInvites(true)
      const text = `Присоединяйтесь к поездке «${title}»`
      if (navigator.share) {
        try { await navigator.share({ title, text, url }) } catch { /* закрыли окно */ }
      } else {
        try { await navigator.clipboard.writeText(url); setMsg('Ссылка скопирована — отправьте её участнику.') } catch { /* покажем ссылку ниже */ }
      }
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setMsg('Ссылка скопирована.') } catch { setErr('Не получилось скопировать') }
  }

  async function changeRole(p: Person, next: Role) {
    setErr('')
    try { await setMemberRole(tripId, p.user_id, next); await load() } catch (e) { setErr((e as Error).message) }
  }

  // Без системного окна подтверждения: второе нажатие
  async function remove(p: Person) {
    setErr('')
    if (confirming !== p.user_id) { setConfirming(p.user_id); return }
    setConfirming(null)
    try { await removeMember(tripId, p.user_id); await load() } catch (e) { setErr((e as Error).message) }
  }

  async function revoke() {
    setErr('')
    if (confirming !== 'invites') { setConfirming('invites'); return }
    setConfirming(null)
    try { await revokeInvites(tripId); setInvites(false); setLink(''); setMsg('Ссылки-приглашения отозваны. Те, кто уже в поездке, остались.') } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Участники поездки">
        <div className="sheet-head">
          <h2>Участники</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        {!sync.user ? (
          <>
            <p className="muted">Чтобы добавить участников, войдите в профиль — поездка попадёт в облако, и участники увидят её у себя.</p>
            <Link to="/settings" className="btn btn-primary">Войти</Link>
          </>
        ) : (
          <>
            {people === null && !err && <p className="muted small">Загружаю…</p>}
            {people && (
              <ul className="people">
                {people.map((p) => (
                  <li key={p.user_id} className="person">
                    <span className="person-avatar">{(p.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <span className="person-body">
                      <span className="person-name">{p.name}{p.user_id === sync.user!.id && ' (вы)'}</span>
                      <span className="muted small">{ROLE_LABEL[p.role]}</span>
                    </span>
                    {isOwner && p.role !== 'owner' && (
                      <span className="person-actions">
                        <button className="link-btn" onClick={() => changeRole(p, p.role === 'editor' ? 'viewer' : 'editor')}>
                          {p.role === 'editor' ? 'Только просмотр' : 'Разрешить менять'}
                        </button>
                        <button className="link-btn danger" onClick={() => remove(p)}>{confirming === p.user_id ? 'Точно убрать?' : 'Убрать'}</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {people && people.length === 1 && isOwner && <p className="muted small">Пока в поездке только вы.</p>}

            {isOwner && (
              <>
                <h3 className="sheet-sub">Добавить участника</h3>
                <div className="share-options">
                  <label className={`share-opt ${role === 'editor' ? 'share-opt-active' : ''}`}>
                    <input type="radio" name="role" checked={role === 'editor'} onChange={() => setRole('editor')} />
                    <span><b>Может менять</b><br /><span className="muted small">Добавляет и правит брони, билеты, события и файлы</span></span>
                  </label>
                  <label className={`share-opt ${role === 'viewer' ? 'share-opt-active' : ''}`}>
                    <input type="radio" name="role" checked={role === 'viewer'} onChange={() => setRole('viewer')} />
                    <span><b>Только смотрит</b><br /><span className="muted small">Видит всю поездку у себя в приложении, но ничего не меняет</span></span>
                  </label>
                </div>
                <button className="btn btn-primary share-create" onClick={invite} disabled={busy}>
                  {busy ? 'Готовлю ссылку…' : 'Отправить приглашение'}
                </button>
                <p className="muted small">Человек откроет ссылку, войдёт или зарегистрируется — и поездка появится у него. Ваши личные документы участникам не видны.</p>
                {link && (
                  <div className="invite-link">
                    <span className="break">{link}</span>
                    <button className="link-btn" onClick={copy}>Копировать</button>
                  </div>
                )}
                {invites && (
                  <button className="link-btn danger" onClick={revoke}>
                    {confirming === 'invites' ? 'Точно отозвать ссылки?' : 'Отозвать ссылки-приглашения'}
                  </button>
                )}
              </>
            )}
            {msg && <p className="notice">{msg}</p>}
            {err && <div className="error">{err}</div>}
          </>
        )}
      </div>
    </div>
  )
}
