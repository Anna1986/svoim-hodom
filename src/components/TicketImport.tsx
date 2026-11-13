import { useState } from 'react'
import { ImportError, IMPORT_MESSAGES, readTicket } from '../ticketImport'
import type { ParsedTicket } from '../ticketParse'

export type ImportResult = { file: File; parsed: ParsedTicket | null; error: string }

/** Кнопка «Заполнить из билета»: читает PDF на устройстве и отдаёт найденные реквизиты. */
export function TicketImport({ onResult, big = false }: { onResult: (r: ImportResult) => void; big?: boolean }) {
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onResult({ file, parsed: await readTicket(file), error: '' })
    } catch (e) {
      console.error(e)
      onResult({ file, parsed: null, error: IMPORT_MESSAGES[e instanceof ImportError ? e.kind : 'broken'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className={`ticket-import ${big ? 'ticket-import-big' : ''} ${busy ? 'is-busy' : ''}`}>
      <span className="ticket-import-icon">{busy ? '⏳' : '📄'}</span>
      <span className="ticket-import-text">
        <b>{busy ? 'Читаю файл…' : big ? 'Загрузить билет или бронь' : 'Заполнить из файла билета'}</b>
        <small>PDF из письма — поля заполнятся сами, файл прикрепится к записи</small>
      </span>
      <input type="file" accept="application/pdf,.pdf,image/*,.txt,.eml,.html" hidden disabled={busy}
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </label>
  )
}
