# Groundwork — Áttekintés

_Rendszer-áttekintés_

A Groundwork négy lépésben épül. Először a két meglévő prototípus változatlanul beköltözik az új repóba, egy közös szerver mögé, így már az elején egy helyen működik minden. Ezután jön a közös kinézet és az angol felület, majd a Plan és a Build összekötése, végül az npm-kiadás.

- groundwork export: statikus, csak olvasható pillanatkép a követőknek · `p-export` · félretett · C-1

## Cél és érintettek {#t-goal .done}

A Groundwork egy hordozható, nyílt forrású csomag, amely egy projektet az ötlettől a megvalósításig kísér végig. Tervezéskor egy élő gondolattérképből termékdokumentáció (PRD, műszaki terv és társaik) készül; fejlesztés közben ugyanott látszik, hol tartanak a jegyek és az ágak.

Bármilyen projekthez használható, nem kötődik egyetlen termékhez vagy területhez sem. A tartalmat Claude Code-dal építjük, de a nézetek Claude nélkül is megnyithatók és olvashatók, így a projekt követői is látják az állapotot.

- Ötlettől a megvalósításig egy csomagban · `d-idea-to-build` · döntés · C-1
  Tervezés (PRD) → fejlesztés (jegyek) egy helyen.
- Bármilyen projekthez használható · `d-any-project` · döntés · C-1
- Hordozható, bárki telepítheti · `d-portable` · döntés · C-1
- Név: Groundwork · `d-name` · döntés · C-1
- Claude Code-dal épül, a nézetek Claude nélkül is olvashatók · `d-users` · döntés · C-1
- Nyílt forrás, MIT licenc · `d-license` · döntés · C-1

## Modulok és határaik {#t-modules .done}

A Groundwork egy közös **Magból** és arra épülő **modulokból** áll. A Mag adja a helyi szervert és a közös keretet (fejléc, navigáció, téma), saját felhasználói funkciója nincs.

Az első két modul a **Plan** (tervezés: interjú, térkép, dokumentumok) és a **Build** (fejlesztés: jegyek, függések, ágak). A kettőt egy stabil azonosító köti össze: a jegy megnevezi azt a PRD-elemet, amiből született, így egy döntéstől el lehet jutni a megvalósításáig, és vissza. Később további modulok is csatlakozhatnak a Mag módosítása nélkül.

- Később új modulokkal bővíthető · `d-extensible` · döntés · C-1
- Mag + két modul: Plan és Build · `d-structure` · döntés · C-1
- A Mag: közös szerver és keret, felhasználói funkció nélkül · `d-core-role` · döntés · kész · C-1
  [core/README.md](../../../core/README.md)
- Jegy ↔ PRD-elem kapcsolat stabil azonosítóval · `d-trace` · döntés · C-1
  A jegyben pl. **PRD:** d-npm sor.
- Fejléc: Ideas → Plan → Build | Sketch · Agents · Present · `d-nav-order` · döntés · C-1
  Az első három a folyamat, a többi eszköz, elválasztva. Az I-5 szerint felváltja: Overview | Ideas → Changes → Spec → Tickets | Sketch · Present.

## Kockázatok és függőségek {#t-risks .done}

A Groundwork néhány külső dologra épít, amelyek változhatnak. A gondolattérképet a Mind Elixir rajzolja, amely lényegében egyetlen fejlesztő projektje. A Claude Code-dal a skilleken és a hookon keresztül kapcsolódik, ezek formátuma változhat. A Build a mattpocock-skillek jegykonvencióiból olvas, amelyek szintén módosulhatnak.

Belső kockázat, hogy Claude és a felhasználó egyszerre szerkesztheti a térképet. Az összefésülés a tartalmat megőrzi, de a testvér-elemek sorrendje ilyenkor elveszhet.

- A Mind Elixir egyszemélyes projekt · `n-risk-me` · jegyzet · C-1
- A Claude Code skill- és hook-formátuma változhat · `n-risk-cc` · jegyzet · C-1
- A mattpocock-konvenciók változhatnak · `n-risk-conv` · jegyzet · C-1
- Egyidejű szerkesztésnél a sorrend elveszhet · `n-risk-merge` · jegyzet · C-1
- Az Excalidraw mérete és csomagolása build-lépés nélkül · `n-risk-excalidraw` · jegyzet · C-1
  A Sketch első jegye bizonyítja, hogy megoldható.
