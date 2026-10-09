import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/icons'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = {
  title: 'Conformitate și siguranță — dispozitive medicale, CE, verificare rețetă',
  description: 'Cum lucrăm: rame și lentile conforme MDR (UE) 2017/745, ochelari de soare EN ISO 12312-1, rețete verificate de optometrist, date medicale criptate.',
  alternates: { canonical: '/conformitate' },
}

export default async function CompliancePage() {
  const s = await getSettings()
  const items: [IconName, string, string][] = [
    ['shield', 'Dispozitive medicale clasa I', 'Ramele de vedere și lentilele corective sunt dispozitive medicale conform Regulamentului (UE) 2017/745 (MDR). Lucrăm doar cu producători care emit declarație de conformitate UE și marcaj CE.'],
    ['eye', 'Rețeta, verificată de optometrist', `Fiecare comandă cu dioptrii e verificată înainte de montaj${s.company.optometrist ? ` de ${s.company.optometrist}` : ' de optometristul nostru'}: coerența valorilor, PD-ul față de ramă, înălțimea de montaj la progresive.`],
    ['target', 'Control după montaj', 'După montaj, măsurăm dioptriile lentilelor cu frontofocometrul și centrarea față de PD. Ochelarii nu pleacă dacă ies din toleranțele ISO 21987.'],
    ['sparkle', 'Ochelari de soare conformi', 'Ochelarii de soare sunt echipamente de protecție individuală (Reg. UE 2016/425), testați conform EN ISO 12312-1, cu categoria filtrului și UV400 indicate pe fiecare produs.'],
    ['lock', 'Date medicale criptate', 'Valorile rețetei și pozele încărcate sunt criptate (AES-256-GCM) înainte de salvare. Au acces doar persoanele care lucrează la comanda ta, iar fiecare acces este jurnalizat.'],
    ['camera', 'Probă virtuală locală', 'Proba virtuală rulează exclusiv în browser. Nicio imagine nu este trimisă către serverele noastre sau către terți.'],
  ]
  return (
    <div className="container-x pb-10 pt-12">
      <div className="eyebrow">Conformitate & siguranță</div>
      <h1 className="disp mt-3 max-w-5xl text-[clamp(44px,6vw,92px)]">Ochelarii sunt dispozitive medicale. Îi tratăm ca atare.</h1>
      <ul className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([icon, t, d]) => (
          <li key={t} className="card p-6">
            <span className="grid size-11 place-items-center rounded-[14px] bg-fog"><Icon name={icon} /></span>
            <h2 className="mt-5 text-[18px] font-bold">{t}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{d}</p>
          </li>
        ))}
      </ul>
      <div className="card mt-10 grid gap-6 p-6 md:grid-cols-2 md:p-8">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          <dt className="text-graphite">Operator</dt><dd>{s.company.legalName}</dd>
          <dt className="text-graphite">CUI</dt><dd>{s.company.cui || 'în curs de completare'}</dd>
          <dt className="text-graphite">Reg. Com.</dt><dd>{s.company.regCom || 'în curs de completare'}</dd>
          <dt className="text-graphite">Adresă</dt><dd>{s.company.address}, {s.company.city}</dd>
          <dt className="text-graphite">Dispozitive medicale</dt><dd>{s.company.medicalNotice || 'Rame și lentile CE, MDR clasa I'}</dd>
        </dl>
        <div className="text-[15px] text-ink-2">
          <p>Declarațiile de conformitate pentru fiecare model sunt disponibile la cerere, iar partenerii B2B le descarcă direct din portal.</p>
          <Link href="/contact" className="mt-4 inline-flex items-center gap-1.5 font-bold text-cobalt no-underline hover:underline">Cere o declarație <Icon name="arrow-right" size={16} /></Link>
        </div>
      </div>
    </div>
  )
}
