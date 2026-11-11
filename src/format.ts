export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Сколько дней до даты (отрицательное — просрочено). */
export function daysUntil(iso: string): number | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86_400_000)
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export function deadlineHint(iso: string): { text: string; tone: 'ok' | 'soon' | 'late' } | null {
  const n = daysUntil(iso)
  if (n === null) return null
  if (n < 0) return { text: `просрочен на ${-n} ${plural(-n, 'день', 'дня', 'дней')}`, tone: 'late' }
  if (n === 0) return { text: 'срок сегодня', tone: 'soon' }
  if (n <= 7) return { text: `через ${n} ${plural(n, 'день', 'дня', 'дней')}`, tone: 'soon' }
  return { text: `через ${n} ${plural(n, 'день', 'дня', 'дней')}`, tone: 'ok' }
}
