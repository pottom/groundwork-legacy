---
id: C-4
title: Spec munkaterület
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

300 elem fölött az egy nagy térkép nem gondolkodási felület és nem mondja meg, mi ez és miből áll; a Plan modul közben a többiek végpontjaiként él tovább.

## Megoldás

Spec munkaterület: Összkép, részek × dokumentumfajták mátrixa, dokumentum-vázlat, a részletes térkép lencseként; Lit-komponensek a munkaterületek közös elemeihez; a Plan modul megszűnik.

## Keret

A Spec nyitólapja, az Összkép szabályai, a térkép helye, a közös komponensek technológiája.

## Kihagyjuk

Jegyek, futószalag és mérföldkövek (C-5).

## Kérdések

## Javasolt elemek

- add `q-map-scale` → `system#t-pipe` — A Spec nyitólapja az Összkép, mellette a részek × dokumentumfajták mátrixa; a részletes térkép lencse · döntés · hiányzik
  Az Összkép (d-big-picture) mondja meg, mi ez és miből áll; a mátrixból látszik, hány dokumentum van, melyik részhez melyik tartozik, mi hiányzik és melyik részt melyik változás alakítja. Kutatás: a valós mind mapek mediánja 31 csomópont; overview first (Shneiderman), fisheye (Furnas). Keresés mindenhol.
- add `d-term-spec` → `system#t-records` — Egy szó: Spec, a fogalomra és a munkaterületre is · döntés · hiányzik
  A produktum jóváhagyott, most érvényes leírása (részek, dokumentumok, elemek); a Product szót nem használjuk rá.
- add `d-big-picture` → `records/tech#t-rec-workspaces` — Összkép: legfeljebb 30–40 csomópont, négy szinten · döntés · hiányzik
  Gyökér (név, cél egy mondatban) → részek (egy mondat, állapotjel) → részenként legfeljebb 5–7 fő képesség (az elem fő jelölése) → a változások jelvényként azon, amit alakítanak (C-7 · Interjú). Kattintásra a részletes Spec-térkép nyílik. Kipróbálásra elfogadva: meglátjuk, mennyire működik.
- add `d-big-picture-sync` → `records/tech#t-rec-workspaces` — A rész leírása és a fő jelölés Spec-tartalom: változáson át módosul, Claude javasolja jóváhagyáskor · döntés · hiányzik
  Így az összkép nem kézzel karbantartott rajz, és nem avul el csendben.
- add `x-big-picture-full` → `records/tech#t-rec-workspaces` — A nagy kép a teljes, részletes Spec-térkép · kizárt · hiányzik
  Túl részletes, nem érthető; a részletes térkép marad, de a részre kattintva nyílik.
- add `x-big-picture-free` → `records/tech#t-rec-workspaces` — Claude szabadon írja meg az összképet · kizárt · hiányzik
  Nem determinisztikus, csendben elavul.
- add `d-spec-home` → `records/tech#t-rec-workspaces` — A Spec nyitólapja az Összkép; a mátrix a második fül · döntés · hiányzik
  Aki a Specet megnyitja, előbb azt lássa, mi ez és miből áll; a mátrix a dokumentumokról szól (mi van, mi hiányzik, milyen állapotban). A q-map-scale pontosítása.
- add `x-big-picture-overview` → `records/tech#t-rec-workspaces` — Az Összkép az Áttekintésen · kizárt · hiányzik
  Az Áttekintés a mi történik most kérdésre felel, az Összkép a mi ez kérdésre: az a Spec dolga.
- add `d-plan-dissolves` → `records/tech#t-rec-workspaces` — A Plan modul megszűnik, a kódja három helyre kerül · döntés · hiányzik
  A térképszerkesztő (Mind Elixir, op-alapú szerkesztés, emberi szerkesztések összefésülése, az ember bekezdéseinek védelme) közös komponens: a Változások szerkesztve (gondolattérkép), a Spec olvasva (Összkép, részletes térkép) használja. A documents.mjs és a doc-strings.mjs a Rekordtárba, a kanonikus Markdown író-olvasóként. A groundwork-prd-maker skill a változás térképét és javasolt elemeit tölti a groundwork record-on át.
- add `x-plan-stays` → `records/tech#t-rec-workspaces` — A Plan modulként megmarad, a többiek a végpontjain kérik a térképet · kizárt · hiányzik
  A hiánya két munkaterületet törne el; a térkép nézet, nem hely.
- add `x-map-one-big` → `records/tech#t-rec-workspaces` — Marad a mai Plan: egy nagy térkép a Spec fölött mint szerkesztőfelület · kizárt · hiányzik
  300 elem fölött nem gondolkodási felület (q-map-scale).
- add `d-lit` → `core/tech#t-core-stack` — Lit (LitElement) a munkaterületek közös komponenseihez · döntés · hiányzik
  Az I-5-tel: térképszerkesztő, rekordkártya, hivatkozás-chip, jóváhagyó lista mint web-komponens (pl. <gw-record-chip>). Fordítás nélkül fut, vendorolva a core/vendor/ alatt, kb. 15 KB; a mai lit-html sablonok változatlanul futnak benne, az áttérés fokozatos.
- add `x-svelte-react` → `core/tech#t-core-stack` — Svelte vagy React a munkaterületekhez (újragondolva az I-5-nél) · kizárt · hiányzik
  Build-lépést és eszközláncot kívánna minden fejlesztőtől és agenttől; a párhuzamos worktree-kben dolgozó agenteknek az azonnali kör többet ér.

## Jegyek

A jegyek a `**Change:** C-4` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: q-map-scale, d-term-spec, d-big-picture, d-big-picture-sync, x-big-picture-full, x-big-picture-free, d-spec-home, x-big-picture-overview, d-plan-dissolves, x-plan-stays, x-map-one-big, d-lit, x-svelte-react; 13 proposed items)
