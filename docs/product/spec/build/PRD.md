# Groundwork — Build modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Hatókör és fő funkciók {#t-build-scope .done}

A Build modul a fejlesztési dashboard-prototípusból születik. A projekt Markdown-jegyeiből és a git történetéből mutatja, hol tart a munka: jegyek és területek, függések, aktivitás, ellentmondások, dokumentumok és az ágak gráfja. A Groundwork szerverén fut; fájlból, szerver nélkül nem nyitható meg. A prototípus minden funkciója része az első verziónak.

Új képessége lesz, hogy egy jegyről egy kattintással el lehet jutni ahhoz a PRD-elemhez, amiből született. Egy Claude-skill, amely a chatben foglalja össze a projekt állapotát, később jöhet.

- Jegyek és területek a .scratch-ből · `f-build-tickets` · döntés · kész · C-1
- Függések (Blocked by), aktivitás · `f-build-deps` · döntés · kész · C-1
- Ellentmondások kiszűrése · `f-build-incons` · döntés · kész · C-1
- Dokumentumok: specek, ADR-ek, fogalomtár · `f-build-docs` · döntés · kész · C-1
- Git ágak és merge-ök gráfja · `f-build-branches` · döntés · kész · C-1
- Szerver nélküli, fájlból megnyitott Build · `f-build-fileonly` · kizárt · C-1
  Elhagyva: az npx @pottom/groundwork egy parancs, a fájlmód pedig generált bundle-t, azaz build-lépést igényelt volna.
- Jegyről egy kattintással a PRD-elemhez · `f-build-trace` · döntés · hiányzik · C-1
- Claude-skill a projekt állapotáról · `p-build-skill` · félretett · C-1
- Hét egyenrangú nézet, elöl az áttekintés · `d-build-tabs` · döntés · kész · C-1

## Felhasználók és használati esetek {#t-build-users .done}

A Build nézeteit bárki használhatja, aki a projektet követi, Claude nélkül is. Claude nélkül csak olvasni lehet.

- Bárki, aki a projektet követi, Claude nélkül is · `d-build-user` · döntés · C-1
- Claude nélkül csak olvasás · `n-build-ro-user` · jegyzet · C-1
