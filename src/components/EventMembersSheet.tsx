import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSyncState } from '../sync'
import type { Role } from '../access'
import { createEventInvite, eventInvitesExist, eventPeople, removeEventMember, revokeEventInvites, type EventPerson, type InviteScope } from '../eventMembers'

export function EventMembersSheet({ itemId, title, onClose }: { itemId: string; title: string; onClose: () => void }) {
  const sync = useSyncState()
  const [scope, setScope] = useState<InviteScope>('event')
  const [role, setRole] = useState<Role>('viewer')
  const [people, setPeople] = useState<EventPerson[] | null>(null)
  const [invites, setInvites] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [link, setLink] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  async function load() {
    const [next, active] = await Promise.all([eventPeople(itemId), eventInvitesExist(itemId)])
    setPeople(next); setInvites(active)
  }
  useEffect(() => {
    let cancelled = false
    if (sync.user) Promise.all([eventPeople(itemId), eventInvitesExist(itemId)])
      .then(([next, active]) => { if (!cancelled) { setPeople(next); setInvites(active) } })
      .catch((e) => { if (!cancelled) setErr(e.message) })
    return () => { cancelled = true }
  }, [itemId, sync.user?.id])
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])

  async function invite() {
    setBusy(true); setErr(''); setMsg(''); setLink('')
    try {
      const url = await createEventInvite(itemId, scope, role)
      setLink(url); setInvites(true)
      if (navigator.share) {
        try { await navigator.share({ title, text: `Приглашаю на событие «${title}»`, url }) } catch { /* link remains available */ }
      } else {
        try { await navigator.clipboard.writeText(url); setMsg('Ссылка скопирована — отправьте её участнику.') } catch { /* show the link */ }
      }
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function remove(p: EventPerson) {
    if (confirming !== p.user_id) { setConfirming(p.user_id); return }
    setBusy(true); setErr('')
    try {
      await removeEventMember(sync.user!.id, itemId, p.user_id)
      setConfirming(null); await load()
      setMsg(p.scope === 'trip' ? 'Участник убран из события. Его доступ ко всей поездке сохранён.' : 'Доступ участника к событию закрыт.')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function revoke() {
    if (confirming !== 'invites') { setConfirming('invites'); return }
    setBusy(true); setErr('')
    try {
      await revokeEventInvites(itemId)
      setInvites(false); setLink(''); setConfirming(null)
      setMsg('Ссылки отозваны. Участники, которые уже присоединились, остались.')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Участники события" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>Участники события</h2><button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button></div>
        {!sync.user ? <><p className="muted">Войдите в профиль, чтобы приглашать участников по ссылке.</p><Link to="/settings" className="btn btn-primary">Войти</Link></> : <>
          {people === null && !err && <p className="muted">Загружаю участников…</p>}
          {people?.length === 0 && <p className="muted">Пока никто не присоединился по приглашению на событие.</p>}
          {!!people?.length && <ul className="people">{people.map((p) => <li key={p.user_id} className="person">
            <span className="person-avatar">{(p.name || '?').trim().charAt(0).toUpperCase()}</span>
            <span className="person-body"><span className="person-name">{p.name}</span><span className="muted small">{p.scope === 'event' ? 'Только это событие · просмотр' : `Вся поездка · ${p.role === 'editor' ? 'может менять' : 'просмотр'}`}</span></span>
            <button className="link-btn danger" disabled={busy} onClick={() => remove(p)}>{confirming === p.user_id ? 'Точно убрать?' : 'Убрать'}</button>
          </li>)}</ul>}
          {people?.some((p) => p.scope === 'trip') && <p className="muted small">Удаление из события не закрывает доступ ко всей поездке. Он настраивается в участниках поездки.</p>}
          <h3 className="sheet-sub">Добавить участника</h3>
          <fieldset className="event-invite-options" disabled={busy}>
            <legend>Что увидит участник</legend>
            <div className="share-options">{(['event', 'trip'] as const).map((value) => <label key={value} className={`share-opt ${scope === value ? 'share-opt-active' : ''}`}>
              <input type="radio" name="event-scope" checked={scope === value} onChange={() => { setScope(value); setLink(''); setMsg('') }} />
              <span><b>{value === 'event' ? 'Только это событие' : 'Вся поездка'}</b><br /><span className="muted small">{value === 'event' ? 'Название, время, место, заметки и файлы события' : 'Все события, брони, билеты и файлы поездки'}</span></span>
            </label>)}</div>
            {scope === 'trip' && <label className="field"><span>Права в поездке</span><select value={role} onChange={(e) => { setRole(e.target.value as Role); setLink(''); setMsg('') }}><option value="viewer">Только просмотр</option><option value="editor">Может менять</option></select></label>}
          </fieldset>
          <button className="btn btn-primary share-create" onClick={invite} disabled={busy}>{busy ? 'Подождите…' : 'Отправить приглашение'}</button>
          <p className="muted small">Участник откроет ссылку, войдёт или зарегистрируется и нажмёт «Присоединиться». Ссылка действует для всех, кому вы её отправите, пока вы её не отзовёте.</p>
          {link && <div className="invite-link"><span className="break">{link}</span><button className="link-btn" onClick={async () => { try { await navigator.clipboard.writeText(link); setMsg('Ссылка скопирована.') } catch { setErr('Не получилось скопировать ссылку.') } }}>Копировать</button></div>}
          {invites && <button className="link-btn danger" onClick={revoke} disabled={busy}>{confirming === 'invites' ? 'Точно отозвать ссылки?' : 'Отозвать ссылки события'}</button>}
          {msg && <p className="notice" role="status">{msg}</p>}
          {err && <div className="error" role="alert">{err}</div>}
        </>}
      </div>
    </div>
  )
}
