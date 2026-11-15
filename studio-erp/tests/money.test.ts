import { describe, expect, it } from 'vitest'
import { parseAmount, parsePercent, parseRate } from '@/lib/money'

describe('parseAmount', () => {
  it.each([
    ['125', 12500],
    ['125.5', 12550],
    ['125,50', 12550],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1 234,5', 123450],
    ['$99.99', 9999],
    ['1,234', 123400],
    ['1.234.567', 123456700],
    ['0', 0],
  ])('%s → %i', (input, cents) => expect(parseAmount(input)).toBe(cents))

  it('reads three digits after a single separator as thousands', () => {
    expect(parseAmount('1.234')).toBe(123400)
    expect(parseAmount('12,345')).toBe(1234500)
  })
  it.each(['', 'abc', '-5', '1,2,3', '12.3.4,5,6', '1.2345', '1,234,5', '12,34.567', '.', ','])('rejects %s', (input) => expect(parseAmount(input)).toBeNull())
})

describe('parsePercent / parseRate', () => {
  it('reads percentages as basis points', () => {
    expect(parsePercent('50')).toBe(5000)
    expect(parsePercent('52,5%')).toBe(5250)
    expect(parsePercent('101')).toBeNull()
  })
  it('reads exchange rates × 10 000', () => {
    expect(parseRate('4,6512')).toBe(46512)
    expect(parseRate('0')).toBeNull()
    expect(parseRate('abc')).toBeNull()
  })
})
