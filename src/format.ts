export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return parse(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatShort(iso: string): string {
  if (!iso) return ''
  return parse(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function formatDay(iso: string): string {
  const s = parse(iso).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatRange(start: string, end: string): string {
  if (start && end && start !== end) return `${formatShort(start)} — ${formatDate(end)}`
  return formatDate(start || end)
}

export function formatDateTime(date: string, time: string): string {
  if (!date) return time
  return time ? `${formatDate(date)}, ${time}` : formatDate(date)
}

/** Сколько дней от сегодня до даты (отрицательное — в прошлом). */
export function daysUntil(iso: string): number | null {
  if (!iso) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((parse(iso).getTime() - today) / 86_400_000)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

/** Короткий диапазон для обложки: «6–10 дек. 2026», «28 нояб. – 3 дек. 2026». */
export function formatRangeShort(start: string, end: string): string {
  const a = start || end
  const b = end || start
  if (!a) return ''
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  const mon = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short' })
  if (a === b) return `${da} ${mon(ya, ma)} ${ya}`
  if (ya === yb && ma === mb) return `${da}–${db} ${mon(ya, ma)} ${ya}`
  if (ya === yb) return `${da} ${mon(ya, ma)} – ${db} ${mon(yb, mb)} ${yb}`
  return `${da} ${mon(ya, ma)} ${ya} – ${db} ${mon(yb, mb)} ${yb}`
}
