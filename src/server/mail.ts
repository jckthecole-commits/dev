import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import nodemailer, { type Transporter } from 'nodemailer'

export type MailAttachment = { filename: string; content: string | Buffer; contentType?: string }
export type Mail = { to: string; subject: string; html: string; text?: string; replyTo?: string; attachments?: MailAttachment[] }

let transporter: Transporter | null = null

function getTransport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return transporter
}

const htmlToText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|h\d|tr|li)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/**
 * Sends an e-mail. Without SMTP configured (development), the message is written
 * to .data/outbox/*.html so flows can be inspected locally. Never throws —
 * a mail failure must not fail an order.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const from = process.env.MAIL_FROM ?? 'Sifra Vision <comenzi@sifravision.ro>'
  try {
    const t = getTransport()
    if (!t) {
      const dir = path.join(process.cwd(), '.data', 'outbox')
      await mkdir(dir, { recursive: true })
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}.html`)
      await writeFile(file, `<!-- To: ${mail.to} | Subject: ${mail.subject} -->\n${mail.html}`)
      if (process.env.NODE_ENV !== 'test') console.info(`[mail] ${mail.subject} → ${mail.to} (saved to ${path.relative(process.cwd(), file)})`)
      return true
    }
    await t.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text ?? htmlToText(mail.html), replyTo: mail.replyTo, attachments: mail.attachments })
    return true
  } catch (err) {
    console.error('[mail] failed', mail.subject, err)
    return false
  }
}

export const staffInbox = () => process.env.MAIL_STAFF || null
