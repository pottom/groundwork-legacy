---
id: C-3
title: Változások
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

Az ötletnek ma a Spec szerkezetében kell helyet keresnie, mielőtt kidolgozták volna; a gondolkodásnak nincs saját helye, és a Spec bármikor, nyom nélkül változhat.

## Megoldás

A Változások munkaterület hozza a fő hurkot: ötlet, interjú, jóváhagyás, Spec. A változás lapja, gondolattérkép a változásban, javasolt elemek célhellyel, jóváhagyó lista és beolvasztás, az új prd-maker skill, és elfogadáskor változás az ötletből.

## Keret

Ötlettől a produktumig fejezet, az interjú és a változás felülete. Utána a fő hurok működik, és a C-4, C-5 már ezen az úton jöhet.

## Kihagyjuk

Összkép, mátrix és a Plan megszűnése (C-4); jegyek és Áttekintés (C-5).

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
- add `d-idea-one-decision` → `system#t-pipe` — Az ötletnél az ember csak dönt: elfogadja, elveti, szundiztatja vagy duplikátumnak jelöli · döntés · hiányzik
  Azt nem kell eldönteni, hová kerül a Specben.
- add `d-stage-derived` → `system#t-pipe` — A szakaszok a kapcsolatokból számolódnak, nem kézzel állítják · döntés · hiányzik
  Változás: Grilling (nyitott kérdések) → Jóváhagyásra vár → Megvalósítás (x/n elem kész) → Kész (minden eleme kész). Az ötlet a döntéssel lezárul; a kártyáján a változásai szakasza látszik.
- add `d-focus-banner` → `system#t-pipe` — Minden szűrt nézet kiírja, mit rejt, és egy kattintással visszaáll az egészre · döntés · hiányzik
- add `x-first-prd` → `system#t-pipe` — Az ötlet az első PRD-be kerül · kizárt · hiányzik
  Több PRD-nél önkényes hely.
- add `x-per-prd-targets` → `system#t-pipe` — PRD-nkénti célpontok a Kidolgozásra oszlopban · kizárt · hiányzik
  Az Ideasnak nem kell ismernie a térkép szerkezetét; 20 PRD-nél 20 célpont lenne.
- add `d-place-on-map` → `system#t-pipe` — A hely az utolsó lépés, elemenként: a rendszer célfejezetet javasol, az ember jóváhagyja · döntés · hiányzik
  Jóváhagyó lista: Elfogad · Máshová… (kereshető lista) · Új rész; Claude ugyanezzel dolgozik. Keresgélni a térképen nem kell.
- add `x-drag-place` → `system#t-pipe` — Az ember a térképen húzza a helyére az ötletet · kizárt · hiányzik
  Nagy térképen keresgélés; már 285 csomópontnál is használhatatlan.
- add `d-grilling-always` → `system#t-pipe` — Minden Specet érintő változás interjún (grillingen) megy át · döntés · hiányzik
  Döntés a Specbe csak interjúból születik; a mérete a változáshoz igazodik (d-interview-size).
- add `d-idea-dissolves` → `system#t-pipe` — A beolvasztott elem eredete egy mező: change: C-7; az ötleteket a változás tudja · döntés · hiányzik
  Későbbi módosításnál az eredet frissül, a régi változás a történetben marad.
- add `d-three-loops` → `system#t-pipe` — A lánc: ötlet (Ideas) → változás (Changes) → Spec-elemek (Spec) → jegyek (Tickets) · döntés · hiányzik
  Az ötlet a születésétől a döntésig él; onnan a változás viszi tovább. Hivatkozások: a változás az ötleteire, az elem a változására (change: C-n), a jegy a változására és az elemeire (**Change:**, **Spec:**). A megvalósítás közben született új ötlet elölről kezdi.
- add `d-idea-summary` → `system#t-pipe` — Az elfogadott ötlet kártyáján kiszámolt összefoglaló: változásai és hol tartanak · döntés · hiányzik
  Pl. → C-12 · Megvalósítás, 4 elem a Specben · 2/5 jegy kész, linkekkel; nem kell vezetni.
- add `d-board-columns` → `system#t-pipe` — Ideas munkapad: New · Considering · Accepted · Closed (összecsukva, szűrhető) · döntés · hiányzik
  Accepted kártyán: → C-12 · Grilling. Döntések csak az embernél: Accept (Grilling / Egyenesen jegy), Reject indoklással, Snooze dátumig (utána vissza New-ba), Duplicate of I-n. 90 napnál régebben Considering-ben álló ötlet régi jelzést kap és figyelmet kér, de magától nem mozdul.
- add `d-route-choice` → `system#t-pipe` — Elfogadáskor az ember választ utat: Grilling vagy Egyenesen jegy; a kind csak az alapértéket adja · döntés · hiányzik
  A tervbe kerülő ötlethez mindig grilling kell; az egyenesen jegy út minimális változást hoz létre egy jeggyel (d-all-work-is-change).
