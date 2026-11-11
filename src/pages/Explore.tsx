import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, newId } from '../db'
import { coverByKey } from '../covers'
import { aviasalesHot, aviasalesSearch, DESTINATIONS, HOME_CITIES, loadHome, MOODS, setHome, type Destination, type Mood, type Place } from '../explore'
import { formatRangeShort } from '../format'
import { useSyncState } from '../sync'
import { PageHeader } from '../components/ui'
import { IconCalendar, IconPin } from '../components/icons'

function isoIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DestCard({ d, depart, ret, origin, onPlan }: { d: Destination; depart: string; ret: string; origin: Place; onPlan: (d: Destination) => void }) {
  const cover = coverByKey(d.cover)
  return (
    <li className="deal">
      <div className="deal-cover">
        <img className="cover-img" src={cover.src} alt="" loading="lazy" style={{ objectPosition: cover.position }} />
        <div className="cover-fade" />
        <div className="deal-info">
          <div className="deal-city">{d.city}</div>
          {d.country !== d.city && <div className="hero-row small-row"><IconPin size={15} /> {d.country}</div>}
          <div className="deal-blurb">{d.blurb}</div>
        </div>
      </div>
      <div className="deal-actions">
        <a className="btn btn-primary" href={aviasalesSearch(origin.code, d.code, depart, ret)} target="_blank" rel="noopener">Билеты ↗</a>
        <button className="btn" onClick={() => onPlan(d)}>Запланировать</button>
      </div>
    </li>
  )
}

export default function Explore() {
  const sync = useSyncState()
  const navigate = useNavigate()
  const [home, setHomeState] = useState<Place | null | undefined>(undefined)
  const [mood, setMood] = useState<Mood | ''>('')
  const [depart, setDepart] = useState(() => isoIn(30))
  const [ret, setRet] = useState(() => isoIn(37))

  useEffect(() => { loadHome().then(setHomeState) }, [sync.user?.id])

  async function pickHome(code: string) {
    const p = HOME_CITIES.find((c) => c.code === code)
    if (!p) return
    setHomeState(p)
    await setHome(p)
  }

  async function plan(d: Destination) {
    const id = newId()
    const now = Date.now()
    await db.trips.add({
      id,
      title: d.city,
      destination: d.country && d.country !== d.city ? `${d.city}, ${d.country}` : d.city,
      startDate: depart,
      endDate: ret,
      notes: home ? `Билеты из города ${home.name}: ${aviasalesSearch(home.code, d.code, depart, ret)}` : '',
      cover: d.cover,
      createdAt: now,
      updatedAt: now,
    })
    navigate(`/trips/${id}`)
  }

  if (home === undefined) return null

  const list = DESTINATIONS.filter((d) => d.code !== home?.code && (!mood || d.moods.includes(mood)))

  return (
    <>
      <PageHeader title="Куда поехать" />
      <p className="muted lead">Идеи для поездки. Цены и билеты откроются на Авиасейлс сразу с вашими датами.</p>

      <div className="section explore-params">
        <label className="field">
          <span>Откуда</span>
          <select value={home?.code ?? ''} onChange={(e) => pickHome(e.target.value)}>
            {!home && <option value="">Выберите город</option>}
            {HOME_CITIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>Туда</span>
            <input type="date" value={depart} min={isoIn(0)} onChange={(e) => { setDepart(e.target.value); if (ret && e.target.value > ret) setRet('') }} />
          </label>
          <label className="field">
            <span>Обратно</span>
            <input type="date" value={ret} min={depart} onChange={(e) => setRet(e.target.value)} />
          </label>
        </div>
        <div className="explore-dates">
          <IconCalendar size={16} className="ic-blue" /> {formatRangeShort(depart, ret)}{!ret && ' · в одну сторону'}
          {ret && <button className="link-btn" onClick={() => setRet('')}>Без обратного билета</button>}
        </div>
        {home && (
          <a className="hot-link" href={aviasalesHot(home.code)} target="_blank" rel="noopener">
            🔥 Горячие билеты · {home.name} ↗
          </a>
        )}
      </div>

      {!home ? (
        <p className="muted">Выберите город вылета, чтобы смотреть билеты.</p>
      ) : (
        <>
          <div className="chips">
            <button className={`chip ${mood === '' ? 'chip-active' : ''}`} onClick={() => setMood('')}>Все</button>
            {MOODS.map((m) => (
              <button key={m.key} className={`chip ${mood === m.key ? 'chip-active' : ''}`} onClick={() => setMood(m.key)}>{m.label}</button>
            ))}
          </div>
          <ul className="deals">
            {list.map((d) => <DestCard key={d.code} d={d} depart={depart} ret={ret} origin={home} onPlan={plan} />)}
          </ul>
        </>
      )}
    </>
  )
}
