---
id: C-12
title: "Áttekintés: futószalag"
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

Nincs egy hely, ahol látszik, mi készül és hol tart, és amiből bemutatni lehet.

## Megoldás

Az Áttekintés futószalag (Ötletek → Grilling → Jóváhagyásra vár → Megvalósítás → Kész) a mérföldkövekkel, WIP-jelzéssel és a rekordok láncával; új fejléc a munkaterületekkel.

## Keret

Az Áttekintés, a fejléc és a kapcsolati gráf. Utána a Present (M-8) erre épülhet.

## Kihagyjuk

A felzárkózás (C-13).

## Kérdések

## Javasolt elemek

- add `q-workspaces` → `system#t-records` — Munkaterületek: Overview | Ideas → Changes → Spec → Tickets | Sketch · Present · döntés · hiányzik
  Overview: mérföldkövek, futó változások, ami figyelmet kér (ebből a bemutató). Ideas: ötletek, döntés. Changes: grilling, javasolt elemek célhellyel, jóváhagyás. Spec: mátrix, dokumentum-vázlat, térkép-lencse, keresés. Tickets: jegyek, ágak, a rajtuk dolgozó agentek. Magyarul: Áttekintés | Ötletek → Változások → Spec → Jegyek | Vázlat · Prezentáció.
- add `d-conveyor` → `system#t-records` — Az Overview egy futószalag: Ötletek → Grilling → Jóváhagyásra vár → Megvalósítás → Kész · döntés · hiányzik
  A szalagon a változás halad, az ötlet a nyersanyag. Egy állomásra kattintva a munkapadja nyílik (Ideas, Changes, Tickets); a Spec nem állomás, hanem a tervrajz-tár, amelybe a jóváhagyó állomás beolvaszt. Számolt gyári mérőszámok: átfutási idő, torlódás (WIP-limit), túl régóta váró darab.
- add `d-wip-signal` → `system#t-records` — WIP-limit állomásonként, csak jelzés: alapból nincs, túllépéskor torlódást jelez · döntés · hiányzik
  Új változás ettől még indítható; az Overview-n figyelmet kér.
- add `d-lineage-graph` → `system#t-records` — Kapcsolati gráf: minden rekord lapján a lánca (miből lett, mi lett belőle), és mérföldkövenként egy gráf · döntés · hiányzik
  Pl. I-2 → C-12 → két Spec-sor → #61 kész, #62 agent dolgozik; minden pontja kattintható. Egyetlen nagy, közös gráf nincs: az is olvashatatlan lenne.
- add `d-new-modules` → `records/tech#t-rec-workspaces` — Új modul: Áttekintés és Változások; marad: Ötletek, Vázlat, Prezentáció · döntés · hiányzik
  Áttekintés: futószalag, mérföldkövek, figyelmet kér (a Build áttekintőjéből). Változások: a változás lapja, gondolattérkép, javasolt elemek célhellyel, jóváhagyó lista. Spec: a Plan helyén. Jegyek: Build + Agents.
- add `d-build-views-move` → `records/tech#t-rec-workspaces` — A Build áttekintője az Áttekintésbe, a Dokumentumok nézete (specek, ADR-ek, fogalomtár) a Specbe költözik · döntés · hiányzik
  Az ADR-ek és a fogalomtár az egészhez tartozó dokumentumként látszanak a Specben.

## Jegyek

A jegyek a `**Change:** C-12` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
