# Rekordtár: Műszaki terv

_Műszaki terv_

## Adatok és tárolás {#t-rec-data .done}

Minden a projekt `docs/product/` mappájában él, gitben.

- Minden rekord egyetlen Markdown-fájl · `d-rec-md-source` · döntés · kész · C-1
  Egy igazság, egy fájl.
<<<<<<< HEAD
- **Azonosítók** · `g-rec-ids` · C-1
  - I-n, C-n, M-n: soha újra nem használt sorszám · `d-rec-ids` · döntés · részben · C-1, C-2
=======
- **Azonosítók és hivatkozások** · `g-rec-ids` · C-1, C-4
  - I-n, C-n, M-n: folyamatos sorszám · `d-rec-ids` · döntés · kész · C-1, C-2
>>>>>>> c-4-ids
- JSON-forrás és mellette generált Markdown · `x-rec-json-source` · kizárt · C-2 · felváltotta: C-3

## Biztonság {#t-rec-sec}

- A tár csak a docs/product/ alá ír · `d-rec-write` · döntés · kész · C-1
