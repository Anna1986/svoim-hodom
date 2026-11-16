import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { buildPlan } from '../trip'
import { todayISO, formatDay } from '../format'

export default function MyDay() {
  const { id } = useParams()
  const trip = useLiveQuery(async () => (await db.trips.get(id!)) ?? null, [id])
  const items = useLiveQuery(() => db.items.where('tripId').equals(id!).toArray(), [id])
  if (trip === undefined || items === undefined) return <p className="muted">Загружаем день…</p>
  if (!trip) return <p>Поездка не найдена. <Link to="/trips">К поездкам</Link></p>
  const today = todayISO()
  const { byDay } = buildPlan(items)
  const events = byDay.find(([date]) => date === today)?.[1] ?? []
  return <section className="section">
    <Link className="back" to={`/trips/${trip.id}`}>← {trip.title}</Link>
    <h1>Мой день</h1>
    <p className="muted">{formatDay(today)}</p>
    <p><Link className="btn" to={`/trips/${trip.id}?tab=plan&view=map`}>🗺️ Маршрут на карте</Link></p>
    {events.length === 0 ? <p className="muted">На сегодня событий пока нет. Добавьте их в план поездки.</p> :
      <ul className="events">{events.map(event => <li key={event.key}>
        <Link className="event" to={`/items/${event.item.id}`}>
          <span className="event-time">{event.time || '—'}</span>
          <span className="event-body">
            <span className="event-title">{event.item.title}</span>
            {event.item.place && <span className="row-sub">📍 {event.item.place}</span>}
            {event.label && <span className="row-sub">{event.label}</span>}
          </span>
        </Link>
        {event.item.link && /^https?:\/\//i.test(event.item.link) && <a href={event.item.link} target="_blank" rel="noopener noreferrer">Открыть ссылку ↗</a>}
      </li>)}</ul>}
  </section>
}
