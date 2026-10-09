import 'server-only'
import { formatPrice } from '@/lib/format'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Brand e-mail shell: table layout + inline styles for every client (Outlook included). */
export function emailLayout({ preheader, title, body, footerNote }: { preheader: string; title: string; body: string; footerNote?: string }) {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#EEF1EF;font-family:Helvetica,Arial,sans-serif;color:#0D1216">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1EF"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
<tr><td style="padding:0 4px 24px;font-size:15px;letter-spacing:4px;font-weight:700">SIFRA <span style="font-weight:300">VISI<span style="color:#2638C9">◯</span>N</span></td></tr>
<tr><td style="background:#F8F9F8;border-radius:20px;padding:36px 32px;border:1px solid #E3E7E5">
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.15;letter-spacing:-0.5px">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#1E262C">${body}</div>
</td></tr>
<tr><td style="padding:22px 6px;font-size:12px;line-height:1.6;color:#4A545B">${footerNote ? `${footerNote}<br><br>` : ''}Sifra Vision · Str. Alexandru Cernat 188, Galați · <a href="${SITE}" style="color:#2638C9">${SITE.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`
}

export function emailButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#2638C9;border-radius:999px"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;color:#fff;text-decoration:none;font-weight:700;font-size:15px">${esc(label)}</a></td></tr></table>`
}

export function emailTable(rows: [string, string][], totalRow?: [string, string]) {
  const tr = rows.map(([a, b]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E3E7E5">${a}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #E3E7E5;white-space:nowrap">${b}</td></tr>`).join('')
  const total = totalRow ? `<tr><td style="padding:12px 0;font-weight:700;font-size:17px">${totalRow[0]}</td><td align="right" style="padding:12px 0;font-weight:700;font-size:17px">${totalRow[1]}</td></tr>` : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:16px 0">${tr}${total}</table>`
}

export type OrderMailData = {
  number: string
  customerName: string
  items: { name: string; detail: string; amount: number }[]
  subtotal: number
  discount: number
  shipping: number
  total: number
  paymentMethod: string
  shippingLabel: string
  trackUrl: string
  requiresRx: boolean
  rxPending: boolean
  bankDetails?: { iban: string; bank: string; legalName: string }
}

export function orderConfirmationEmail(o: OrderMailData) {
  const rows: [string, string][] = o.items.map((i) => [`<strong>${esc(i.name)}</strong><br><span style="color:#4A545B;font-size:13px">${esc(i.detail)}</span>`, formatPrice(i.amount)])
  if (o.discount) rows.push(['Reducere', `−${formatPrice(o.discount)}`])
  rows.push([esc(o.shippingLabel), o.shipping ? formatPrice(o.shipping) : 'gratuit'])
  const rx = o.requiresRx
    ? o.rxPending
      ? `<p style="background:#FBF0E0;border-radius:12px;padding:14px 16px">Ne mai trebuie <strong>rețeta</strong>. O poți încărca oricând din pagina comenzii — producția începe după ce optometristul o verifică.</p>`
      : `<p>Optometristul nostru verifică rețeta înainte de montaj. Dacă ceva nu se leagă, te sunăm.</p>`
    : ''
  const bank =
    o.paymentMethod === 'transfer' && o.bankDetails
      ? `<p style="background:#ECEFFD;border-radius:12px;padding:14px 16px"><strong>Plată prin transfer</strong><br>Beneficiar: ${esc(o.bankDetails.legalName)}<br>IBAN: ${esc(o.bankDetails.iban || 'se comunică pe e-mail')}<br>Banca: ${esc(o.bankDetails.bank || '—')}<br>Detalii plată: comanda ${esc(o.number)}</p>`
      : ''
  return emailLayout({
    preheader: `Comanda ${o.number} a fost înregistrată.`,
    title: `Mulțumim, ${o.customerName.split(' ')[0]}!`,
    body: `<p>Am primit comanda <strong>${esc(o.number)}</strong>.</p>${rx}${bank}${emailTable(rows, ['Total', formatPrice(o.total)])}${emailButton(o.trackUrl, 'Urmărește comanda')}`,
    footerNote: 'Prețurile includ TVA. Factura fiscală o primești pe e-mail după procesare.',
  })
}
