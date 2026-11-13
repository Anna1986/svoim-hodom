import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { eventTypeOf, type Item, type Trip } from '../db'
import { formatShort } from '../format'
import {
  buildStops, locate, orderForDay, pointUrl, routeUrl, setMapProvider, useMapProvider,
  PROVIDER_LABEL, type LatLng, type MapStop,
} from '../geo'
import { CAT_IMG, CatIcon } from './icons'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function roleOf(s: MapStop): string {
  const ev = eventTypeOf(s.item)
  return ev ? `${ev.icon} ${ev.label}` : s.role
}

function whenOf(s: MapStop): string {
  if (s.category === 'hotel') {
    const { startDate: a, endDate: b } = s.item
    return a ? `${formatShort(a)}${b && b !== a ? ' — ' + formatShort(b) : ''}` : ''
  }
  const d = s.dates[0]
  return d ? `${formatShort(d)}${s.time ? ', ' + s.time : ''}` : ''
}

export default function TripMap({ trip, items }: { trip: Trip; items: Item[] }) {
  const provider = useMapProvider()
  const stops = useMemo(() => buildStops(trip, items), [trip, items])
  const [found, setFound] = useState<Record<string, LatLng | null>>({})
  const [failed, setFailed] = useState(false)
  const days = useMemo(() => [...new Set(stops.flatMap((s) => s.dates))].sort(), [stops])
  const [day, setDay] = useState<string>('all')

  // Ищем координаты по одному адресу (ответы кэшируются на устройстве).
  useEffect(() => {
    let alive = true
    setFailed(false)
    ;(async () => {
      for (const s of stops) {
        if (!alive) return
        try {
          const ll = s.known ?? await locate(s.query, s.context)
          if (alive) setFound((f) => (f[s.key] === ll ? f : { ...f, [s.key]: ll }))
        } catch {
          if (alive) setFailed(true)
          return
        }
      }
    })()
    return () => { alive = false }
  }, [stops])

  const visible = useMemo(() => {
    const list = day === 'all'
      ? [...stops].sort((a, b) => ((a.dates[0] ?? '9') + (a.time || '99')).localeCompare((b.dates[0] ?? '9') + (b.time || '99')))
      : orderForDay(stops, day)
    return list
  }, [stops, day])
  const placed = useMemo(() => visible.filter((s) => found[s.key]), [visible, found])
  const pending = stops.filter((s) => !(s.key in found)).length
  const missing = visible.filter((s) => found[s.key] === null)
  const numbered = day !== 'all'

  /* ---------- Leaflet ---------- */
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef<Record<string, L.Marker>>({})
  const fittedFor = useRef('')

  useEffect(() => {
    if (!box.current) return
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([55.75, 37.62], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    }).addTo(m)
    m.attributionControl.setPrefix(false)
    map.current = m
    layer.current = L.layerGroup().addTo(m)
    return () => { m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers()
    markers.current = {}
    const pts: LatLng[] = []
    placed.forEach((s, i) => {
      const ll = found[s.key]!
      pts.push(ll)
      const icon = L.divIcon({
        className: 'map-pin-wrap',
        html: `<div class="map-pin"><img src="${CAT_IMG[s.category]}" alt="" />${numbered ? `<b>${i + 1}</b>` : ''}</div>`,
        iconSize: [40, 40], iconAnchor: [20, 38], popupAnchor: [0, -34],
      })
      const role = roleOf(s), when = whenOf(s)
      const popup =
        `<div class="map-pop">` +
        (role || when ? `<div class="map-pop-sub">${esc([role, when].filter(Boolean).join(' · '))}</div>` : '') +
        `<div class="map-pop-title">${esc(s.item.title)}</div>` +
        `<div class="map-pop-sub">${esc(s.query)}</div>` +
        `<div class="map-pop-links"><a href="#/items/${s.item.id}">Подробнее</a>` +
        `<a href="${pointUrl(provider, ll)}" target="_blank" rel="noopener">В ${PROVIDER_LABEL[provider]}</a></div></div>`
      markers.current[s.key] = L.marker(ll, { icon }).bindPopup(popup).addTo(g)
      if (s.pairKey && found[s.pairKey] && (day === 'all' || visible.some((v) => v.key === s.pairKey))) {
        L.polyline([found[s.pairKey]!, ll], { color: '#2563eb', weight: 2, dashArray: '6 6', opacity: 0.7 }).addTo(g)
      }
    })
    if (numbered && pts.length > 1) {
      L.polyline(pts, { color: '#2563eb', weight: 3, opacity: 0.35 }).addTo(g)
    }
    // Подгоняем масштаб, когда сменился день или нашлись новые точки
    const sig = day + ':' + pts.length
    if (pts.length && fittedFor.current !== sig) {
      fittedFor.current = sig
      if (pts.length === 1) m.setView(pts[0], 14)
      else m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 })
    }
  }, [placed, found, numbered, provider, day, visible])

  function focus(s: MapStop) {
    const mk = markers.current[s.key]
    if (!mk || !map.current) return
    map.current.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 15))
    mk.openPopup()
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!stops.length) {
    return <p className="muted">Чтобы поездка появилась на карте, укажите адреса у жилья и событий, а у билетов — откуда и куда.</p>
  }

  const route = placed.map((s) => found[s.key]!).filter((ll, i, arr) => i === 0 || ll.join() !== arr[i - 1].join())

  return (
    <div className="trip-map">
      <div className="chips">
        <button className={`chip ${day === 'all' ? 'chip-active' : ''}`} onClick={() => setDay('all')}>Все дни</button>
        {days.map((d) => (
          <button key={d} className={`chip ${day === d ? 'chip-active' : ''}`} onClick={() => setDay(d)}>{formatShort(d)}</button>
        ))}
      </div>

      <div ref={box} className="map-box" />

      {pending > 0 && !failed && <p className="muted small">Ищем места на карте… осталось {pending}</p>}
      {failed && <p className="muted small">Не получилось найти адреса — нужен интернет. Попробуйте позже.</p>}

      <div className="map-open">
        <span className="muted small">Открывать в</span>
        <div className="view-toggle">
          <button className={provider === 'yandex' ? 'active' : ''} onClick={() => setMapProvider('yandex')}>Яндекс</button>
          <button className={provider === 'google' ? 'active' : ''} onClick={() => setMapProvider('google')}>Google</button>
        </div>
      </div>

      {numbered && route.length > 1 && (
        <a className="btn btn-soft map-route" href={routeUrl(provider, route)} target="_blank" rel="noopener">
          Маршрут дня в {PROVIDER_LABEL[provider]}
        </a>
      )}

      <ol className="map-list">
        {visible.filter((s) => found[s.key] !== null).map((s) => {
          const ll = found[s.key]
          const n = placed.indexOf(s)
          return (
            <li key={s.key}>
              <button className="map-item" onClick={() => focus(s)} disabled={!ll}>
                {numbered && <span className="map-num">{n >= 0 ? n + 1 : '·'}</span>}
                <CatIcon c={s.category} size={36} />
                <span className="row-body">
                  <span className="row-sub">{[roleOf(s), whenOf(s)].filter(Boolean).join(' · ')}</span>
                  <span className="row-title">{s.item.title}</span>
                  {s.query !== s.item.title && <span className="row-sub">{s.query}</span>}
                </span>
              </button>
              {ll && <a className="map-ext" href={pointUrl(provider, ll)} target="_blank" rel="noopener" aria-label={`Открыть в ${PROVIDER_LABEL[provider]}`}>↗</a>}
            </li>
          )
        })}
      </ol>

      {missing.length > 0 && (
        <section className="map-missing">
          <h3>Не нашли на карте</h3>
          <p className="muted small">Уточните адрес — например, добавьте город и улицу.</p>
          {missing.map((s) => (
            <Link key={s.key} to={`/items/${s.item.id}/edit`} className="map-missing-row">
              <CatIcon c={s.category} size={28} /> <span>{s.item.title}: <b>{s.query}</b></span>
            </Link>
          ))}
        </section>
      )}

      <p className="muted small">Карта © OpenStreetMap. Без интернета карта не загружается.</p>
    </div>
  )
}
