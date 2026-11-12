import { useEffect, useState } from 'react'
import { exportBackup, importBackup } from '../backup'
import { formatSize } from '../format'
import { PageHeader } from '../components/ui'
import { AccountSection } from '../components/Account'
import { useSyncState } from '../sync'
import { setMapProvider, useMapProvider } from '../geo'

export default function Settings() {
  const [usage, setUsage] = useState<string>('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const sync = useSyncState()
  const mapProvider = useMapProvider()

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
      <PageHeader title={sync.user ? 'Профиль' : 'Вход и настройки'} />

      <AccountSection />

      <section className="section">
        <h2>Где хранятся данные</h2>
        <p className="muted">
          {sync.user
            ? 'Копия всех данных хранится на этом устройстве, поэтому приложение работает без интернета. Изменения отправляются в облако, как только появляется связь. Ваши записи и файлы доступны только вам.'
            : 'Сейчас всё хранится только на этом устройстве, в браузере, и доступно без интернета. Чтобы данные были и на других устройствах — войдите в аккаунт.'}
        </p>
        {usage && <p className="muted small">Занято: {usage}{persisted !== null && (persisted ? ' · защищено от автоочистки' : '')}</p>}
      </section>

      <section className="section">
        <h2>Карты</h2>
        <p className="muted">Где открывать места и маршруты из карты поездки.</p>
        <div className="view-toggle">
          <button className={mapProvider === 'yandex' ? 'active' : ''} onClick={() => setMapProvider('yandex')}>Яндекс Карты</button>
          <button className={mapProvider === 'google' ? 'active' : ''} onClick={() => setMapProvider('google')}>Google Карты</button>
        </div>
      </section>

      <section className="section">
        <h2>Резервная копия</h2>
        <p className="muted">Дополнительная копия в файле — на всякий случай. Можно сохранить в «Файлы», Google Диск или себе в мессенджер.</p>
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
      <p className="muted small version">Версия приложения: {new Date(__BUILD_TIME__).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
    </>
  )
}
