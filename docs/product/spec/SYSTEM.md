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

## Rekordmodell {#t-records}

A Groundwork rekordtípusokra épül, ahogy egy ServiceNow-szerű rendszer: ötlet (I-n), változás (C-n), mérföldkő (M-n), rész, dokumentum, Spec-elem és jegy, mellettük az eszközök rekordjai (vázlat, agent-futás, diasor). Mindegyiknek van azonosítója, életciklusa, típusos hivatkozásai és története, így a „hol tart?” kérdésre mindig ugyanúgy felelünk. Minden munka változás: az egyenesen jegy út is egy minimális változást hoz létre, és a projekt kezdete is az (új projektnél az első ötletből, meglévő kódnál a Kiinduló állapotból).

A munkaterületek ezek nézetei: **Overview | Ideas → Changes → Spec → Tickets | Sketch · Present**. Az Overview egy futószalag (Ötletek → Grilling → Jóváhagyásra vár → Megvalósítás → Kész), amelyen a változások haladnak; az állomásokra kattintva a munkapadjuk nyílik, a torlódást WIP-limit jelzi. A Spec nem állomás, hanem a tervrajz-tár: az egész és egy szint rész, mindegyiknek a típusa szerinti dokumentumai; nyitólapja egy részek × dokumentumfajták mátrix, a térkép csak lencse. A felülírt Spec-sor felváltva jelet kap, nem tűnik el.

Az interjú (grilling, magyarul Interjú) a Claude Code chatben zajlik, a változás lapja közben élőben töltődik a mezőkkel (cím, honnan, probléma, keret, kihagyjuk, mérföldkő), a nyitott kérdésekkel és a javasolt elemekkel; méretét Claude igazítja a változáshoz, és az ember bármikor lezárhatja. Később a lapról is lehet majd válaszolni. Minden rekord lapján egy kis gráf mutatja a láncát (miből lett, mi lett belőle), mérföldkövenként egy nagyobb is. A jegyen kötelező a változás (**Change:**), és ha Spec-elemet valósít meg, az elemek (**Spec:**).

- A Groundwork rekordtípusokra épül; a modulok ezek nézetei (munkaterületek) · `d-record-model` · döntés · hiányzik · C-2
  Mint a ServiceNow-ban (Idea, Demand, Change Request, CMDB); nem a meglévő modulokból indulunk ki.
- **Rekordtípusok** · `g-record-types` · hiányzik · C-2
  - Ötlet (I-n): New → Considering → Accepted / Rejected / Snoozed / Duplicate · `d-rec-idea` · döntés · hiányzik · C-2
  - Változás (C-n): Grilling → Jóváhagyásra vár → Megvalósítás → Kész / Elvetve · `d-rec-change` · döntés · hiányzik · C-2
    A grilling magyar felirata: Interjú.
  - Rész (a mai összetevő): aktív / kivezetett · `d-rec-part` · döntés · hiányzik · C-2
  - Dokumentum: egy rész (vagy az egész) fejezetekre bontott leírása · `d-rec-doc` · döntés · hiányzik · C-2
  - Spec-elem: érvényes / felváltva; megvalósítás: hiányzik → részben → kész · `d-rec-item` · döntés · hiányzik · C-2
  - Eszköz-rekordok (vázlat, agent-futás, diasor) bármire hivatkozhatnak · `d-rec-tools` · döntés · hiányzik · C-2
  - Mérföldkő (M-n): változások csoportja, haladása a változásaiból számolódik · `d-rec-milestone` · döntés · hiányzik · C-2
    Egy változás legfeljebb egy mérföldkőhöz tartozik; a jegyek a változásukon át számítanak. Tervezett → Folyamatban → Kész; átvihető változás, a történetben látszik.
- Minden rekordban közös: azonosító, típus, életciklus-állapot, típusos hivatkozások, történet · `d-rec-common` · döntés · hiányzik · C-2
  A hol tart? mindig ugyanúgy válaszolható: a rekord állapota és a hivatkozásai.
- Cél / Kimenet rekordtípus · `p-rec-goal` · félretett · hiányzik · C-2
- A Spec: az egész és egy szint rész; mindegyiknek a típusa szerinti dokumentumai · `d-spec-structure` · döntés · hiányzik · C-2
  Sima terméknél nincs rész, csak az egész (PRD, TECH): a mátrix egy sor. Az Új rész a jóváhagyó listán új sort hoz a típusához illő üres dokumentumokkal. Alrészek később, ha kellenek.
