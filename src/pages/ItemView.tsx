import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES, db, deleteItem, eventTypeOf } from '../db'
import { formatDateTime } from '../format'
import { CopyValue, Empty, Linkify, PageHeader } from '../components/ui'
import { Attachments } from '../components/Attachments'
import { CatIcon } from '../components/icons'

function mapsLink(q: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`
}

export default function ItemView() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const item = useLiveQuery(async () => (await db.items.get(itemId!)) ?? null, [itemId])
  const trip = useLiveQuery(async () => (item ? (await db.trips.get(item.tripId)) ?? null : null), [item?.tripId])

  if (item === undefined) return null
  if (item === null) return <Empty icon="🤷"><p>Запись не найдена.</p><Link to="/trips" className="btn">К поездкам</Link></Empty>

  const cfg = CATEGORIES[item.category]
  const tripBack = `/trips/${item.tripId}`

  async function remove() {
    if (!window.confirm(`Удалить «${item!.title}» вместе с файлами?`)) return
    await deleteItem(item!.id)
    navigate(tripBack, { replace: true })
  }

  return (
    <>
      <PageHeader title={item.title} back={tripBack} backLabel={`← ${trip?.title ?? 'Поездка'}`} />
      <div className="kind-label"><CatIcon c={item.category} size={36} /> {eventTypeOf(item) ? `${eventTypeOf(item)!.icon} ${eventTypeOf(item)!.label}` : cfg.one}</div>

      <dl className="details">
        {item.place && cfg.place && (
          <><dt>{cfg.place}</dt><dd><a href={mapsLink(item.place)} target="_blank" rel="noopener" className="link">{item.place}</a></dd></>
        )}
        {item.placeTo && cfg.placeTo && (
          <><dt>{cfg.placeTo}</dt><dd><a href={mapsLink(item.placeTo)} target="_blank" rel="noopener" className="link">{item.placeTo}</a></dd></>
        )}
        {item.startDate && (<><dt>{cfg.start}</dt><dd className="strong">{formatDateTime(item.startDate, item.startTime)}</dd></>)}
        {(item.endDate || item.endTime) && cfg.end && (
          <><dt>{cfg.end}</dt><dd className="strong">{formatDateTime(item.endDate || (item.endTime ? item.startDate : ''), item.endTime)}</dd></>
        )}
        {item.bookingRef && (<><dt>{cfg.ref || 'Номер'}</dt><dd><CopyValue value={item.bookingRef} /></dd></>)}
        {item.link && (<><dt>Ссылка</dt><dd><a href={item.link} target="_blank" rel="noopener" className="link break">{item.link.replace(/^https?:\/\//, '')}</a></dd></>)}
      </dl>

      {item.notes && <p className="description"><Linkify text={item.notes} /></p>}

      <Attachments ownerType="item" ownerId={item.id} />

      <div className="form-actions">
        <Link to={`/items/${item.id}/edit`} className="btn btn-primary">Редактировать</Link>
        <button className="btn btn-danger" onClick={remove}>Удалить</button>
      </div>
    </>
  )
}
