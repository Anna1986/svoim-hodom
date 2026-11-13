import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { passwordProblem, useSyncState } from '../sync'
import { Empty, PageHeader } from '../components/ui'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const sync = useSyncState()
  const linkError = params.get('error')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [waited, setWaited] = useState(false)

  // Даём пару секунд, чтобы вход по ссылке из письма успел примениться
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t) }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const weak = passwordProblem(password)
    if (weak) return setErr(weak)
    if (password !== repeat) return setErr('Пароли не совпадают')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setErr(/same.*password|different from the old/i.test(error.message) ? 'Новый пароль должен отличаться от старого' : error.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/trips', { replace: true }), 1800)
  }

  if (linkError) {
    return (
      <>
        <PageHeader title="Новый пароль" />
        <Empty icon="⌛">
          <p>Ссылка из письма устарела или уже была использована. Запросите новую — она придёт на почту за минуту.</p>
          <Link to="/settings?forgot=1" className="btn btn-primary">Запросить новую ссылку</Link>
        </Empty>
      </>
    )
  }

  if (done) {
    return (
      <>
        <PageHeader title="Новый пароль" />
        <Empty icon="✅"><p>Пароль изменён. Открываю ваши поездки…</p></Empty>
      </>
    )
  }

  if (!sync.user) {
    return (
      <>
        <PageHeader title="Новый пароль" />
        {waited ? (
          <Empty icon="🔑">
            <p>Чтобы задать новый пароль, откройте ссылку из письма о сбросе пароля — или войдите и смените пароль в профиле.</p>
            <Link to="/settings?forgot=1" className="btn btn-primary">Забыли пароль?</Link>
          </Empty>
        ) : (
          <div className="explore-loading">Проверяю ссылку…</div>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader title="Новый пароль" back="/settings" backLabel="← Профиль" />
      <p className="muted lead">Для аккаунта <b className="text">{sync.user.email}</b></p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Новый пароль (от 8 символов, буквы и цифры)</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} autoFocus />
        </label>
        <label className="field">
          <span>Повторите пароль</span>
          <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => { setRepeat(e.target.value); setErr('') }} />
        </label>
        {err && <div className="error">{err}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить пароль'}</button>
        </div>
      </form>
    </>
  )
}
