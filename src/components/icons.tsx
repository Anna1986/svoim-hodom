import type { Category, DocKind } from '../db'
import { CATEGORIES } from '../db'
import flight from '../assets/icons/flight.png'
import transport from '../assets/icons/transport.png'
import hotel from '../assets/icons/hotel.png'
import car from '../assets/icons/car.png'
import voucher from '../assets/icons/voucher.png'
import visa from '../assets/icons/visa.png'
import insurance from '../assets/icons/insurance.png'
import route from '../assets/icons/route.png'
import other from '../assets/icons/other.png'

/* ---------- Объёмные иконки папок ---------- */

const CAT_IMG: Record<Category, string> = { flight, transport, hotel, car, voucher, visa, insurance, route, other }

export function CatIcon({ c, size = 44, className = '' }: { c: Category; size?: number; className?: string }) {
  return <img src={CAT_IMG[c]} width={size} height={size} alt={CATEGORIES[c].one} className={`cat-icon ${className}`} draggable={false} />
}

const DOC_IMG: Record<DocKind, string> = {
  'intl-passport': visa, passport: visa, license: car, insurance, card: other, other,
}

export function DocIcon({ k, size = 44 }: { k: DocKind; size?: number }) {
  return <img src={DOC_IMG[k]} width={size} height={size} alt="" className="cat-icon" draggable={false} />
}

/* ---------- Линейные иконки интерфейса ---------- */

type P = { size?: number; className?: string }
const svg = (size: number, className: string, children: React.ReactNode, fill = false) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
)

export const IconSuitcase = ({ size = 24, className = '' }: P) => svg(size, className, <>
  <rect x="3" y="7" width="18" height="13" rx="3" />
  <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
  <path d="M3 12.5h18" />
</>)

export const IconDoc = ({ size = 24, className = '' }: P) => svg(size, className, <>
  <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  <path d="M14 3v5h5M9 13h6M9 17h6" />
</>)

export const IconUser = ({ size = 24, className = '' }: P) => svg(size, className, <>
  <circle cx="12" cy="8" r="4" />
  <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
</>)

export const IconCalendar = ({ size = 20, className = '' }: P) => svg(size, className, <>
  <rect x="3.5" y="5" width="17" height="15" rx="3" />
  <path d="M8 3v4M16 3v4M3.5 10h17" />
  <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth="2.4" />
</>)

export const IconClock = ({ size = 18, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M12 7v5l3 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
)

export const IconPin = ({ size = 20, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="#ef4444" />
    <circle cx="12" cy="10" r="2.6" fill="#fff" />
  </svg>
)

export const IconBriefcase = ({ size = 20, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <rect x="2.5" y="7" width="19" height="13" rx="3" fill="#2563eb" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="#2563eb" strokeWidth="1.8" fill="none" />
    <rect x="2.5" y="7" width="19" height="5" rx="2.5" fill="#3b82f6" />
  </svg>
)

export const IconChevron = ({ size = 20, className = '' }: P) => svg(size, className, <path d="M9 6l6 6-6 6" />)

export const IconBack = ({ size = 20, className = '' }: P) => svg(size, className, <path d="M15 6l-6 6 6 6" />)

/* ---------- Иллюстрация для шапки поездки ---------- */

export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 240" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4f5" />
          <stop offset="1" stopColor="#d9f0ff" />
        </linearGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fae6b" />
          <stop offset="1" stopColor="#3f8f52" />
        </linearGradient>
        <radialGradient id="glow" cx="0.8" cy="0.15" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill="url(#glow)" />
      {/* облака */}
      <g fill="#fff" opacity="0.85">
        <ellipse cx="300" cy="120" rx="46" ry="12" />
        <ellipse cx="330" cy="112" rx="26" ry="12" />
        <ellipse cx="120" cy="70" rx="34" ry="8" opacity="0.6" />
      </g>
      {/* след и самолёт */}
      <path d="M150 74 Q 230 52 300 40" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      <g transform="translate(300 30) rotate(-12)">
        <path d="M0 10 L60 4 Q74 3 76 9 Q74 15 60 15 L0 14 Z" fill="#f8fafc" />
        <path d="M30 9 L52 -12 L58 -12 L46 10 Z" fill="#e2e8f0" />
        <path d="M30 14 L48 30 L54 30 L44 13 Z" fill="#cbd5e1" />
        <path d="M2 10 L-6 -4 L2 -4 L12 9 Z" fill="#2563eb" />
        <rect x="18" y="8" width="38" height="2" rx="1" fill="#93c5fd" />
        <path d="M68 7 Q72 7 73 9 L68 9 Z" fill="#1e3a8a" />
      </g>
      {/* холмы с домиками */}
      <path d="M250 190 Q 300 120 360 130 Q 390 135 400 150 L400 200 L250 200 Z" fill="url(#hill)" />
      <g>
        {[
          [300, 150, '#f8fafc', '#ea7a4b'], [322, 140, '#fef3c7', '#d9643a'], [344, 146, '#f8fafc', '#ea7a4b'],
          [366, 138, '#e0f2fe', '#d9643a'], [312, 165, '#fef3c7', '#ea7a4b'], [338, 162, '#f8fafc', '#d9643a'],
          [362, 158, '#f8fafc', '#ea7a4b'], [384, 152, '#fef3c7', '#d9643a'], [290, 172, '#f8fafc', '#d9643a'],
        ].map(([x, y, wall, roof], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <rect x="0" y="4" width="16" height="13" fill={wall as string} />
            <path d="M-2 5 L8 -3 L18 5 Z" fill={roof as string} />
            <rect x="4" y="8" width="3" height="4" fill="#60a5fa" />
            <rect x="9" y="8" width="3" height="4" fill="#60a5fa" />
          </g>
        ))}
      </g>
      {/* море */}
      <path d="M0 190 Q 100 180 200 188 T 400 186 L400 240 L0 240 Z" fill="url(#sea)" />
      <path d="M40 205 q 15 -4 30 0 M160 212 q 15 -4 30 0 M290 206 q 15 -4 30 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round" />
    </svg>
  )
}
