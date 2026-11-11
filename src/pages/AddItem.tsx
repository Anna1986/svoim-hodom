import { Link, useParams } from 'react-router-dom'
import { CATEGORIES, CATEGORY_ORDER } from '../db'
import { PageHeader } from '../components/ui'
import { CatIcon, IconChevron } from '../components/icons'

export default function AddItem() {
  const { id } = useParams()
  return (
    <>
      <PageHeader title="Что добавить?" back={`/trips/${id}`} />
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
