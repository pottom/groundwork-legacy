# Groundwork — Build modul: Műszaki terv

_Műszaki terv_

## Biztonság {#t-build-sec .done}

A Build csak olvas: a projekt fájljait és a git történetét jeleníti meg, semmit nem módosít.

- Csak olvas, csak 127.0.0.1, idegen Host → 403 · `n-build-ro` · döntés · kész · C-1

## Integrációk: jegykezelők {#t-build-conv .done}

A Build a mattpocock-skillek konvencióit olvassa: a `.scratch/<terület>/issues/` alatti helyi jegyeket, a területek `spec.md` fájljait, a `docs/adr/` döntéseit és a fogalomtárat. Az első verzió a GitHub-issue-kat is jegyként olvassa, az állapotukkal, a milestone-jukkal és a „Blocked by” kapcsolataikkal együtt, mert a Groundwork saját jegyei is a GitHubon vannak. A GitHub elérése a szerveren át megy, token nem kerül az oldalba. A GitLab-issue-k később jöhetnek.

- .scratch/<terület>/issues, spec.md, docs/adr, GLOSSARY · `n-build-conv` · döntés · kész · C-1
- v1: helyi Markdown-jegyek (.scratch/) és GitHub-issue-k · `d-local-tickets` · döntés · C-1
  A Groundwork saját jegyei a GitHubon vannak (pottom/groundwork).
- GitLab-issue-k · `p-gh-issues` · félretett · C-1
- A Plan jegyszámai a Build jegyolvasójából (/api/build/prd) · `d-prd-counts` · döntés · kész · C-1
  A szerver ugyanazzal a jegyolvasóval (ticket-reader.mjs) olvassa a jegyeket, mint a Build oldala, így a két modul ugyanazt látja. Elvetett (wontfix, legacy) jegy nem számít; kész a done, resolved és closed.
  [modules/build/project-tickets.mjs](../../../../modules/build/project-tickets.mjs)
