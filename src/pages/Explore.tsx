import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, newId } from '../db'
import { coverFor } from '../covers'
import { exploreDeals, ExploreError, loadHome, searchPlaces, setHome, type Deal, type Place } from '../explore'
import { formatRangeShort, plural } from '../format'
import { useSyncState } from '../sync'
import { Empty, PageHeader } from '../components/ui'
import { IconCalendar, IconPin } from '../components/icons'

/* ---------- Вспомогательное ---------- */

function nextMonths(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1)
    const value = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
    let label = m.toLocaleDateString('ru-RU', { month: 'long' })
    label = label.charAt(0).toUpperCase() + label.slice(1)
    if (m.getFullYear() !== d.getFullYear()) label += ` ${m.getFullYear()}`
    out.push({ value, label })
  }
  return out
}

const datePart = (s: string) => s.slice(0, 10)
const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽'

function transfersText(d: Deal, roundtrip: boolean): string {
  const t = Math.max(d.transfers, roundtrip ? d.return_transfers : 0)
  return t === 0 ? 'прямой рейс' : `${t} ${plural(t, 'пересадка', 'пересадки', 'пересадок')}`
}

/* ---------- Выбор города вылета ---------- */

function CityPicker({ onPick, onCancel }: { onPick: (p: Place) => void; onCancel?: () => void }) {
  const [term, setTerm] = useState('')
  const [list, setList] = useState<Place[]>([])
  const [err, setErr] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    if (term.trim().length < 2) { setList([]); return }
    timer.current = setTimeout(async () => {
      try { setErr(''); setList(await searchPlaces(term.trim())) }
      catch (e) { setErr((e as Error).message) }
    }, 300)
  }, [term])

  return (
    <div className="section city-picker">
      <h2>Откуда вы летите?</h2>
      <input className="search-input" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Начните вводить город" />
      {err && <div className="error">{err}</div>}
      {list.length > 0 && (
        <ul className="city-list">
          {list.map((p) => (
            <li key={p.code}>
              <button onClick={() => onPick(p)}>
                <b>{p.name}</b> <span className="muted">{p.country} · {p.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCancel && <button className="link-btn" onClick={onCancel}>Отмена</button>}
    </div>
  )
}

/* ---------- Карточка направления ---------- */

function DealCard({ d, roundtrip, onPlan }: { d: Deal; roundtrip: boolean; onPlan: (d: Deal) => void }) {
  const cover = coverFor({ id: d.destination, title: d.city, destination: `${d.city} ${d.country}` })
  return (
    <li className="deal">
      <div className="deal-cover">
        <img className="cover-img" src={cover.src} alt="" loading="lazy" style={{ objectPosition: cover.position }} />
        <div className="cover-fade" />
        <div className="deal-info">
          <div className="deal-city">{d.city}</div>
          {d.country && <div className="hero-row small-row"><IconPin size={15} /> {d.country}</div>}
          <div className="hero-row small-row">
            <IconCalendar size={15} className="ic-blue" /> {formatRangeShort(datePart(d.departure_at), roundtrip ? datePart(d.return_at) : '')}
          </div>
          <div className="deal-price">от {rub(d.price)}</div>
          <div className="deal-meta">{transfersText(d, roundtrip)}{roundtrip ? ' · туда и обратно' : ' · в одну сторону'}</div>
        </div>
      </div>
      <div className="deal-actions">
        {d.link && <a className="btn btn-primary" href={d.link} target="_blank" rel="noopener">На Авиасейлс ↗</a>}
        <button className="btn" onClick={() => onPlan(d)}>Запланировать</button>
      </div>
    </li>
  )
}

/* ---------- Страница ---------- */

export default function Explore() {
  const sync = useSyncState()
  const navigate = useNavigate()
  const months = nextMonths(7)
  const [home, setHomeState] = useState<Place | null | undefined>(undefined)
  const [picking, setPicking] = useState(false)
  const [month, setMonth] = useState('')
  const [roundtrip, setRoundtrip] = useState(true)
  const [direct, setDirect] = useState(false)
  const [deals, setDeals] = useState<Deal[] | null>(null)
  const [error, setError] = useState<ExploreError | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadHome().then(setHomeState) }, [sync.user?.id])

  useEffect(() => {
    if (!home || !sync.user) return
    let cancelled = false
    setLoading(true); setError(null)
    exploreDeals(home.code, month, roundtrip, direct)
      .then((r) => { if (!cancelled) setDeals(r) })
      .catch((e) => { if (!cancelled) { setDeals(null); setError(e instanceof ExploreError ? e : new ExploreError('other', String(e))) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [home, month, roundtrip, direct, sync.user])

  async function pick(p: Place) {
    setHomeState(p); setPicking(false)
    await setHome(p)
  }

  async function plan(d: Deal) {
    const id = newId()
    const now = Date.now()
    await db.trips.add({
      id,
      title: d.city,
      destination: [d.city, d.country].filter(Boolean).join(', '),
      startDate: datePart(d.departure_at),
      endDate: roundtrip ? datePart(d.return_at) : '',
      notes: `Идея из «Куда поехать»: билеты от ${rub(d.price)}${home ? ` из города ${home.name}` : ''}.${d.link ? `\nСмотреть на Авиасейлс: ${d.link}` : ''}`,
      cover: '',
      createdAt: now,
      updatedAt: now,
    })
    navigate(`/trips/${id}`)
  }

  if (!sync.ready || home === undefined) return null

  if (!sync.user) {
    return (
      <>
        <PageHeader title="Куда поехать" />
        <Empty icon="🧭">
          <p>Подборка дешёвых направлений от Авиасейлс доступна после входа в профиль.</p>
          <Link to="/settings" className="btn btn-primary">Войти</Link>
        </Empty>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Куда поехать" />
      <p className="muted lead">Самые дешёвые направления по данным Авиасейлс. Цены — по недавним поискам, точная стоимость откроется на сайте.</p>

      {!home || picking ? (
        <CityPicker onPick={pick} onCancel={home ? () => setPicking(false) : undefined} />
      ) : (
        <>
          <div className="explore-from">
            <span className="muted">Откуда:</span>
            <button className="from-chip" onClick={() => setPicking(true)}>
              <IconPin size={16} /> {home.name} <span className="muted">✎</span>
            </button>
          </div>

          <div className="chips">
            <button className={`chip ${month === '' ? 'chip-active' : ''}`} onClick={() => setMonth('')}>Ближайшие</button>
            {months.map((m) => (
              <button key={m.value} className={`chip ${month === m.value ? 'chip-active' : ''}`} onClick={() => setMonth(m.value)}>{m.label}</button>
            ))}
          </div>
          <div className="chips">
            <button className={`chip ${roundtrip ? 'chip-active' : ''}`} onClick={() => setRoundtrip(true)}>Туда и обратно</button>
            <button className={`chip ${!roundtrip ? 'chip-active' : ''}`} onClick={() => setRoundtrip(false)}>В одну сторону</button>
            <button className={`chip ${direct ? 'chip-active' : ''}`} onClick={() => setDirect(!direct)}>{direct ? '✓ ' : ''}Только прямые</button>
          </div>

          {loading && <div className="explore-loading">Ищу направления…</div>}

          {!loading && error && (
            <Empty icon={error.code === 'no_token' ? '🔑' : '⚠️'}>
              <p>{error.message}</p>
              {error.code === 'no_token' && <p className="muted small">Нужно один раз добавить ключ Travelpayouts в настройках Supabase.</p>}
              {error.code === 'login' && <Link to="/settings" className="btn btn-primary">Войти</Link>}
            </Empty>
          )}

          {!loading && !error && deals && deals.length === 0 && (
            <Empty icon="🔍"><p>Для этих условий направлений не нашлось. Попробуйте другой месяц или уберите «Только прямые».</p></Empty>
          )}

          {!loading && !error && deals && deals.length > 0 && (
            <ul className="deals">
              {deals.map((d) => <DealCard key={d.destination + d.departure_at} d={d} roundtrip={roundtrip} onPlan={plan} />)}
            </ul>
          )}
        </>
      )}
    </>
  )
}
