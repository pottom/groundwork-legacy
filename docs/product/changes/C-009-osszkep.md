---
id: C-9
title: Összkép
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

A Specből ma nem derül ki első ránézésre, mi ez és miből áll: egy nagy térkép van, 300 elem fölött.

## Megoldás

A Spec nyitólapja az Összkép: legfeljebb 30–40 csomópont négy szinten (gyökér, részek, fő képességek, a rajtuk dolgozó változások jelvényként); kattintásra nyílik a részletes térkép.

## Keret

Az Összkép és a szabályai. Utána a Spec megnyitásakor azonnal látszik, mi ez és miből áll.

## Kihagyjuk

A mátrix és a Plan megszűnése (C-10).

## Kérdések

## Javasolt elemek

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
- add `x-big-picture-overview` → `records/tech#t-rec-workspaces` — Az Összkép az Áttekintésen · kizárt · hiányzik
  Az Áttekintés a mi történik most kérdésre felel, az Összkép a mi ez kérdésre: az a Spec dolga.
- add `d-spec-home` → `records/tech#t-rec-workspaces` — A Spec nyitólapja az Összkép; a mátrix a második fül · döntés · hiányzik
  Aki a Specet megnyitja, előbb azt lássa, mi ez és miből áll; a mátrix a dokumentumokról szól (mi van, mi hiányzik, milyen állapotban). A q-map-scale pontosítása.

## Jegyek

A jegyek a `**Change:** C-9` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
