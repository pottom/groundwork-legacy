---
id: C-5
title: Jóváhagyás és beolvasztás
ideas: I-5
milestone: M-9
status: implementing
---

## Probléma

A javasolt elemek a változásban maradnak: nincs lépés, amely helyükre tenné őket a Specben, és a változások (C-2-től) jóváhagyásra várnak.

## Megoldás

A változás lapján jóváhagyó lista: soronként a javasolt elem a célhelyével, Elfogad és Máshová… (kereshető lista a fejezetekből), alul egy Jóváhagyás gomb. Az áthelyezés azonnal a változás fájljába íródik; a Jóváhagyás egy lépésben, mind vagy semmi alapon beolvasztja az elemeket a Specbe, eredetként a változás azonosítójával (egy későbbi módosítás a listához fűzi a magáét), és a változást Megvalósításba viszi.

A változások sorrendben olvadnak be: amíg egy elem célhelye egy még be nem olvasztott változásban van, a lap kiírja, melyikre vár. Hogy egy változás be van-e olvasztva, a Specből számolódik. A beolvasztás a core rekordtárában él, a Changes modul két végpontja az ember nevében hívja; ez az első írás a lapról, és a C-7 erre épül. A grilling zárásánál Claude szeletelést javasol, az ember a chatben hagyja jóvá.

## Keret

A jóváhagyó lista, a beolvasztás (core merge, a Changes modul két végpontja) és a szeletelés lépése a groundwork-prd-maker zárásában.

Kész, ha: a C-2, a C-3, a C-4 és a C-5 a lapról, sorrendben beolvadt a Specbe, mind vagy semmi alapon, eredetükkel; az áthelyezés a változás fájljába íródik; a függő célhelyű változás nem hagyható jóvá, és a lap megmondja, mire vár; a record check hibátlan.

## Kihagyjuk

Új rész létrehozása a lapon (Claude javasolja a chatben); a válasz a lapról (C-7); a Spec munkaterülete (C-9, C-10).

## Gondolatok

- = Az ember a változás lapján hagyja jóvá a változást → `d-approve-on-page`
  A jóváhagyó lista és a Jóváhagyás gomb az első írás a lapról; a C-7 válaszai ugyanerre az íróútra épülnek.
  - x A chatben hagyja jóvá, Claude futtatja a beolvasztást → `x-approve-in-chat`
  - = Sorrendben: egy jóváhagyás egy változást olvaszt be; amíg egy célhely egy másik függő változásban van, a lap kiírja, melyikre vár, és a Jóváhagyás nem megy → `d-merge-in-order`
    Az első körben ez a C-2-vel kezdődik, utána a C-3, aztán a többi.
    - x Láncban: a jóváhagyás a függő változásokat is beolvasztja → `x-merge-chain`
    - x Függőben: az elem a még nem létező célhelyre várakozik → `x-merge-pending`
  - = Egy Megvalósítás alatt álló változás (C-3, C-4) ugyanazzal a jóváhagyó listával olvad be, és az állapota nem változik → `d-merge-implementing`
    - x Előbb vissza Jóváhagyásra vár állapotba, onnan jóváhagyni → `x-merge-reapprove`
  - = A jóváhagyó lista soronként Elfogad és Máshová… (kereshető lista a fejezetekből); új részt a chatben kér az ember → `d-approve-list-actions`
    - x Új rész a lapon is, névvel, típussal, mappával → `x-new-part-on-page`
    - x Csak az egész lista jóváhagyása, javítás a chatben → `x-approve-all-only`
    - = Soronként nem kell elfogadni: a Jóváhagyás mindent elfogad, ami nincs áthelyezve; a Máshová… azonnal beíródik a változás fájljába → `d-move-writes-change`
      - x Minden sort ki kell pipálni a Jóváhagyás előtt → `x-tick-every-row`
- = A grilling zárásánál Claude szeletelést javasol, az ember a chatben hagyja jóvá → `d-slice-at-close`
  Egy változás marad, vagy több szelet, és melyik mire épül. Minden szelet saját változás, saját jóváhagyó listával, sorrendben beolvasztva.
  - x A jóváhagyó listán az ember elemenként szeletbe sorolja a javasolt elemeket → `x-slice-on-list`
