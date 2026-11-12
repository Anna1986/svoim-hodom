import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { sendPasswordReset, signIn, signOut, signUp, syncNow, updateName, useSyncState, type SyncState } from '../sync'

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'только что'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} мин назад`
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function displayName(user: NonNullable<SyncState['user']>): string {
  return user.name || user.email.split('@')[0]
}

export function Avatar({ size = 32 }: { size?: number }) {
  const { user } = useSyncState()
  const letter = user ? displayName(user).charAt(0).toUpperCase() : '👤'
  return (
    <span className={`avatar ${user ? '' : 'avatar-guest'}`} style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {letter}
    </span>
  )
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

/** Карточка «вы в своём кабинете» — для главного экрана и бокового меню. */
export function AccountBadge({ compact = false }: { compact?: boolean }) {
  const s = useSyncState()
  if (!s.ready || !s.user) return null
  return (
    <div className={`account-badge ${compact ? 'account-badge-compact' : ''}`}>
      <Avatar size={compact ? 36 : 40} />
      <div className="account-badge-text">
        <span className="account-name">{displayName(s.user)}</span>
        <SyncLine />
      </div>
    </div>
  )
}

function NameEditor({ current }: { current: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (!editing) {
    return (
      <button className="link-btn" onClick={() => { setValue(current); setEditing(true) }}>
        {current ? 'Изменить имя' : 'Указать имя'}
      </button>
    )
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const error = await updateName(value.trim())
    setBusy(false)
    if (error) setErr(error)
    else setEditing(false)
  }
  return (
    <form className="name-form" onSubmit={save}>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Как к вам обращаться" autoFocus />
      <button className="btn btn-primary" disabled={busy}>Сохранить</button>
      <button type="button" className="btn" onClick={() => setEditing(false)}>Отмена</button>
      {err && <div className="error">{err}</div>}
    </form>
  )
}

export function AccountSection() {
  const s = useSyncState()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>(params.get('forgot') ? 'forgot' : 'in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (mode === 'forgot') {
      if (!email.trim()) return setErr('Введите почту, на которую зарегистрирован аккаунт')
      setBusy(true)
      const error = await sendPasswordReset(email.trim())
      setBusy(false)
      if (error) setErr(error)
      else setMsg('Письмо со ссылкой для нового пароля отправлено. Откройте его на этом же устройстве и нажмите ссылку. Если письма нет пару минут — проверьте «Спам».')
      return
    }
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
      <section className="section profile-card">
        <div className="profile-head">
          <Avatar size={64} />
          <div className="profile-info">
            <div className="profile-name">{displayName(s.user)}</div>
            <div className="muted">{s.user.email}</div>
            <NameEditor current={s.user.name} />
          </div>
        </div>
        <p className="profile-sync"><SyncLine /></p>
        <p className="muted small">Ваши поездки, документы и файлы одинаковые на всех устройствах, где вы вошли в этот аккаунт.</p>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => syncNow()} disabled={s.syncing}>Синхронизировать</button>
          <Link to="/reset-password" className="btn">Сменить пароль</Link>
          <button className="btn" onClick={() => { if (window.confirm('Выйти из аккаунта? Данные останутся на этом устройстве, но перестанут синхронизироваться.')) signOut() }}>Выйти</button>
        </div>
      </section>
    )
  }

  return (
    <section className="section" id="account">
      <h2>{mode === 'forgot' ? 'Восстановление пароля' : 'Вход в личный кабинет'}</h2>
      {mode !== 'forgot' && (
        <>
      <p className="muted">Войдите, чтобы на телефоне и компьютере были одни и те же поездки, документы и файлы. На каждом устройстве нужно войти один раз.</p>
      <div className="tabs tabs-small">
        <button className={`tab ${mode === 'in' ? 'tab-active' : ''}`} onClick={() => { setMode('in'); setErr('') }}>Вход</button>
        <button className={`tab ${mode === 'up' ? 'tab-active' : ''}`} onClick={() => { setMode('up'); setErr('') }}>Регистрация</button>
      </div>
        </>
      )}
      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Почта</span>
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <label className="field">
            <span>Пароль{mode === 'up' && ' (не короче 6 символов)'}</span>
            <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {mode === 'forgot' && <p className="muted small">Пришлём на почту ссылку — по ней вы зададите новый пароль. Поездки и документы сохранятся.</p>}
        {err && <div className="error">{err}</div>}
        {msg && <p className="notice">{msg}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'in' ? 'Войти' : mode === 'up' ? 'Создать аккаунт' : 'Прислать ссылку'}
          </button>
          {mode === 'in' && <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setErr(''); setMsg('') }}>Забыли пароль?</button>}
          {mode === 'forgot' && <button type="button" className="link-btn" onClick={() => { setMode('in'); setErr(''); setMsg('') }}>← Ко входу</button>}
        </div>
      </form>
    </section>
  )
}
