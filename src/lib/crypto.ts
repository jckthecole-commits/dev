/**
 * Application-layer encryption for health data (prescriptions, Rx uploads).
 * AES-256-GCM, random 96-bit IV, key from DATA_ENCRYPTION_KEY (base64, 32 bytes).
 * Format (text): "v1." + base64url(iv | tag | ciphertext)
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

let cachedKey: Buffer | null = null

function key(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.DATA_ENCRYPTION_KEY
  if (raw) {
    const k = Buffer.from(raw, 'base64')
    if (k.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)')
    cachedKey = k
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('DATA_ENCRYPTION_KEY is required in production')
    // Development fallback: derived from the auth secret so local data stays readable.
    cachedKey = createHash('sha256').update(`sifra-dev:${process.env.BETTER_AUTH_SECRET ?? 'dev'}`).digest()
  }
  return cachedKey
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct])
}

export function decryptBuffer(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const ct = blob.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

export function encryptJson(value: unknown): string {
  return `v1.${encryptBuffer(Buffer.from(JSON.stringify(value), 'utf8')).toString('base64url')}`
}

export function decryptJson<T>(text: string): T {
  if (!text.startsWith('v1.')) throw new Error('Unknown ciphertext format')
  return JSON.parse(decryptBuffer(Buffer.from(text.slice(3), 'base64url')).toString('utf8')) as T
}

/**
 * Like decryptJson, but a record that cannot be read — encrypted under another
 * DATA_ENCRYPTION_KEY, or damaged — comes back as null instead of failing the whole
 * page it is listed on. The cause is logged once per process.
 */
let warned = false
export function tryDecryptJson<T>(text: string): T | null {
  try {
    return decryptJson<T>(text)
  } catch (e) {
    if (!warned) {
      warned = true
      console.error('[crypto] a record could not be decrypted — was DATA_ENCRYPTION_KEY changed after it was saved?', (e as Error).message)
    }
    return null
  }
}

/** URL-safe random token (default 24 bytes → 32 chars). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}
