import { describe, expect, it } from 'vitest'
import { formatPhone, isValidCui, normalizePhone } from '@/lib/ro'

describe('CUI checksum', () => {
  it('accepts valid codes with or without RO prefix', () => {
    expect(isValidCui('RO14399840')).toBe(true)
    expect(isValidCui('14399840')).toBe(true)
    expect(isValidCui('ro 14399840')).toBe(true)
  })
  it('rejects wrong check digits and garbage', () => {
    expect(isValidCui('14399841')).toBe(false)
    expect(isValidCui('RO')).toBe(false)
    expect(isValidCui('12345678901')).toBe(false)
  })
})

describe('phones', () => {
  it('normalises Romanian numbers to E.164', () => {
    expect(normalizePhone('0722 123 456')).toBe('+40722123456')
    expect(normalizePhone('+40 722-123-456')).toBe('+40722123456')
    expect(normalizePhone('0040722123456')).toBe('+40722123456')
    expect(normalizePhone('0236 412 345')).toBe('+40236412345')
  })
  it('rejects non-Romanian or short numbers', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('0822123456')).toBeNull()
  })
  it('formats for display', () => {
    expect(formatPhone('+40722123456')).toBe('0722 123 456')
  })
})
