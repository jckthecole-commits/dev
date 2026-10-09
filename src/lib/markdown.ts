import { Marked } from 'marked'

/**
 * Markdown → HTML for CMS content (guides, legal pages). Raw HTML in the
 * source is escaped (staff-authored, but defence in depth). External links
 * open safely in a new tab; headings get stable ids for the table of contents.
 */
const marked = new Marked({ gfm: true, breaks: false })

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

marked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens)
      return `<h${depth} id="${slug(text)}">${text}</h${depth}>\n`
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : '#'
      const ext = /^https?:/i.test(safe)
      return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ''}${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
    },
  },
})

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string
}

export function headingsOf(md: string): { id: string; text: string }[] {
  return [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ id: slug(m[1]!.replace(/[*_`]/g, '')), text: m[1]!.replace(/[*_`]/g, '') }))
}

/** Replace {{a.b.c}} placeholders from a context object. */
export function interpolate(md: string, ctx: Record<string, unknown>): string {
  return md.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), ctx)
    return v === undefined || v === null || v === '' ? '—' : String(v)
  })
}