- = A beolvasztottság számolódik: minden eleme ott van a Specben ezzel a változással az eredetében; a történetbe egy merged sor kerül az embernek → `d-merged-computed`
  - x Egy merged: dátum mező a változás fejlécében → `x-merged-field`
  - x Egy új állapot, Beolvasztva, a Jóváhagyásra vár és a Megvalósítás között
- = Mind vagy semmi: minden írás előbb összeáll és ellenőrződik, és csak hiba nélkül íródik ki; a lap a hibás sorok mellett mondja meg, mi a baj → `d-merge-atomic`
  A Spec írója megtagadja a már máshol álló azonosítót, a közben változott dokumentumot és a kieső felváltott elemet; egy változás több dokumentumba is ír.
  - x Ami megy, beíródik, a hibás elemek a változásban maradnak → `x-merge-partial`
- = A Jóváhagyás a Jóváhagyásra vár változást a beolvasztással együtt Megvalósításba viszi; ami már Megvalósítás alatt áll, az marad → `d-approve-implements`
  - x Az állapot külön lépés a beolvasztás után
- = A beolvasztás a core rekordtárában él: merge(C-n) együtt írja a változást és a Specet; a Changes modul két végpontja (Jóváhagyás, Máshová…) az ember nevében hívja → `d-merge-in-core`
  - x A Plan végpontján át, mert ma a Plan írja a Specet: a Plan a C-10-ben megszűnik
  - x Egy közös core író végpont minden rekordnak: korai, a C-7 a Changes végpontjai mellé kap egyet
- = A keret: a jóváhagyó lista, a beolvasztás és a szeletelés lépése a groundwork-prd-maker zárásában; kész, ha a C-2, C-3, C-4, C-5 a lapról, sorrendben beolvadt
  - x A szeletelés lépése külön változásban
- = A C-5 egy változás marad: az első szelet nélkül semmi nem működik, a második kicsi lenne
  - x Két szelet: előbb a merge és egy Jóváhagyás gomb, utána a Máshová… és a szeletelés lépése
- ! 187 elem vár a C-2…C-13-ban, és a célhelyük nagy része egy másik függő változás elemére mutat
  A C-2 hozza a records részt és a records/tech fejezeteit, a C-3 a changes részt és a t-pipe-ot; a C-5 minden eleme a C-3 t-pipe-jára céloz. A beolvasztás sorrendje tehát számít. Ma nincs kód, amely a javasolt elemeket a Specbe írná (a C-1-et a már törölt migrate írta), és a Changes modulnak nincs író végpontja.
- = A hely az utolsó lépés, elemenként: a rendszer célfejezetet javasol, az ember jóváhagyja → `d-place-on-map`
  - x Az ember a térképen húzza a helyére az ötletet → `x-drag-place`
- = Egy jóváhagyó lépésben olvad be minden elem, az interjú végén → `d-merge-on-approval`
- = A beolvasztott elem eredete a változások listája, amelyek hozták vagy módosították: · C-1, C-7 → `d-idea-dissolves`
  Az ötleteket a változás tudja; egy elemről a Specben ránézésre látszik, mely változások formálták.
  - x Csere: csak a legutolsó változás áll ott, a korábbiak a git történetében

## Javasolt elemek

- add `d-approve-on-page` → `changes/prd#t-changes-scope` — Az ember a változás lapján hagyja jóvá a változást · döntés · hiányzik
  A jóváhagyás az ember lépése, és a rekordtár a csatornából tudja, ki ír: a böngésző az ember, a parancssor Claude. A jóváhagyó lista és a Jóváhagyás gomb ezért a lapon van; ez az első írás a lapról, és a válasz a lapról (C-7) ugyanerre az íróútra épül.
- add `x-approve-in-chat` → `changes/prd#t-changes-scope` — Az ember a chatben hagyja jóvá, Claude futtatja a beolvasztást · kizárt · hiányzik
  A parancssornak az ember nevében kellene írnia, és ez gyengítené a szabályt, hogy Claude nem viheti Megvalósításba a változást.
