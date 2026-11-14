import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Trip } from '../db'
import { formatRangeShort } from '../format'
import { tripCountdown, tripPhase, type Phase } from '../trip'
import { Empty, Fab, PageHeader } from '../components/ui'
import { AccountBadge } from '../components/Account'
import { coverFor } from '../covers'
import { IconCalendar, IconClock, IconPin } from '../components/icons'
import { useSyncState } from '../sync'
import { useSharedTrips } from '../members'

const SECTIONS: { phase: Phase; title: string }[] = [
  { phase: 'current', title: 'Сейчас' },
  { phase: 'upcoming', title: 'Предстоящие' },
  { phase: 'undated', title: 'Без дат' },
  { phase: 'past', title: 'Прошедшие' },
]

function TripCard({ t, shared }: { t: Trip; shared: boolean }) {
  const countdown = tripCountdown(t)
  const phase = tripPhase(t)
  return (
    <Link to={`/trips/${t.id}`} className={`trip-card trip-${phase}`}>
      <img className="cover-img" src={coverFor(t).src} alt="" loading="lazy" style={{ objectPosition: coverFor(t).position }} />
      <div className="cover-fade" />
      <div className="trip-card-body">
        {shared && <span className="shared-badge">👥 общая</span>}
        <div className="trip-card-title">{t.title}</div>
        {t.destination && <div className="hero-row small-row"><IconPin size={16} /> {t.destination}</div>}
        {(t.startDate || t.endDate) && <div className="hero-row small-row"><IconCalendar size={16} className="ic-blue" /> {formatRangeShort(t.startDate, t.endDate)}</div>}
        {countdown && <span className={`hero-pill hero-pill-${phase}`}><IconClock size={15} /> {countdown}</span>}
      </div>
    </Link>
  )
}

const LOGO = `${import.meta.env.BASE_URL}icon.svg`

function Brand() {
  return <div className="brand-top show-mobile"><img src={LOGO} alt="" /> Своим ходом</div>
}

/** Первый экран для гостя: что это за приложение и зачем оно. */
function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-brand"><img src={LOGO} alt="" /> Своим ходом</div>
      <h1 className="welcome-title">Вся поездка — в одном месте</h1>
      <p className="welcome-sub">Билеты, брони и план по дням вместо поиска по почте и чатам.</p>
      <Link to="/trips/new" className="btn btn-primary welcome-cta">Создать поездку</Link>
      <p className="muted small welcome-note">Это 5 минут и без регистрации</p>
      <ul className="welcome-benefits">
        <li><span>📄</span><div><b>Загрузите билет</b>Рейс, даты и адреса заполнятся сами</div></li>
        <li><span>🗺️</span><div><b>План и карта — автоматически</b>Всё по дням и на карте, даже без интернета</div></li>
        <li><span>👥</span><div><b>Вместе с друзьями</b>Поделитесь поездкой или планируйте её вдвоём</div></li>
      </ul>
      <p className="welcome-trust">Бесплатно · без рекламы · работает без интернета</p>
      <Link to="/settings" className="link welcome-login">У меня уже есть аккаунт — войти</Link>
    </div>
  )
}

export default function TripsList() {
  const trips = useLiveQuery(() => db.trips.toArray(), [])
  const sync = useSyncState()
  const sharedTrips = useSharedTrips()
  if (!trips) return null
  if (sync.ready && !sync.user && trips.length === 0) return <Welcome />

  return (
    <>
      <Brand />
      <PageHeader title="Поездки">
        <Link to="/trips/new" className="btn btn-primary hide-mobile">+ Новая поездка</Link>
      </PageHeader>
      {sync.ready && !sync.user && (
        <Link to="/settings" className="banner">☁️ Сохраните поездки в аккаунте — чтобы не потерять их и открыть на другом устройстве →</Link>
      )}
      {sync.user && <Link to="/settings" className="show-mobile account-link"><AccountBadge compact /></Link>}

      {trips.length === 0 ? (
        <Empty icon="🧳">
          <p>Здесь будут ваши поездки: билеты, брони, ваучеры и план по дням.</p>
          <Link to="/trips/new" className="btn btn-primary">Добавить первую поездку</Link>
        </Empty>
      ) : (
        SECTIONS.map(({ phase, title }) => {
          const list = trips
            .filter((t) => tripPhase(t) === phase)
            .sort((a, b) =>
              phase === 'past'
                ? (b.startDate || b.endDate).localeCompare(a.startDate || a.endDate)
                : (a.startDate || a.endDate || '').localeCompare(b.startDate || b.endDate || '') || b.createdAt - a.createdAt,
            )
          if (!list.length) return null
          return (
            <section key={phase} className="group">
              <h2 className="group-title">{title}</h2>
              <ul className="cards">
                {list.map((t) => <li key={t.id}><TripCard t={t} shared={!!sharedTrips[t.id]} /></li>)}
              </ul>
            </section>
          )
        })
      )}

      <Fab to="/trips/new" label="Новая поездка" />
    </>
  )
}
