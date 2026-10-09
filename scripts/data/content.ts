/**
 * Editorial content: guides (SEO), legal pages (templates with {{placeholders}}
 * resolved from settings at render time) and FAQs.
 * Legal texts are a solid starting point and MUST be reviewed by a lawyer.
 */

export type SeedPost = {
  slug: string
  kind: 'article' | 'page'
  title: string
  excerpt: string
  category?: string
  readingMinutes?: number
  metaDescription?: string
  body: string
}

export const ARTICLES: SeedPost[] = [
  {
    slug: 'cum-citesti-prescriptia-de-ochelari',
    kind: 'article',
    category: 'Ghiduri',
    readingMinutes: 6,
    title: 'Cum citești prescripția de ochelari: SPH, CYL, AX, ADD și PD',
    excerpt: 'Ce înseamnă fiecare căsuță din rețeta de la oftalmolog sau optometrist — și ce trebuie să completezi când comanzi online.',
    metaDescription: 'Ghid simplu pentru prescripția de ochelari: ce înseamnă SPH, CYL, AX, ADD și PD, cum se scriu valorile și ce faci dacă lipsește distanța pupilară.',
    body: `Rețeta de ochelari arată ca un tabel cu prescurtări. Odată ce știi ce înseamnă fiecare, o poți copia corect în orice formular — inclusiv în configuratorul nostru.

## OD și OS: care ochi e care

- **OD** (*oculus dexter*) — ochiul **drept**.
- **OS** (*oculus sinister*) — ochiul **stâng**.
- Uneori vei vedea **OU** (*oculus uterque*) — ambii ochi.

Pe unele rețete scrie simplu „Ochi drept / Ochi stâng” sau „R / L”.

## SPH — sfera

Este puterea principală a lentilei, în dioptrii (D).

- Valorile cu **minus** (de exemplu −1,75) corectează **miopia** — vezi neclar la distanță.
- Valorile cu **plus** (de exemplu +2,00) corectează **hipermetropia** — vezi neclar aproape.
- Valorile merg în pași de 0,25. „Plan”, „pl” sau 0,00 înseamnă fără corecție pe acel ochi.

## CYL și AX — cilindrul și axul

Corectează **astigmatismul**, adică o curbură neuniformă a corneei.

- **CYL** este tot în dioptrii, cu plus sau minus. Dacă rubrica e goală, nu ai astigmatism pe acel ochi.
- **AX** (axul) este un unghi între 0° și 180° și **există doar împreună cu CYL**. Fără ax, cilindrul nu poate fi montat corect — de aceea formularul nostru îl cere obligatoriu când completezi un cilindru.

> Atenție: unii medici scriu cilindrul cu plus, alții cu minus. Ambele sunt corecte și descriu aceeași lentilă. Copiază exact ce scrie pe rețetă — optometristul nostru face conversia.

## ADD — adiția

Apare la rețetele pentru **lentile progresive** sau pentru citit, de obicei după 40–45 de ani. Este puterea suplimentară pentru aproape, între +0,75 și +3,50. De regulă e aceeași pentru ambii ochi.

## PD — distanța pupilară

Distanța dintre centrele pupilelor, în milimetri. La adulți e de obicei între 56 și 72 mm.

- Poate fi scrisă ca un singur număr (de exemplu **63**) sau ca două valori, câte una pentru fiecare ochi (**31,5 / 31,5**) — „PD monocular”, mai precis la dioptrii mari și la progresive.
- **Mulți medici nu trec PD-ul pe rețetă.** Ai trei variante: îl măsurăm gratuit în showroom, îl măsori cu camera telefonului în [proba virtuală](/proba-virtuala), sau îl măsori cu o riglă în fața oglinzii.

## Exemplu complet

| | SPH | CYL | AX | ADD |
|---|---|---|---|---|
| **OD** | −2,25 | −0,75 | 180 | — |
| **OS** | −2,00 | −0,50 | 170 | — |

PD: 64 mm. Ochiul drept are miopie −2,25 cu astigmatism −0,75 la 180°; cel stâng, −2,00 cu −0,50 la 170°. Pentru o astfel de rețetă recomandăm de obicei indicele **1.60** — vezi [cum alegi grosimea lentilelor](/jurnal/indicele-de-refractie-lentile-subtiate).

## Cât de veche poate fi rețeta?

Recomandarea generală e un control la 1–2 ani (anual la copii și după 60 de ani). Dacă rețeta are peste doi ani sau simți că vezi mai prost, [programează o consultație](/programare) înainte să comanzi.

## Ce verificăm noi

Fiecare rețetă trimisă online e citită de un optometrist **înainte** de montaj: verificăm coerența valorilor, PD-ul față de rama aleasă și înălțimea de montaj la progresive. Dacă ceva nu se leagă, te sunăm — nu ghicim.`,
  },
  {
    slug: 'cum-alegi-marimea-ramei',
    kind: 'article',
    category: 'Ghiduri',
    readingMinutes: 5,
    title: 'Cum alegi mărimea ramei: ce înseamnă 52□18 145',
    excerpt: 'Cele trei numere de pe brațul ramei îți spun aproape tot ce trebuie despre cum va sta pe fața ta.',
    metaDescription: 'Ce înseamnă numerele de pe rama de ochelari (lățime lentilă, punte, braț), cum le compari cu rama ta actuală și cum alegi lățimea potrivită feței.',
    body: `Pe interiorul brațului oricărei rame găsești o serie ca **52□18 145**. E standardul internațional (EN ISO 8624) și e cel mai sigur mod de a ști dacă o ramă ți se potrivește înainte s-o ai în mână.

## Cele trei numere

1. **52 — lățimea lentilei (A)**, în mm, pe orizontală.
2. **18 — puntea (DBL)**, distanța dintre lentile, adică partea care stă pe nas.
3. **145 — lungimea brațului**, de la balama până la vârf.

Pătrățelul „□” dintre primele două arată că rama a fost măsurată prin sistemul *boxing* — ca și cum fiecare lentilă ar fi într-o cutie dreptunghiulară.

Pe paginile noastre de produs mai găsești:

- **Înălțimea lentilei (B)** — important la progresive, care au nevoie de minimum 28 mm.
- **Lățimea totală** — de la o balama la alta. Este cel mai bun indicator pentru „îngustă / medie / lată”.

## Metoda cea mai sigură: compară cu rama pe care o porți

Dacă ai o pereche care îți stă bine, uită-te pe braț și caută seria de numere. Apoi, în [catalog](/rame-de-vedere), folosește filtrele de dimensiuni:

- **±2 mm la lentilă** se simte puțin; 4 mm se vede.
- **Puntea** contează pentru confort: dacă rama îți alunecă pe nas, caută o punte mai îngustă sau plăcuțe nazale reglabile.
- **Brațul**: 140 mm pentru fețe mici, 145 mm standard, 150 mm pentru capete mari.

## Lățimea feței

| Lățime totală ramă | Potrivită pentru |
|---|---|
| sub 132 mm | fețe înguste, adolescenți |
| 132–140 mm | majoritatea adulților |
| peste 140 mm | fețe late |

## Regula ochilor

Ochii ar trebui să cadă aproximativ în centrul lentilelor, pe orizontală. Dacă lentila e mult mai lată decât fața, ochii ajung spre interior și lentila se face mai groasă la margine (mai ales la miopie). Asta e unul dintre motivele pentru care [proba virtuală](/proba-virtuala) desenează rama la **mărime reală**, nu „cât să încapă pe ecran”.

## Încă nesigur?

Vino în showroom-ul din Galați, pe Str. Alexandru Cernat 188 — probezi zeci de rame și măsurăm totul pe loc. Sau [programează o probă](/programare).`,
  },
  {
    slug: 'lentile-progresive-ghid',
    kind: 'article',
    category: 'Lentile',
    readingMinutes: 6,
    title: 'Lentile progresive: cum funcționează și cât durează adaptarea',
    excerpt: 'O singură pereche pentru departe, ecran și citit. Ce trebuie să știi înainte să le comanzi.',
    metaDescription: 'Cum funcționează lentilele progresive, cine are nevoie de ele, cât durează adaptarea și cum alegi rama potrivită pentru progresive.',
    body: `După 40–45 de ani, cristalinul își pierde treptat elasticitatea și apare **presbiopia**: textul mic se citește tot mai greu. Lentilele progresive rezolvă asta fără să schimbi ochelarii între distanțe.

## Cum funcționează

O lentilă progresivă are trei zone, fără linii vizibile între ele:

1. **Sus — departe**: condusul, strada, televizorul.
2. **Mijloc — intermediar**: ecranul, bordul mașinii, raftul din magazin.
3. **Jos — aproape**: telefonul, cartea.

Puterea crește gradual de sus în jos. Diferența dintre departe și aproape este **ADD**-ul de pe rețetă.

## Adaptarea

Majoritatea oamenilor se obișnuiesc în **câteva zile până la două săptămâni**. La început:

- mișcă **capul**, nu doar ochii, spre ce vrei să vezi;
- pe scări, privește prin partea de sus a lentilei;
- marginile laterale pot părea ușor „unduite” — e normal la toate progresivele.

Avem **garanție de adaptare de {{policies.adaptationDays}} de zile**: dacă nu te obișnuiești, refacem lentilele cu alt design.

## Rama contează

- **Înălțimea lentilei (B) minimum 28 mm**, ideal 30+. Altfel zona de aproape se taie. Configuratorul nostru blochează automat ramele prea joase.
- Evită ramele foarte înguste pe verticală sau cat-eye-urile foarte ridicate.
- Ramele cu plăcuțe nazale reglabile permit ajustarea fină a înălțimii.

## Măsurătorile

La progresive avem nevoie de **PD monocular** (pentru fiecare ochi) și de **înălțimea de montaj** — distanța de la pupilă la marginea de jos a ramei, măsurată cu rama pe față. Cea mai precisă variantă e o [probă în showroom](/programare). Dacă comanzi de la distanță, te sunăm pentru a confirma măsurătorile înainte de montaj.

## Progresive sau office?

Dacă lucrezi mult la birou, lentilele **office** au o zonă intermediară mult mai largă, dar nu sunt făcute pentru condus. Mulți clienți folosesc progresive „de zi cu zi” și o pereche office la birou.`,
  },
  {
    slug: 'indicele-de-refractie-lentile-subtiate',
    kind: 'article',
    category: 'Lentile',
    readingMinutes: 5,
    title: 'Indicele de refracție: când merită lentilele subțiate',
    excerpt: '1.50, 1.60, 1.67 sau 1.74? Cât de groasă va fi lentila ta, cu cifre.',
    metaDescription: 'Ce înseamnă indicele 1.50, 1.60, 1.67 și 1.74 la lentilele de ochelari, cât de subțiri sunt și când merită să plătești pentru lentile subțiate.',
    body: `Cu cât indicele de refracție e mai mare, cu atât materialul deviază lumina mai puternic — și lentila poate fi mai subțire pentru aceeași dioptrie.

## Pe scurt

| Indice | Recomandat pentru | Observații |
|---|---|---|
| **1.50** standard | până la ±2,00 | cea mai bună claritate optică |
| **1.60** subțiat | ±2,00 … ±4,00 | obligatoriu la rame fără ramă / semi |
| **1.67** extra-subțiat | ±4,00 … ±6,00 | |
| **1.74** ultra-subțiat | peste ±6,00 | doar monofocale |

## Cât de groasă iese, concret

Pentru o ramă **52□18** și PD 63, la **−4,00** marginea lentilei iese aproximativ:

- **5,5 mm** la indicele 1.50
- **4,4 mm** la 1.60
- **3,9 mm** la 1.67
- **3,6 mm** la 1.74

Configuratorul nostru calculează această estimare pentru rama și rețeta ta, înainte să alegi.

## Rama schimbă totul

La miopie (minus), lentila e groasă **la margine**. Cu cât lentila e mai lată și cu cât ochii sunt mai departe de centrul ei, cu atât marginea crește. Concret:

- o ramă mai îngustă, cu PD-ul tău aproape de centrul lentilei, reduce mai mult grosimea decât un indice mai mare;
- acetatul gros ascunde marginea lentilei; metalul fin o expune.

La hipermetropie (plus), lentila e groasă **la centru** — iar ramele mici ajută la fel de mult.

## Numărul Abbe

Materialele cu indice mare dispersează puțin mai mult culorile (număr Abbe mai mic). La dioptrii mici, 1.50 are cea mai bună claritate periferică — de aceea nu recomandăm „cel mai subțire” din reflex.`,
  },
  {
    slug: 'filtru-lumina-albastra-adevar',
    kind: 'article',
    category: 'Lentile',
    readingMinutes: 4,
    title: 'Filtrul de lumină albastră: ce face și ce nu face',
    excerpt: 'O explicație onestă, fără promisiuni miraculoase.',
    metaDescription: 'Ce face filtrul de lumină albastră pentru ochelari, ce spun studiile despre oboseala ochilor la ecran și când are sens să-l alegi.',
    body: `Filtrul de lumină albastră este un tratament care reflectă o parte din lumina albastră-violet (aproximativ 400–455 nm). Se recunoaște după reflexul albăstrui sau violet al lentilei.

## Ce face

- Reduce ușor strălucirea percepută a ecranelor și a luminilor LED.
- Mulți purtători spun că lumina pare „mai caldă” și mai confortabilă seara.

## Ce nu face

- Studiile de până acum **nu au arătat un efect clar** asupra oboselii vizuale digitale. Oboseala la ecran vine mai ales din clipitul rar, distanța și postura, și din corecția nepotrivită.
- Nu tratează și nu previne boli oculare.

De aceea îl oferim ca **opțiune**, nu ca standard, și nu îl recomandăm automat.

## Ce ajută de fapt la ecran

1. **Corecția corectă** pentru distanța ecranului — după 40 de ani, lentilele **office** schimbă radical confortul.
2. **Antireflexul** (inclus la noi) — elimină reflexiile parazite de pe lentilă.
3. Regula **20-20-20**: la fiecare 20 de minute, privește 20 de secunde la ceva aflat la ~6 metri.
4. Ecran la distanța brațului, ușor sub nivelul ochilor.

Dacă vrei să încerci, filtrul costă {{price.blue}} în configurator.`,
  },
  {
    slug: 'ochelari-de-soare-categorii-uv400-polarizare',
    kind: 'article',
    category: 'Soare',
    readingMinutes: 4,
    title: 'Ochelari de soare: categoria filtrului, UV400 și polarizarea',
    excerpt: 'Ce înseamnă cifrele de pe brațul ochelarilor de soare și când merită polarizarea.',
    metaDescription: 'Categoriile de filtre 0–4, protecția UV400, marcajul CE și lentilele polarizate la ochelarii de soare — explicate simplu.',
    body: `Ochelarii de soare sunt echipamente de protecție individuală și trebuie să poarte marcajul **CE** și categoria filtrului, conform standardului **EN ISO 12312-1**.

## Categoria filtrului (0–4)

| Categorie | Lumină transmisă | Folosire |
|---|---|---|
| 0 | 80–100% | interior, lentile aproape transparente |
| 1 | 43–80% | lumină slabă |
| 2 | 18–43% | lumină medie, oraș |
| 3 | 8–18% | soare puternic, vară, mare |
| 4 | 3–8% | munte, zăpadă — **interzis la condus** |

Toate modelele noastre de soare au categoria trecută pe pagina produsului.

## UV400

Înseamnă blocarea radiațiilor UV până la 400 nm — UVA și UVB. Este independentă de cât de închisă e lentila: o lentilă deschisă poate avea UV400, iar una foarte închisă fără protecție UV e periculoasă (pupila se dilată și lasă mai mult UV să intre).

## Polarizarea

Lentilele polarizate filtrează lumina reflectată orizontal — de pe apă, asfalt ud, zăpadă, capota mașinii. Merită la:

- condus, pescuit, sporturi pe apă, bicicletă;
- oricine e deranjat de reflexii.

Dezavantaj: unele ecrane LCD (bord, bancomate) pot părea întunecate sub anumite unghiuri.

## Ochelari de soare cu dioptrii

Aproape orice ramă de soare din catalog poate primi lentile cu dioptrii, colorate sau polarizate. Alegi „Cu dioptrii” în configurator.`,
  },
]

