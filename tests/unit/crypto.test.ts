import { describe, expect, it } from 'vitest'
import { decryptJson, encryptJson, tryDecryptJson } from '@/lib/crypto'

describe('crypto', () => {
  it('round-trips JSON through AES-GCM', () => {
    const rx = { od: { sph: -2.25, cyl: -0.5, axis: 90 }, pd: { mode: 'single', value: 63 } }
    expect(decryptJson(encryptJson(rx))).toEqual(rx)
  })

  it('tryDecryptJson reads valid records', () => {
    expect(tryDecryptJson<{ a: number }>(encryptJson({ a: 1 }))).toEqual({ a: 1 })
  })

  it('tryDecryptJson returns null instead of throwing for records it cannot read', () => {
    const blob = encryptJson({ a: 1 })
    // a flipped byte fails authentication exactly like a different key does
    const tampered = blob.slice(0, -2) + (blob.endsWith('A') ? 'B' : 'A') + blob.slice(-1)
    expect(() => decryptJson(tampered)).toThrow()
    expect(tryDecryptJson(tampered)).toBeNull()
    expect(tryDecryptJson('not-a-record')).toBeNull()
  })
})
