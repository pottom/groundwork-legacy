---
id: I-11
title: "groundwork uninstall: init in reverse"
author: claude
source: conversation 2026-10-20 (moving a Matt-skills project to Groundwork and back)
kind: product
impact: medium
effort: low
rationale: Whoever tries Groundwork must be able to leave cleanly; init already knows every file and hook it installs, so the reverse is small
status: new
created: 2026-10-20
---

init has no reverse today: leaving Groundwork means removing by hand the .claude/skills/groundwork-* folders, the module hooks in .claude/settings.json, the .claude/hooks/groundwork-* files, the pre-commit hook and .groundwork/. groundwork uninstall would do it from the same module manifests (the claude field) that init reads: list what it would remove and ask [y/N] like init, remove only what init itself installed (a hook or skill the user changed, or another tool's, stays and is named), keep everything else in settings.json, and leave docs/product/ untouched: the Spec, the changes and the ideas stay plain Markdown that reads without Groundwork. Tickets keep their **PRD:** and **Change:** lines. A test pairs it with init: init then uninstall leaves the project as it was.

## Történet

- 2026-10-20 · claude · created