- add `d-merge-in-order` → `system#t-pipe` — A változások sorrendben olvadnak be: egy jóváhagyás egy változás, és a függő célhelyű nem hagyható jóvá · döntés · hiányzik
  Ha egy elem célhelye egy még be nem olvasztott változás eleme, a lap kiírja, melyik változásra vár, és a Jóváhagyás addig nem megy. Így minden beolvasztás egy átnézett változás, és a Specben nincs árva célhely.
- add `x-merge-chain` → `system#t-pipe` — A jóváhagyás a függő változásokat is beolvasztja, láncban · kizárt · hiányzik
  Olyan változások is beolvadnának, amelyeket az ember külön nem nézett át.
- add `x-merge-pending` → `system#t-pipe` — Az elem beolvad, és a még nem létező célhelyre várakozik · kizárt · hiányzik
  Félkész Specet hagyna, árva célhelyekkel.
- add `d-merge-implementing` → `system#t-pipe` — Egy már Megvalósítás alatt álló változás ugyanazzal a jóváhagyó listával olvad be, az állapota nem változik · döntés · hiányzik
  A C-5 előtt jóváhagyott változások (C-3, C-4) elemei a beolvasztásra várnak; a jóváhagyás és a beolvasztás egy út marad, visszaléptetés nélkül.
- add `x-merge-reapprove` → `system#t-pipe` — A Megvalósítás alatt álló változást előbb vissza kell tenni Jóváhagyásra vár állapotba · kizárt · hiányzik
- add `d-slice-at-close` → `system#t-pipe` — A grilling zárásánál Claude szeletelést javasol, az ember a chatben hagyja jóvá · döntés · hiányzik
  Amikor elfogynak a kérdések, Claude megmondja, hogy a változás egyben marad, vagy több, egymásra épülő szeletre vágja. Minden szelet saját változás lesz, saját jóváhagyó listával, és a sorrend szabálya szerint olvad be (d-merge-in-order). A szeletelés gondolkodás, ezért a beszélgetésben dől el; a groundwork-prd-maker zárása ezzel a lépéssel bővül.
- add `x-slice-on-list` → `system#t-pipe` — Az ember a jóváhagyó listán elemenként sorolja szeletbe a javasolt elemeket · kizárt · hiányzik
- add `d-approve-list-actions` → `changes/prd#t-changes-scope` — A jóváhagyó lista soronként Elfogad és Máshová…; új részt a chatben kér az ember · döntés · hiányzik
  A Máshová… kereshető lista a Spec fejezeteiből és a függő változások fejezeteiből. Új rész ritkán kell, és Claude a parts célhellyel már felveszi, így a lapra nem kell részlétrehozó űrlap.
- add `x-new-part-on-page` → `changes/prd#t-changes-scope` — Új rész létrehozása a jóváhagyó listán, névvel, típussal, mappával · kizárt · hiányzik
- add `x-approve-all-only` → `changes/prd#t-changes-scope` — Csak az egész lista jóváhagyása, soronkénti lépés nélkül · kizárt · hiányzik
  A rossz célhely ránézésre látszik a listán; ott a legolcsóbb javítani.
- add `d-move-writes-change` → `changes/prd#t-changes-scope` — A Jóváhagyás mindent elfogad, ami nincs áthelyezve; a Máshová… azonnal a változás fájljába íródik · döntés · hiányzik
  A Jóváhagyás gomb maga a „megnéztem”. Az új célhely a változás fájljában él, mert a Markdown a forrás: Claude is látja, és újratöltés után is megmarad.
- add `x-tick-every-row` → `changes/prd#t-changes-scope` — Minden sort ki kell pipálni a Jóváhagyás előtt · kizárt · hiányzik
  Egy 86 elemes változásnál (C-2) 86 kattintás, és nem mond többet a Jóváhagyásnál.
- add `d-merged-computed` → `system#t-pipe` — Egy változás akkor van beolvasztva, ha minden eleme ott van a Specben ezzel a változással az eredetében · döntés · hiányzik
  Nem kell hozzá mező vagy állapot: az igazság a Specben van, mint a szakaszé a nyitott kérdésekben. A történetbe egy merged sor kerül, az embernek. Ha valaki kézzel kivesz egy elemet, a változás újra beolvasztatlan.
