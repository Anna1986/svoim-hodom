import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TicketImport } from '../components/TicketImport'
import { setPendingImport } from '../ticketImport'
import { CATEGORIES, CATEGORY_ORDER } from '../db'
import { PageHeader } from '../components/ui'
import { CatIcon, IconChevron } from '../components/icons'

export default function AddItem() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  return (
    <>
      <PageHeader title="Что добавить?" back={`/trips/${id}`} />
      <TicketImport big onResult={(r) => {
        if (!r.parsed && r.error.startsWith('Такой файл')) return setError(r.error)
        setPendingImport(r)
        navigate(`/trips/${id}/items/new?category=${r.parsed?.category ?? 'other'}`, { replace: true })
      }} />
      {error && <p className="error">{error}</p>}
      <p className="muted small">или выберите, что добавить:</p>
      <div className="folders">
        {CATEGORY_ORDER.map((c) => (
          <Link key={c} to={`/trips/${id}/items/new?category=${c}`} replace className="folder">
            <CatIcon c={c} size={76} className="folder-img" />
            <span className="folder-foot">
              <span className="folder-label">{CATEGORIES[c].one}</span>
              <IconChevron size={18} className="folder-chevron" />
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
