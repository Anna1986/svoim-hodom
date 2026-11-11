import { useEffect, useState } from 'react'
import { exportBackup, importBackup } from '../backup'
import { formatSize } from '../format'
import { PageHeader } from '../components/ui'

export default function Settings() {
  const [usage, setUsage] = useState<string>('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(formatSize(e.usage))).catch(() => {})
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  async function doExport() {
    setBusy(true); setMsg('')
    try {
      const file = await exportBackup()
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: file.name }); return } catch { /* закрыли — скачаем */ }
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url; a.download = file.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setMsg('Резервная копия сохранена.')
    } catch (e) {
      setMsg('Не получилось создать копию: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm('Загрузить данные из копии? Записи с теми же данными будут заменены, остальные сохранятся.')) return
    setBusy(true); setMsg('')
    try {
      const r = await importBackup(file)
      setMsg(`Готово: поездок — ${r.trips}, записей — ${r.items}, документов — ${r.docs}, файлов — ${r.files}.`)
    } catch (err) {
      setMsg('Не получилось загрузить: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Настройки" />

      <section className="section">
        <h2>Где хранятся данные</h2>
        <p className="muted">
          Всё хранится только на этом устройстве, в браузере, и доступно без интернета. На другом телефоне или компьютере данных не будет — перенести их можно через резервную копию.
        </p>
        {usage && <p className="muted small">Занято: {usage}{persisted !== null && (persisted ? ' · защищено от автоочистки' : '')}</p>}
      </section>

      <section className="section">
        <h2>Резервная копия</h2>
        <p className="muted">Сохраните копию перед поездкой — например, в «Файлы», Google Диск или себе в мессенджер. Если браузер очистит данные, всё можно будет восстановить.</p>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={doExport} disabled={busy}>Сохранить копию</button>
          <label className={`btn ${busy ? 'disabled' : ''}`}>
            <input type="file" accept="application/json,.json" hidden onChange={doImport} disabled={busy} />
            Загрузить из копии
          </label>
        </div>
        {msg && <p className="notice">{msg}</p>}
      </section>

      <section className="section">
        <h2>Как установить на телефон</h2>
        <p className="muted"><b>iPhone:</b> откройте сайт в Safari → «Поделиться» → «На экран „Домой“».</p>
        <p className="muted"><b>Android:</b> откройте в Chrome → меню ⋮ → «Добавить на главный экран».</p>
      </section>
    </>
  )
}
