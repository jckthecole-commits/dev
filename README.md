# Sifra Vision

Magazin online, configurator de lentile, probă virtuală, programări, portal B2B și panou de administrare pentru **SIFRA Vision** — rame de vedere și ochelari de soare, showroom pe Str. Alexandru Cernat 188, Galați.

> „Când stilul ține pasul cu tine.” — de la neclar la clar.

---

## Ce face

**Pentru clienți**

- **Catalog cu dimensiuni reale.** Fiecare ramă are lățimea lentilei, puntea, brațul și înălțimea lentilei. Filtrele merg pe formă, material, tip de ramă, lățimea feței și pe milimetri exacți („am o ramă 52□18 145, arată-mi ceva asemănător”).
- **Desen la scară 1:1.** Ramele sunt desenate procedural din dimensiunile lor (SVG, 1 unitate = 1 mm). Același desen apare în carduri, în configurator, în proba virtuală, în imaginile de partajare și în feed-ul Google. Fotografiile reale, când există, au prioritate.
- **Rame în 3D, din aceleași milimetri** (three.js, `src/components/three/`): în hero, optotipul neclar devine clar prin lentile (shader de lentilă în spațiul ecranului), rama se rotește cu mouse-ul, cu degetul sau cu giroscopul; secțiunea „Anatomia ramei” desface rama la scroll, cu cote din fișa produsului și grosimi de lentilă din motorul optic; pe pagina de produs, vizualizare 360° cu lentile de sticlă refractive și brațe care se pliază. three.js se încarcă doar după primul paint și doar unde e nevoie; fără WebGL, cu *reduce motion* sau *Save-Data* rămân versiunile SVG/statice.
- **Forme care se transformă:** „Caută după formă” trece fluid între conturul real al câte unei rame din fiecare formă, cu cotele A, B și puntea animate.
- **Configurator de lentile:** tip (monofocale / progresive / office / fără dioptrii) → indice (1.50–1.74, cu recomandare automată după dioptrie și estimarea grosimii marginii) → tratamente (cu grupuri exclusive) → rețetă (completată, încărcată ca poză/PDF sau trimisă mai târziu). Prețul complet se vede înainte de coș.
- **Probă virtuală în browser** (MediaPipe Face Landmarker, găzduit local): rama apare la mărimea ei reală pe față (scara vine din diametrul irisului, 11,7 mm) și măsoară distanța pupilară, preluată automat în configurator.
- **Checkout** cu curier, easybox sau ridicare din showroom; plată cu card (Netopia API v2 sau Stripe), ramburs, transfer sau la ridicare. Consimțământ separat pentru date medicale (GDPR art. 9).
- **Urmărirea comenzii** fără cont, programări online în showroom cu fișier calendar, cont client cu export și ștergere de date.
- **Portal B2B pentru optici:** cerere de parteneriat cu validare CUI, prețuri en-gros nete, comandă rapidă pe SKU, listă de prețuri CSV, termene de plată.

**Pentru echipă** (`/admin`)

- Panou cu venituri, comenzi în lucru, programările zilei, stoc scăzut și pregătirea pentru lansare.
- Comenzi: filtre, export CSV, tranziții de status validate (o comandă cu lentile nu intră în laborator până nu e verificată rețeta), AWB, plăți, note, istoric, **fișă de montaj printabilă**, emitere factură SmartBill.
- Rețete: coada optometristului, valori decriptate doar pentru roluri autorizate, fiecare deschidere înregistrată în jurnal.
- Agenda showroomului, zile cu program special, mesaje.
- Produse: editor cu previzualizare live la scară, variante de culoare, stoc pe locații cu jurnal de mișcări, fotografii, SEO; lentile și prețuri, cupoane, moderare recenzii.
- Clienți (inclusiv vizitatori), parteneri B2B (aprobarea creează contul și trimite invitația), echipă și roluri, setări, integrări, jurnal de audit, conținut (editor Markdown cu previzualizare, pagini, întrebări frecvente).

**Roluri:** `staff` (consultant), `optometrist`, `manager`, `admin` — matricea de permisiuni e vizibilă în *Echipă & roluri* și definită în `src/server/session.ts`.

## Tehnologie

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components / Partial Prerendering, React Compiler), React 19 |
| Date | PostgreSQL 15+, Drizzle ORM, migrații în `drizzle/` |
| Autentificare | Better Auth (e-mail + parolă, opțional Google) |
| Stil | Tailwind CSS v4, tokeni în `src/app/globals.css` |
| Fonturi | Mona Sans (titluri, variabil pe greutate și lățime; accentele sunt oblicul lui) · Atkinson Hyperlegible Next & Mono (text și specificații — desenat de Braille Institute pentru persoane cu vedere slabă) |
| 3D | three.js (+ depth of field și bloom în „Anatomia ramei”, doar desktop), încărcat la prima interacțiune |
| Mișcare | GSAP (SplitText, ScrollTrigger, Flip) + Lenis (scroll inerțial pe mouse/trackpad), încărcate la prima interacțiune · Sonner pentru notificări · View Transitions între pagini |
| Plăți | Netopia Payments API v2 (IPN semnat JWT RS512), Stripe Checkout |
| Facturare | SmartBill Cloud → e-Factura (SPV) |
| Fișiere | disc local sau S3 / Cloudflare R2; rețetele criptate AES-256-GCM |
| Teste | Vitest (unitare), Playwright (end-to-end, desktop + mobil) |

