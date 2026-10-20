---
id: C-10
title: Spec-mátrix, a Plan megszűnik
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

A dokumentumokról nem látszik, mi van, mi hiányzik és melyik részhez tartozik; a Plan modul közben a többiek végpontjaiként él tovább.

## Megoldás

A Spec második füle a részek × dokumentumfajták mátrixa, dokumentum-vázlattal és kereséssel; a Plan modul megszűnik, a térképszerkesztő közös komponens lesz, a dokumentum-kód a Rekordtárba költözik.

## Keret

A mátrix és a Plan szétosztása. Utána a Spec munkaterület teljes.

## Kihagyjuk

Jegyek és Áttekintés (C-11, C-12).

## Kérdések

## Javasolt elemek

- add `q-map-scale` → `system#t-pipe` — A Spec nyitólapja az Összkép, mellette a részek × dokumentumfajták mátrixa; a részletes térkép lencse · döntés · hiányzik
  Az Összkép (d-big-picture) mondja meg, mi ez és miből áll; a mátrixból látszik, hány dokumentum van, melyik részhez melyik tartozik, mi hiányzik és melyik részt melyik változás alakítja. Kutatás: a valós mind mapek mediánja 31 csomópont; overview first (Shneiderman), fisheye (Furnas). Keresés mindenhol.
- add `d-plan-dissolves` → `records/tech#t-rec-workspaces` — A Plan modul megszűnik, a kódja három helyre kerül · döntés · hiányzik
  A térképszerkesztő (Mind Elixir, op-alapú szerkesztés, emberi szerkesztések összefésülése, az ember bekezdéseinek védelme) közös komponens: a Változások szerkesztve (gondolattérkép), a Spec olvasva (Összkép, részletes térkép) használja. A documents.mjs és a doc-strings.mjs a Rekordtárba, a kanonikus Markdown író-olvasóként. A groundwork-prd-maker skill a változás térképét és javasolt elemeit tölti a groundwork record-on át.
- add `x-plan-stays` → `records/tech#t-rec-workspaces` — A Plan modulként megmarad, a többiek a végpontjain kérik a térképet · kizárt · hiányzik
  A hiánya két munkaterületet törne el; a térkép nézet, nem hely.
- add `x-map-one-big` → `records/tech#t-rec-workspaces` — Marad a mai Plan: egy nagy térkép a Spec fölött mint szerkesztőfelület · kizárt · hiányzik
  300 elem fölött nem gondolkodási felület (q-map-scale).

## Jegyek

A jegyek a `**Change:** C-10` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
