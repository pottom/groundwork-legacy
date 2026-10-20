---
id: C-4
title: Gondolattérkép a változásban
ideas: I-5
milestone: M-9
status: implementing
---

## Probléma

A gondolkodás ma egy nagy, közös térképen folyik, 300 elem fölött; egy változás gondolatai elvesznek benne.

## Megoldás

Minden változásnak saját, kicsi gondolattérképe van a lapja tetején. A gyökere a változás címe, az ágain gondolatok, kérdések, lehetőségek, döntések, megkötések és kihagyott dolgok nőnek. A térkép a változás .md-jében él, a Gondolatok szakaszban, beágyazott listaként, a csomópont típusa egy nyelvfüggetlen jel a sor elején.

Az interjú erre rajzol: Claude felteszi a kérdést a térképre, alá a lehetőségeket, a javasoltat jelölve; a lap jobb oldali paneljén a nyitott kérdések állnak opcióikkal. A válasz után a kérdés maga válik döntéssé, a komoly alternatívák kihagyjuk-ágként maradnak, a töltelék eltűnik. A nyitott kérdések egyetlen helye a térkép, ebből számolódik a szakasz is; a beérett csomópontokból javasolt elem lesz célhellyel, és a csomópont az elemre hivatkozik.

A térkép egyelőre csak olvasható: Claude írja, az ember a chatben alakítja, a lapon élőben látja. A válasz a lapról (C-7) ugyanezt a panelt bővíti válaszolóvá, és vele jön a szerkesztés a böngészőből.

## Keret

A gondolattérkép a változás lapján, a formátuma, a nyitott kérdések panelje és a groundwork-prd-maker átállása a térképre. Utána az interjú a változás saját térképén megy.

Kész, ha: a C-5 interjúját már a C-5 lapjának térképén követjük; Claude rajzol, a kérdések opcióikkal a jobb oldali panelen állnak, a válasz után a kérdés döntéssé válik, és a felvillanás meg a commit óta jelölés a térképen is működik; a szakasz a térkép nyitott kérdéseiből számolódik; a modul önállóan tesztelhető, és git nélkül sem hibázik.

## Kihagyjuk

A térkép szerkesztése és a válasz a lapról (C-7); a Spec Összképe és részletes térképe, a Plan modul megszüntetése (C-9, C-10).

## Kérdések

## Javasolt elemek

- add `d-map-in-change` → `records/tech#t-rec-workspaces` — A gondolattérkép a változás saját felülete · döntés · hiányzik
  Gyökere a ködös ötlet; ágain gondolatok, kérdések, lehetőségek, döntések. Ember és Claude együtt építi: Claude rajzol, az ember a chatben alakítja. A beérett ágakból (döntés, megkötés, kihagyjuk) javasolt elem lesz célhely-javaslattal; a többi a változásban marad. Forrása a változás .md-jének Gondolatok vázlata. Kicsi marad, mert egy változásé.
- add `x-map-tool` → `records/tech#t-rec-workspaces` — A térkép önálló eszköz, mint a Vázlat · kizárt · hiányzik
  A gondolkodás a változásban történik; külön eszközként csak hivatkozás lenne rá.
- add `d-map-in-md` → `records/tech#t-rec-data` — A térkép a változás .md-jében él, a Gondolatok szakaszban, beágyazott listaként · döntés · hiányzik
  A behúzás adja az ágakat, a sor eleji jel a csomópont típusát. Egy változás egy fájl marad: kézzel írható, a diffje olvasható, és a felvillanás meg a commit óta jelölés ugyanúgy működik rá, mint a lap többi részére.
