# Változások modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Hatókör és fő funkciók {#t-changes-scope}

- A változás lapja egyelőre csak olvasható: Claude ír a fájlba, a lap követi · `d-changes-page-readonly` · döntés · kész · C-3
  Indulásnak; a használat mutatja meg, mit érdemes a lapon szerkeszthetővé tenni. A válasz a lapról (C-7) és a jóváhagyó lista (C-5) külön szelet.
- Ami az utolsó írással új lett vagy megváltozott, a lapon néhány másodpercig kiemelve látszik · `d-changes-flash` · döntés · kész · C-3
  A szem odaugrik, ahová Claude épp írt.
- A legutóbbi commit óta változott részek tartósan jelölve vannak: új, módosult, áthúzott · `d-changes-since-commit` · döntés · kész · C-3
  Az alap a git: nincs saját „mit láttam” állapot, újratöltés és gépváltás után is látszik. Elemenként (id szerint) és szakaszonként vet össze, nem nyers sordiff. Git vagy commitolt fájl nélkül csak a rövid kiemelés működik.
- A változások listája szakaszonként csoportosít; soronként azonosító, cím, szakasz, nyitott kérdések és javasolt elemek száma, ötletek, mérföldkő · `d-changes-list` · döntés · kész · C-3
- Az interjú két szakasza számolt: van nyitott kérdés → Grilling, nincs → Jóváhagyásra vár; a későbbieket egyelőre a `status` mező adja · `d-changes-stage-interview` · döntés · kész · C-3
  A kézi címke elfelejtődik (a C-3 interjú közben is awaiting-approval volt). Megvalósítás, Kész és Elvetve a C-5 és a C-8 után számolódik (d-stage-derived).
- Az ember a változás lapján hagyja jóvá a változást · `d-approve-on-page` · döntés · kész · C-5
  A jóváhagyás az ember lépése, és a rekordtár a csatornából tudja, ki ír: a böngésző az ember, a parancssor Claude. A jóváhagyó lista és a Jóváhagyás gomb ezért a lapon van; ez az első írás a lapról, és a válasz a lapról (C-7) ugyanerre az íróútra épül.
- Az ember a chatben hagyja jóvá, Claude futtatja a beolvasztást · `x-approve-in-chat` · kizárt · C-5
  A parancssornak az ember nevében kellene írnia, és ez gyengítené a szabályt, hogy Claude nem viheti Megvalósításba a változást.
- A jóváhagyó lista soronként Elfogad és Máshová…; új részt a chatben kér az ember · `d-approve-list-actions` · döntés · kész · C-5
  A Máshová… kereshető lista a Spec fejezeteiből és a függő változások fejezeteiből. Új rész ritkán kell, és Claude a parts célhellyel már felveszi, így a lapra nem kell részlétrehozó űrlap.
- Új rész létrehozása a jóváhagyó listán, névvel, típussal, mappával · `x-new-part-on-page` · kizárt · C-5
- Csak az egész lista jóváhagyása, soronkénti lépés nélkül · `x-approve-all-only` · kizárt · C-5
  A rossz célhely ránézésre látszik a listán; ott a legolcsóbb javítani.
- A Jóváhagyás mindent elfogad, ami nincs áthelyezve; a Máshová… azonnal a változás fájljába íródik · `d-move-writes-change` · döntés · kész · C-5
  A Jóváhagyás gomb maga a „megnéztem”. Az új célhely a változás fájljában él, mert a Markdown a forrás: Claude is látja, és újratöltés után is megmarad.
- Minden sort ki kell pipálni a Jóváhagyás előtt · `x-tick-every-row` · kizárt · C-5
  Egy 86 elemes változásnál (C-2) 86 kattintás, és nem mond többet a Jóváhagyásnál.
- A gondolattérkép a lapon egyelőre csak olvasható: Claude rajzol, az ember a chatben alakítja · `d-map-readonly` · döntés · kész · C-4
  Ugyanaz az elv, mint a lapnál (d-changes-page-readonly): egy író, nincs mit összefésülni, és a használat mutatja meg, mit érdemes szerkeszthetővé tenni.
- A lap tetején munkafelület: balra a térkép, jobbra a nyitott kérdések; Jóváhagyásra vár szakaszban összecsukva · `d-map-workspace` · döntés · kész · C-4
  A kérdések a térképből számolódnak, felül a legutóbbi, mindegyiken Claude javaslata; kattintásra a térkép a csomóponthoz ugrik. Alatta a leírás és a javasolt elemek. A válasz a lapról (C-7) ugyanezt a panelt bővíti válaszolóvá (a javaslat gomb lesz, mellé saját válasz), így a lap nem rendeződik át.
- A válaszoló a kérdés-csomópontra kattintva felugró ablakban · `x-map-popup-answer` · kizárt · C-4
  A kérdés legyen szem előtt ott, ahol válaszolnál; a felugró ablak eltakarja a térképet.
- A térkép szerkesztése a böngészőben (áthúzás, átnevezés, saját csomópont) · `p-map-edit` · félretett · C-4
  A válasz a lapról (C-7) szelettel, közös íróúttal: egy út szolgálja ki a válaszokat és a térkép szerkesztését. Ha az első interjúk után hiányzik, az a jel.