## Pornire locală

Cerințe: Node 22, pnpm 10, PostgreSQL 15+ (sau `docker compose up -d db`).

```bash
pnpm install
cp .env.example .env            # completează cel puțin DATABASE_URL și BETTER_AUTH_SECRET
pnpm db:migrate
pnpm db:seed:demo               # catalog + conținut + date demo (comenzi, programări, conturi)
pnpm dev                        # http://localhost:3000
```

Conturi demo (parola `sifra-demo-2026`, sau `DEMO_PASSWORD`): `admin@sifravision.ro`, `optometrist@sifravision.ro`, `showroom@sifravision.ro`, `partener@example.com`, `client@example.com`.

Pentru o instalare curată fără date demo: `pnpm db:seed`, apoi primul administrator:

```bash
ADMIN_PASSWORD='…' pnpm admin:create --email nume@sifravision.ro --name "Nume Prenume"
```

Fără SMTP configurat, e-mailurile se salvează în `.data/outbox/*.html`; fără procesator de plăți, `ALLOW_SIMULATED_PAYMENTS=true` afișează un simulator (doar în dezvoltare).

## Comenzi

| Comandă | Ce face |
|---|---|
| `pnpm dev` / `build` / `start` | dezvoltare, build de producție, server de producție |
| `pnpm check` | typecheck + lint + teste unitare |
| `pnpm test` | teste unitare (optică, prețuri, programări, validări RO, catalog) |
| `pnpm e2e` | teste end-to-end (Playwright) pe aplicația pornită, cu datele demo |
| `pnpm db:migrate` / `db:seed` / `db:seed:demo` | migrații, date de bază, date demo |
| `pnpm db:reset:demo` | șterge baza locală și o reface cu date demo (refuză în producție) |
| `pnpm db:generate` | generează o migrație după modificarea `src/lib/db/schema.ts` |
| `pnpm admin:create` | creează sau promovează un administrator |

## Variabile de mediu

Toate sunt descrise în `.env.example`. Obligatorii în producție:

- `NEXT_PUBLIC_SITE_URL` — adresa publică (canonical, sitemap, e-mailuri). **Se fixează la build.** `robots.txt` blochează indexarea pe orice adresă care conține `localhost`, `staging` sau `preview`.
- `DATABASE_URL`, `BETTER_AUTH_SECRET`
- `DATA_ENCRYPTION_KEY` — 32 de octeți base64 (`openssl rand -base64 32`). Criptează rețetele. **Păstrează o copie separată**: fără ea, rețetele existente nu mai pot fi citite.
- `CRON_SECRET` — pentru job-ul de mentenanță.

Plus, după caz: SMTP, Netopia sau Stripe, SmartBill, S3/R2, Google OAuth, GA4 / Meta Pixel (se încarcă doar după acordul pentru cookie-uri). Pagina **Admin → Lansare & integrări** arată ce e configurat, fără să afișeze valorile secrete.

## Producție

### Build-ul are nevoie de baza de date

Catalogul, paginile de conținut și setările sunt prerandate la build (Partial Prerendering) și invalidate apoi prin tag-uri când se modifică din admin. De aceea `pnpm build` trebuie să poată citi baza de date, cu migrațiile aplicate.

### Docker (un singur server)

```bash
cp .env.example .env    # completează valorile de producție
scripts/docker-up.sh    # pornește Postgres, aplică migrațiile, face build și pornește aplicația + cron
```

`docker-compose.yml` conține baza de date, aplicația (imagine *standalone*, utilizator fără privilegii, volum pentru fișiere încărcate) și un container care apelează mentenanța la 15 minute. Pune în față un reverse proxy cu HTTPS (Caddy, Nginx, Traefik) și setează `TRUSTED_PROXY_HOPS` la numărul de proxy-uri: IP-ul clientului (pentru limitări și jurnalul de audit) se ia din hop-ul adăugat de proxy, nu din valoarea trimisă de client.

### Vercel / alte platforme

Funcționează cu `next build` + `next start` sau output *standalone*. Folosește stocare S3/R2 (`STORAGE_DRIVER=s3`) și programează `GET /api/cron/maintenance` la 15 minute cu antetul `Authorization: Bearer $CRON_SECRET` (Vercel Cron îl trimite automat).

### Job-ul de mentenanță

