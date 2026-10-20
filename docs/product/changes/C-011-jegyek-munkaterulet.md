---
id: C-11
title: Jegyek munkaterület
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

A hol tart ez a jegy? kérdésre ma két modul (Build, Agents) ad részválaszt.

## Megoldás

Build + Agents = Jegyek munkaterület: a jegyen a változása, a Spec-elemei és a rajta dolgozó agent; külön fül az Agenteknek és a Worktree-knek.

## Keret

A két modul összevonása. Utána egy jegy minden állapota egy helyen látszik.

## Kihagyjuk

Az Áttekintés (C-12).

## Kérdések

## Javasolt elemek

- add `d-tickets-merge` → `records/tech#t-rec-workspaces` — Build + Agents = Jegyek munkaterület, két kódterülettel · döntés · hiányzik
  A Buildből: jegyolvasó (.scratch, GitHub), függések, ellenőrzések, ágak gráfja, aktivitás. Az Agentsből: hook, eseménynapló, idővonal, záró jelentés, worktree-k, figyelmet kér. A jegyen a változása, a Spec-elemei és a dolgozó agent; külön fül az Agenteknek és a Worktree-knek. Az Agents fejlécfüle megszűnik, a figyelmet kérő szám a Jegyek fülére kerül.
- add `x-agents-own` → `records/tech#t-rec-workspaces` — Az Agents külön modul és fül marad · kizárt · hiányzik
  Az agent mindig jegyen és ágon dolgozik; a hol tart ez a jegy? egy helyen válaszolható.

## Jegyek

A jegyek a `**Change:** C-11` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
