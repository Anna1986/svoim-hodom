import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES, CATEGORY_ORDER, db, deleteTrip, type Category, type Item } from '../db'
import { formatDay, formatRangeShort, formatShort, todayISO } from '../format'
import { buildPlan, fittedDates, fitTripToTickets, passportWarnings, tripCountdown, tripPhase } from '../trip'
import { useEffect } from 'react'
import { Empty, Fab, Linkify } from '../components/ui'
import { coverFor } from '../covers'
import { CatIcon, IconBack, IconCalendar, IconChevron, IconClock, IconList, IconPin, IconTicket } from '../components/icons'
import { PlanCalendar } from '../components/PlanCalendar'
import type { PlanEvent } from '../trip'

function placeLine(item: Item): string {
  if (item.place && item.placeTo) return `${item.place} → ${item.placeTo}`
  return item.place || item.placeTo
}

function ItemRow({ item, fileCount }: { item: Item; fileCount: number }) {
  const when = item.startDate
    ? `${formatShort(item.startDate)}${item.startTime ? ' ' + item.startTime : ''}` +
      (item.endDate && item.endDate !== item.startDate ? ` — ${formatShort(item.endDate)}` : '')
    : ''
  return (
    <Link to={`/items/${item.id}`} className="row">
      <CatIcon c={item.category} size={44} className="row-img" />
      <span className="row-body">
        <span className="row-title">{item.title}</span>
        {placeLine(item) && <span className="row-sub">{placeLine(item)}</span>}
        {when && <span className="row-sub">{when}</span>}
      </span>
      {fileCount > 0 && <span className="row-files">📎{fileCount}</span>}
    </Link>
  )
}

