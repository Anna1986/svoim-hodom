import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminMessageDone, adminMessages, adminStats, isAdmin, supportList, userTrips, type Stats, type SupportMessage, type SupportRequest } from '../admin'
import { CATEGORIES, eventTypeOf, type Item, type Trip } from '../db'
import { formatDateTime, formatRangeShort } from '../format'
import { PageHeader } from '../components/ui'
import { CatIcon } from '../components/icons'
import { useSyncState } from '../sync'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function useAdmin() {
  const s = useSyncState()
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => { if (s.ready) void (s.user ? isAdmin().then(setOk) : setOk(false)) }, [s.ready, s.user?.id])
  return ok
}

function Num({ n, label, sub }: { n: number; label: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="stat-n">{n.toLocaleString('ru-RU')}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

export default function Admin() {
  const ok = useAdmin()
  const [stats, setStats] = useState<Stats | null>(null)
  const [reqs, setReqs] = useState<SupportRequest[]>([])
  const [msgs, setMsgs] = useState<SupportMessage[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!ok) return
    Promise.all([adminStats(), supportList(), adminMessages()])
      .then(([st, r, m]) => { setStats(st); setReqs(r); setMsgs(m) })
      .catch((e) => { console.error(e); setErr('Не получилось загрузить статистику. Проверьте интернет.') })
  }, [ok])

  if (ok === null) return null
  if (!ok) return <><PageHeader title="Администрирование" back="/settings" /><p className="muted">Этот раздел только для администратора.</p></>

  const max = Math.max(1, ...(stats?.visits_by_day ?? []).map((d) => d.n))

  return (
    <>
      <PageHeader title="Администрирование" back="/settings" />
      {err && <p className="error">{err}</p>}
      {stats && (
        <>
          <h2 className="admin-h">Посетители</h2>
          <div className="stats">
            <Num n={stats.visitors_today} label="сегодня" />
            <Num n={stats.visitors_7d} label="за 7 дней" />
            <Num n={stats.visitors_30d} label="за 30 дней" />
            <Num n={stats.visitors_total} label="всего" />
          </div>
          {stats.visits_by_day.length > 1 && (
            <div className="bars" aria-label="Посетители по дням за 30 дней">
              {stats.visits_by_day.map((d) => (
                <span key={d.day} className="bar" style={{ height: `${(d.n / max) * 100}%` }} title={`${d.day}: ${d.n}`} />
              ))}
            </div>
          )}
          <p className="muted small">Посетитель — один браузер за день; телефон и компьютер одного человека считаются отдельно.</p>

          <h2 className="admin-h">Пользователи</h2>
          <div className="stats">
            <Num n={stats.users_total} label="зарегистрировано" />
            <Num n={stats.users_7d} label="новых за 7 дней" />
            <Num n={stats.users_active_7d} label="активных за 7 дней" sub="что-то меняли" />
          </div>

          <h2 className="admin-h">Поездки</h2>
          <div className="stats">
            <Num n={stats.trips_total} label="поездок" sub={`+${stats.trips_7d} за неделю`} />
            <Num n={stats.items_total} label="броней и билетов" />
            <Num n={stats.files_total} label="файлов" />
            <Num n={stats.shares_active} label="ссылок «Поделиться»" />
          </div>
        </>
      )}

      <h2 className="admin-h">Сообщения в поддержку{msgs.some((m) => !m.done_at) && ` · новых ${msgs.filter((m) => !m.done_at).length}`}</h2>
      {msgs.length === 0 ? <p className="muted">Сообщений пока нет.</p> : (
        <div className="rows">
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.done_at ? 'msg-done' : ''}`}>
              <div className="row-sub">{m.name || m.email} · {m.email} · {fmt(m.created_at)}</div>
              <div className="msg-text">{m.text}</div>
              <div className="person-actions msg-actions">
                <a className="link-btn" href={`mailto:${m.email}?subject=${encodeURIComponent('Своим ходом — ответ поддержки')}&body=${encodeURIComponent('\n\n> ' + m.text.replace(/\n/g, '\n> '))}`}>Ответить по почте</a>
                <button className="link-btn" onClick={async () => { await adminMessageDone(m.id, !m.done_at); setMsgs(await adminMessages()) }}>
                  {m.done_at ? 'Вернуть в новые' : 'Отметить решённым'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="admin-h">Открыли доступ к поездкам</h2>
      {reqs.length === 0 ? (
        <p className="muted">Сейчас никто не открыл доступ поддержке. Пользователь открывает его сам в профиле на 24 часа.</p>
      ) : (
        <div className="rows">
          {reqs.map((r) => (
            <Link key={r.user_id} to={`/admin/u/${r.user_id}`} className="row">
              <span className="row-body">
                <span className="row-title">{r.name || r.email}</span>
                <span className="row-sub">{r.email} · доступ до {fmt(r.expires_at)}</span>
                {r.note && <span className="row-sub">«{r.note}»</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
      <p className="muted small">Пользователь видит в профиле каждый ваш просмотр его поездок.</p>
    </>
  )
}

export function AdminUser() {
  const ok = useAdmin()
  const { userId } = useParams()
  const [data, setData] = useState<{ trips: Trip[]; items: Item[] } | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!ok || !userId) return
    userTrips(userId).then(setData).catch((e) => {
      console.error(e)
      setErr(/no access/.test(String(e?.message)) ? 'Пользователь закрыл доступ или срок истёк.' : 'Не получилось загрузить данные.')
    })
  }, [ok, userId])

  if (!ok) return null
  return (
    <>
      <PageHeader title="Поездки пользователя" back="/admin" />
      <p className="muted small">Только просмотр. Документы и файлы пользователя не показываются.</p>
      {err && <p className="error">{err}</p>}
      {data && data.trips.length === 0 && <p className="muted">Поездок в облаке нет.</p>}
      {data?.trips.sort((a, b) => (a.startDate || '9').localeCompare(b.startDate || '9')).map((t) => {
        const list = data.items.filter((i) => i.tripId === t.id)
          .sort((a, b) => (a.startDate + a.startTime || '9').localeCompare(b.startDate + b.startTime || '9'))
        return (
          <section key={t.id} className="section">
            <h2>{t.title}</h2>
            <p className="muted small">{[t.destination, formatRangeShort(t.startDate, t.endDate)].filter(Boolean).join(' · ')}</p>
            {list.length === 0 ? <p className="muted small">Броней нет.</p> : (
              <div className="rows">
                {list.map((it) => (
                  <div key={it.id} className="row">
                    <CatIcon c={it.category} size={36} />
                    <span className="row-body">
                      <span className="row-sub">{eventTypeOf(it)?.label ?? CATEGORIES[it.category]?.one}</span>
                      <span className="row-title">{it.title}</span>
                      {(it.place || it.placeTo) && <span className="row-sub">{[it.place, it.placeTo].filter(Boolean).join(' → ')}</span>}
                      {it.startDate && <span className="row-sub">{formatDateTime(it.startDate, it.startTime)}{it.endDate ? ` — ${formatDateTime(it.endDate, it.endTime)}` : ''}</span>}
                      {it.bookingRef && <span className="row-sub">{CATEGORIES[it.category]?.ref}: {it.bookingRef}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </>
  )
}
