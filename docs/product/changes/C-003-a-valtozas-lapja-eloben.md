---
id: C-3
title: A változás lapja élőben
ideas: I-5
milestone: M-9
status: implementing
---

## Probléma

Az interjú ma csak a chatben és a nagy térképen látszik; a gondolkodásnak nincs saját helye, és a Spec bármikor, nyom nélkül változhat.

## Megoldás

Változások fül saját modulban (`modules/changes`): a változások listája szakaszonként csoportosítva, és a változás lapja (probléma, megoldás, keret, kihagyjuk, nyitott kérdések, javasolt elemek célhellyel, szakasz). A lap egyelőre csak olvasható. Az interjú a chatben megy a grilling skillel, mellette a groundwork-prd-maker közvetlenül a változás .md-jébe ír, és minden írás után ellenőriz; a lap a core fájlfigyelésén követi. Ami épp változott, felvillan; ami a legutóbbi commit óta változott, jelölve marad (új, módosult, áthúzott). Az interjú két szakasza számolt: van nyitott kérdés → Grilling, nincs → Jóváhagyásra vár. Az új felület az első Lit-komponensekkel épül, a közösek (pl. rekord-chip) a core-ba kerülnek.

## Keret

Ötlettől a produktumig fejezet; a Spec és a változás szétválasztása; a változás lapja és az interjú a chatben. Utána a következő szelet interjúját már a böngészőben, a változás lapján követjük.

Kész, ha: a Változások fül listázza a C-1…C-13-at számolt szakasszal; a lap mindent mutat, az ötlet- és mérföldkő-hivatkozások chipként; a groundwork-prd-maker a változás interjújában a C-n fájlba ír és `record check`-kel ellenőriz; a C-4 interjúját a böngészőben, a C-4 lapján követjük (felvillanás, commit óta jelölés, commit után eltűnik); a modul önállóan tesztelhető, és git nélkül sem hibázik.

## Kihagyjuk

Gondolattérkép a változásban (C-4), jóváhagyás és beolvasztás (C-5), ötletből változás (C-6), válasz a lapról (C-7).

## Kérdések

## Javasolt elemek

- add `t-pipe` → `system` — Ötlettől a produktumig
  A Groundwork egy cső: az egyik végén bejön egy ötlet, a másikon kijön a produktum, legyen az szoftver, rendszerterv vagy szolgáltatás. Segédeszköz a cél eléréséhez: bármikor látszik, mi készül és hol tart, és ebből tervezni és bemutatni is lehet. A csövek egymásba fűződnek: egy alapötletből rendszerterv lesz, a tervből megvalósítás, és mindkettőhöz jöhetnek újabb ötletek.

  A korábbi modell gyökérhibája az volt, hogy az ötletnek a terv szerkezetében kellett helyet keresnie, mielőtt kidolgozták volna; sok dokumentumnál ez önkényes helyre vitte (az első PRD-be), és egy nagy térképen a jó helyet keresgélni sem lehetett. Ezért két dolgot külön tartunk nyilván: a **Specet**, ami most igaz, és a **változásokat**, ami most alakul (a kutatás alapján, OpenSpec-mintára).

  Az ötletnél az ember csak dönt: elfogadja, elveti, szundiztatja vagy duplikátumnak jelöli, és elfogadáskor utat választ (Grilling vagy Egyenesen jegy). Az elfogadott ötletből azonnal egy változás (C-n) lesz. Az interjú ezt tölti meg: Claude kérdez, a válaszokból javasolt Spec-elemek lesznek, mindegyik mellett egy javasolt célfejezettel. A hely tehát az utolsó lépés, elemenként, egy rövid jóváhagyó listán (Elfogad · Máshová… · Új rész), és ugyanígy működik egy és húsz dokumentummal. Jóváhagyáskor az elemek egyszerre olvadnak be a Specbe, eredetként a változás azonosítójával; a Spec tartalma csak így változik, a megfogalmazása közvetlenül is javítható. A szakaszokat senki nem állítja kézzel: a kapcsolatokból számolódnak, és mindig oda mutatnak, ahol a munka tart.
- add `d-pipe` → `system#t-pipe` — A Groundwork egy cső: ötlet be, produktum ki, közben látszik, hol tart · döntés · hiányzik
  Segédeszköz a cél eléréséhez: látszik, mi készül és hol tart; tervezni és bemutatni lehet belőle.
- add `d-map-is-product` → `system#t-pipe` — Egy projekt egy Spec: a produktum jóváhagyott leírása · döntés · hiányzik
  Szoftver, rendszerterv, szolgáltatás vagy bármi más; ami a Specben van, az készül, a megvalósítási állapot mutatja, mennyi épült meg.
- add `d-spec-change` → `system#t-pipe` — Két dolgot tartunk nyilván: a Specet (ami most igaz) és a Változásokat (ami most alakul) · döntés · hiányzik
  A gyökérhiba az volt, hogy az ötletnek a szerkezetben kellett helyet keresni, mielőtt kidolgozták volna (OpenSpec: specs + changes).
