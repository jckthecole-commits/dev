# Studio ERP

Aplicație internă pentru un studio: modele, echipă, orar pe camere și ture, încasări pe platforme și calculul lunar al plăților, cu fluturași. Interfața e în română, gândită întâi pentru telefon, cu temă întunecată sau luminoasă după setarea dispozitivului.

Aplicația e separată de magazinul din rădăcina repo-ului. Are propriile dependențe, propria bază de date și se poate muta oricând într-un repo nou.

## Ce face (MVP)

| Modul | Ce poți face |
|---|---|
| **Acasă** | Brutul lunii cu comparație față de aceeași perioadă a lunii trecute, grafic pe zile, top modele, cine e azi în camere |
| **Modele** | Fișă (nume de scenă, nume din acte, status, trainer, plan de plată, IBAN, note), program pe 14 zile, istoric încasări și fluturași, cont de acces pentru model, utilizatorii de pe fiecare platformă |
| **Echipă** | Administratori, manageri, traineri: adăugare, schimbare rol, resetare parolă, dezactivare |
| **Orar camere** | Grilă săptămânală cameră × tură × zi. Blochează dubla programare a aceluiași model în aceeași tură. Poate copia săptămâna trecută. |
| **Încasări** | Adăugare manuală sau import CSV (model, platforma, data, suma, minute), filtre, totaluri pe platforme |
| **Plăți** | Calcul pe model după plan (praguri), bonusuri, avansuri, rețineri, conversie în RON, închiderea lunii cu fluturași înghețați, redeschidere, export CSV |
| **Setări** | Numele studioului, cursul implicit, camere, ture, platforme, planuri de plată |
| **Jurnal de audit** | Fiecare modificare: cine, ce, când, de pe ce IP |
| **Portalul modelului** | Modelul își vede programul, încasările lunii și fluturașii (doar pe ale lui) |

### Roluri

| | Admin | Manager | Trainer | Model |
|---|:-:|:-:|:-:|:-:|
| Modele: vede | toate | toate | doar ale lui, fără nume din acte și sume | — |
| Modele: modifică | ✓ | ✓ | | |
| Orar: vede / modifică | ✓ / ✓ | ✓ / ✓ | ✓ / | doar al lui |
| Încasări, plăți | ✓ | ✓ | | doar fluturașii lui |
| Închide / redeschide luna | ✓ | | | |
| Echipă, setări, audit | ✓ | | | |

Permisiunile sunt verificate pe server în fiecare pagină și acțiune (`src/lib/roles.ts`), nu doar ascunse din meniu.

### Cum se calculează plata

- Încasările se țin în **USD**, pe model, platformă și zi (un singur rând pe combinație; re-importul îl înlocuiește).
- **Planul** are praguri pe brutul lunar, de exemplu 50% de la 0, 55% de la 5.000 USD, 60% de la 10.000 USD. Sunt două moduri:
  - *Pragul atins se aplică la tot*: la 12.000 USD, 60% din 12.000.
  - *Progresiv pe tranșe*: 50% din primii 5.000, 55% din următorii 5.000, 60% din rest.
- **Net = cotă + bonusuri − avansuri − rețineri**, apoi convertit în RON la cursul ales la închiderea lunii.
- **Închiderea lunii** scrie fluturașii și blochează încasările și ajustările acelei luni. Dacă ai greșit ceva, admin-ul o poate redeschide, iar fluturașii se regenerează la următoarea închidere.
- Sumele se țin ca numere întregi (cenți, bani), deci nu apar erori de rotunjire.

### Import CSV

Prima linie e antetul. Coloanele se recunosc după nume, cu sau fără diacritice: `model`, `platforma`, `data`, `suma` și opțional `minute`. Separatorul poate fi virgulă, punct și virgulă sau tab. Data poate fi `2026-11-14` sau `14.11.2026`. Suma poate fi `1240.50` sau `1.240,50`.

Modelul se găsește după numele de scenă sau după utilizatorul de pe acea platformă (setat în fișa modelului). Importul e „totul sau nimic”: dacă un rând e greșit, nu se salvează nimic și primești lista problemelor cu numărul rândului.

## Pornire locală

Ai nevoie de Node 22 și pnpm 10 (`corepack enable`), plus PostgreSQL 15+.

```bash
cd studio-erp
cp .env.example .env            # pune DATABASE_URL și un BETTER_AUTH_SECRET lung (openssl rand -base64 32)
pnpm install
pnpm db:migrate                 # creează tabelele
pnpm db:seed                    # camere, ture și un plan de plată de pornire
ADMIN_PASSWORD='o-parola-lunga-de-12+' pnpm admin:create --email tu@exemplu.ro --name "Numele Tău"
pnpm dev                        # http://localhost:3000
```

**Date demo** (doar pe o bază de test): `pnpm db:seed:demo` adaugă modele fictive, două luni de încasări și orarul săptămânii. Conturile sunt `admin@demo.local`, `manager@demo.local`, `trainer@demo.local` și `luna@demo.local`, toate cu parola `demo-parola-123`.

## Producție

```bash
pnpm build && pnpm start        # sau output-ul standalone din .next/standalone
```

- Setează `APP_URL` la adresa reală (https) și un `BETTER_AUTH_SECRET` unic.
- Pune aplicația în spatele unui proxy cu HTTPS. Nu există înregistrare publică: conturile le creează admin-ul.
- Fă backup zilnic la baza de date (`pg_dump`). Conține date personale și financiare.

## Verificări

```bash
pnpm check                      # typecheck + lint + teste unitare (calcul plăți, sume, CSV, date)
```

## Structură

```
src/app/autentificare        pagina de login
src/app/(app)/…              paginile aplicației (fiecare cu actions.ts pe server)
src/lib/payroll.ts           calculul plății (pur, testat)
src/lib/csv.ts, money.ts     parsare import și sume
src/lib/roles.ts             roluri și permisiuni
src/lib/db/schema.ts         schema bazei de date
src/server/                  autentificare, sesiune, audit, setări, calcul lunar
drizzle/                     migrări SQL
```

## Ce urmează (fazele 2 și 3)

- Contracte și documente (acte de identitate criptate, semnare), facturi PDF
- Concedii și cereri de schimbare a turei, targeturi și clasament
- Import automat din platforme unde există API sau export programat
- Notificări (e-mail sau WhatsApp) pentru orar și fluturași
- Mai multe studiouri pe aceeași instalare