export const PAGES: SeedPost[] = [
  {
    slug: 'livrare-si-plata',
    kind: 'page',
    title: 'Livrare și plată',
    excerpt: 'Cum livrăm, în cât timp și cum poți plăti.',
    body: `## Termen de execuție

Ochelarii cu lentile sunt produși la comandă: verificăm rețeta, comandăm sau tăiem lentilele, le montăm și facem controlul de calitate. Durează de obicei **{{policies.productionDaysMin}}–{{policies.productionDaysMax}} zile lucrătoare**. Ramele fără lentile și ochelarii de soare fără dioptrii pleacă în 1–2 zile lucrătoare.

## Metode de livrare

| Metodă | Cost | Termen după expediere |
|---|---|---|
| {{shipping.courier.label}} | {{shipping.courier.price}} | {{shipping.courier.eta}} |
| {{shipping.easybox.label}} | {{shipping.easybox.price}} | {{shipping.easybox.eta}} |
| {{shipping.pickup.label}} | gratuit | {{shipping.pickup.eta}} |

**Livrarea este gratuită pentru comenzile de peste {{shipping.freeThreshold}}.** Primești numărul AWB pe e-mail și îl vezi și pe pagina comenzii.

## Metode de plată

- **Card online** — plată securizată 3-D Secure; datele cardului nu ajung la noi.
- **Ramburs** — plătești curierului la livrare (numerar sau card, în funcție de curier).
- **Transfer bancar** — primești datele în e-mailul de confirmare; comanda intră în producție după încasare.
- **În showroom** — la ridicare, cu card sau numerar.

Prețurile afișate includ TVA. Factura fiscală se emite electronic și o primești pe e-mail.`,
  },
  {
    slug: 'retur-si-garantie',
    kind: 'page',
    title: 'Retur și garanție',
    excerpt: 'Dreptul de retragere, garanția de adaptare și garanția produselor.',
    body: `## Rame fără lentile și ochelari de soare fără dioptrii

Ai la dispoziție **{{policies.returnDays}} de zile** de la primire pentru a returna produsul, fără să ne spui motivul (dreptul legal de retragere este de 14 zile, conform OUG 34/2014; noi îl extindem). Produsul trebuie să fie nepurtat, în ambalajul original, cu etichetele intacte. Banii îți sunt returnați în maximum 14 zile de la primirea coletului, pe aceeași cale prin care ai plătit sau în contul indicat.

## Ochelari cu lentile pe rețetă

Ochelarii cu lentile realizate după rețeta ta sunt **produse personalizate** și, potrivit art. 16 lit. c) din OUG 34/2014, nu intră sub dreptul de retragere. Totuși:

- **Garanția de adaptare — {{policies.adaptationDays}} de zile.** Dacă nu te poți obișnui cu lentilele (de exemplu cu progresivele), le refacem o dată, gratuit, după o verificare la optometrist.
- **Greșeala e a noastră?** Dacă lentilele nu corespund rețetei sau măsurătorilor, le refacem pe cheltuiala noastră, oricând.

## Garanție

- Rame: **{{policies.warrantyMonths}} de luni** pentru defecte de fabricație (balamale, sudură, delaminarea acetatului).
- Lentile: defecte ale tratamentelor (exfolierea antireflexului) — {{policies.warrantyMonths}} de luni.
- Nu sunt acoperite: zgârieturile, ruperea prin accident sau ajustările făcute în altă parte.

## Cum returnezi

1. Scrie-ne la {{company.email}} sau din pagina comenzii.
2. Trimite coletul prin curier sau lasă-l în orice easybox, ori adu-l în showroom.
3. Te anunțăm imediat ce am primit și verificat produsul.

## Soluționarea litigiilor

Dacă nu ajungem la o înțelegere, te poți adresa ANPC sau entităților de soluționare alternativă a litigiilor prin platforma [reclamatiisal.anpc.ro](https://reclamatiisal.anpc.ro).`,
  },
  {
    slug: 'termeni-si-conditii',
    kind: 'page',
    title: 'Termeni și condiții',
    excerpt: 'Condițiile de utilizare a site-ului și de vânzare.',
    body: `Site-ul este operat de **{{company.legalName}}**, CUI {{company.cui}}, nr. Reg. Com. {{company.regCom}}, cu sediul în {{company.address}}, {{company.city}}. Contact: {{company.email}}{{company.phoneSuffix}}.

## 1. Comanda

Comanda devine contract în momentul în care îți confirmăm prin e-mail că am acceptat-o. La ochelarii cu lentile, confirmarea finală are loc după ce optometristul verifică rețeta; dacă rețeta nu poate fi executată, te contactăm și, la cerere, anulăm comanda și returnăm integral suma plătită.

## 2. Prețuri

Prețurile sunt în lei și includ TVA. Prețul final, cu lentile, tratamente și transport, este afișat înainte de plasarea comenzii.

## 3. Rețeta medicală

Ești responsabil ca rețeta transmisă să fie a ta și să fie actuală. Nu modificăm valorile rețetei fără acordul tău. Recomandăm un control la cel mult doi ani.

## 4. Proba virtuală și măsurarea PD

Proba virtuală rulează **local, în browserul tău** — imaginile camerei nu sunt trimise și nu sunt salvate pe serverele noastre. Măsurarea distanței pupilare din cameră este o estimare; pentru lentile progresive o confirmăm prin telefon sau în showroom.

## 5. Livrare, retur, garanție

Detaliile sunt în paginile [Livrare și plată](/livrare-si-plata) și [Retur și garanție](/retur-si-garantie), care fac parte din acești termeni.

## 6. Dispozitive medicale

Ramele de vedere și lentilele corective sunt dispozitive medicale de clasa I (Regulamentul (UE) 2017/745). Ochelarii de soare sunt echipamente de protecție individuală (Regulamentul (UE) 2016/425).

## 7. Litigii

Legea aplicabilă este legea română. Te poți adresa ANPC sau entităților SAL prin [reclamatiisal.anpc.ro](https://reclamatiisal.anpc.ro).`,
  },
  {
    slug: 'politica-de-confidentialitate',
    kind: 'page',
    title: 'Politica de confidențialitate',
    excerpt: 'Ce date prelucrăm, de ce și cum le protejăm — inclusiv datele medicale din rețete.',
    body: `Operatorul datelor este **{{company.legalName}}** ({{company.address}}, {{company.city}}, {{company.email}}).

## Ce date prelucrăm

- **Date de identificare și contact**: nume, e-mail, telefon, adresă de livrare și facturare.
- **Date de comandă și plată**: produse, valori, istoricul comenzii. Datele cardului sunt procesate exclusiv de procesatorul de plăți.
- **Date privind sănătatea**: valorile rețetei (SPH, CYL, AX, ADD, PD) și imaginea rețetei, dacă o încarci. Sunt **date cu caracter special** (art. 9 GDPR).
- **Programări**: serviciul ales, data, observațiile tale.
- **Date tehnice**: cookie-uri strict necesare și, doar cu acordul tău, cookie-uri de analiză și marketing.

## De ce

| Scop | Temei |
|---|---|
| Executarea comenzii și livrarea | contract (art. 6 alin. 1 lit. b) |
| Realizarea lentilelor după rețetă | consimțământul tău explicit (art. 9 alin. 2 lit. a) și scop medical (art. 9 alin. 2 lit. h) |
| Facturare, contabilitate | obligație legală (art. 6 alin. 1 lit. c) |
| Newsletter | consimțământ, retras oricând |
| Analiză trafic | consimțământ (cookie-uri) |

## Cum protejăm rețetele

- Valorile rețetei și fișierele încărcate sunt **criptate** (AES-256-GCM) înainte de a fi salvate.
- Au acces doar optometriștii și personalul care execută comanda, cu jurnal de acces.
- Imaginile din proba virtuală **nu părăsesc dispozitivul tău**.

## Cât păstrăm

Datele de comandă și facturile: 10 ani (obligație fiscală). Rețetele: cât timp ai cont la noi sau 3 ani de la ultima comandă, apoi le ștergem sau le anonimizăm.

## Drepturile tale

Acces, rectificare, ștergere, restricționare, portabilitate, opoziție și retragerea consimțământului. Scrie-ne la {{company.email}}. Ai dreptul să depui plângere la ANSPDCP (dataprotection.ro).`,
  },
  {
    slug: 'politica-cookies',
    kind: 'page',
    title: 'Politica de cookies',
    excerpt: 'Ce cookie-uri folosim și cum îți gestionezi preferințele.',
    body: `## Strict necesare (mereu active)

| Cookie | Scop | Durată |
|---|---|---|
| sv_cart | coșul de cumpărături | 30 de zile |
| better-auth.session_token | autentificare în cont | până la deconectare / 7 zile |
| sv_consent | preferințele tale privind cookie-urile | 6 luni |

## Analiză (doar cu acord)

Google Analytics 4 — măsurăm anonim ce pagini sunt utile. Se încarcă **doar** după ce accepți.

## Marketing (doar cu acord)

Meta Pixel — pentru măsurarea campaniilor. Se încarcă **doar** după ce accepți.

Îți poți schimba oricând alegerea din linkul „Preferințe cookies” din subsolul site-ului.`,
  },
  {
    slug: 'accesibilitate',
    kind: 'page',
    title: 'Declarație de accesibilitate',
    excerpt: 'Cum facem site-ul utilizabil pentru toată lumea.',
    body: `Suntem optician — vederea e meseria noastră. Vrem ca site-ul să poată fi folosit de oricine, inclusiv de persoanele cu vedere scăzută.

## Ce am făcut

- Textul este setat în **Atkinson Hyperlegible**, un font creat de Braille Institute pentru cititorii cu vedere scăzută: litere ușor de deosebit (I, l, 1; O, 0).
- Contrast al textului conform WCAG 2.2 nivel AA.
- Navigare completă din tastatură, cu indicator de focus vizibil.
- Animațiile se opresc dacă ai activat „reducerea mișcării” în sistem.
- Formularele au etichete și mesaje de eroare clare, legate de câmpuri.

## Limitări cunoscute

- Proba virtuală folosește camera și o imagine; oferim alternativa: pagina de produs cu toate dimensiunile și programarea în showroom.

## Feedback

Dacă ceva nu funcționează pentru tine, scrie-ne la {{company.email}}. Răspundem în cel mult 5 zile lucrătoare.`,
  },
]

