import Dexie, { type EntityTable } from 'dexie'

export type ProjectStatus = 'planned' | 'active' | 'paused' | 'done'

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planned', label: 'Планируется' },
  { value: 'active', label: 'В работе' },
  { value: 'paused', label: 'На паузе' },
  { value: 'done', label: 'Завершён' },
]

export function statusLabel(s: ProjectStatus): string {
  return PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s
}

export interface Project {
  id: string
  name: string
  description: string
  client: string
  status: ProjectStatus
  startDate: string // YYYY-MM-DD или ''
  dueDate: string // YYYY-MM-DD или ''
  createdAt: number
  updatedAt: number
}

export const db = new Dexie('sup') as Dexie & {
  projects: EntityTable<Project, 'id'>
}

db.version(1).stores({
  projects: 'id, status, dueDate, updatedAt',
})

/** Просим браузер не удалять данные при нехватке места (важно на телефонах). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    /* не критично */
  }
}

export function newId(): string {
  return crypto.randomUUID()
}