- add `x-merged-field` → `system#t-pipe` — A beolvasztás egy merged: dátum mező a változás fejlécében · kizárt · hiányzik
  Egy kézzel tartott mező elcsúszhat a Spec valóságától.
- add `d-merge-atomic` → `system#t-pipe` — A beolvasztás mind vagy semmi: hiba esetén semmi nem változik, és a lap a hibás sorok mellett mondja meg, mi a baj · döntés · hiányzik
  Félig beolvasztott változás nem maradhat: a beolvasztottság számolása és a sorrend szabálya is elakadna rajta.
- add `x-merge-partial` → `system#t-pipe` — Ami beírható, beíródik, a hibás elemek a változásban maradnak · kizárt · hiányzik
- add `d-approve-implements` → `system#t-pipe` — A Jóváhagyás a beolvasztással együtt Megvalósításba viszi a Jóváhagyásra vár változást · döntés · hiányzik
  A jóváhagyás és a megvalósításra jóváhagyás ugyanaz a döntés; egy második gomb csak egy újabb állapotot hozna. Ami már Megvalósítás alatt áll (C-3, C-4), az marad.
- add `d-merge-in-core` → `records/tech#t-rec-arch` — A beolvasztás a core rekordtárában él; a Changes modul végpontjai az ember nevében hívják · döntés · hiányzik
  A beolvasztás a változás és a Spec közös szabálya (sorrend, mind vagy semmi, eredet), ezért ott él, ahol a rekordtár és a Spec: merge(C-n) együtt írja a változás fájlját és a Spec dokumentumait. A Changes modul két végpontja (Jóváhagyás, Máshová…) a böngészőből jön, így az ember írása; a C-7 válaszai ugyanezen az úton egy harmadik végpontot kapnak.
- add `d-place-on-map` → `system#t-pipe` — A hely az utolsó lépés, elemenként: a rendszer célfejezetet javasol, az ember jóváhagyja · döntés · hiányzik
  Jóváhagyó lista: Elfogad · Máshová… (kereshető lista); új részt Claude javasol a chatben (d-approve-list-actions). Keresgélni a térképen nem kell.
- add `x-drag-place` → `system#t-pipe` — Az ember a térképen húzza a helyére az ötletet · kizárt · hiányzik
  Nagy térképen keresgélés; már 285 csomópontnál is használhatatlan.
- add `d-merge-on-approval` → `system#t-pipe` — A változás elemei egyszer, az interjú végén, egy jóváhagyó lépésben olvadnak be a Specbe · döntés · hiányzik
  A jóváhagyó listán dől el minden elem helye; beolvasztva hiányzik állapottal kerülnek a specbe, utána jönnek a jegyek. A spec a tervezett produktum, a megvalósítási állapot mutatja, mi épült meg (az OpenSpec-kel ellentétben nem a megvalósítás után).
- add `d-idea-dissolves` → `system#t-pipe` — A beolvasztott elem eredete a változások listája, amelyek hozták vagy módosították (· C-1, C-7); az ötleteket a változás tudja · döntés · hiányzik
  Egy későbbi módosítás (change) a végére fűzi a saját azonosítóját, így a legutolsó áll hátul. Egy elemről a Specben ránézésre látszik, mely változások formálták, és mindegyik a változás lapjára visz, a miértekkel.

## Jegyek

A jegyek a `**Change:** C-5` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: q-workspaces, d-conveyor, d-wip-signal, d-lineage-graph, d-ticket-lines, d-rec-ticket, d-tickets-merge, d-build-views-move, x-agents-own, d-new-modules, d-rec-ticket-source, d-ticket-write, d-ticket-old-lines, d-ticket-scratch-slug, d-ticket-checks, d-rec-catch-up, x-rec-catch-up-auto, x-rec-check-only, d-rec-history-outside, d-rec-test-mixed; 20 proposed items)
- 2026-10-20 · claude · re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
- 2026-10-20 · claude · grilled on its map: jóváhagyás a lapon, sorrendben, mind vagy semmi, Máshová… a fájlba írva, eredet listában, beolvasztottság számolva, merge a core-ban, szeletelés a zárásnál; egy változás marad
- 2026-10-20 · human · approved for implementation (the proposed items wait for its own approval list)
- 2026-10-20 · human · merged
