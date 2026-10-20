# Groundwork — Present modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Probléma és cél {#t-present-problem .done}

Egy projekt bemutatásához ma kézzel kell összeszedni a célt, a döntéseket, a haladást és a terveket, és a kész prezentáció másnapra elavul. Pedig a Groundwork mindezt tudja: a Plan a célt és a döntéseket, a Build a haladást, a Sketch az ábrákat, az Ideas a jövőt.

A Present modul ezekből készít prezentációt: az egész projektről, egy mérföldkőről vagy a fejlesztés pillanatnyi állásáról. A diák élő adatblokkokat tartalmazhatnak, így egy státuszprezentáció bármikor, frissen bemutatható.

- Prezentáció a projektről, egy mérföldkőről vagy a fejlesztés állásáról, a Groundwork adataiból · `d-present-goal` · döntés · C-1

## Felhasználók és használati esetek {#t-present-users .done}

A fejlesztő mutatja be a projektet egy megrendelőnek, a csapatnak vagy egy érdeklődőnek; Claude megírja a vázat és az előadói jegyzeteket, a fejlesztő átírja, majd teljes képernyőn, előadói nézettel bemutatja, vagy PDF-ben elküldi.

Tipikus esetek: egy mérföldkő lezárásakor egy összefoglaló arról, mi készült el és mi jön; egy heti státusz, amely mindig a friss számokat mutatja; egy projektbemutató egy új érdeklődőnek.

- A fejlesztő mutatja be; a közönség megrendelő, csapat vagy érdeklődő · `d-present-users` · döntés · C-1

## Hatókör és fő funkciók {#t-present-scope .done}

A Present diasorokat kezel, amelyek a böngészőben, teljes képernyőn, a közös kinézettel jelennek meg, billentyűzettel lapozhatók, és előadói nézetük is van jegyzetekkel, időmérővel és a következő diával. A diák élő adatblokkokat tartalmazhatnak, például egy mérföldkő haladását, a nyitott blokkolókat, a döntéseket vagy a méréseket, így a prezentáció mindig a friss állapotot mutatja. Vázlat és ötletlista is kerülhet diára.

Három sablonnal indul: projektbemutató, mérföldkő-összefoglaló és fejlesztési állás. Claude a skillen át megírja a történetet és az előadói jegyzeteket, a fejlesztő a böngészőben szerkeszti, élő előnézettel. PDF-be a böngésző nyomtatásával menthető; a PowerPoint-export későbbre marad.

- Diasor a böngészőben: teljes képernyő, billentyűzetes lapozás, közös kinézet · `f-present-deck` · döntés · hiányzik · C-1
- Élő adatblokkok: mérföldkő-haladás, blokkolók, döntések, mérések · `f-present-live` · döntés · hiányzik · C-1
- Sablonok: projektbemutató, mérföldkő-összefoglaló, fejlesztési állás · `f-present-templates` · döntés · hiányzik · C-1
- Claude írja a történetet és az előadói jegyzeteket, skillen át · `f-present-claude` · döntés · hiányzik · C-1
- Szerkesztés a böngészőben, élő előnézettel · `f-present-edit` · döntés · hiányzik · C-1
- Előadói nézet: jegyzetek, időmérő, következő dia · `f-present-speaker` · döntés · hiányzik · C-1
- PDF-be mentés a böngésző nyomtatásával · `f-present-pdf` · döntés · hiányzik · C-1
- Vázlatok és ötletek a diákon · `f-present-sources` · döntés · hiányzik · C-1
- PowerPoint-export · `p-present-pptx` · félretett · C-1

## Funkcionális követelmények {#t-present-func .done}

Egy élő adatblokk rögzíthető is: ilyenkor a rögzítés pillanatának számait mutatja, így egy mérföldkő-összefoglaló később is a lezáráskori állapotot idézi. Ha egy blokk forrásmodulja hiányzik, a dia hiba helyett nyugodt helykitöltőt mutat.

- Egy élő blokk rögzíthető: pillanatképként az akkori számokat mutatja · `d-present-snapshot` · döntés · C-1
  Egy mérföldkő-összefoglaló így később is a lezáráskori állapotot mutatja.
- Ha egy blokk forrásmodulja hiányzik, a dia nyugodt helykitöltőt mutat · `d-present-missing` · döntés · C-1

## Nem funkcionális követelmények {#t-present-nfr .done}

A Present a közös dizájnrendszert használja, angolul és magyarul is működik, hálózat nélkül is. A diák szövege a diasor saját nyelvén van, függetlenül a felület nyelvétől, ahogy a Plan dokumentumainál.

- Közös kinézet, angol és magyar felület, offline; a diák szövege a diasor nyelvén · `d-present-nfr` · döntés · C-1
