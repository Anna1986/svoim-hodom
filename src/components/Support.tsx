import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { closeSupport, isAdmin, myAccessLog, myGrant, openSupport, sendSupportMessage, type Grant } from '../admin'
import { useSyncState } from '../sync'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Профиль: кто видит данные, доступ поддержки на время, журнал просмотров. */
export function SupportSection() {
  const s = useSyncState()
  const [grant, setGrant] = useState<Grant | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [admin, setAdmin] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [asking, setAsking] = useState(false)
  const [available, setAvailable] = useState(false)
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  async function load() {
    try {
      const [g, l, a] = await Promise.all([myGrant(), myAccessLog(), isAdmin()])
      setGrant(g); setLog(l); setAdmin(a); setAvailable(true)
    } catch {
      setAvailable(false) // нет связи или сервер ещё не обновлён — раздел не показываем
    }
  }
  useEffect(() => { if (s.user) void load() }, [s.user?.id])

  if (!s.user || !available) return null

  async function open() {
    setBusy(true); setErr('')
    const e = await openSupport(24, note)
    setBusy(false)
    if (e) return setErr(e)
    setAsking(false); setNote('')
    void load()
  }

  async function send() {
    if (!text.trim()) return setErr('Напишите, что случилось')
    setBusy(true); setErr('')
    const e = await sendSupportMessage(text)
    setBusy(false)
    if (e) return setErr(e)
    setWriting(false); setText(''); setSent(true)
  }

  async function close() {
    setBusy(true); setErr('')
    const e = await closeSupport()
    setBusy(false)
    if (e) return setErr(e)
    void load()
  }

  return (
    <section className="section">
      <h2>Конфиденциальность и помощь</h2>
      <p className="muted">
        Ваши поездки, брони, документы и файлы видите только вы. Администратор приложения видит лишь общие цифры:
        сколько всего пользователей и поездок, — без названий, дат и содержимого.
      </p>
      {writing ? (
        <div className="support-ask">
          <label className="field">
            <span>Ваше сообщение</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Вопрос, проблема или идея" autoFocus />
          </label>
          <p className="muted small">Ответим на почту {s.user.email}. Ваши поездки при этом никто не видит.</p>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Отправляю…' : 'Отправить'}</button>
            <button className="btn" onClick={() => { setWriting(false); setErr('') }}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary support-btn" onClick={() => { setWriting(true); setSent(false); setAsking(false); setErr('') }}>✉️ Написать в поддержку</button>
      )}
      {sent && <p className="notice">Сообщение отправлено. Ответим на почту {s.user.email}.</p>}
      {grant ? (
        <div className="support-open">
          <p><b>Доступ поддержки открыт</b> до {fmt(grant.expires_at)}. Поддержка может посмотреть ваши поездки и брони (без документов и файлов), чтобы помочь.</p>
          <button className="btn" onClick={close} disabled={busy}>Закрыть доступ</button>
        </div>
      ) : asking ? (
        <div className="support-ask">
          <label className="field">
            <span>Что случилось? (необязательно)</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: не вижу бронь отеля на телефоне" />
          </label>
          <p className="muted small">Нужно, если поддержке надо увидеть вашу поездку, чтобы разобраться. Доступ откроется на 24 часа. Поддержка увидит поездки и брони — но не документы и не файлы. Закрыть доступ можно в любой момент.</p>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={open} disabled={busy}>{busy ? 'Открываю…' : 'Открыть доступ на 24 часа'}</button>
            <button className="btn" onClick={() => setAsking(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-soft support-btn" onClick={() => { setAsking(true); setWriting(false); setErr('') }}>Открыть поддержке доступ к поездкам</button>
      )}
      {err && <p className="error">{err}</p>}
      {log.length > 0 && (
        <p className="muted small">Поддержка открывала ваши поездки: {log.map(fmt).join(', ')}</p>
      )}
      {admin && <Link to="/admin" className="btn add-inline">Администрирование</Link>}
    </section>
  )
}
