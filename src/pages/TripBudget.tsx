import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORY_ORDER, CATEGORIES, db, type Category } from '../db'
import { formatMoneyTotal, formatTicketPrice, tripBudget, type MoneyTotal } from '../money'
import { PageHeader, Empty } from '../components/ui'
import { CatIcon } from '../components/icons'
import { useTripAccess } from '../members'

function Amounts({ totals }: { totals: MoneyTotal[] }) {
  return <span className="budget-amounts">{totals.map((total) => <span key={total.currency}>{formatMoneyTotal(total)}</span>)}</span>
}

export default function TripBudget() {
  const { id } = useParams()
  const trip = useLiveQuery(async () => (await db.trips.get(id!)) ?? null, [id])
  const items = useLiveQuery(() => db.items.where('tripId').equals(id!).toArray(), [id])
  const access = useTripAccess(id)
  if (trip === undefined || items === undefined) return <p className="muted">Загружаем бюджет…</p>
  if (!trip) return <Empty icon="🧳"><p>Поездка не найдена.</p><Link to="/trips" className="btn">К поездкам</Link></Empty>
  const budget = tripBudget(trip.id, items)
  const groups = [...budget.groups].sort((a, b) => CATEGORY_ORDER.indexOf(a.category as Category) - CATEGORY_ORDER.indexOf(b.category as Category))
  return <>
    <PageHeader title="Бюджет поездки" back={`/trips/${trip.id}`} backLabel={`← ${trip.title}`} />
    <section className="budget-summary" aria-label="Итоговая стоимость">
      <h2>Итоговая стоимость</h2>
      {budget.totals.length ? <div className="budget-total"><Amounts totals={budget.totals} /></div> : <p className="muted">Стоимость пока не указана.</p>}
      <p className="muted small">Сумма указанных расходов поездки. Жильё учитывается один раз за весь период проживания.</p>
      {budget.totals.length > 1 && <p className="muted small">Итоги по валютам показаны отдельно, без пересчёта по курсу.</p>}
      {budget.missingCount > 0 && <p className="budget-missing">Без указанной стоимости: {budget.missingCount}. Эти записи не включены в итог.</p>}
    </section>
    {access.canEdit && <Link to={`/trips/${trip.id}/items/new?category=other&from=budget`} className="btn btn-primary budget-add">+ Добавить расход</Link>}
    {items.length === 0 ? <Empty icon="💰"><p>Добавьте билеты, жильё или другие расходы — бюджет соберётся автоматически.</p></Empty> : <>
      <h2>Расходы по статьям</h2>
      {groups.map((group) => {
        const category = group.category as Category
        return <section className="budget-category" key={category} aria-label={CATEGORIES[category]?.label ?? 'Другое'}>
          <div className="budget-category-head">
            <h3><CatIcon c={CATEGORIES[category] ? category : 'other'} size={32} />{CATEGORIES[category]?.label ?? 'Другое'}</h3>
            {group.totals.length ? <Amounts totals={group.totals} /> : <span className="muted small">Стоимость не указана</span>}
          </div>
          <ul className="budget-items">{group.items.map((item) => <li key={item.id}>
            <Link to={`/items/${item.id}`} className="budget-item">
              <span className="budget-item-name">{item.title}{item.category === 'hotel' && <span className="row-sub">За весь период проживания</span>}</span>
              <span className={`budget-item-price ${!formatTicketPrice(item.ticketPrice) ? 'muted' : ''}`}>{formatTicketPrice(item.ticketPrice) || 'Не указана'}</span>
            </Link>
          </li>)}</ul>
        </section>
      })}
    </>}
  </>
}
