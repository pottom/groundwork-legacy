# Rekordtár: Műszaki terv

_Műszaki terv_

## Adatok és tárolás {#t-rec-data .done}

Minden a projekt `docs/product/` mappájában él, gitben.

* Minden rekord egyetlen Markdown-fájl, és ez a forrás · `d-rec-md-source` · kész · döntés · C-1
  Egy igazság, egy fájl.
- **Azonosítók** · `g-rec-ids` · C-1
   - I-n, C-n, M-n: soha újra nem használt sorszám · `d-rec-ids` · decision · partial · C-1, C-2
  - Spec: rész = slug · `d-rec-ids-spec` · döntés · hiányzik · C-2 · sürgős
- JSON-forrás és mellette generált Markdown · `x-rec-json-source` · kizárt · C-2 · felváltotta: C-3

## Biztonság {#t-rec-sec}

- A tár csak a docs/product/ alá ír · `d-rec-write` · kész · C-1
