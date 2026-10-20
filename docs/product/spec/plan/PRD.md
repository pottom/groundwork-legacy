# Groundwork — Plan modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Hatókör és fő funkciók {#t-plan-scope .done}

A Plan modul a prd-maker prototípusból születik. Egy grilling-interjú közben élő, közösen szerkeszthető gondolattérképet rajzol, és abból termékdokumentációt generál a `docs/product/` alá. Kezeli az összetevőkből álló rendszereket és a különböző dokumentumtípusokat, meglévő projektnél pedig a kódból tölti fel a térképet. A prototípus minden funkciója része az első verziónak.

Új képessége lesz, hogy döntésenként megmutatja, hány jegy született belőle, és azok közül mennyi kész. A jegyeket továbbra is a mattpocock `to-tickets` skillje készíti; utána Claude minden jegybe beírja, melyik PRD-elemből született.

- Élő, közösen szerkeszthető gondolattérkép · `f-plan-map` · döntés · kész · C-1
  [modules/plan/index.html](../../../../modules/plan/index.html)
- Dokumentumok generálása (PRD, TECH, …) · `f-plan-docs` · döntés · kész · C-1
  [modules/plan/documents.mjs](../../../../modules/plan/documents.mjs)
- Összetevők és dokumentumtípusok · `f-plan-components` · döntés · kész · C-1
- Meglévő projekt feltöltése kódból · `f-plan-existing` · döntés · részben · C-1
  A skill leírja, nincs külön eszköz hozzá.
- Nézet/szerkesztés mód, fókusz, összecsukás · `f-plan-modes` · döntés · kész · C-1
- groundwork-prd-maker skill + hook · `f-plan-skill` · döntés · részben · C-1
  A hook élesben még nem futott.
  [.claude/skills/groundwork-prd-maker/SKILL.md](../../../../.claude/skills/groundwork-prd-maker/SKILL.md)
- Dokumentumok a beszélgetés nyelvén · `d-plan-lang` · döntés · részben · C-1
  Magyar és angol szövegkészlet van; más nyelvű beszélgetésnél a dokumentumok angolul készülnek.
  [modules/plan/doc-strings.mjs](../../../../modules/plan/doc-strings.mjs)
- Döntésenként látszik, hány jegy lett és mennyi kész · `f-plan-trace` · döntés · kész · C-1
  [modules/build/project-tickets.mjs](../../../../modules/build/project-tickets.mjs)
- A to-tickets után Claude írja be a PRD-hivatkozást · `d-trace-how` · döntés · C-1
  A to-tickets változatlan marad. Az I-5 szerint a beírt sorok: **Change:** és **Spec:** (d-ticket-write).
- Saját jegykészítő skill · `x-own-tickets` · kizárt · C-1
- A térkép van elöl; üres térképnél indítókártya · `d-plan-first` · döntés · kész · C-1

## Felhasználók és használati esetek {#t-plan-users .done}

A Plan felhasználója a Claude Code-ot használó fejlesztő, aki egyedül vagy kis csapatban dolgozik, és Claude-dal együtt tervezi meg a terméket.

- Claude Code-ot használó fejlesztő, egyedül vagy kis csapatban · `d-plan-user` · döntés · C-1
