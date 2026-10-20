# Groundwork — Sketch modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Probléma és cél {#t-board-problem .done}

Egy architektúrát, egy folyamatot vagy egy hibát szövegben lassú elmagyarázni, és a chatben leírt magyarázat utána elvész. A Sketch modul egy közös vázlatfelület: a fejlesztő és Claude ugyanarra a felületre rajzol, és az alakzatokhoz tűzött rövid szálakban válaszolnak egymásnak, így a magyarázat a rajzon marad.

- Közös vázlatfelület, ahol ember és Claude oda-vissza magyaráz · `d-board-goal` · döntés · C-1

## Felhasználók és használati esetek {#t-board-users .done}

A fejlesztő felvázol valamit, és megkérdezi Claude-ot; Claude elolvassa a rajzot, a szálban válaszol, és ha kell, maga is rajzol: dobozokat, nyilakat, folyamatot. Fordítva is: Claude egy diagrammal magyaráz el egy javaslatot, a fejlesztő pedig a rajzon jelzi, mi nem stimmel. A követők a vázlatokat olvassák.

- Ember és Claude is rajzol és válaszol · `d-board-who` · döntés · C-1

## Hatókör és fő funkciók {#t-board-scope .done}

A modul névvel ellátott vázlatokat kezel; mindegyik egy Excalidraw-rajz a közös keretben. Claude parancssori eszközön és skillen át olvassa és rajzolja a vázlatot, Mermaid-leírásból is. A vázlat lényege a szálak: egy alakzatra tűzött rövid beszélgetés, amelyben ember és Claude felváltva válaszol. Minden változás élőben jelenik meg. Egy vázlat hivatkozhat ötletre, térképcsomópontra vagy jegyre, és azok is a vázlatra.

- Excalidraw-szerkesztő a keretben · `f-board-draw` · döntés · kész · C-1
  [modules/sketch/module.mjs](../../../../modules/sketch/module.mjs)
- Tetszőleges számú vázlat névvel: lista, létrehozás, átnevezés · `f-board-list` · döntés · kész · C-1
  [modules/sketch/view/sketches.mjs](../../../../modules/sketch/view/sketches.mjs)
- Claude olvassa a vázlatot: alakzatok, szövegek, kapcsolatok · `f-board-claude-read` · döntés · kész · C-1
  [modules/sketch/digest.mjs](../../../../modules/sketch/digest.mjs)
- Claude rajzol: alakzatok, nyilak, szövegek, Mermaidből is · `f-board-claude-draw` · döntés · kész · C-1
  [modules/sketch/ops.mjs](../../../../modules/sketch/ops.mjs)
- Alakzatokhoz tűzött megjegyzésszálak · `f-board-threads` · döntés · kész · C-1
  [modules/sketch/threads.mjs](../../../../modules/sketch/threads.mjs)
- Élő frissítés: Claude rajza és válasza azonnal megjelenik · `f-board-live` · döntés · kész · C-1
  [modules/sketch/view/follow.mjs](../../../../modules/sketch/view/follow.mjs)
- Hivatkozás ötletre, térképcsomópontra és jegyre, és vissza · `f-board-links` · döntés · kész · C-1
  Jó, ha van, de nem feltétlenül szükséges.
  [modules/sketch/links-store.mjs](../../../../modules/sketch/links-store.mjs)
- Egy alakzat is hivatkozhat ötletre, térképcsomópontra, jegyre vagy másik vázlatra · `f-board-shape-links` · döntés · kész · C-1
  Az Excalidraw saját elem-hivatkozásával; jó, ha van, de nem feltétlenül szükséges.
  [modules/sketch/view/targets.mjs](../../../../modules/sketch/view/targets.mjs)

## Funkcionális követelmények {#t-board-func .done}

Ha a fejlesztő és Claude egyszerre módosít, a változások elemenként fésülődnek össze, így egyikük sem írja felül a másikat. Egy szál egy alakzathoz tartozik, hozzászólásokból áll szerzővel és idővel, és lezárható, ha a kérdés megoldódott. A vázlat szabványos .excalidraw fájl marad, amelyet bármely Excalidraw megnyit.

- Egyidejű szerkesztésnél elemszintű összefésülés · `d-board-merge` · döntés · C-1
  Az Excalidraw elemeinek version mezője alapján; Claude és a böngésző nem írja felül egymást.
- Szál: alakzat, hozzászólások szerzővel és idővel, lezárható · `d-board-thread-fields` · döntés · C-1
- A vázlat szabványos .excalidraw fájl, az excalidraw.com is megnyitja · `d-board-std-file` · döntés · C-1

## Nem funkcionális követelmények {#t-board-nfr .done}

Az Excalidraw nagy, ezért a Sketch csak akkor töltődik be, amikor először megnyitják; a Plan és a Build ettől nem lassul. A vázlat világos vagy sötét módja és nyelve a keretét követi, és hálózat nélkül is működik.

- Csak megnyitáskor töltődik be, a többi modul gyors marad · `d-board-lazy` · döntés · C-1
- A vázlat követi a keret témáját és nyelvét · `d-board-theme` · döntés · C-1
