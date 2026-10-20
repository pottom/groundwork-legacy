# Változások modul: Műszaki terv

_Műszaki terv_

## Architektúra és komponensek {#t-changes-arch}

- A Változások fül saját modul (`modules/changes`), átveszi a Change típus deklarációját a core-tól · `d-changes-module` · döntés · hiányzik · C-3
  Ugyanúgy ki-be kapcsolható és önállóan tesztelhető, mint a többi munkaterület. A mérföldkő (M-n) a core-ban marad, amíg az Áttekintés el nem viszi.
- A Lit bekerül a `core/vendor`-ba; a Változások lapja Lit-komponensekből épül, a nyilvánvalóan közösek (pl. rekord-chip) a core-ba kerülnek · `d-lit-scope-c3` · döntés · hiányzik · C-3
  A meglévő modulokat most nem írjuk át (az áttérés fokozatos, d-lit); a közös komponens helye viszont már most jó legyen, hogy a következő modul ne másolja le.
- A lap a core fájlfigyelésén követi a változást: a modul `watch(path)`-ja, SSE, a shell `subscribe()`-ja · `d-changes-live` · döntés · hiányzik · C-3
  Változáskor a nyitott változást újraolvassa; a commit óta változott részekhez a fájl HEAD-beli változatát (`git show HEAD:<path>`) veti össze a `readChange`-dzsel.
- A változásolvasó a Gondolatok szakaszt is olvassa; a régi Kérdések listát átmenetileg még elfogadja · `d-map-reader` · döntés · hiányzik · C-4
  Így a korábbi változásfájlok nem törnek el; a szakasz a térkép nyitott kérdéseiből számolódik.

## Integrációk és interfészek {#t-changes-int}

- Az interjúban Claude közvetlenül a változás .md-jét szerkeszti, minden írás után `groundwork record check` · `d-change-write-direct` · döntés · hiányzik · C-3
  A groundwork-prd-maker a változás interjújában a C-n fájlba ír, nem a Specbe. A formátum kézzel írhatónak készült, és a lap csak olvasható, így nincs mit összefésülni.
- Ops-alapú íróparancs a változáshoz (`groundwork change apply`) · `x-change-apply-cmd` · kizárt · hiányzik · C-3
  Validálna és elemenként írna, de az összefésülés haszna csak két írónál jön elő; újra elő kell venni a válasz a lapról (C-7) vagy a szerkeszthető lap idején.
- A groundwork-prd-maker az interjúban a térképre írja a kérdéseket, lehetőségeket és döntéseket; a javasolt elemeket a listába · `d-map-skill` · döntés · hiányzik · C-4
  Minden írás után `groundwork record check`, ami a Gondolatok szakasz formáját is ellenőrzi.
