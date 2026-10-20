---
id: I-5
title: "Redesign Groundwork: record model and conveyor"
author: claude
source: concept interview 2026-10-20
kind: product
impact: high
effort: high
rationale: "Ideas, plan and build had no coherent model: an idea had to find a place in the spec before it was worked out; a record model (idea, change, spec, ticket, milestone) with a conveyor overview fixes it for 1 or 20 documents"
links: I-3, I-4, t-pipe, t-records, r-9
status: accepted
created: 2026-10-19
---

Decided in the concept interview (map: Overview > Ötlettől a produktumig, Rekordmodell; research: docs/product/research/idea-to-product-flow.md). Groundwork is built on record types: Idea (I-n), Change (C-n), Part, Document, Spec item, Ticket, Milestone (M-n), plus tool records (sketch, agent run, deck); each with an id, a lifecycle, typed links and history. The spec (what is true now) changes only through changes (what is being shaped); an accepted idea creates a change; the interview (grilling) fills the change with proposed items, each with a suggested target section; on approval they merge into the spec, tagged change: C-n. Workspaces: Overview (a conveyor: Ideas > Grilling > Awaiting approval > Implementation > Done) | Ideas > Changes > Spec > Tickets | Sketch, Present. The Spec opens on a parts x document-kinds matrix; the map is a lens, not the home. Next: a technical interview (storage of records, what becomes of today's modules, migrating the current map as C-1 Initial state).

## Történet

- 2026-10-20 · human · status: considering → accepted
