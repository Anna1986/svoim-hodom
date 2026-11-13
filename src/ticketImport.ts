import { parseTicket, type ParsedTicket } from './ticketParse'

/** Текст из файла билета: PDF (с текстовым слоем), текст или письмо. */
export async function fileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return pdfText(file)
  if (file.type.startsWith('text/') || /\.(txt|eml|html?)$/.test(name)) {
    const raw = await file.text()
    return /<html|<body|<div|<td/i.test(raw)
      ? (new DOMParser().parseFromString(raw.replace(/<(br|\/p|\/div|\/tr|\/h\d)[^>]*>/gi, '\n$&'), 'text/html').body.textContent ?? '')
      : raw
  }
  if (file.type.startsWith('image/')) throw new ImportError('image')
  throw new ImportError('type')
}

export class ImportError extends Error {
  constructor(public kind: 'image' | 'type' | 'empty' | 'broken') { super(kind) }
}

export const IMPORT_MESSAGES: Record<ImportError['kind'], string> = {
  image: 'Фото и скриншоты пока не распознаём — только PDF из письма. Файл прикреплён, поля заполните вручную.',
  type: 'Такой файл не распознать. Подойдёт PDF билета или брони.',
  empty: 'В PDF нет текста — похоже, это скан или фото. Файл прикреплён, поля заполните вручную.',
  broken: 'Не получилось открыть файл. Возможно, он повреждён или защищён паролем.',
}

async function pdfText(file: File): Promise<string> {
  // legacy-сборка — чтобы работало и на не самых новых iPhone
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let doc
  try {
    doc = await task.promise
  } catch {
    throw new ImportError('broken')
  }
  const pages: string[] = []
  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // собираем строки по вертикальной координате, внутри строки — слева направо
    const rows: { y: number; parts: { x: number; s: string }[] }[] = []
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const x = it.transform[4], y = it.transform[5]
      const h = Math.max(2, (it.height || 8) * 0.5)
      let row = rows.find((r) => Math.abs(r.y - y) <= h)
      if (!row) rows.push((row = { y, parts: [] }))
      row.parts.push({ x, s: it.str })
    }
    rows.sort((a, b) => b.y - a.y)
    pages.push(rows.map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ')).join('\n'))
  }
  void task.destroy()
  const text = pages.join('\n')
  if (text.replace(/\s/g, '').length < 20) throw new ImportError('empty')
  return text
}

export async function readTicket(file: File): Promise<ParsedTicket> {
  return parseTicket(await fileText(file))
}

/* Передача распознанного файла со страницы «Что добавить?» в форму записи */
let pending: { file: File; parsed: ParsedTicket | null; error: string } | null = null
export function setPendingImport(p: typeof pending) { pending = p }
export function takePendingImport() { const p = pending; pending = null; return p }
