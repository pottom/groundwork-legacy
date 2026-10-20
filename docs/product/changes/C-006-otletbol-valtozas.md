---
id: C-6
title: Ötletből változás
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

Az ötlet elfogadása ma csak állapotváltás: nem indul belőle semmi, és az ötlet kártyája nem tudja, mi lett belőle.

## Megoldás

Ideas munkapad (New · Considering · Accepted · Closed); elfogadáskor az ember utat választ (Grilling vagy Egyenesen jegy), és azonnal változás lesz belőle; szundi dátumig, duplikátum; az elfogadott kártyán számolt összefoglaló a változásairól; a szűrt nézetek kiírják, mit rejtenek.

## Keret

Az ötlet döntései és a változás indítása az Ideas fülről. Utána a hurok a felületen indul.

## Kihagyjuk

Válasz a lapról (C-7).

## Kérdések

## Javasolt elemek

- add `d-idea-one-decision` → `system#t-pipe` — Az ötletnél az ember csak dönt: elfogadja, elveti, szundiztatja vagy duplikátumnak jelöli · döntés · hiányzik
  Azt nem kell eldönteni, hová kerül a Specben.
- add `d-route-choice` → `system#t-pipe` — Elfogadáskor az ember választ utat: Grilling vagy Egyenesen jegy; a kind csak az alapértéket adja · döntés · hiányzik
  A tervbe kerülő ötlethez mindig grilling kell; az egyenesen jegy út minimális változást hoz létre egy jeggyel (d-all-work-is-change).
- add `d-board-columns` → `system#t-pipe` — Ideas munkapad: New · Considering · Accepted · Closed (összecsukva, szűrhető) · döntés · hiányzik
  Accepted kártyán: → C-12 · Grilling. Döntések csak az embernél: Accept (Grilling / Egyenesen jegy), Reject indoklással, Snooze dátumig (utána vissza New-ba), Duplicate of I-n. 90 napnál régebben Considering-ben álló ötlet régi jelzést kap és figyelmet kér, de magától nem mozdul.
- add `d-idea-summary` → `system#t-pipe` — Az elfogadott ötlet kártyáján kiszámolt összefoglaló: változásai és hol tartanak · döntés · hiányzik
  Pl. → C-12 · Megvalósítás, 4 elem a Specben · 2/5 jegy kész, linkekkel; nem kell vezetni.
- add `d-focus-banner` → `system#t-pipe` — Minden szűrt nézet kiírja, mit rejt, és egy kattintással visszaáll az egészre · döntés · hiányzik

## Jegyek

A jegyek a `**Change:** C-6` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