- Alrészek (rész a részben) · `p-subparts` · félretett · hiányzik · C-2
- A kezdet is változás: új projektnél az első ötletből C-1, meglévő kódnál C-1 Kiinduló állapot · `d-start-is-change` · döntés · hiányzik · C-2
  Új projektnél a grilling a szerkezetet (részek, dokumentumok) is javasolja; meglévő kódnál kódból jelölésű elemeket megvalósítási állapottal. Így a Spec minden eleme változásból születik.
- A felülírt vagy kivett Spec-sor felváltva jelet kap (felváltotta: C-n), nem tűnik el · `d-superseded` · döntés · hiányzik · C-2
  A dokumentum alapból csak az érvényes sorokat mutatja, kapcsolóval a felváltottakat is; a gráfon is látszik (ADR-elv).
- A változás mezői: cím, honnan, probléma, keret, kihagyjuk, mérföldkő · `d-change-fields` · döntés · hiányzik · C-2
  Claude tölti ki az interjúban a válaszokból (a keret = az interjú mérete); a lapon élőben látszik és átírható. A kihagyjuk jóváhagyáskor a Spec nem céljai közé kerül.
- Az interjút Claude méretezi a változáshoz, az ember bármikor lezárhatja (jó így) · `d-interview-size` · döntés · hiányzik · C-3
  Elején megmondja, kicsi (2–3 kérdés) vagy nagy (több kör); a legfontosabb kérdéssel kezd. Lezáráskor a nyitva maradt kérdések a változáson látszanak.
- Az interjú a Claude Code chatben zajlik, a változás lapja élőben töltődik · `d-interview-chat` · döntés · hiányzik · C-3
  Indítás a változás lapjáról (kész prompt) vagy a chatből; Claude kérdésenként javaslatot ad; a lapon a nyitott kérdések és a javasolt elemek célhellyel látszanak.
- Minden munka változás: az egyenesen jegy út is minimális változást hoz létre · `d-all-work-is-change` · döntés · hiányzik · C-3
  Grilling és spec-elem nélkül, csak egy jeggyel; így a mérföldkő, az áttekintés és a hol tart? kivétel nélkül változásokat számol.

## Ötlettől a produktumig {#t-pipe}

A Groundwork egy cső: az egyik végén bejön egy ötlet, a másikon kijön a produktum, legyen az szoftver, rendszerterv vagy szolgáltatás. Segédeszköz a cél eléréséhez: bármikor látszik, mi készül és hol tart, és ebből tervezni és bemutatni is lehet. A csövek egymásba fűződnek: egy alapötletből rendszerterv lesz, a tervből megvalósítás, és mindkettőhöz jöhetnek újabb ötletek.

A korábbi modell gyökérhibája az volt, hogy az ötletnek a terv szerkezetében kellett helyet keresnie, mielőtt kidolgozták volna; sok dokumentumnál ez önkényes helyre vitte (az első PRD-be), és egy nagy térképen a jó helyet keresgélni sem lehetett. Ezért két dolgot külön tartunk nyilván: a **Specet**, ami most igaz, és a **változásokat**, ami most alakul (a kutatás alapján, OpenSpec-mintára).

Az ötletnél az ember csak dönt: elfogadja, elveti, szundiztatja vagy duplikátumnak jelöli, és elfogadáskor utat választ (Grilling vagy Egyenesen jegy). Az elfogadott ötletből azonnal egy változás (C-n) lesz. Az interjú ezt tölti meg: Claude kérdez, a válaszokból javasolt Spec-elemek lesznek, mindegyik mellett egy javasolt célfejezettel. A hely tehát az utolsó lépés, elemenként, egy rövid jóváhagyó listán (Elfogad · Máshová… · Új rész), és ugyanígy működik egy és húsz dokumentummal. Jóváhagyáskor az elemek egyszerre olvadnak be a Specbe, eredetként a változás azonosítójával; a Spec tartalma csak így változik, a megfogalmazása közvetlenül is javítható. A szakaszokat senki nem állítja kézzel: a kapcsolatokból számolódnak, és mindig oda mutatnak, ahol a munka tart.

