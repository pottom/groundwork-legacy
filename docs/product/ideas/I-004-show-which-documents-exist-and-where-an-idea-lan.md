---
id: I-4
title: Show which documents exist and where an idea lands
author: claude
source: conversation 2026-10-19
kind: product
impact: high
effort: medium
rationale: A first-time user could not see how many PRDs there are, which module has which document, or that To develop silently puts the node into the first PRD
links: I-3, I-5
status: rejected
reason: felváltja az I-5
created: 2026-10-19
---

Three gaps found while moving I-1..I-3: (1) Plan has no overview of the documents: which component has a PRD, a TECH, neither; the selector lists them but mixed with progress entries and nothing says 'Mag has no PRD'. A documents panel (component x PRD/TECH, with status) would show it. (2) Moving an idea to To develop says nothing about where it went; it should say it (toast and the card: 'Plan modul › Termék › Ötletek') with a link that opens the map there, expanded, even when the map is filtered to another component. (3) The map's filter hides other components without saying so, so dragging a node to another module's PRD looks impossible; say that the view is filtered and how to see the whole map.

Superseded by I-5 (concept interview 2026-10-20): all three parts are in the new model. (1) The Spec workspace opens on a parts x document-kinds matrix. (2) Where an idea went is shown by its change page and the lineage graph (I-n > C-n > spec items > tickets). (3) A filtered view always says what it hides.

## Történet
