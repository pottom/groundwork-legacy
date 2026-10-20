---
id: C-5
title: Jegyek és Áttekintés
ideas: I-5
milestone: M-9
status: awaiting-approval
---

## Probléma

A hol tart? kérdésre ma három modul (Build, Agents, a térkép) ad részválaszt; a jegyek nem tudják, melyik változáshoz tartoznak, és ami eszközön kívül történik, az nem jön vissza a rekordokba.

## Megoldás

Build + Agents = Jegyek munkaterület, új jegysorok (**Change:**, **Spec:**) és Checks; az Áttekintés futószalag a mérföldkövekkel; új fejléc a munkaterületekkel; felzárkózás-változás az eszközön kívüli munkára.

## Keret

A munkaterületek fejléce, a futószalag, a jegyek és az ellenőrzéseik, a vegyes csapat felzárkózása. Utána folytatódik a Present (M-8), a rekordtárra írva.

## Kihagyjuk

A Present maga (M-8, #40–46).

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
- add `d-ticket-lines` → `system#t-records` — A jegyen kötelező **Change:** C-n, és **Spec:** <elemek>, ha spec-elemet valósít meg · döntés · hiányzik
  A régi **PRD:** sort a rendszer a Spec sor régi neveként elfogadja; az **Idea:** sor helyét a Change veszi át (d-ticket-old-lines).
- add `d-rec-ticket` → `system#g-record-types` — Jegy (#n): nyitott → folyamatban → kész; változásra és elemekre hivatkozik · döntés · hiányzik
- add `d-tickets-merge` → `records/tech#t-rec-workspaces` — Build + Agents = Jegyek munkaterület, két kódterülettel · döntés · hiányzik
  A Buildből: jegyolvasó (.scratch, GitHub), függések, ellenőrzések, ágak gráfja, aktivitás. Az Agentsből: hook, eseménynapló, idővonal, záró jelentés, worktree-k, figyelmet kér. A jegyen a változása, a Spec-elemei és a dolgozó agent; külön fül az Agenteknek és a Worktree-knek. Az Agents fejlécfüle megszűnik, a figyelmet kérő szám a Jegyek fülére kerül.
- add `d-build-views-move` → `records/tech#t-rec-workspaces` — A Build áttekintője az Áttekintésbe, a Dokumentumok nézete (specek, ADR-ek, fogalomtár) a Specbe költözik · döntés · hiányzik
  Az ADR-ek és a fogalomtár az egészhez tartozó dokumentumként látszanak a Specben.
- add `x-agents-own` → `records/tech#t-rec-workspaces` — Az Agents külön modul és fül marad · kizárt · hiányzik
  Az agent mindig jegyen és ágon dolgozik; a hol tart ez a jegy? egy helyen válaszolható.
- add `d-new-modules` → `records/tech#t-rec-workspaces` — Új modul: Áttekintés és Változások; marad: Ötletek, Vázlat, Prezentáció · döntés · hiányzik
  Áttekintés: futószalag, mérföldkövek, figyelmet kér (a Build áttekintőjéből). Változások: a változás lapja, gondolattérkép, javasolt elemek célhellyel, jóváhagyó lista. Spec: a Plan helyén. Jegyek: Build + Agents.
- add `d-rec-ticket-source` → `records/tech#t-rec-int` — A jegy rekord a tárban, de a forrása a jegykezelő marad · döntés · hiányzik
  A jegyolvasót (.scratch, GitHub) a Jegyek modul adja be a tárnak; a tár csak olvassa.
- add `d-ticket-write` → `records/tech#t-rec-int` — Jegysorok írása: a to-tickets változatlan, utána Claude írja be a **Change:** és **Spec:** sort · döntés · hiányzik
  A **Spec:** a mai **PRD:** szabályával olvasódik (-, nincs, none = nem valósít meg Spec-elemet).
- add `d-ticket-old-lines` → `records/tech#t-rec-int` — Régi sorok: **PRD:** = **Spec:**, **Idea:** I-n = az ötlet változása; a tár soha nem írja át őket · döntés · hiányzik
  Ha az ötletnek több változása van, a Checks választást kér. Sor nélküli, C-1 előtti jegy C-1 (d-migrate-old-tickets).
- add `d-ticket-scratch-slug` → `records/tech#t-rec-int` — Helyi jegyek: .scratch/<a változás fájlneve>/issues/ · döntés · hiányzik
  Pl. .scratch/C-007-sketch-bongeszo/issues/; az igazság ettől még a **Change:** sor.
- add `d-ticket-checks` → `records/tech#t-rec-int` — Checks: no-change, unknown-change, unknown-spec hiba; spec-not-in-change figyelmeztetés; a no-prd megszűnik · döntés · hiányzik
  A spec-not-in-change csak figyelmeztet: egy jegy jogosan érinthet régebbi elemet, amit tiszteletben kell tartania.
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

A jegyek a `**Change:** C-5` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: q-workspaces, d-conveyor, d-wip-signal, d-lineage-graph, d-ticket-lines, d-rec-ticket, d-tickets-merge, d-build-views-move, x-agents-own, d-new-modules, d-rec-ticket-source, d-ticket-write, d-ticket-old-lines, d-ticket-scratch-slug, d-ticket-checks, d-rec-catch-up, x-rec-catch-up-auto, x-rec-check-only, d-rec-history-outside, d-rec-test-mixed; 20 proposed items)
