import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createShare, listShares, revokeShare, shareUrl, type ShareLink } from '../share'
import { useSyncState } from '../sync'

async function sendLink(url: string, title: string): Promise<'shared' | 'copied' | 'none'> {
  if (navigator.share) {
    try { await navigator.share({ title, text: `Поездка «${title}»`, url }); return 'shared' } catch { /* закрыли окно */ return 'none' }
  }
  try { await navigator.clipboard.writeText(url); return 'copied' } catch { return 'none' }
}

export function ShareSheet({ tripId, title, onClose }: { tripId: string; title: string; onClose: () => void }) {
  const sync = useSyncState()
  const [details, setDetails] = useState(true)
  const [links, setLinks] = useState<ShareLink[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [linkErr, setLinkErr] = useState<{ token: string; text: string } | null>(null)

  useEffect(() => {
    if (!sync.user) return
    listShares(tripId).then(setLinks).catch((e) => setErr(e.message))
  }, [tripId, sync.user])

  async function create() {
    setBusy(true); setErr(''); setMsg('')
    try {
      const token = await createShare(tripId, details)
      setLinks(await listShares(tripId))
      const r = await sendLink(shareUrl(token), title)
      if (r === 'copied') setMsg('Ссылка скопирована — вставьте её в сообщение.')
      if (r === 'none') setMsg('Ссылка создана — её можно отправить кнопкой ниже.')
    } catch (e) {
      setErr(navigator.onLine ? (e as Error).message : 'Нужен интернет, чтобы создать ссылку')
    } finally {
      setBusy(false)
    }
  }

  async function copy(token: string) {
    try { await navigator.clipboard.writeText(shareUrl(token)); setMsg('Ссылка скопирована.') } catch { setErr('Не получилось скопировать') }
  }

  // Без системного окна подтверждения: второе нажатие на «Точно отозвать?»
  async function revoke(token: string) {
    setLinkErr(null)
    if (confirming !== token) { setConfirming(token); return }
    setConfirming(null)
    try {
      await revokeShare(token)
      setLinks((l) => (l ?? []).filter((x) => x.token !== token))
      setMsg('Ссылка отозвана — по ней поездка больше не откроется.')
    } catch (e) {
      setLinkErr({ token, text: (e as Error).message })
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Поделиться поездкой">
        <div className="sheet-head">
          <h2>Поделиться поездкой</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        {!sync.user ? (
          <>
            <p className="muted">Чтобы делиться поездками, войдите в профиль — так поездка попадёт в облако и откроется по ссылке.</p>
            <Link to="/settings" className="btn btn-primary">Войти</Link>
          </>
        ) : (
          <>
            <p className="muted small">По ссылке поездку можно только смотреть, без регистрации. Изменения, которые вы внесёте позже, тоже будут видны.</p>

            <div className="share-options">
              <label className={`share-opt ${details ? 'share-opt-active' : ''}`}>
                <input type="radio" name="details" checked={details} onChange={() => setDetails(true)} />
                <span><b>Всё</b><br /><span className="muted small">План, номера броней, ссылки, заметки и файлы билетов</span></span>
              </label>
              <label className={`share-opt ${!details ? 'share-opt-active' : ''}`}>
                <input type="radio" name="details" checked={!details} onChange={() => setDetails(false)} />
                <span><b>Только план</b><br /><span className="muted small">Даты, места и время — без номеров броней и файлов</span></span>
              </label>
            </div>

            <button className="btn btn-primary share-create" onClick={create} disabled={busy}>
              {busy ? 'Создаю ссылку…' : 'Создать ссылку и отправить'}
            </button>
            {msg && <p className="notice">{msg}</p>}
            {err && <div className="error">{err}</div>}

            {links && links.length > 0 && (
              <div className="share-list">
                <h3>Действующие ссылки</h3>
                {links.map((l) => (
                  <div key={l.token} className="share-link">
                    <div>
                      <div className="share-link-mode">{l.include_details ? 'Всё' : 'Только план'}</div>
                      <div className="muted small">создана {new Date(l.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="share-link-actions">
                      <button className="link-btn" onClick={() => sendLink(shareUrl(l.token), title)}>Отправить</button>
                      <button className="link-btn" onClick={() => copy(l.token)}>Копировать</button>
                      <button className="link-btn danger" onClick={() => revoke(l.token)}>
                        {confirming === l.token ? 'Точно отозвать?' : 'Отозвать'}
                      </button>
                    </div>
                    {linkErr?.token === l.token && <div className="error share-link-err">{linkErr.text}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