- add `d-map-types` → `records/tech#t-rec-data` — Csomóponttípusok: gondolat, kérdés, lehetőség, döntés, megkötés, kihagyjuk · döntés · hiányzik
- add `d-map-questions` → `records/tech#t-rec-data` — A változás nyitott kérdései a térkép kérdés-csomópontjai; a Kérdések lista megszűnik · döntés · hiányzik
  Egy forrás: a kérdés ott áll, ahol a gondolatmenetben felmerült, és az interjú szakasza (Grilling / Jóváhagyásra vár, d-changes-stage-interview) a térkép nyitott kérdéseiből számolódik.
- add `d-map-options` → `records/tech#t-rec-data` — A kérdés opciói a gyerekei, lehetőség-csomópontként; Claude javaslata jelölve · döntés · hiányzik
  A térképen is látszik, mi közül választunk; a panel ugyanezeket mutatja, és a válasz a lapról (C-7) ezekből gombokat csinál.
- add `x-map-rec-in-note` → `records/tech#t-rec-data` — Az opciók és a javaslat a kérdés megjegyzésében, szövegként · kizárt · hiányzik
  A térképen nem látszana, mi közül választottunk.
- add `d-map-answer` → `records/tech#t-rec-data` — A megválaszolt kérdés-csomópont maga válik a válasszá (döntés, kihagyjuk, megkötés) · döntés · hiányzik
  A térkép a mostani állapotot mutatja, nem a történetet; hogy mit változtatott egy válasz, a commit óta jelölés mutatja. Ha a kérdés maga is fontos, a válasz megjegyzésébe kerül.
- add `d-map-rejected-options` → `records/tech#t-rec-data` — A nem választott lehetőségekről Claude dönt: a komoly alternatíva kihagyjuk-gyerek lesz, a töltelék eltűnik · döntés · hiányzik
  Így a térkép nem telik meg elvetett opciókkal, a valódi alternatíva viszont látszik, és belőle lesz a javasolt elemek kizárt sora.
- add `d-map-signs` → `records/tech#t-rec-data` — A csomópont típusa nyelvfüggetlen jel a sor elején: ? kérdés · ~ lehetőség · ~! javasolt · = döntés · ! megkötés · x kihagyjuk; jel nélkül gondolat · döntés · hiányzik
  A típus elöl áll, egy oszlopban, és a fájl nyelvétől független. A hivatkozás a sor végén (→ `id`), a megjegyzés alatta behúzva, mint a lap többi részén. A fájlt Claude írja, a lapon ikon és szín mutatja; a jelmagyarázat a modul README-jében.
- add `x-map-words` → `records/tech#t-rec-data` — A típus szóval, a sor végén vagy szögletes zárójelben ([kérdés]) · kizárt · hiányzik
  A szó nyelvfüggő: magyar és angol dokumentumnyelv mellett vegyesen állna, és az olvasónak minden nyelv szavait ismernie kellene.
- add `d-map-root` → `records/tech#t-rec-data` — A térkép gyökere a változás címe; nem külön tárolódik · döntés · hiányzik
  Egy változásnak egy neve van; ötlet nélküli változásnál is működik, és ha a cím élesedik, a gyökér vele élesedik.
- add `d-map-item-link` → `records/tech#t-rec-data` — A Javasolt elemek külön lista marad; a beérett csomópont a javasolt elem id-jére hivatkozik · döntés · hiányzik
  Az elemnek célhely és a Spec nyelvén írt szöveg kell, ezt a térkép nem adja. A lapon a csomóponton látszik: javasolva → célhely.
- add `x-map-lists-apart` → `records/tech#t-rec-data` — A Kérdések és a Javasolt elemek a térképtől független listák, Claude tartja szinkronban · kizárt · hiányzik
  Két helyen élő kérdések biztosan szétcsúsznak.
- add `x-map-generates-items` → `records/tech#t-rec-data` — A Javasolt elemek a térképből generálódnak · kizárt · hiányzik
  A célhely és a Spec-szöveg nem a gondolkodás része; a térkép kicsi és laza maradjon.