export default function TripView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Слева — «Брони и билеты» (по умолчанию), справа — план
  const tab = params.get('tab') === 'plan' ? 'plan' : 'folders'
  const view = params.get('view') === 'calendar' ? 'calendar' : 'list'
  const folder = params.get('folder') as Category | null

  const trip = useLiveQuery(async () => (await db.trips.get(id!)) ?? null, [id])
  const items = useLiveQuery(() => db.items.where('tripId').equals(id!).toArray(), [id])
  const fileCounts = useLiveQuery(async () => {
    const ids = (await db.items.where('tripId').equals(id!).primaryKeys()) as string[]
    const counts: Record<string, number> = {}
    if (ids.length) {
      await db.attachments.where('ownerId').anyOf(ids).each((a) => { counts[a.ownerId] = (counts[a.ownerId] ?? 0) + 1 })
    }
    return counts
  }, [id])
  const docs = useLiveQuery(() => db.docs.toArray(), [])

  // Билеты могли прийти с другого устройства или появиться раньше этой функции — подгоняем даты.
  useEffect(() => {
    if (!trip || !items) return
    const next = fittedDates(trip, items)
    if (next.startDate !== trip.startDate || next.endDate !== trip.endDate) void fitTripToTickets(trip.id)
  }, [trip, items])

  if (trip === undefined || !items || !fileCounts || !docs) return null
  if (trip === null) {
    return <Empty icon="🤷"><p>Поездка не найдена.</p><Link to="/trips" className="btn">К поездкам</Link></Empty>
  }

  const countdown = tripCountdown(trip)
  const warnings = tripPhase(trip) !== 'past' ? passportWarnings(trip, docs) : []
  const { byDay, undated } = buildPlan(items)
  const today = todayISO()
  const nextKey = byDay.flatMap(([, ev]) => ev).find((e) => e.date >= today)?.key

  async function remove() {
    if (!window.confirm(`Удалить поездку «${trip!.title}» вместе со всеми бронями и файлами?`)) return
    await deleteTrip(trip!.id)
    navigate('/trips', { replace: true })
  }

  function renderEvents(events: PlanEvent[]) {
    return (
      <ul className="events">
        {events.map((e) => (
          <li key={e.key}>
            <Link to={`/items/${e.item.id}`} className={`event ${e.key === nextKey ? 'event-next' : ''}`}>
              <span className="event-time">
                {e.time || '—'}
                {e.timeEnd && <small>{e.timeEnd}</small>}
              </span>
              <CatIcon c={e.item.category} size={40} className="event-img" />
              <span className="event-body">
                {e.label && <span className="event-label">{e.label}</span>}
                <span className="event-title">{e.item.title}</span>
                {placeLine(e.item) && <span className="row-sub">{placeLine(e.item)}</span>}
              </span>
              {fileCounts![e.item.id] > 0 && <span className="row-files">📎</span>}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const addLink = folder ? `/trips/${trip.id}/items/new?category=${folder}` : `/trips/${trip.id}/add`

  return (
    <>
      <Link to="/trips" className="hero-back"><IconBack size={18} /> Поездки</Link>
      <header className="hero">
        <img className="cover-img" src={coverFor(trip).src} alt="" style={{ objectPosition: coverFor(trip).position }} />
        <div className="cover-fade" />
        <div className="hero-content">
          <h1 className="hero-title">{trip.title}</h1>
          {trip.destination && <div className="hero-row"><IconPin /> {trip.destination}</div>}
          {(trip.startDate || trip.endDate) && <div className="hero-row"><IconCalendar className="ic-blue" /> {formatRangeShort(trip.startDate, trip.endDate)}</div>}
          {countdown && <span className={`hero-pill hero-pill-${tripPhase(trip)}`}><IconClock /> {countdown}</span>}
        </div>
      </header>

      {warnings.map((w, i) => <div key={i} className="warning">⚠️ {w}</div>)}

      <div className="tabs" role="tablist">
        <button role="tab" className={`tab ${tab === 'folders' ? 'tab-active' : ''}`} onClick={() => setParams({}, { replace: true })}>
          <IconTicket size={20} /> Брони и билеты
        </button>
        <button role="tab" className={`tab ${tab === 'plan' ? 'tab-active' : ''}`} onClick={() => setParams({ tab: 'plan', ...(view === 'calendar' ? { view } : {}) }, { replace: true })}>
          <IconCalendar size={20} /> План
        </button>
      </div>

      {tab === 'plan' && (
        items.length === 0 ? (
          <Empty icon="🗺️">
            <p>Добавьте билеты, жильё и экскурсии — план по дням соберётся сам.</p>
            <Link to={`/trips/${trip.id}/add`} className="btn btn-primary">Добавить бронь</Link>
          </Empty>
        ) : (
          <div className="plan">
            <div className="view-toggle">
              <button className={view === 'list' ? 'active' : ''} onClick={() => setParams({ tab: 'plan' }, { replace: true })}><IconList /> По дням</button>
              <button className={view === 'calendar' ? 'active' : ''} onClick={() => setParams({ tab: 'plan', view: 'calendar' }, { replace: true })}><IconCalendar size={18} /> Календарь</button>
            </div>
            {view === 'calendar' ? (
              <PlanCalendar byDay={byDay} start={trip.startDate} end={trip.endDate} renderDay={(_, events) => renderEvents(events)} />
            ) : (
              byDay.map(([date, events]) => (
                <section key={date} className={`day ${date < today ? 'day-past' : ''} ${date === today ? 'day-today' : ''}`}>
                  <h3 className="day-title">
                    {formatDay(date)}
                    {date === today && <span className="pill pill-current">сегодня</span>}
                  </h3>
                  {renderEvents(events)}
                </section>
              ))
            )}
            {undated.length > 0 && (
              <section className="day">
                <h3 className="day-title">Без даты</h3>
                <div className="rows">{undated.map((it) => <ItemRow key={it.id} item={it} fileCount={fileCounts[it.id] ?? 0} />)}</div>
              </section>
            )}
            {items.some((i) => !CATEGORIES[i.category].inPlan) && (
              <p className="muted small">Визы и страховки — во вкладке «Брони и билеты».</p>
            )}
          </div>
        )
      )}

      {tab === 'folders' && !folder && (
        <div className="folders">
          {CATEGORY_ORDER.map((c) => {
            const n = items.filter((i) => i.category === c).length
            return (
              <button key={c} className="folder" onClick={() => setParams({ folder: c })}>
                <CatIcon c={c} size={76} className="folder-img" />
                <span className="folder-count">{n}</span>
                <span className="folder-foot">
                  <span className="folder-label">{CATEGORIES[c].label}</span>
                  <IconChevron size={18} className="folder-chevron" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'folders' && folder && CATEGORIES[folder] && (
        <section>
          <button className="back back-btn" onClick={() => setParams({}, { replace: true })}>← Все брони и билеты</button>
          <h2 className="folder-heading"><CatIcon c={folder} size={48} /> {CATEGORIES[folder].label}</h2>
          {(() => {
            const list = items
              .filter((i) => i.category === folder)
              .sort((a, b) => (a.startDate + a.startTime || '9').localeCompare(b.startDate + b.startTime || '9'))
            return list.length ? (
              <div className="rows">{list.map((it) => <ItemRow key={it.id} item={it} fileCount={fileCounts[it.id] ?? 0} />)}</div>
            ) : (
              <p className="muted">Пока пусто.</p>
            )
          })()}
          <Link to={addLink} className="btn btn-soft add-inline">+ Добавить: {CATEGORIES[folder].one.toLowerCase()}</Link>
        </section>
      )}

      {trip.notes && (
        <section className="section notes-section">
          <h2>Заметки</h2>
          <p className="description"><Linkify text={trip.notes} /></p>
        </section>
      )}

      <div className="form-actions page-actions">
        <Link to={`/trips/${trip.id}/edit`} className="btn">Изменить</Link>
        <button className="btn btn-danger" onClick={remove}>Удалить</button>
      </div>

      <Fab to={addLink} label="Добавить" />
    </>
  )
}
