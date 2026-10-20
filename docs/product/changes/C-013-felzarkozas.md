---
id: C-13
title: Felzárkózás
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

Ami eszközön kívül történik (kézi szerkesztés, más csapattag), nem jön vissza a rekordokba.

## Megoldás

Felzárkózás-változás: a gitből és a kódból Claude javasolt változást ír arról, ami kívül történt, és az ember hagyja jóvá.

## Keret

A felzárkózás és a vegyes csapat próbája.

## Kihagyjuk

Semmi.

## Kérdések

## Javasolt elemek

- add `d-rec-catch-up` → `records/tech#t-rec-mixed` — Felzárkózás-változás: ami eszközön kívül történt, változásként jön be, ember hagyja jóvá · döntés · hiányzik
  A tár a docs/product/.groundwork-seen fájlban követi a legutóbb látott commitot. Ha azóta eszköz nélkül változott a docs/product/ vagy a kód, Claude a gitből és a kódból egy javasolt változást ír (C-n Felzárkózás, dátum–dátum): a kívülről jött elemek kódból jelölést kapnak, a törölt elemek felváltás-javaslatot, az eltérő állapotok javítást, az árva jegyek ide kötődnek. Ugyanaz a minta, mint a C-1 Kiinduló állapot.
- add `x-rec-catch-up-auto` → `records/tech#t-rec-mixed` — A kívülről jött módosítások kérdés nélküli besorolása · kizárt · hiányzik
  Az emberé a döntés (d-idea-one-decision).
- add `x-rec-check-only` → `records/tech#t-rec-mixed` — Csak a record check jelez, a rendezés kézi · kizárt · hiányzik
  A hibák listája megvan, de a Specbe kerülésük útja nincs.
- add `d-rec-history-outside` → `records/tech#t-rec-history` — Eszköz nélküli állapotváltás: a felzárkózás javasol hozzá történetsort · döntés · hiányzik
  Kívülről, commit abc123.
- add `d-rec-test-mixed` → `records/tech#t-rec-test` — Vegyes csapat forgatókönyv: eszköz nélküli szerkesztés után a felzárkózás pontosan azt javasolja, ami történt · döntés · hiányzik

## Jegyek

A jegyek a `**Change:** C-13` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created: re-sliced: C-3…C-5 cut into C-3…C-13, each a slice the next one already uses (human approved)
