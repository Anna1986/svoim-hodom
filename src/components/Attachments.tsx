import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addAttachments, db, type Attachment, type OwnerType } from '../db'
import { formatSize } from '../format'

function useObjectUrl(blob: Blob): string {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return url
}

function fileIcon(mime: string): string {
  if (mime === 'application/pdf') return '📕'
  if (mime.startsWith('image/')) return '🖼️'
  return '📄'
}

function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([''], 'x.txt', { type: 'text/plain' })] })
  } catch {
    return false
  }
}

function Tile({ a }: { a: Attachment }) {
  const url = useObjectUrl(a.blob)
  const isImage = a.mime.startsWith('image/')

  async function share() {
    try {
      await navigator.share({ files: [new File([a.blob], a.name, { type: a.mime })], title: a.name })
    } catch {
      /* пользователь закрыл окно */
    }
  }

  async function remove() {
    if (window.confirm(`Удалить файл «${a.name}»?`)) await db.attachments.delete(a.id)
  }

  return (
    <li className="att">
      <a href={url} target="_blank" rel="noopener" className="att-preview" title="Открыть">
        {isImage ? <img src={url} alt={a.name} /> : <span className="att-icon">{fileIcon(a.mime)}</span>}
      </a>
      <div className="att-info">
        <a href={url} target="_blank" rel="noopener" className="att-name">{a.name}</a>
        <span className="att-size">{formatSize(a.size)}</span>
      </div>
      <div className="att-actions">
        {canShareFiles() && <button type="button" className="icon-btn" onClick={share} aria-label="Поделиться или сохранить">⤴︎</button>}
        <a className="icon-btn" href={url} download={a.name} aria-label="Скачать">⬇︎</a>
        <button type="button" className="icon-btn icon-danger" onClick={remove} aria-label="Удалить">✕</button>
      </div>
    </li>
  )
}

/** Файлы, уже сохранённые у записи или документа. */
export function Attachments({ ownerType, ownerId }: { ownerType: OwnerType; ownerId: string }) {
  const list = useLiveQuery(() => db.attachments.where('ownerId').equals(ownerId).sortBy('createdAt'), [ownerId])
  const [busy, setBusy] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      await addAttachments(ownerType, ownerId, files)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <h2>Файлы {list && list.length > 0 && <span className="muted-inline">· {list.length}</span>}</h2>
      {list && list.length > 0 ? (
        <ul className="att-list">{list.map((a) => <Tile key={a.id} a={a} />)}</ul>
      ) : (
        <p className="muted">Прикрепите билет, бронь, ваучер или фото документа.</p>
      )}
      <label className={`btn btn-soft att-add ${busy ? 'disabled' : ''}`}>
        <input type="file" multiple hidden onChange={onPick} disabled={busy} />
        {busy ? 'Сохраняю…' : '📎 Прикрепить файл'}
      </label>
    </section>
  )
}

/** Выбор файлов в форме до сохранения записи. */
export function PendingFiles({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div className="field">
      <span>Файлы</span>
      {files.length > 0 && (
        <ul className="pending">
          {files.map((f, i) => (
            <li key={i}>
              <span>{fileIcon(f.type)} {f.name}</span>
              <button type="button" className="icon-btn icon-danger" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="Убрать">✕</button>
            </li>
          ))}
        </ul>
      )}
      <label className="btn btn-soft att-add">
        <input
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])]
            e.target.value = ''
            onChange([...files, ...picked])
          }}
        />
        📎 Прикрепить файл
      </label>
    </div>
  )
}
