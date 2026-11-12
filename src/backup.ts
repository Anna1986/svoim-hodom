import { db, type Attachment } from './db'

const FORMAT = 'sup-travel-backup'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function exportBackup(): Promise<File> {
  const [trips, items, docs, attachments] = await Promise.all([
    db.trips.toArray(), db.items.toArray(), db.docs.toArray(), db.attachments.toArray(),
  ])
  const files = await Promise.all(
    attachments.map(async ({ blob, ...meta }) => ({ ...meta, data: await blobToDataUrl(blob) })),
  )
  const json = JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), trips, items, docs, attachments: files })
  const date = new Date().toISOString().slice(0, 10)
  return new File([json], `svoim-hodom-${date}.json`, { type: 'application/json' })
}

export async function importBackup(file: File): Promise<{ trips: number; items: number; docs: number; files: number }> {
  const data = JSON.parse(await file.text())
  if (data?.format !== FORMAT) throw new Error('Это не файл резервной копии этого приложения.')
  const attachments: Attachment[] = await Promise.all(
    (data.attachments ?? []).map(async ({ data: url, ...meta }: Attachment & { data: string }) => ({
      ...meta,
      blob: await (await fetch(url)).blob(),
    })),
  )
  await db.transaction('rw', db.trips, db.items, db.docs, db.attachments, async () => {
    await db.trips.bulkPut(data.trips ?? [])
    await db.items.bulkPut(data.items ?? [])
    await db.docs.bulkPut(data.docs ?? [])
    await db.attachments.bulkPut(attachments)
  })
  return {
    trips: data.trips?.length ?? 0,
    items: data.items?.length ?? 0,
    docs: data.docs?.length ?? 0,
    files: attachments.length,
  }
}
