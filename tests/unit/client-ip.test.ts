import { describe, expect, it } from 'vitest'
import { clientIpFrom } from '@/lib/client-ip'

const h = (o: Record<string, string>) => new Headers(o)

describe('clientIpFrom', () => {
  it('takes the address appended by the trusted proxy, not the spoofable left side', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }), 1)).toBe('203.0.113.7')
    expect(clientIpFrom(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7, 10.0.0.2' }), 2)).toBe('203.0.113.7')
  })
  it('falls back to X-Real-IP and rejects garbage', () => {
    expect(clientIpFrom(h({ 'x-real-ip': '2001:db8::1' }), 1)).toBe('2001:db8::1')
    expect(clientIpFrom(h({ 'x-forwarded-for': '<script>' }), 1)).toBeNull()
    expect(clientIpFrom(h({}), 1)).toBeNull()
  })
  it('never indexes past the start of a short chain', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '198.51.100.4' }), 3)).toBe('198.51.100.4')
  })
})
