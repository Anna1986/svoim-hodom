import { useEffect, useRef, useState } from 'react'
import { locate, pointUrl, searchPlaces, suggestPlaces, useMapProvider, PROVIDER_LABEL, type LatLng, type PlaceHit } from '../geo'

/**
 * Поле «Место или адрес» с поиском по карте: при вводе показывает подсказки,
 * выбранное место сохраняется вместе с координатами — и точно встаёт на карту поездки.
 */
export function PlaceInput({ value, ll, near, onChange }: {
  value: string
  ll: LatLng | undefined
  near: string // город поездки — искать ближе к нему
  onChange: (text: string, ll: LatLng | undefined) => void
}) {
  const provider = useMapProvider()
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'' | 'searching' | 'none' | 'offline'>('')
  const [nearLL, setNearLL] = useState<LatLng | null>(null)
  const typed = useRef(false) // подсказки показываем только когда человек печатает, а не при открытии формы

  useEffect(() => {
    let alive = true
    if (near.trim()) locate(near, '').then((p) => { if (alive) setNearLL(p) }).catch(() => {})
    return () => { alive = false }
  }, [near])

  useEffect(() => {
    if (!typed.current) return
    const q = value.trim()
    if (q.length < 3 || ll) { setHits([]); setOpen(false); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      suggestPlaces(q, nearLL, ctrl.signal)
        .then((h) => { setHits(h); setOpen(true); setState('') })
        .catch((e) => { if (e?.name !== 'AbortError') { setHits([]); setOpen(true) } })
    }, 450)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [value, ll, nearLL])

  function pick(h: PlaceHit) {
    typed.current = false
    setOpen(false); setHits([]); setState('')
    onChange(h.text, h.ll)
  }

  async function search() {
    setState('searching')
    try {
      const h = await searchPlaces(value.trim(), near)
      setHits(h); setOpen(true); setState(h.length ? '' : 'none')
    } catch {
      setState('offline')
    }
  }

  const canSearch = !ll && value.trim().length >= 3

  return (
    <div className="place-input">
      <input
        value={value}
        autoComplete="off"
        onChange={(e) => { typed.current = true; onChange(e.target.value, undefined) }}
        placeholder="Название или адрес — найдём на карте"
      />
      {open && hits.length > 0 && (
        <ul className="place-hits">
          {hits.map((h) => (
            <li key={h.text + h.ll.join()}>
              <button type="button" onClick={() => pick(h)}>
                <span className="place-hit-pin">📍</span>
                <span className="place-hit-body">
                  <span className="place-hit-title">{h.title}</span>
                  {h.subtitle && <span className="place-hit-sub">{h.subtitle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ll ? (
        <span className="place-found">
          ✓ Место найдено на карте · <a href={pointUrl(provider, ll)} target="_blank" rel="noopener" className="link">посмотреть в {PROVIDER_LABEL[provider]}</a>
        </span>
      ) : canSearch && open && state !== 'searching' ? (
        <span className="place-help">
          {state === 'none' ? 'На карте не нашлось — уточните название или адрес. Можно сохранить и так. '
            : state === 'offline' ? 'Поиск по карте не работает без интернета. Можно сохранить и так. '
            : hits.length ? 'Выберите место из списка — оно точно встанет на карту. Нет нужного? ' : 'Подсказок нет. '}
          {state !== 'offline' && <button type="button" className="link-btn" onClick={search}>Искать ещё</button>}
        </span>
      ) : state === 'searching' ? <span className="place-help">Ищу на карте…</span> : null}
    </div>
  )
}