- A Groundwork egy cső: ötlet be, produktum ki, közben látszik, hol tart · `d-pipe` · döntés · hiányzik · C-3
  Segédeszköz a cél eléréséhez: látszik, mi készül és hol tart; tervezni és bemutatni lehet belőle.
- Egy projekt egy Spec: a produktum jóváhagyott leírása · `d-map-is-product` · döntés · hiányzik · C-3
  Szoftver, rendszerterv, szolgáltatás vagy bármi más; ami a Specben van, az készül, a megvalósítási állapot mutatja, mennyi épült meg.
- Két dolgot tartunk nyilván: a Specet (ami most igaz) és a Változásokat (ami most alakul) · `d-spec-change` · döntés · hiányzik · C-3
  A gyökérhiba az volt, hogy az ötletnek a szerkezetben kellett helyet keresni, mielőtt kidolgozták volna (OpenSpec: specs + changes).
- A változásnak saját azonosítója van (C-n); ötletek és változások hivatkoznak egymásra · `d-change-own-id` · döntés · hiányzik · C-3
  Alapból egy elfogadott ötletből azonnal egy változás lesz; később más ötlet hozzácsatolható, egy nagy változás kettévágható.
- Változás ötlet nélkül is indulhat (grillingből, munka közben) · `d-change-without-idea` · döntés · hiányzik · C-3
- A spec tartalma csak változáson át módosul, a megfogalmazása közvetlenül is · `d-spec-via-change` · döntés · hiányzik · C-3
  Ami azt változtatja, mit építünk (elem be, módosul, ki), az változás; elírás, pontosítás, átrendezés közvetlenül. Kézi tartalmi szerkesztésnél a felület felajánlja a változás nyitását.
- Minden Specet érintő változás interjún (grillingen) megy át · `d-grilling-always` · döntés · hiányzik · C-3
  Döntés a Specbe csak interjúból születik; a mérete a változáshoz igazodik (d-interview-size).
- A lánc: ötlet (Ideas) → változás (Changes) → Spec-elemek (Spec) → jegyek (Tickets) · `d-three-loops` · döntés · hiányzik · C-3
  Az ötlet a születésétől a döntésig él; onnan a változás viszi tovább. Hivatkozások: a változás az ötleteire, az elem a változására (change: C-n), a jegy a változására és az elemeire (**Change:**, **Spec:**). A megvalósítás közben született új ötlet elölről kezdi.
- A szakaszok a kapcsolatokból számolódnak, nem kézzel állítják · `d-stage-derived` · döntés · hiányzik · C-3
  Változás: Grilling (nyitott kérdések) → Jóváhagyásra vár → Megvalósítás (x/n elem kész) → Kész (minden eleme kész). Az ötlet a döntéssel lezárul; a kártyáján a változásai szakasza látszik.
- Kutatás: ötlettől a produktumig (Shape Up, Torres, Linear, OpenSpec, Shneiderman…) · `n-research-flow` · jegyzet · hiányzik · C-3
  <docs/product/research/idea-to-product-flow.md>
- Az ötlet az első PRD-be kerül · `x-first-prd` · kizárt · hiányzik · C-3
  Több PRD-nél önkényes hely.
- PRD-nkénti célpontok a Kidolgozásra oszlopban · `x-per-prd-targets` · kizárt · hiányzik · C-3
  Az Ideasnak nem kell ismernie a térkép szerkezetét; 20 PRD-nél 20 célpont lenne.
- Beérkezett tálca a térképen, az ötletre egy céldokumentum, abban Ötletek fejezet · `x-inbox-doc` · kizárt · hiányzik · C-3
  A hely túl korán és túl durván dőlne el, és minden dokumentumban Ötletek fejezet nőne (kutatás, 3. döntés).
- A változások sorrendben olvadnak be: egy jóváhagyás egy változás, és a függő célhelyű nem hagyható jóvá · `d-merge-in-order` · döntés · hiányzik · C-5
  Ha egy elem célhelye egy még be nem olvasztott változás eleme, a lap kiírja, melyik változásra vár, és a Jóváhagyás addig nem megy. Így minden beolvasztás egy átnézett változás, és a Specben nincs árva célhely.
- A jóváhagyás a függő változásokat is beolvasztja, láncban · `x-merge-chain` · kizárt · hiányzik · C-5
  Olyan változások is beolvadnának, amelyeket az ember külön nem nézett át.
