---
id: C-6
title: Ötletből változás
ideas: I-5
milestone: M-9
status: implementing
---

## Probléma

Az ötlet elfogadása ma csak állapotváltás: nem indul belőle semmi, és az ötlet kártyája nem tudja, mi lett belőle.

## Megoldás

Elfogadáskor az ember utat választ, Grilling vagy Egyenesen jegy, és a core rekordtára egy lépésben írja az ötletet és az új változást. A Grilling út változása Grilling állapotban indul az ötlet szövegével; az Egyenesen jegy útja egy minimális változás, rögtön Megvalósításban, és a kártya a Claude-nak szóló promptot másolja, amely megírja a jegyet. Az elfogadott kártyán számolt összefoglaló mutatja a változásait és hol tartanak. A szundi és a régi ötlet csak csendes jelzést kap: a tábla semmit nem tol az ember elé, amíg nincs oka rá.

A felület most minimális: a tábla mai hat oszlopa marad, az új oszlopok és a szűrt nézetek sávja az I-12 UI-tervéig félretéve.

## Keret

Az elfogadás útválasztással, a core-ban, mind az ötlet, mind a változás írásával; az Egyenesen jegy prompt a kártyán; az összefoglaló az elfogadott kártyán; a csendes jelzések. Kész, ha egy ötlet elfogadása a tábláról a választott úton változást hoz létre, és a kártya mutatja, mi lett belőle.

## Kihagyjuk

Válasz a lapról (C-7); a tábla új oszlopai és a szűrt nézetek sávja (az I-12 UI-terve); a szerver nem nyit GitHub-jegyet.

## Gondolatok

- = A felület most minimális; a látványt az I-12 UI-terve gondolja újra, egyben
  A C-6 a működést építi: elfogadásból változás, az összefoglaló számolása. A tábla kinézete az átfogó UI-tervvel együtt változik, hogy ne kelljen kétszer átírni.
- Ami már megvan az Ideas táblán: New, Considering, Accepted, Rejected indokkal, Snoozed dátumig, Duplicate (I-n)
- = Az Egyenesen jegy út egy minimális változást hoz létre, és a kártya a Claude-nak szóló promptot másolja, amely megírja a jegyet → `d-direct-ticket`
  A böngésző nem futtat Claude-ot; a jegyet Claude írja, a **Change:** sorral, ahogy a mai Make a ticket gomb.
  - x A szerver azonnal nyit egy GitHub-jegyet a gh-val, az ötlet szövegéből
  - x Csak a minimális változás; a jegy később, a változás lapjáról
- = Az elfogadás a core rekordtárában él: egy lépésben írja az ötletet és az új változást; az Ideas végpontja az ember nevében hívja → `d-accept-in-core`
  Mint a beolvasztás (d-merge-in-core): két rekordtípus közös szabálya ott él, ahol mindkettő. Így nem maradhat elfogadott ötlet változás nélkül.
  - x A Changes modul végpontja hozza létre a változást, az ötlet állapota külön írás
  - x Az Ideas modul jogot kap változást létrehozni
- = A szundi addig tart, amíg az ember vissza nem hozza; a lejárt dátum csak csendes jelzés → `d-snooze-manual`
  Az ötlet magától nem jön vissza, amíg az embernek nincs oka rá; a dátum emlékeztető, nem határidő.
  - x Számolva New-ként látszik a dátum után, és figyelmet kér
  - x A szerver visszaírja New-ba, egy történetsorral
- = A 90 napnál régebben Considering-ben álló ötlet csak csendes régi jelzést kap, figyelmet nem kér → `d-stale-quiet`
  Ugyanaz, mint a lejárt szundinál: a tábla semmit nem tol az ember elé, amíg nincs oka rá.
  - x Régi jelzés, és figyelmet kér (szám a fülön)
- = A tábla új oszlopai és a szűrt nézetek sávja félretéve az I-12 UI-tervéig; a C-6 a mai oszlopokat tartja → `d-board-columns`
  Mindkettő a felület látványa, és az átfogó UI-tervvel együtt változik.
  - x Most épüljön, minimálisan