- add `d-change-own-id` → `system#t-pipe` — A változásnak saját azonosítója van (C-n); ötletek és változások hivatkoznak egymásra · döntés · hiányzik
  Alapból egy elfogadott ötletből azonnal egy változás lesz; később más ötlet hozzácsatolható, egy nagy változás kettévágható.
- add `d-change-without-idea` → `system#t-pipe` — Változás ötlet nélkül is indulhat (grillingből, munka közben) · döntés · hiányzik
- add `d-spec-via-change` → `system#t-pipe` — A spec tartalma csak változáson át módosul, a megfogalmazása közvetlenül is · döntés · hiányzik
  Ami azt változtatja, mit építünk (elem be, módosul, ki), az változás; elírás, pontosítás, átrendezés közvetlenül. Kézi tartalmi szerkesztésnél a felület felajánlja a változás nyitását.
- add `d-grilling-always` → `system#t-pipe` — Minden Specet érintő változás interjún (grillingen) megy át · döntés · hiányzik
  Döntés a Specbe csak interjúból születik; a mérete a változáshoz igazodik (d-interview-size).
- add `d-three-loops` → `system#t-pipe` — A lánc: ötlet (Ideas) → változás (Changes) → Spec-elemek (Spec) → jegyek (Tickets) · döntés · hiányzik
  Az ötlet a születésétől a döntésig él; onnan a változás viszi tovább. Hivatkozások: a változás az ötleteire, az elem a változására (change: C-n), a jegy a változására és az elemeire (**Change:**, **Spec:**). A megvalósítás közben született új ötlet elölről kezdi.
- add `d-stage-derived` → `system#t-pipe` — A szakaszok a kapcsolatokból számolódnak, nem kézzel állítják · döntés · hiányzik
  Változás: Grilling (nyitott kérdések) → Jóváhagyásra vár → Megvalósítás (x/n elem kész) → Kész (minden eleme kész). Az ötlet a döntéssel lezárul; a kártyáján a változásai szakasza látszik.
- add `n-research-flow` → `system#t-pipe` — Kutatás: ötlettől a produktumig (Shape Up, Torres, Linear, OpenSpec, Shneiderman…) · jegyzet · hiányzik
  <docs/product/research/idea-to-product-flow.md>
- add `x-first-prd` → `system#t-pipe` — Az ötlet az első PRD-be kerül · kizárt · hiányzik
  Több PRD-nél önkényes hely.
- add `x-per-prd-targets` → `system#t-pipe` — PRD-nkénti célpontok a Kidolgozásra oszlopban · kizárt · hiányzik
  Az Ideasnak nem kell ismernie a térkép szerkezetét; 20 PRD-nél 20 célpont lenne.
- add `x-inbox-doc` → `system#t-pipe` — Beérkezett tálca a térképen, az ötletre egy céldokumentum, abban Ötletek fejezet · kizárt · hiányzik
  A hely túl korán és túl durván dőlne el, és minden dokumentumban Ötletek fejezet nőne (kutatás, 3. döntés).
- add `d-interview-size` → `system#t-records` — Az interjút Claude méretezi a változáshoz, az ember bármikor lezárhatja (jó így) · döntés · hiányzik
  Elején megmondja, kicsi (2–3 kérdés) vagy nagy (több kör); a legfontosabb kérdéssel kezd. Lezáráskor a nyitva maradt kérdések a változáson látszanak.
- add `d-interview-chat` → `system#t-records` — Az interjú a Claude Code chatben zajlik, a változás lapja élőben töltődik · döntés · hiányzik
  Indítás a változás lapjáról (kész prompt) vagy a chatből; Claude kérdésenként javaslatot ad; a lapon a nyitott kérdések és a javasolt elemek célhellyel látszanak.
- add `d-all-work-is-change` → `system#t-records` — Minden munka változás: az egyenesen jegy út is minimális változást hoz létre · döntés · hiányzik
  Grilling és spec-elem nélkül, csak egy jeggyel; így a mérföldkő, az áttekintés és a hol tart? kivétel nélkül változásokat számol.
- add `d-lit` → `core/tech#t-core-stack` — Lit (LitElement) a munkaterületek közös komponenseihez · döntés · hiányzik
  Az I-5-tel: térképszerkesztő, rekordkártya, hivatkozás-chip, jóváhagyó lista mint web-komponens (pl. <gw-record-chip>). Fordítás nélkül fut, vendorolva a core/vendor/ alatt, kb. 15 KB; a mai lit-html sablonok változatlanul futnak benne, az áttérés fokozatos.
- add `x-svelte-react` → `core/tech#t-core-stack` — Svelte vagy React a munkaterületekhez (újragondolva az I-5-nél) · kizárt · hiányzik
  Build-lépést és eszközláncot kívánna minden fejlesztőtől és agenttől; a párhuzamos worktree-kben dolgozó agenteknek az azonnali kör többet ér.
