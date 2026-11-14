import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CATEGORIES, eventTypeOf, type Item } from '../db'
import { coverFor } from '../covers'
import { fetchShared, type SharedFile, type SharedTrip as Shared } from '../share'
import { formatDateTime, formatDay, formatRangeShort, formatSize, todayISO } from '../format'
import { buildPlan, tripCountdown, tripPhase, type PlanEvent } from '../trip'
import { CopyValue, Empty, Linkify } from '../components/ui'
import { CatIcon, IconCalendar, IconClock, IconList, IconPin, IconTicket } from '../components/icons'
import { PlanCalendar } from '../components/PlanCalendar'

function placeLine(item: Item): string {
  if (item.place && item.placeTo) return `${item.place} → ${item.placeTo}`
  return item.place || item.placeTo
}

function ItemCard({ item, files, open, onToggle }: { item: Item; files: SharedFile[]; open: boolean; onToggle: () => void }) {
  const cfg = CATEGORIES[item.category]
  return (
    <div className={`shared-item ${open ? 'shared-item-open' : ''}`}>
      <button className="row shared-row" onClick={onToggle}>
        <CatIcon c={item.category} size={44} />
        <span className="row-body">
          {eventTypeOf(item) && <span className="event-label">{eventTypeOf(item)!.icon} {eventTypeOf(item)!.label}</span>}
          <span className="row-title">{item.title}</span>
          {placeLine(item) && <span className="row-sub">{placeLine(item)}</span>}
          {item.startDate && <span className="row-sub">{formatDateTime(item.startDate, item.startTime)}</span>}
        </span>
        {files.length > 0 && <span className="row-files">📎{files.length}</span>}
      </button>
      {open && (
        <div className="shared-details">
          <dl className="details">
            {item.startDate && (<><dt>{cfg.start}</dt><dd className="strong">{formatDateTime(item.startDate, item.startTime)}</dd></>)}
            {(item.endDate || item.endTime) && cfg.end && (<><dt>{cfg.end}</dt><dd className="strong">{formatDateTime(item.endDate || item.startDate, item.endTime)}</dd></>)}
            {item.place && cfg.place && (<><dt>{cfg.place}</dt><dd>{item.place}</dd></>)}
            {item.placeTo && cfg.placeTo && (<><dt>{cfg.placeTo}</dt><dd>{item.placeTo}</dd></>)}
            {item.bookingRef && (<><dt>{cfg.ref || 'Номер'}</dt><dd><CopyValue value={item.bookingRef} /></dd></>)}
            {item.link && (<><dt>Ссылка</dt><dd><a href={item.link} target="_blank" rel="noopener" className="link break">{item.link.replace(/^https?:\/\//, '')}</a></dd></>)}
          </dl>
          {item.notes && <p className="description"><Linkify text={item.notes} /></p>}
          {files.length > 0 && (
            <ul className="att-list">
              {files.map((f) => (
                <li key={f.id} className="att">
                  <a href={f.url} target="_blank" rel="noopener" className="att-preview">
                    {f.mime.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <span className="att-icon">{f.mime === 'application/pdf' ? '📕' : '📄'}</span>}
                  </a>
                  <div className="att-info">
                    <a href={f.url} target="_blank" rel="noopener" className="att-name">{f.name}</a>
                    <span className="att-size">{formatSize(f.size)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function SharedTrip() {
  const { token } = useParams()
  const [data, setData] = useState<Shared | null | undefined>(undefined)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'items' | 'plan'>('items')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetchShared(token!).then(setData).catch((e) => { setErr(e.message); setData(null) })
  }, [token])

  if (data === undefined) return <div className="shared-page"><div className="explore-loading">Открываю поездку…</div></div>
  if (data === null) {
    return (
      <div className="shared-page">
        <Empty icon="🔒">
          <p>{err || 'Ссылка недействительна: её отозвали или поездку удалили.'}</p>
          <a href={location.pathname} className="btn">Открыть приложение «Своим ходом»</a>
        </Empty>
      </div>
    )
  }

  const { trip, items, files, ownerName } = data
  const cover = coverFor(trip)
  const countdown = tripCountdown(trip)
  const { byDay, undated } = buildPlan(items)
  const today = todayISO()
  const filesOf = (id: string) => files.filter((f) => f.ownerId === id)

  const renderEvents = (events: PlanEvent[]) => (
    <ul className="events">
      {events.map((e) => (
        <li key={e.key}>
          <button className="event shared-event" onClick={() => { setTab('items'); setOpen(e.item.id) }}>
            <span className="event-time">{e.time || '—'}{e.timeEnd && <small>{e.timeEnd}</small>}</span>
            <CatIcon c={e.item.category} size={40} />
            <span className="event-body">
              {e.label && <span className="event-label">{e.label}</span>}
              <span className="event-title">{e.item.title}</span>
              {placeLine(e.item) && <span className="row-sub">{placeLine(e.item)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="shared-page">
      <div className="shared-banner">
        <span>👀 {ownerName ? `${ownerName} делится с вами поездкой` : 'С вами поделились поездкой'}</span>
        <span className="muted small">только просмотр</span>
      </div>

      <header className="hero">
        <img className="cover-img" src={cover.src} alt="" style={{ objectPosition: cover.position }} />
        <div className="cover-fade" />
        <div className="hero-content">
          <h1 className="hero-title">{trip.title}</h1>
          {trip.destination && <div className="hero-row"><IconPin /> {trip.destination}</div>}
          {(trip.startDate || trip.endDate) && <div className="hero-row"><IconCalendar className="ic-blue" /> {formatRangeShort(trip.startDate, trip.endDate)}</div>}
          {countdown && <span className={`hero-pill hero-pill-${tripPhase(trip)}`}><IconClock /> {countdown}</span>}
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button className={`tab ${tab === 'items' ? 'tab-active' : ''}`} onClick={() => setTab('items')}><IconTicket size={20} /> Брони и билеты</button>
        <button className={`tab ${tab === 'plan' ? 'tab-active' : ''}`} onClick={() => setTab('plan')}><IconCalendar size={20} /> План</button>
      </div>

      {items.length === 0 && <Empty icon="🗺️"><p>В поездке пока нет броней.</p></Empty>}

      {tab === 'items' && items.length > 0 && (
        <div className="rows">
          {[...items]
            // По датам по возрастанию; записи без даты — в конце
            .sort((a, b) => (a.startDate ? a.startDate + (a.startTime || '99:99') : '9999').localeCompare(b.startDate ? b.startDate + (b.startTime || '99:99') : '9999'))
            .map((it) => (
              <ItemCard key={it.id} item={it} files={filesOf(it.id)} open={open === it.id} onToggle={() => setOpen(open === it.id ? null : it.id)} />
            ))}
        </div>
      )}

      {tab === 'plan' && items.length > 0 && (
        <div className="plan">
          <div className="view-toggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><IconList /> По дням</button>
            <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><IconCalendar size={18} /> Календарь</button>
          </div>
          {view === 'calendar' ? (
            <PlanCalendar byDay={byDay} start={trip.startDate} end={trip.endDate} items={items} renderDay={(_, ev) => renderEvents(ev)} />
          ) : (
            byDay.map(([date, events]) => (
              <section key={date} className={`day ${date < today ? 'day-past' : ''}`}>
                <h3 className="day-title">{formatDay(date)}{date === today && <span className="pill pill-current">сегодня</span>}</h3>
                {renderEvents(events)}
              </section>
            ))
          )}
          {undated.length > 0 && <p className="muted small">Ещё {undated.length} без даты — во вкладке «Брони и билеты».</p>}
        </div>
      )}

      {trip.notes && (
        <section className="section notes-section">
          <h2>Заметки</h2>
          <p className="description"><Linkify text={trip.notes} /></p>
        </section>
      )}

      <aside className="shared-cta">
        <div className="shared-cta-title">Собираетесь в поездку?</div>
        <p>Соберите свою так же: билеты, брони и план по дням — в одном месте, даже без интернета.</p>
        <a href={`${location.pathname}#/trips/new`} className="btn btn-primary">Создать свою поездку</a>
        <span className="muted small">Бесплатно · приложение «Своим ходом»</span>
      </aside>
    </div>
  )
}
