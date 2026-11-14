import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../admin'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Переписка: сообщения и поле ответа. mine — чьи сообщения показывать справа. */
export function Chat({ load, send, mine, empty, placeholder }: {
  load: () => Promise<ChatMessage[]>
  send: (text: string) => Promise<string>
  mine: 'user' | 'admin'
  empty: string
  placeholder: string
}) {
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const count = useRef(0)

  async function refresh() {
    try {
      const m = await load()
      setMsgs(m)
      if (m.length !== count.current) { count.current = m.length; setTimeout(() => end.current?.scrollIntoView({ block: 'nearest' })) }
    } catch (e) { if (msgs === null) setErr((e as Error).message) }
  }
  useEffect(() => {
    void refresh()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 15_000)
    return () => clearInterval(t)
  }, [])

  async function submit() {
    if (!text.trim()) return
    setBusy(true); setErr('')
    const e = await send(text)
    setBusy(false)
    if (e) return setErr(e)
    setText('')
    await refresh()
  }

  return (
    <div className="chat">
      {msgs && msgs.length === 0 && <p className="muted small">{empty}</p>}
      {msgs && msgs.length > 0 && (
        <div className="chat-list">
          {msgs.map((m) => {
            const own = (mine === 'admin') === m.from_admin
            return (
              <div key={m.id} className={`bubble ${own ? 'bubble-own' : ''}`}>
                {!own && <span className="bubble-who">{m.from_admin ? 'Поддержка' : 'Пользователь'}</span>}
                <span className="bubble-text">{m.text}</span>
                <span className="bubble-time">{fmt(m.created_at)}{own && m.read_at ? ' · прочитано' : ''}</span>
              </div>
            )
          })}
          <div ref={end} />
        </div>
      )}
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      {err && <div className="error">{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={busy || !text.trim()}>{busy ? 'Отправляю…' : 'Отправить'}</button>
    </div>
  )
}
