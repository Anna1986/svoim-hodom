import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({ title, back, backLabel = '← Назад', children }: {
  title: ReactNode
  back?: string
  backLabel?: string
  children?: ReactNode
}) {
  return (
    <header className={`page-header ${back ? 'page-header-sub' : ''}`}>
      {back && <Link to={back} className="back">{backLabel}</Link>}
      <div className="title-row">
        <h1>{title}</h1>
        {children}
      </div>
    </header>
  )
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      {children}
    </div>
  )
}

export function Fab({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="fab" aria-label={label}>+</Link>
}

export function CopyValue({ value }: { value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      const el = document.activeElement as HTMLElement | null
      el?.setAttribute('data-copied', '1')
      setTimeout(() => el?.removeAttribute('data-copied'), 1200)
    } catch {
      /* нет доступа к буферу */
    }
  }
  return (
    <button type="button" className="copy" onClick={copy} title="Скопировать">
      <span className="mono">{value}</span> <span className="copy-icon">⧉</span>
    </button>
  )
}
