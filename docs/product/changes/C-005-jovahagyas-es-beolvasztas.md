---
id: C-5
title: Jóváhagyás és beolvasztás
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

A javasolt elemek a változásban maradnak: nincs lépés, amely helyükre tenné őket a Specben, és a változások (C-2-től) jóváhagyásra várnak.

## Megoldás

Jóváhagyó lista a változás lapján: elemenként Elfogad · Máshová… (kereshető lista) · Új rész; egy jóváhagyással minden elem egyszerre olvad be a Specbe, eredetként a változás azonosítójával.

## Keret

A jóváhagyó lista és a beolvasztás. Utána a C-2-t és az addig kész szeleteket a felületen hagyjuk jóvá.

## Kihagyjuk

A Spec munkaterülete (C-9, C-10).

## Kérdések

## Javasolt elemek

- add `d-place-on-map` → `system#t-pipe` — A hely az utolsó lépés, elemenként: a rendszer célfejezetet javasol, az ember jóváhagyja · döntés · hiányzik
  Jóváhagyó lista: Elfogad · Máshová… (kereshető lista) · Új rész; Claude ugyanezzel dolgozik. Keresgélni a térképen nem kell.
- add `x-drag-place` → `system#t-pipe` — Az ember a térképen húzza a helyére az ötletet · kizárt · hiányzik
  Nagy térképen keresgélés; már 285 csomópontnál is használhatatlan.
- add `d-merge-on-approval` → `system#t-pipe` — A változás elemei egyszer, az interjú végén, egy jóváhagyó lépésben olvadnak be a Specbe · döntés · hiányzik
  A jóváhagyó listán dől el minden elem helye; beolvasztva hiányzik állapottal kerülnek a specbe, utána jönnek a jegyek. A spec a tervezett produktum, a megvalósítási állapot mutatja, mi épült meg (az OpenSpec-kel ellentétben nem a megvalósítás után).
- add `d-idea-dissolves` → `system#t-pipe` — A beolvasztott elem eredete egy mező: change: C-7; az ötleteket a változás tudja · döntés · hiányzik
  Későbbi módosításnál az eredet frissül, a régi változás a történetben marad.

## Jegyek

A jegyek a `**Change:** C-5` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: q-workspaces, d-conveyor, d-wip-signal, d-lineage-graph, d-ticket-lines, d-rec-ticket, d-tickets-merge, d-build-views-move, x-agents-own, d-new-modules, d-rec-ticket-source, d-ticket-write, d-ticket-old-lines, d-ticket-scratch-slug, d-ticket-checks, d-rec-catch-up, x-rec-catch-up-auto, x-rec-check-only, d-rec-history-outside, d-rec-test-mixed; 20 proposed items)
- 2026-10-20 · claude · re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
