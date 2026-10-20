# Rekordtár: Műszaki terv

_Műszaki terv_

## Adatok és tárolás {#t-rec-data .done}

Minden a projekt `docs/product/` mappájában él, gitben.

<!-- human: hp-1 -->
Ezt az ember írta, és így marad.
<!-- /human -->

- Minden rekord egyetlen Markdown-fájl · `d-rec-md-source` · döntés · kész · C-1
  Egy igazság, egy fájl.
- **Azonosítók** · `g-rec-ids` · C-1
  - I-n, C-n, M-n: soha újra nem használt sorszám · `d-rec-ids` · döntés · done · C-1, C-2
  - Spec: rész = slug · `d-rec-ids-spec` · döntés · kész (#48) · C-2
    [core/records/spec-format.mjs](../../../../core/records/spec-format.mjs)
    Implemented in core/records/spec-format.mjs by the agent.
- JSON-forrás és mellette generált Markdown · `x-rec-json-source` · kizárt · C-2 · felváltotta: C-3

## Biztonság {#t-rec-sec}

- A tár csak a docs/product/ alá ír · `d-rec-write` · döntés · kész · C-1

<!-- human -->
Ennek a blokknak nincs vége, mert az agent kitörölte.
