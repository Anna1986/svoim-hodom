import { useState } from 'react'
import { ImportError, IMPORT_MESSAGES, readTicket } from '../ticketImport'
import type { ParsedTicket } from '../ticketParse'

export type ImportResult = { file: File; parsed: ParsedTicket | null; error: string }

/** Кнопка «Заполнить из билета»: читает PDF на устройстве и отдаёт найденные реквизиты. */
export function TicketImport({ onResult, big = false }: { onResult: (r: ImportResult) => void; big?: boolean }) {
  const [busy, setBusy] = useState(false)

  async function pick(picked: File | undefined) {
    if (!picked) return
    setBusy(true)
    // Сразу копируем файл в память — после сброса поля выбора Safari может «потерять» его содержимое
    let file: File
    try {
      file = new File([await picked.arrayBuffer()], picked.name, { type: picked.type })
    } catch {
      setBusy(false)
      return onResult({ file: picked, parsed: null, error: 'Не получилось прочитать файл. Попробуйте выбрать его ещё раз.' })
    }
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
        onChange={(e) => { const f = e.target.files?.[0]; void pick(f).finally(() => { e.target.value = '' }) }} />
    </label>
  )
}