- Az elem beolvad, és a még nem létező célhelyre várakozik · `x-merge-pending` · kizárt · hiányzik · C-5
  Félkész Specet hagyna, árva célhelyekkel.
- Egy már Megvalósítás alatt álló változás ugyanazzal a jóváhagyó listával olvad be, az állapota nem változik · `d-merge-implementing` · döntés · hiányzik · C-5
  A C-5 előtt jóváhagyott változások (C-3, C-4) elemei a beolvasztásra várnak; a jóváhagyás és a beolvasztás egy út marad, visszaléptetés nélkül.
- A Megvalósítás alatt álló változást előbb vissza kell tenni Jóváhagyásra vár állapotba · `x-merge-reapprove` · kizárt · hiányzik · C-5
- A grilling zárásánál Claude szeletelést javasol, az ember a chatben hagyja jóvá · `d-slice-at-close` · döntés · hiányzik · C-5
  Amikor elfogynak a kérdések, Claude megmondja, hogy a változás egyben marad, vagy több, egymásra épülő szeletre vágja. Minden szelet saját változás lesz, saját jóváhagyó listával, és a sorrend szabálya szerint olvad be (d-merge-in-order). A szeletelés gondolkodás, ezért a beszélgetésben dől el; a groundwork-prd-maker zárása ezzel a lépéssel bővül.
- Az ember a jóváhagyó listán elemenként sorolja szeletbe a javasolt elemeket · `x-slice-on-list` · kizárt · hiányzik · C-5
- Egy változás akkor van beolvasztva, ha minden eleme ott van a Specben ezzel a változással az eredetében · `d-merged-computed` · döntés · hiányzik · C-5
  Nem kell hozzá mező vagy állapot: az igazság a Specben van, mint a szakaszé a nyitott kérdésekben. A történetbe egy merged sor kerül, az embernek. Ha valaki kézzel kivesz egy elemet, a változás újra beolvasztatlan.
- A beolvasztás egy merged: dátum mező a változás fejlécében · `x-merged-field` · kizárt · hiányzik · C-5
  Egy kézzel tartott mező elcsúszhat a Spec valóságától.
- A beolvasztás mind vagy semmi: hiba esetén semmi nem változik, és a lap a hibás sorok mellett mondja meg, mi a baj · `d-merge-atomic` · döntés · hiányzik · C-5
  Félig beolvasztott változás nem maradhat: a beolvasztottság számolása és a sorrend szabálya is elakadna rajta.
- Ami beírható, beíródik, a hibás elemek a változásban maradnak · `x-merge-partial` · kizárt · hiányzik · C-5
- A Jóváhagyás a beolvasztással együtt Megvalósításba viszi a Jóváhagyásra vár változást · `d-approve-implements` · döntés · hiányzik · C-5
  A jóváhagyás és a megvalósításra jóváhagyás ugyanaz a döntés; egy második gomb csak egy újabb állapotot hozna. Ami már Megvalósítás alatt áll (C-3, C-4), az marad.
- A hely az utolsó lépés, elemenként: a rendszer célfejezetet javasol, az ember jóváhagyja · `d-place-on-map` · döntés · hiányzik · C-5
  Jóváhagyó lista: Elfogad · Máshová… (kereshető lista); új részt Claude javasol a chatben (d-approve-list-actions). Keresgélni a térképen nem kell.
- Az ember a térképen húzza a helyére az ötletet · `x-drag-place` · kizárt · hiányzik · C-5
  Nagy térképen keresgélés; már 285 csomópontnál is használhatatlan.
- A változás elemei egyszer, az interjú végén, egy jóváhagyó lépésben olvadnak be a Specbe · `d-merge-on-approval` · döntés · hiányzik · C-5
  A jóváhagyó listán dől el minden elem helye; beolvasztva hiányzik állapottal kerülnek a specbe, utána jönnek a jegyek. A spec a tervezett produktum, a megvalósítási állapot mutatja, mi épült meg (az OpenSpec-kel ellentétben nem a megvalósítás után).
- A beolvasztott elem eredete a változások listája, amelyek hozták vagy módosították (· C-1, C-7); az ötleteket a változás tudja · `d-idea-dissolves` · döntés · hiányzik · C-5
  Egy későbbi módosítás (change) a végére fűzi a saját azonosítóját, így a legutolsó áll hátul. Egy elemről a Specben ránézésre látszik, mely változások formálták, és mindegyik a változás lapjára visz, a miértekkel.
