import type { Metadata } from 'next'
import { ContactForm } from '@/components/content/contact-form'
import { Icon } from '@/components/icons'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = { title: 'Contact', description: 'Scrie-ne, sună-ne sau vino în showroom-ul Sifra Vision din Galați, Str. Alexandru Cernat 188.', alternates: { canonical: '/contact' } }

export default async function ContactPage() {
  const s = await getSettings()
  return (
    <div className="container-x grid gap-12 pb-10 pt-12 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <div className="eyebrow">Contact</div>
        <h1 className="disp mt-3 text-[clamp(44px,6vw,88px)]">Vorbim.</h1>
        <ul className="mt-8 flex flex-col gap-4 text-[16px]">
          <li className="flex items-start gap-3"><Icon name="pin" className="mt-0.5" /> {s.company.address}, {s.company.city}</li>
          {s.company.phone ? <li className="flex items-center gap-3"><Icon name="phone" /> <a href={`tel:${s.company.phone}`} className="no-underline hover:underline">{s.company.phone}</a></li> : null}
          <li className="flex items-center gap-3"><Icon name="mail" /> <a href={`mailto:${s.company.email}`} className="no-underline hover:underline">{s.company.email}</a></li>
          {s.company.whatsapp ? <li className="flex items-center gap-3"><Icon name="whatsapp" /> <a href={`https://wa.me/${s.company.whatsapp.replace(/\D/g, '')}`} className="no-underline hover:underline">WhatsApp</a></li> : null}
        </ul>
        <p className="mt-8 max-w-sm text-[14.5px] text-graphite">Pentru întrebări despre o comandă, trece numărul comenzii — găsim totul mai repede.</p>
      </div>
      <ContactForm />
    </div>
  )
}
