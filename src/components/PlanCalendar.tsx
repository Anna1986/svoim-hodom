import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Item } from '../db'
import type { PlanEvent } from '../trip'
import { CatIcon } from './icons'
import { formatDay, todayISO } from '../format'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

/**
 * Календарь поездки: дни поездки подсвечены, в днях с событиями — иконки.
 * Нажатие на день показывает его события под календарём (renderDay).
 */
export function PlanCalendar({ byDay, start, end, items, renderDay }: {
  byDay: [string, PlanEvent[]][]
  start: string
  end: string
  items: Item[]
  renderDay: (date: string, events: PlanEvent[]) => React.ReactNode
}) {
  const eventsByDate = new Map(byDay)

  // Жильё и аренда авто — на все дни, с заезда до выезда включительно
  const staysByDate = new Map<string, Item[]>()
  for (const it of items) {
    if ((it.category !== 'hotel' && it.category !== 'car') || !it.startDate || !it.endDate) continue
    for (let d = parse(it.startDate); iso(d) <= it.endDate; d.setDate(d.getDate() + 1)) {
      const k = iso(d)
      staysByDate.set(k, [...(staysByDate.get(k) ?? []), it])
    }
  }
  const dates = byDay.map(([d]) => d)
  const from = [start, dates[0]].filter(Boolean).sort()[0]
  const to = [end, dates.at(-1)].filter(Boolean).sort().at(-1)
  const today = todayISO()

  const initial = (eventsByDate.has(today) && today) || dates.find((d) => d >= today) || dates[0] || from || ''
  const [selected, setSelected] = useState<string>(initial)

  if (!from || !to) return <p className="muted">Укажите даты поездки или добавьте брони с датами — тогда появится календарь.</p>

  // Месяцы от начала до конца
  const months: Date[] = []
  const cur = new Date(parse(from).getFullYear(), parse(from).getMonth(), 1)
  const last = new Date(parse(to).getFullYear(), parse(to).getMonth(), 1)
  while (cur <= last) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1) }

  const tripStart = start || from
  const tripEnd = end || to

  return (
    <div className="cal">
      {months.map((m) => {
        const offset = (m.getDay() + 6) % 7
        const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
        let title = m.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')
        title = title.charAt(0).toUpperCase() + title.slice(1)
        return (
          <section key={iso(m)} className="cal-month">
            <h3 className="cal-title">{title}</h3>
            <div className="cal-grid">
              {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
              {(() => {
                // Ячейки месяца по неделям; показываем только недели, которые касаются поездки
                const cells: (string | null)[] = [
                  ...Array.from({ length: offset }, () => null),
                  ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1))),
                ]
                while (cells.length % 7) cells.push(null)
                const weeks: (string | null)[][] = []
                for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
                return weeks
                  .filter((w) => w.some((d) => d && d >= from && d <= to))
                  .flat()
                  .map((date, idx) => {
                    if (!date) return <div key={'e' + idx} />
                    const ev = eventsByDate.get(date) ?? []
                    const inTrip = date >= tripStart && date <= tripEnd
                    const cls = [
                      'cal-day',
                      inTrip && 'cal-in',
                      date === tripStart && 'cal-start',
                      date === tripEnd && 'cal-end',
                      date === today && 'cal-today',
                      date === selected && 'cal-sel',
                      ev.length > 0 && 'cal-has',
                    ].filter(Boolean).join(' ')
                    const stays = staysByDate.get(date) ?? []
                    const cats = [...new Set([...ev.map((e) => e.item.category), ...stays.map((it) => it.category)])].slice(0, 3)
                    return (
                      <button key={date} className={cls} onClick={() => setSelected(date)} aria-label={formatDay(date)}>
                        <span className="cal-num">{Number(date.slice(8))}</span>
                        <span className="cal-icons">{cats.map((c) => <CatIcon key={c} c={c} size={16} />)}</span>
                      </button>
                    )
                  })
              })()}
            </div>
          </section>
        )
      })}

      {selected && (
        <div className="cal-details">
          <h3 className="day-title">{formatDay(selected)}{selected === today && <span className="pill pill-current">сегодня</span>}</h3>
          {(() => {
            const ev = eventsByDate.get(selected) ?? []
            // Проживание показываем, если в этот день нет заезда или выезда по этой брони
            const stays = (staysByDate.get(selected) ?? []).filter((it) => !ev.some((e) => e.item.id === it.id))
            if (!ev.length && !stays.length) return <p className="muted">В этот день ничего не запланировано.</p>
            return (
              <>
                {stays.map((it) => (
                  <Link key={it.id} to={`/items/${it.id}`} className="stay-row">
                    <CatIcon c={it.category} size={28} />
                    <span><span className="muted">{it.category === 'hotel' ? 'Проживание' : 'Аренда авто'}:</span> {it.title}</span>
                  </Link>
                ))}
                {ev.length > 0 && renderDay(selected, ev)}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
