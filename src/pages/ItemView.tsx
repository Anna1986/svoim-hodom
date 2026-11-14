import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES, db, deleteItem, eventTypeOf, type Item } from '../db'
import { pointUrl, useMapProvider, type MapProvider } from '../geo'
import { matchAirport, matchStation, prettyStation } from '../stations'
import { formatDateTime } from '../format'
import { CopyValue, Empty, Linkify, PageHeader } from '../components/ui'
import { Attachments } from '../components/Attachments'
import { useTripAccess } from '../members'
import { CatIcon } from '../components/icons'

function placeInfo(category: Item['category'], raw: string, provider: MapProvider, ll?: [number, number]): { text: string; href: string } {
  if (ll) return { text: raw, href: pointUrl(provider, ll) }
  const known = category === 'flight' ? matchAirport(raw) : category === 'transport' ? matchStation(raw) : null
  const text = known?.label ?? (category === 'transport' ? prettyStation(raw) : raw)
  if (known?.ll) return { text, href: pointUrl(provider, known.ll) }
  const q = encodeURIComponent(category === 'transport' && !/вокзал/i.test(text) ? `${text} вокзал` : text)
  return { text, href: provider === 'yandex' ? `https://yandex.ru/maps/?text=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}` }
}

export default function ItemView() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const provider = useMapProvider()
  const item = useLiveQuery(async () => (await db.items.get(itemId!)) ?? null, [itemId])
  const trip = useLiveQuery(async () => (item ? (await db.trips.get(item.tripId)) ?? null : null), [item?.tripId])
  const access = useTripAccess(item?.tripId)

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
          <><dt>{cfg.place}</dt><dd><a href={placeInfo(item.category, item.place, provider, item.placeLL).href} target="_blank" rel="noopener" className="link">{placeInfo(item.category, item.place, provider, item.placeLL).text}</a></dd></>
        )}
        {item.placeTo && cfg.placeTo && (
          <><dt>{cfg.placeTo}</dt><dd><a href={placeInfo(item.category, item.placeTo, provider, item.placeToLL).href} target="_blank" rel="noopener" className="link">{placeInfo(item.category, item.placeTo, provider, item.placeToLL).text}</a></dd></>
        )}
        {item.startDate && (<><dt>{cfg.start}</dt><dd className="strong">{formatDateTime(item.startDate, item.startTime)}</dd></>)}
        {(item.endDate || item.endTime) && cfg.end && (
          <><dt>{cfg.end}</dt><dd className="strong">{formatDateTime(item.endDate || (item.endTime ? item.startDate : ''), item.endTime)}</dd></>
        )}
        {item.bookingRef && (<><dt>{cfg.ref || 'Номер'}</dt><dd><CopyValue value={item.bookingRef} /></dd></>)}
        {item.link && (<><dt>Ссылка</dt><dd><a href={item.link} target="_blank" rel="noopener" className="link break">{item.link.replace(/^https?:\/\//, '')}</a></dd></>)}
      </dl>

      {item.notes && <p className="description"><Linkify text={item.notes} /></p>}

      <Attachments ownerType="item" ownerId={item.id} readOnly={!access.canEdit} />

      {access.canEdit && (
        <div className="form-actions">
          <Link to={`/items/${item.id}/edit`} className="btn btn-primary">Редактировать</Link>
          <button className="btn btn-danger" onClick={remove}>Удалить</button>
        </div>
      )}
    </>
  )
}