`/api/cron/maintenance` anulează comenzile cu card neplătite după 90 de minute (stocul rezervat se eliberează), trimite remindere cu ~24 h înainte de programări și curăță sesiunile, token-urile, limitele de rată și coșurile vechi.

### Webhook-uri

- Netopia IPN: `https://<domeniu>/api/webhooks/netopia`
- Stripe: `https://<domeniu>/api/webhooks/stripe` (evenimentele `checkout.session.*`)

## Înainte de lansare

Lista completă, cu bife, e în **Admin → Lansare & integrări**. Pe scurt:

1. Date firmă reale în *Setări*: CUI, Registrul Comerțului, telefon, IBAN, mențiunea ANMDMR pentru dispozitive medicale, optometristul responsabil.
2. Programul showroomului confirmat (din el se generează orele de programare).
3. Încadrarea TVA pentru rame/lentile corective confirmată cu contabilul; clasa TVA setată pe produse și lentile.
4. Procesator de plăți, SMTP, SmartBill (e-Factura) și stocare configurate.
5. Pictograma oficială ANPC SAL în subsol și paginile legale revizuite de un jurist (termeni, confidențialitate — inclusiv date medicale, retur).
6. Fotografii reale de produs (desenele procedurale rămân ca rezervă și pentru feed).
7. Google Search Console și Merchant Center: `sitemap.xml` și `feeds/google-merchant.xml`.

## SEO și descoperire

- Date structurate: Organization, WebSite cu SearchAction, Optician (showroom, program), BreadcrumbList, FAQPage, Article, ProductGroup cu variante de culoare, ofertă, livrare și politică de retur, ItemList pe catalog.
- Pagini de categorie cu text propriu (`/rame-de-vedere/rotunde`, `/ochelari-de-soare/polarizati` …), canonical pe fiecare pagină; combinațiile de filtre trimit canonical către categorie, iar sortarea și paginarea sunt excluse din crawl.
- Imagini Open Graph generate (site, produs la scară, articol), imagini pătrate de produs pe fundal alb pentru Google Shopping, `sitemap.xml` cu imagini, feed Merchant Center pe variante, `llms.txt` pentru asistenții AI.

## Securitate și date personale

- Rețetele (valori și fișiere) sunt criptate în aplicație (AES-256-GCM) și sunt servite doar proprietarului și rolurilor autorizate, cu jurnal de acces.
- Consimțământ explicit pentru date medicale la checkout; export JSON și ștergere a contului din *Contul meu* (și de către echipă, la cerere).
- CSP strictă, HSTS, `frame-ancestors 'none'`, zonele private cu `Cache-Control: no-store`, limitare de rată pe formulare, autentificare și checkout, IPN-uri verificate criptografic, confirmarea plății protejată împotriva dublei procesări.
- Bannerul de cookie-uri folosește Google Consent Mode v2; nimic opțional nu se încarcă înainte de alegere.

## Performanță

Măsurat cu Lighthouse (mobil, throttling simulat) pe build-ul de producție: catalog și pagina de produs ~98, acasă ~90 (89–94 între rulări), desktop 99–100. Ce o ține așa:

- **Fonturi** variabile găzduite local, subsetate (latin + diacritice românești, fără hinting): ~120 KB în total față de ~300 KB de pe CDN. Le regenerezi cu `scripts/build-fonts.py`; licențele OFL sunt în `src/fonts`.
- **3D, GSAP, Lenis, post-procesarea și notificările** se încarcă abia la prima interacțiune (`src/lib/interaction.ts`, `src/lib/motion/boot.ts`); versiunile CSS/SVG sunt complete fără ele. Galeria orizontală a colecției e CSS scroll-driven, fără JS.
- **Desenele ramelor din carduri** sunt imagini SVG generate (`/imagini/rame/<slug>/<culoare>.svg?v=…`, cache permanent), nu SVG inline — DOM mai mic, nimic de calculat la hidratare.
- **Secțiunile de sub hero** sunt granițe `<Suspense>` (hidratate pe rând, fără task-uri lungi) cu `content-visibility: auto`.
- Fără overlay de intro, fără bucle JS per cadru la încărcare; animațiile de repaus rulează pe compozitor.

## Structură

```
src/
  app/(site)/        magazinul public
  app/(flow)/        configurator, checkout, plată (layout fără distrageri)
  app/admin/         panoul de administrare (+ _actions/ cu acțiunile de server)
  app/api/           autentificare, webhook-uri plăți, cron, descărcări private
  components/        UI pe domenii (catalog, product, configurator, tryon, admin …)
  lib/               logică pură, testată: optică, prețuri, programări, geometria ramelor, filtre, validări RO
  server/            acces la date și integrări (comenzi, stoc, e-mail, plăți, facturare, stocare, GDPR)
scripts/             migrații, seed, creare admin, copiere runtime MediaPipe
tests/unit, tests/e2e
```
