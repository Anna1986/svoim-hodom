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

export const CAT_IMG: Record<Category, string> = { flight, transport, hotel, car, voucher, visa, insurance, route, other }

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

export const IconCompass = ({ size = 24, className = '' }: P) => svg(size, className, <>
  <circle cx="12" cy="12" r="9" />
  <path d="M15.5 8.5l-2 5-5 2 2-5z" />
</>)

export const IconTicket = ({ size = 20, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" fill="currentColor" />
    <path d="M14.5 7v10" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 2" />
  </svg>
)

export const IconList = ({ size = 18, className = '' }: P) => svg(size, className, <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />)
