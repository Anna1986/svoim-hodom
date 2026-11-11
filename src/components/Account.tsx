import { useState, type FormEvent } from 'react'
import { signIn, signOut, signUp, syncNow, useSyncState } from '../sync'

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'только что'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} мин назад`
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SyncLine() {
  const s = useSyncState()
  if (!s.user) return null
  if (s.syncing) return <span className="sync-line">⟳ Синхронизация…</span>
  if (s.error) return <span className="sync-line sync-error">⚠️ {s.error}</span>
  if (!navigator.onLine) return <span className="sync-line">Нет сети — изменения отправятся позже{s.pending ? ` (${s.pending})` : ''}</span>
  if (s.pending) return <span className="sync-line">Ожидают отправки: {s.pending}</span>
  return <span className="sync-line sync-ok">✓ Синхронизировано{s.lastSync ? ` · ${ago(s.lastSync)}` : ''}</span>
}

export function AccountSection() {
  const s = useSyncState()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (!email.trim() || !password) return setErr('Введите почту и пароль')
    setBusy(true)
    try {
      if (mode === 'in') {
        const error = await signIn(email.trim(), password)
        if (error) setErr(error)
      } else {
        const r = await signUp(email.trim(), password)
        if (r.error) setErr(r.error)
        else if (r.needsConfirm) {
          setMsg('Готово! Мы отправили письмо на вашу почту — откройте его и нажмите ссылку для подтверждения. Потом вернитесь сюда и войдите.')
          setMode('in')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  if (!s.ready) return null

  if (s.user) {
    return (
      <section className="section">
        <h2>Аккаунт и синхронизация</h2>
        <p className="muted">Вы вошли как <b className="text">{s.user.email}</b>. Поездки, документы и файлы одинаковые на всех устройствах, где вы вошли.</p>
        <p><SyncLine /></p>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => syncNow()} disabled={s.syncing}>Синхронизировать</button>
          <button className="btn" onClick={() => { if (window.confirm('Выйти из аккаунта? Данные останутся на этом устройстве, но перестанут синхронизироваться.')) signOut() }}>Выйти</button>
        </div>
      </section>
    )
  }

  return (
    <section className="section" id="account">
      <h2>Аккаунт и синхронизация</h2>
      <p className="muted">Войдите, чтобы на телефоне и компьютере были одни и те же поездки, документы и файлы. На каждом устройстве нужно войти один раз.</p>
      <div className="tabs tabs-small">
        <button className={`tab ${mode === 'in' ? 'tab-active' : ''}`} onClick={() => { setMode('in'); setErr('') }}>Вход</button>
        <button className={`tab ${mode === 'up' ? 'tab-active' : ''}`} onClick={() => { setMode('up'); setErr('') }}>Регистрация</button>
      </div>
      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Почта</span>
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Пароль{mode === 'up' && ' (не короче 6 символов)'}</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <div className="error">{err}</div>}
        {msg && <p className="notice">{msg}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
      </form>
    </section>
  )
}