export const FAQS = [
  { topic: 'comanda', question: 'Cum comand ochelari de vedere online?', answer: 'Alegi rama, apoi în configurator tipul lentilelor, grosimea și tratamentele. La final îți introduci rețeta, încarci o poză cu ea sau o trimiți mai târziu. Un optometrist verifică rețeta înainte de montaj.' },
  { topic: 'comanda', question: 'Nu am rețetă. Ce fac?', answer: 'Poți programa o consultație optometrică în showroom-ul din Galați. Dacă ai o rețetă mai veche de doi ani, îți recomandăm un control înainte de comandă.' },
  { topic: 'comanda', question: 'Ce fac dacă rețeta nu are trecută distanța pupilară (PD)?', answer: 'O măsori gratuit cu camera telefonului în proba virtuală, o măsurăm noi în showroom sau o completezi mai târziu — te sunăm înainte de montaj.' },
  { topic: 'lentile', question: 'Ce indice de lentilă să aleg?', answer: 'Configuratorul îți recomandă indicele în funcție de rețetă și ramă și îți arată grosimea estimată a marginii. Ca regulă: 1.50 până la ±2, 1.60 până la ±4, 1.67 până la ±6, 1.74 peste.' },
  { topic: 'lentile', question: 'Antireflexul este inclus?', answer: 'Da. Durificarea și antireflexul sunt preselectate la toate lentilele cu dioptrii; le poți debifa dacă vrei.' },
  { topic: 'lentile', question: 'Pot pune lentile cu dioptrii pe ochelari de soare?', answer: 'Da, pe aproape toate modelele de soare: monofocale sau progresive, colorate sau polarizate.' },
  { topic: 'livrare', question: 'În cât timp primesc ochelarii?', answer: 'Ochelarii cu lentile sunt gata în 3–6 zile lucrătoare, apoi livrarea durează 1–2 zile. Ramele și ochelarii de soare fără dioptrii pleacă în 1–2 zile lucrătoare.' },
  { topic: 'livrare', question: 'Pot ridica comanda din Galați?', answer: 'Da, din showroom-ul de pe Str. Alexandru Cernat 188. Te anunțăm prin e-mail și SMS când e gata; la ridicare ajustăm rama pe fața ta.' },
  { topic: 'retur', question: 'Pot returna ochelarii?', answer: 'Ramele și ochelarii de soare fără dioptrii, da — 30 de zile. Ochelarii cu lentile pe rețetă sunt personalizați, dar au garanție de adaptare: dacă nu te obișnuiești, refacem lentilele o dată, gratuit.' },
  { topic: 'proba', question: 'Proba virtuală îmi salvează imaginile?', answer: 'Nu. Proba virtuală rulează exclusiv în browserul tău; imaginile camerei nu sunt trimise nicăieri.' },
  { topic: 'b2b', question: 'Sunt optician. Pot cumpăra rame SIFRA en-gros?', answer: 'Da. Cere un cont de partener: primești prețuri en-gros, stoc în timp real, comandă rapidă pe cod de model și documentele de conformitate.' },
]
