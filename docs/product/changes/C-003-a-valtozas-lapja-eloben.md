---
id: C-3
title: A változás lapja élőben
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

Az interjú ma csak a chatben és a nagy térképen látszik; a gondolkodásnak nincs saját helye, és a Spec bármikor, nyom nélkül változhat.

## Megoldás

Változások fül: a változások listája és a változás lapja (probléma, megoldás, keret, kihagyjuk, nyitott kérdések, javasolt elemek célhellyel, szakasz). Az interjú a chatben megy a grilling skillel, mellette a groundwork-prd-maker élőben a változás .md-jébe ír, a lap követi. Az új felület az első Lit-komponensekkel épül.

## Keret

Ötlettől a produktumig fejezet; a Spec és a változás szétválasztása; a változás lapja és az interjú a chatben. Utána a következő szelet interjúját már a böngészőben, a változás lapján követjük.

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

## Jegyek

A jegyek a `**Change:** C-3` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: t-pipe, d-interview-size, d-interview-chat, d-interview-browser, d-all-work-is-change, d-map-in-change, x-map-tool, n-plan-purpose; 30 proposed items)
- 2026-10-20 · claude · re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
