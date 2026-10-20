---
id: C-8
title: Jegysorok magától
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

A jegyek nem tudják, melyik változáshoz és Spec-elemhez tartoznak; a sorokat ma kézzel kell pótolni a to-tickets után.

## Megoldás

A jegyen kötelező **Change:**, és **Spec:**, ha Spec-elemet valósít meg; a to-tickets változatlan, utána Claude írja be a sorokat; régi sorok elfogadva; Checks a hiányzó és ismeretlen sorokra; helyi jegyek a változás mappájában.

## Keret

A jegysorok, a jegy rekord és az ellenőrzésük. Utána a /to-tickets után semmit nem kell kézzel pótolni.

## Kihagyjuk

A Jegyek munkaterület (C-11).

## Kérdések

## Javasolt elemek

- add `d-ticket-lines` → `system#t-records` — A jegyen kötelező **Change:** C-n, és **Spec:** <elemek>, ha spec-elemet valósít meg · döntés · hiányzik
  A régi **PRD:** sort a rendszer a Spec sor régi neveként elfogadja; az **Idea:** sor helyét a Change veszi át (d-ticket-old-lines).
- add `d-ticket-write` → `records/tech#t-rec-int` — Jegysorok írása: a to-tickets változatlan, utána Claude írja be a **Change:** és **Spec:** sort · döntés · hiányzik
  A **Spec:** a mai **PRD:** szabályával olvasódik (-, nincs, none = nem valósít meg Spec-elemet).
- add `d-ticket-old-lines` → `records/tech#t-rec-int` — Régi sorok: **PRD:** = **Spec:**, **Idea:** I-n = az ötlet változása; a tár soha nem írja át őket · döntés · hiányzik
  Ha az ötletnek több változása van, a Checks választást kér. Sor nélküli, C-1 előtti jegy C-1 (d-migrate-old-tickets).
- add `d-ticket-checks` → `records/tech#t-rec-int` — Checks: no-change, unknown-change, unknown-spec hiba; spec-not-in-change figyelmeztetés; a no-prd megszűnik · döntés · hiányzik
  A spec-not-in-change csak figyelmeztet: egy jegy jogosan érinthet régebbi elemet, amit tiszteletben kell tartania.
- add `d-ticket-scratch-slug` → `records/tech#t-rec-int` — Helyi jegyek: .scratch/<a változás fájlneve>/issues/ · döntés · hiányzik
  Pl. .scratch/C-007-sketch-bongeszo/issues/; az igazság ettől még a **Change:** sor.
- add `d-rec-ticket` → `system#g-record-types` — Jegy (#n): nyitott → folyamatban → kész; változásra és elemekre hivatkozik · döntés · hiányzik
- add `d-rec-ticket-source` → `records/tech#t-rec-int` — A jegy rekord a tárban, de a forrása a jegykezelő marad · döntés · hiányzik
  A jegyolvasót (.scratch, GitHub) a Jegyek modul adja be a tárnak; a tár csak olvassa.

## Jegyek

A jegyek a `**Change:** C-8` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