- add `x-map-own-file` → `records/tech#t-rec-data` — A térkép külön fájlban a változás mellett (map.json vagy a mai mindmap.json formátuma) · kizárt · hiányzik
  Két fájl egy változásért; a JSON diffje olvashatatlan, kézzel nem írható.
- add `d-map-readonly` → `changes/prd#t-changes-scope` — A gondolattérkép a lapon egyelőre csak olvasható: Claude rajzol, az ember a chatben alakítja · döntés · hiányzik
  Ugyanaz az elv, mint a lapnál (d-changes-page-readonly): egy író, nincs mit összefésülni, és a használat mutatja meg, mit érdemes szerkeszthetővé tenni.
- add `d-map-workspace` → `changes/prd#t-changes-scope` — A lap tetején munkafelület: balra a térkép, jobbra a nyitott kérdések; Jóváhagyásra vár szakaszban összecsukva · döntés · hiányzik
  A kérdések a térképből számolódnak, felül a legutóbbi, mindegyiken Claude javaslata; kattintásra a térkép a csomóponthoz ugrik. Alatta a leírás és a javasolt elemek. A válasz a lapról (C-7) ugyanezt a panelt bővíti válaszolóvá (a javaslat gomb lesz, mellé saját válasz), így a lap nem rendeződik át.
- add `x-map-popup-answer` → `changes/prd#t-changes-scope` — A válaszoló a kérdés-csomópontra kattintva felugró ablakban · kizárt · hiányzik
  A kérdés legyen szem előtt ott, ahol válaszolnál; a felugró ablak eltakarja a térképet.
- add `p-map-edit` → `changes/prd#t-changes-scope` — A térkép szerkesztése a böngészőben (áthúzás, átnevezés, saját csomópont) · félretett · hiányzik
  A válasz a lapról (C-7) szelettel, közös íróúttal: egy út szolgálja ki a válaszokat és a térkép szerkesztését. Ha az első interjúk után hiányzik, az a jel.
- add `d-map-component` → `core/tech#t-core-shell` — A gondolattérkép közös Lit-komponens a core-ban (`<gw-mind-map>`), a csomagba tett Mind Elixirrel · döntés · hiányzik
  Most csak olvasható módban, a Plan térképtémájával. A mai Plan-térkép összenőtt a Plan állapotával, ezért az marad, ahogy van; a C-10 szünteti meg (d-lit-scope-c3, d-plan-dissolves).
- add `d-map-reader` → `changes/tech#t-changes-arch` — A változásolvasó a Gondolatok szakaszt is olvassa; a régi Kérdések listát átmenetileg még elfogadja · döntés · hiányzik
  Így a korábbi változásfájlok nem törnek el; a szakasz a térkép nyitott kérdéseiből számolódik.
- add `d-map-skill` → `changes/tech#t-changes-int` — A groundwork-prd-maker az interjúban a térképre írja a kérdéseket, lehetőségeket és döntéseket; a javasolt elemeket a listába · döntés · hiányzik
  Minden írás után `groundwork record check`, ami a Gondolatok szakasz formáját is ellenőrzi.
- add `n-plan-purpose` → `records/tech#t-rec-workspaces` — A Plan eredeti célja: ködös ötletből Claude-dal közösen gondolatokat építeni · jegyzet · hiányzik

## Jegyek

A jegyek a `**Change:** C-4` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: q-map-scale, d-term-spec, d-big-picture, d-big-picture-sync, x-big-picture-full, x-big-picture-free, d-spec-home, x-big-picture-overview, d-plan-dissolves, x-plan-stays, x-map-one-big, d-lit, x-svelte-react; 13 proposed items)
- 2026-10-20 · claude · re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
- 2026-10-20 · claude · grilled: térkép a .md-ben jelekkel, csak olvasható, kérdések a térképen opciókkal, munkafelület panellel, gyökér a cím, közös <gw-mind-map>, kész a C-5 interjújával
- 2026-10-20 · human · approved for implementation (the proposed items wait for the merge, C-5)