- = Az Egyenesen jegy minimális változása rögtön Megvalósításban indul: az elfogadás maga a jóváhagyás → `d-direct-ticket`
  Nincs javasolt eleme, így nincs mit beolvasztani; a változás a jegyet fogja össze.
  - x Jóváhagyásra vár, és egy elem nélküli jóváhagyás viszi tovább
- A Grilling út változása Grilling állapotban indul, az ötlet címével és szövegével, az ötletre hivatkozva; mérföldkő nélkül, azt az interjú adja

## Javasolt elemek

- add `d-idea-one-decision` → `system#t-pipe` — Az ötletnél az ember csak dönt: elfogadja, elveti, szundiztatja vagy duplikátumnak jelöli · döntés · hiányzik
  Azt nem kell eldönteni, hová kerül a Specben.
- add `d-route-choice` → `system#t-pipe` — Elfogadáskor az ember választ utat: Grilling vagy Egyenesen jegy; a kind csak az alapértéket adja · döntés · hiányzik
  A tervbe kerülő ötlethez mindig grilling kell; az egyenesen jegy út minimális változást hoz létre egy jeggyel (d-all-work-is-change).
- add `d-direct-ticket` → `system#t-pipe` — Az Egyenesen jegy út minimális változást hoz létre, rögtön Megvalósításban; a jegyet Claude írja a kártyáról másolt prompttal · döntés · hiányzik
  Az elfogadás maga a jóváhagyás: a változásnak nincs javasolt eleme, nincs mit beolvasztani, a jegyet fogja össze. A böngésző nem futtat Claude-ot, ezért a jegyet nem a szerver nyitja: a kártya a Claude-nak szóló promptot másolja, és Claude a **Change:** sorral írja meg, ahogy a mai Make a ticket gomb.
- add `d-accept-in-core` → `records/tech#t-rec-arch` — Az ötlet elfogadása a core rekordtárában él: egy lépésben írja az ötletet és az új változást · döntés · hiányzik
  Az Ideas végpontja az ember nevében hívja, mint a Changes a beolvasztást (d-merge-in-core). Két rekordtípus közös szabálya ott él, ahol mindkettő, így nem maradhat elfogadott ötlet változás nélkül.
- add `d-board-columns` → `system#t-pipe` — Ideas munkapad: New · Considering · Accepted · Closed (összecsukva, szűrhető) · félretett
  Accepted kártyán: → C-12 · Grilling. Döntések csak az embernél: Accept (Grilling / Egyenesen jegy), Reject indoklással, Snooze dátumig (utána csak csendes jelzés, d-snooze-manual), Duplicate of I-n. 90 napnál régebben Considering-ben álló ötlet csendes régi jelzést kap (d-stale-quiet).
- add `d-snooze-manual` → `system#t-pipe` — A szundi addig tart, amíg az ember vissza nem hozza; a lejárt dátum csak csendes jelzés a kártyán · döntés · hiányzik
  Az ötlet magától nem jön vissza és nem kér figyelmet: a dátum emlékeztető, nem határidő.
- add `d-stale-quiet` → `system#t-pipe` — A 90 napnál régebben Considering-ben álló ötlet csendes régi jelzést kap; figyelmet nem kér, és magától nem mozdul · döntés · hiányzik
- add `d-idea-summary` → `system#t-pipe` — Az elfogadott ötlet kártyáján kiszámolt összefoglaló: változásai és hol tartanak · döntés · hiányzik
  Pl. → C-12 · Megvalósítás, 4 elem a Specben · 2/5 jegy kész, linkekkel; nem kell vezetni.
- add `d-focus-banner` → `system#t-pipe` — Minden szűrt nézet kiírja, mit rejt, és egy kattintással visszaáll az egészre · félretett
  Az I-12 UI-tervéig félretéve, a tábla oszlopaival együtt (d-board-columns).

## Jegyek

A jegyek a `**Change:** C-6` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
- 2026-10-20 · claude · grilled: elfogadás a core-ban, két út (Grilling, Egyenesen jegy rögtön Megvalósításban, a jegyet Claude írja), csendes szundi és régi jelzés, a tábla látványa az I-12-ig félretéve; egy változás marad
- 2026-10-20 · human · merged; status: awaiting-approval → implementing
