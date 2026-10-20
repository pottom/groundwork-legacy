# Groundwork — Plan modul: Műszaki terv

_Műszaki terv_

## Technológiai stack {#t-plan-stack .done}

A gondolattérképet a Mind Elixir, a dokumentumok Markdown-megjelenítését a marked adja. Mindkettő a csomag része, nem CDN-ről töltődik, így a Plan internet nélkül is működik.

- Mind Elixir 5.15.1 · `s-plan-me` · döntés · kész · C-1
  A csomagba téve, nem CDN-ről.
- marked 12.0.2 · `s-plan-marked` · döntés · kész · C-1
  A csomagba téve, nem CDN-ről.
- Függőségek CDN-ről · `x-cdn` · kizárt · C-1
- Egy közös Markdown-renderelő a két modulban · `p-one-md` · félretett · C-1
  Előbb próba: elég-e a Build biztonságos renderelője a Plan dokumentumaihoz; ha igen, a marked (90 KB) kikerül.

## Adatok és tárolás {#t-plan-data .done}

A Plan egyetlen igazságforrása a `docs/product/mindmap.json`; ebből generálódnak a dokumentumok ugyanebbe a mappába. Ez a projekt dokumentációja, ezért gitbe kerül. A böngészőben tett, Claude által még fel nem dolgozott szerkesztések helyi állapotként a `.groundwork/plan/` alá kerülnek, és nem kerülnek gitbe.

- docs/product/mindmap.json az igazságforrás · `n-plan-json` · döntés · kész · C-1
- A docs/product/ gitbe kerül · `d-git-docs` · döntés · C-1
- Helyi állapot: .groundwork/<module>/, .gitignore-ban · `d-state-dir` · döntés · részben · C-1
  A Plan állapota a .groundwork/plan/ alatt; a régi .prd-maker/ átkerül. A .gitignore-ba az init teszi (még hiányzik).
