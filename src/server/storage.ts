import 'server-only'
import { AwsClient } from 'aws4fetch'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomToken } from '@/lib/crypto'
import { decryptBuffer, encryptBuffer } from '@/lib/crypto'

/**
 * Object storage: local filesystem (default) or any S3-compatible bucket.
 * Keys are namespaced: "public/…" (product images, documents) and "private/…"
 * (prescriptions — always encrypted, never publicly addressable).
 */
const driver = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local'
const localRoot = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? './storage')

let s3: AwsClient | null = null
function s3Client() {
  s3 ??= new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    region: process.env.S3_REGION ?? 'auto',
    service: 's3',
  })
  return s3
}
const s3Url = (key: string) => `${process.env.S3_ENDPOINT!.replace(/\/$/, '')}/${process.env.S3_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`

function safeLocalPath(key: string) {
  const p = path.resolve(/*turbopackIgnore: true*/ localRoot, key)
  if (!p.startsWith(localRoot + path.sep)) throw new Error('Invalid storage key')
  return p
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (driver === 's3') {
    const res = await s3Client().fetch(s3Url(key), { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': contentType } })
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`)
    return
  }
  const p = safeLocalPath(key)
  await mkdir(/*turbopackIgnore: true*/ path.dirname(p), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ p, body)
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (driver === 's3') {
    const res = await s3Client().fetch(s3Url(key))
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`S3 read failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
  try {
    return await readFile(/*turbopackIgnore: true*/ safeLocalPath(key))
  } catch {
    return null
  }
}

export async function deleteObject(key: string) {
  if (driver === 's3') {
    await s3Client().fetch(s3Url(key), { method: 'DELETE' })
    return
  }
  await unlink(/*turbopackIgnore: true*/ safeLocalPath(key)).catch(() => {})
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}
export const ALLOWED_RX_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/** Sniff the real type from magic bytes — never trust the browser's MIME. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'application/pdf'
  const ftyp = buf.subarray(4, 12).toString()
  if (ftyp.startsWith('ftypavif')) return 'image/avif'
  if (ftyp.startsWith('ftypheic') || ftyp.startsWith('ftypheix') || ftyp.startsWith('ftypmif1')) return 'image/heic'
  return null
}

export async function storePublicFile(file: File, folder: string, allowed = ALLOWED_IMAGE_TYPES, maxBytes = 8 * 1024 * 1024) {
  if (file.size > maxBytes) throw new Error(`Fișierul depășește ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  const buf = Buffer.from(await file.arrayBuffer())
  const mime = sniffMime(buf)
  if (!mime || !allowed.includes(mime)) throw new Error('Tip de fișier neacceptat.')
  const key = `public/${folder}/${randomToken(12)}.${EXT[mime] ?? 'bin'}`
  await putObject(key, buf, mime)
  return { key, mime, size: buf.length }
}

/** Encrypted private upload (prescriptions). */
export async function storePrivateFile(file: File, folder: string) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Fișierul depășește 10 MB.')
  const buf = Buffer.from(await file.arrayBuffer())
  const mime = sniffMime(buf)
  if (!mime || !ALLOWED_RX_TYPES.includes(mime)) throw new Error('Încarcă o poză (JPG, PNG, HEIC) sau un PDF.')
  const key = `private/${folder}/${randomToken(16)}.enc`
  await putObject(key, encryptBuffer(buf), 'application/octet-stream')
  return { key, mime }
}

export async function readPrivateFile(key: string): Promise<Buffer | null> {
  if (!key.startsWith('private/')) return null
  const blob = await getObject(key)
  return blob ? decryptBuffer(blob) : null
}

const DOC_TYPES: Record<string, { mime: string; magic?: (b: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', magic: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  jpg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  png: { mime: 'image/png', magic: (b) => b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: (b) => b.subarray(0, 4).toString('hex') === '504b0304' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: (b) => b.subarray(0, 4).toString('hex') === '504b0304' },
  csv: { mime: 'text/csv', magic: (b) => !b.includes(0) },
}

/** Business documents (declarations of conformity, price lists, catalogues) — encrypted, served through an access-checked route. */
export async function storeDocument(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Fișierul depășește 20 MB.')
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace('jpeg', 'jpg')
  const type = DOC_TYPES[ext]
  const buf = Buffer.from(await file.arrayBuffer())
  if (!type || !type.magic?.(buf)) throw new Error('Acceptăm PDF, JPG, PNG, XLSX, DOCX sau CSV.')
  const key = `private/documents/${randomToken(16)}.enc`
  await putObject(key, encryptBuffer(buf), 'application/octet-stream')
  return { key, mime: type.mime, size: buf.length, ext }
}

/** Public URL for a stored public object (served by /media/[...key] or a CDN). */
export function publicUrl(key: string) {
  if (process.env.NEXT_PUBLIC_MEDIA_BASE_URL) return `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '')}/${key}`
  return `/media/${key.replace(/^public\//, '')}`
}
