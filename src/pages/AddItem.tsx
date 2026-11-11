import { Link, useParams } from 'react-router-dom'
import { CATEGORIES, CATEGORY_ORDER } from '../db'
import { PageHeader } from '../components/ui'

export default function AddItem() {
  const { id } = useParams()
  return (
    <>
      <PageHeader title="Что добавить?" back={`/trips/${id}`} />
      <div className="folders">
        {CATEGORY_ORDER.map((c) => (
          <Link key={c} to={`/trips/${id}/items/new?category=${c}`} replace className="folder">
            <span className="folder-icon">{CATEGORIES[c].icon}</span>
            <span className="folder-label">{CATEGORIES[c].one}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
