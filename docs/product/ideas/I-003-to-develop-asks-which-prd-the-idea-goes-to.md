---
id: I-3
title: To develop has a drop target per PRD
author: claude
source: conversation 2026-10-19
kind: product
impact: medium
effort: medium
rationale: "With several PRDs (a PRD per module) the first PRD is an arbitrary place: I-1 and I-2 landed in the Plan PRD instead of the Sketch PRD"
links: I-1, I-2, I-5, 17338b463049
status: rejected
reason: felváltja az I-5
created: 2026-10-19
---

The To develop column is split into one drop target per PRD on the map (e.g. "Plan modul › Termék", "Sketch modul › Termék"), so the board itself shows how many PRDs there are and which component has one, and where an idea goes is chosen by where it is dropped. A component without a PRD (the core) has no target. With a single PRD the column looks as today. The card then shows its PRD. Plan's POST /api/plan/todo takes the chosen PRD and puts the node in that PRD's Ideas section; no "first PRD" fallback when there are several.

Decided by the user (2026-10-19): drop targets per PRD, instead of the earlier variant (a dialog asking which PRD on the move, the card not moving until one is chosen). Project independent: the targets come from the map alone, never from how this repository is laid out. One target per document of kind PRD, named by its path on the map (component › document), plus always one more, "Something new" (no PRD yet): its node goes to the map's root as a todo, and grilling decides where it belongs (an existing PRD, or a new component with its own documents). Nothing assumes modules, an overview document or a component structure.

Open: how it looks with many PRDs (group by component, collapse), and what a drag-and-drop-free move (the move menu, keyboard) offers.

Superseded by I-5 (concept interview 2026-10-20): an idea no longer picks a document. An accepted idea becomes a change (C-n); the interview proposes items, each with a suggested target section, and they merge into the spec on approval. Drop targets per PRD are not needed.

## Történet
