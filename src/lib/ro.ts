/** Romania-specific data & validators. */

export const COUNTIES = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 'Brăila', 'București', 'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea',
] as const

/** Romanian CUI/CIF checksum (control key 753217532). Accepts "RO12345678". */
export function isValidCui(input: string): boolean {
  const digits = input.toUpperCase().replace(/^RO/, '').replace(/\s/g, '')
  if (!/^\d{2,10}$/.test(digits)) return false
  const control = Number(digits.at(-1))
  const body = digits.slice(0, -1).padStart(9, '0')
  const key = '753217532'
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(key[i])
  let c = (sum * 10) % 11
  if (c === 10) c = 0
  return c === control
}

/** Normalise a Romanian phone number to +40XXXXXXXXX; null if invalid. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '')
  if (d.startsWith('+40')) d = `0${d.slice(3)}`
  else if (d.startsWith('0040')) d = `0${d.slice(4)}`
  else if (d.startsWith('40') && d.length === 11) d = `0${d.slice(2)}`
  if (!/^0[2-7]\d{8}$/.test(d)) return null
  return `+40${d.slice(1)}`
}

export function formatPhone(e164: string): string {
  const d = e164.replace('+40', '0')
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : e164
}