- add `changes` → `parts` — Változások modul · software · A változások listája és a változás lapja.
- add `changes/prd` → `changes` — Változások modul: Termék
- add `changes/tech` → `changes` — Változások modul: Műszaki terv
- add `t-changes-arch` → `changes/tech` — Architektúra és komponensek
- add `d-changes-module` → `changes/tech#t-changes-arch` — A Változások fül saját modul (`modules/changes`), átveszi a Change típus deklarációját a core-tól · döntés · hiányzik
  Ugyanúgy ki-be kapcsolható és önállóan tesztelhető, mint a többi munkaterület. A mérföldkő (M-n) a core-ban marad, amíg az Áttekintés el nem viszi.
- add `t-changes-scope` → `changes/prd` — Hatókör és fő funkciók
- add `d-changes-page-readonly` → `changes/prd#t-changes-scope` — A változás lapja egyelőre csak olvasható: Claude ír a fájlba, a lap követi · döntés · hiányzik
  Indulásnak; a használat mutatja meg, mit érdemes a lapon szerkeszthetővé tenni. A válasz a lapról (C-7) és a jóváhagyó lista (C-5) külön szelet.
- add `d-changes-flash` → `changes/prd#t-changes-scope` — Ami az utolsó írással új lett vagy megváltozott, a lapon néhány másodpercig kiemelve látszik · döntés · hiányzik
  A szem odaugrik, ahová Claude épp írt.
- add `d-changes-since-commit` → `changes/prd#t-changes-scope` — A legutóbbi commit óta változott részek tartósan jelölve vannak: új, módosult, áthúzott · döntés · hiányzik
  Az alap a git: nincs saját „mit láttam” állapot, újratöltés és gépváltás után is látszik. Elemenként (id szerint) és szakaszonként vet össze, nem nyers sordiff. Git vagy commitolt fájl nélkül csak a rövid kiemelés működik.
- add `d-changes-list` → `changes/prd#t-changes-scope` — A változások listája szakaszonként csoportosít; soronként azonosító, cím, szakasz, nyitott kérdések és javasolt elemek száma, ötletek, mérföldkő · döntés · hiányzik
- add `d-changes-stage-interview` → `changes/prd#t-changes-scope` — Az interjú két szakasza számolt: van nyitott kérdés → Grilling, nincs → Jóváhagyásra vár; a későbbieket egyelőre a `status` mező adja · döntés · hiányzik
  A kézi címke elfelejtődik (a C-3 interjú közben is awaiting-approval volt). Megvalósítás, Kész és Elvetve a C-5 és a C-8 után számolódik (d-stage-derived).
- add `d-lit-scope-c3` → `changes/tech#t-changes-arch` — A Lit bekerül a `core/vendor`-ba; a Változások lapja Lit-komponensekből épül, a nyilvánvalóan közösek (pl. rekord-chip) a core-ba kerülnek · döntés · hiányzik
  A meglévő modulokat most nem írjuk át (az áttérés fokozatos, d-lit); a közös komponens helye viszont már most jó legyen, hogy a következő modul ne másolja le.
- add `d-changes-live` → `changes/tech#t-changes-arch` — A lap a core fájlfigyelésén követi a változást: a modul `watch(path)`-ja, SSE, a shell `subscribe()`-ja · döntés · hiányzik
  Változáskor a nyitott változást újraolvassa; a commit óta változott részekhez a fájl HEAD-beli változatát (`git show HEAD:<path>`) veti össze a `readChange`-dzsel.
- add `t-changes-int` → `changes/tech` — Integrációk és interfészek
- add `d-change-write-direct` → `changes/tech#t-changes-int` — Az interjúban Claude közvetlenül a változás .md-jét szerkeszti, minden írás után `groundwork record check` · döntés · hiányzik
  A groundwork-prd-maker a változás interjújában a C-n fájlba ír, nem a Specbe. A formátum kézzel írhatónak készült, és a lap csak olvasható, így nincs mit összefésülni.
- add `x-change-apply-cmd` → `changes/tech#t-changes-int` — Ops-alapú íróparancs a változáshoz (`groundwork change apply`) · kizárt · hiányzik
  Validálna és elemenként írna, de az összefésülés haszna csak két írónál jön elő; újra elő kell venni a válasz a lapról (C-7) vagy a szerkeszthető lap idején.

- add `x-solid` → `core/tech#t-core-stack` — SolidJS a munkaterületekhez · kizárt · hiányzik
  Könnyű és gyors, de a természetes formája a JSX, ami build-lépést kíván; a fordítás nélküli útja (solid-js/html) másodrangú. A mai lit-html sablonok a Litben változatlanul futnak, Solidra minden lapot újra kellene írni.

## Jegyek

A jegyek a `**Change:** C-3` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: t-pipe, d-interview-size, d-interview-chat, d-interview-browser, d-all-work-is-change, d-map-in-change, x-map-tool, n-plan-purpose; 30 proposed items)
- 2026-10-20 · claude · re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
- 2026-10-20 · claude · grilled: module, read-only page, direct writes, live highlight and since-commit marks, interview stages, Lit scope, done criteria
- 2026-10-20 · human · approved for implementation (the proposed items wait for the merge, C-5)
- 2026-10-20 · human · merged