- add `n-research-flow` → `system#t-pipe` — Kutatás: ötlettől a produktumig (Shape Up, Torres, Linear, OpenSpec, Shneiderman…) · jegyzet · hiányzik
  <docs/product/research/idea-to-product-flow.md>
- add `d-spec-change` → `system#t-pipe` — Két dolgot tartunk nyilván: a Specet (ami most igaz) és a Változásokat (ami most alakul) · döntés · hiányzik
  A gyökérhiba az volt, hogy az ötletnek a szerkezetben kellett helyet keresni, mielőtt kidolgozták volna (OpenSpec: specs + changes).
- add `d-change-own-id` → `system#t-pipe` — A változásnak saját azonosítója van (C-n); ötletek és változások hivatkoznak egymásra · döntés · hiányzik
  Alapból egy elfogadott ötletből azonnal egy változás lesz; később más ötlet hozzácsatolható, egy nagy változás kettévágható.
- add `x-inbox-doc` → `system#t-pipe` — Beérkezett tálca a térképen, az ötletre egy céldokumentum, abban Ötletek fejezet · kizárt · hiányzik
  A hely túl korán és túl durván dőlne el, és minden dokumentumban Ötletek fejezet nőne (kutatás, 3. döntés).
- add `d-change-without-idea` → `system#t-pipe` — Változás ötlet nélkül is indulhat (grillingből, munka közben) · döntés · hiányzik
- add `d-spec-via-change` → `system#t-pipe` — A spec tartalma csak változáson át módosul, a megfogalmazása közvetlenül is · döntés · hiányzik
  Ami azt változtatja, mit építünk (elem be, módosul, ki), az változás; elírás, pontosítás, átrendezés közvetlenül. Kézi tartalmi szerkesztésnél a felület felajánlja a változás nyitását.
- add `d-merge-on-approval` → `system#t-pipe` — A változás elemei egyszer, az interjú végén, egy jóváhagyó lépésben olvadnak be a Specbe · döntés · hiányzik
  A jóváhagyó listán dől el minden elem helye; beolvasztva hiányzik állapottal kerülnek a specbe, utána jönnek a jegyek. A spec a tervezett produktum, a megvalósítási állapot mutatja, mi épült meg (az OpenSpec-kel ellentétben nem a megvalósítás után).
- add `d-interview-size` → `system#t-records` — Az interjút Claude méretezi a változáshoz, az ember bármikor lezárhatja (jó így) · döntés · hiányzik
  Elején megmondja, kicsi (2–3 kérdés) vagy nagy (több kör); a legfontosabb kérdéssel kezd. Lezáráskor a nyitva maradt kérdések a változáson látszanak.
- add `d-interview-chat` → `system#t-records` — Az interjú a Claude Code chatben zajlik, a változás lapja élőben töltődik · döntés · hiányzik
  Indítás a változás lapjáról (kész prompt) vagy a chatből; Claude kérdésenként javaslatot ad; a lapon a nyitott kérdések és a javasolt elemek célhellyel látszanak.
- add `d-interview-browser` → `system#t-records` — Később: válasz a változás lapjáról is (Claude javaslatai gombként, vagy saját válasz) · döntés · hiányzik
  Meg akarjuk építeni, második lépésként; ehhez Claude-nak figyelnie kell a lapot.
- add `d-all-work-is-change` → `system#t-records` — Minden munka változás: az egyenesen jegy út is minimális változást hoz létre · döntés · hiányzik
  Grilling és spec-elem nélkül, csak egy jeggyel; így a mérföldkő, az áttekintés és a hol tart? kivétel nélkül változásokat számol.
- add `d-map-in-change` → `records/tech#t-rec-workspaces` — A gondolattérkép a változás saját felülete · döntés · hiányzik
  Gyökere a ködös ötlet; ágain gondolatok, kérdések, lehetőségek, döntések. Ember és Claude együtt építi. A beérett ágakból (döntés, megkötés, kihagyjuk) javasolt elem lesz célhely-javaslattal; a többi a változásban marad. Forrása a változás .md-jének Gondolatok vázlata. Kicsi marad, mert egy változásé.
- add `x-map-tool` → `records/tech#t-rec-workspaces` — A térkép önálló eszköz, mint a Vázlat · kizárt · hiányzik
  A gondolkodás a változásban történik; külön eszközként csak hivatkozás lenne rá.
- add `n-plan-purpose` → `records/tech#t-rec-workspaces` — A Plan eredeti célja: ködös ötletből Claude-dal közösen gondolatokat építeni · jegyzet · hiányzik

## Jegyek

A jegyek a `**Change:** C-3` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: t-pipe, d-interview-size, d-interview-chat, d-interview-browser, d-all-work-is-change, d-map-in-change, x-map-tool, n-plan-purpose; 30 proposed items)
