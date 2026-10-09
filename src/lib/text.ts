/** Remove Romanian (and other) diacritics: "Galați" → "Galati" */
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Lowercase, diacritic-free, collapsed whitespace — used for search columns & queries. */
export function normalizeSearch(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9.□\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function slugify(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s
}

/** Very small markdown → plain text (for meta descriptions, excerpts). */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
