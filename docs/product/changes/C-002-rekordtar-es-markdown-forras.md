---
id: C-2
title: Rekordtár és Markdown-forrás
ideas: I-5
milestone: M-9
status: implementing
---

## Probléma

Az ötletek, a térkép és a jegyek külön tárolódnak, egy nagy mindmap.json a forrás, és amit a csapattárs vagy egy agent a generált Markdownban átír, az csendben elvész. Minden további lépés (változások, Spec munkaterület, jegyek) egy közös rekordtárra épülne, ami még nincs.

## Megoldás

Közös rekordtár a Magban: minden rekord és Spec-dokumentum egyetlen Markdown-fájl, és ez a forrás; kanonikus író és türelmes olvasó, index a .groundwork/ alatt, record check és record renumber. A groundwork migrate a régi térképből C-1 Kiinduló állapotot, a további változásokat és az M-1…M-9 mérföldköveket írja; az Ötletek a tárra költöznek; a Plan térképe ideiglenesen a tárból olvas és ír. Fejlesztési időben JSDoc-típusok és tsc --noEmit.

## Keret

A rekordmodell (rekordtípusok, közös mezők, Spec-szerkezet), a Rekordtár műszaki terve, a típusellenőrzés. Elöl, mert ez a legkockázatosabb (türelmes olvasó, átállás), és minden más erre épül; a régi felület még az új adatokon fut.

## Kihagyjuk

Jóváhagyó lista és beolvasztás (C-3), Spec munkaterület és Lit (C-4), jegyek, futószalag és felzárkózás (C-5).

## Kérdések

## Javasolt elemek

- add `t-records` → `system` — Rekordmodell
  A Groundwork rekordtípusokra épül, ahogy egy ServiceNow-szerű rendszer: ötlet (I-n), változás (C-n), mérföldkő (M-n), rész, dokumentum, Spec-elem és jegy, mellettük az eszközök rekordjai (vázlat, agent-futás, diasor). Mindegyiknek van azonosítója, életciklusa, típusos hivatkozásai és története, így a „hol tart?” kérdésre mindig ugyanúgy felelünk. Minden munka változás: az egyenesen jegy út is egy minimális változást hoz létre, és a projekt kezdete is az (új projektnél az első ötletből, meglévő kódnál a Kiinduló állapotból).

  A munkaterületek ezek nézetei: **Overview | Ideas → Changes → Spec → Tickets | Sketch · Present**. Az Overview egy futószalag (Ötletek → Grilling → Jóváhagyásra vár → Megvalósítás → Kész), amelyen a változások haladnak; az állomásokra kattintva a munkapadjuk nyílik, a torlódást WIP-limit jelzi. A Spec nem állomás, hanem a tervrajz-tár: az egész és egy szint rész, mindegyiknek a típusa szerinti dokumentumai; nyitólapja egy részek × dokumentumfajták mátrix, a térkép csak lencse. A felülírt Spec-sor felváltva jelet kap, nem tűnik el.

  Az interjú (grilling, magyarul Interjú) a Claude Code chatben zajlik, a változás lapja közben élőben töltődik a mezőkkel (cím, honnan, probléma, keret, kihagyjuk, mérföldkő), a nyitott kérdésekkel és a javasolt elemekkel; méretét Claude igazítja a változáshoz, és az ember bármikor lezárhatja. Később a lapról is lehet majd válaszolni. Minden rekord lapján egy kis gráf mutatja a láncát (miből lett, mi lett belőle), mérföldkövenként egy nagyobb is. A jegyen kötelező a változás (**Change:**), és ha Spec-elemet valósít meg, az elemek (**Spec:**).
- add `d-record-model` → `system#t-records` — A Groundwork rekordtípusokra épül; a modulok ezek nézetei (munkaterületek) · döntés · hiányzik
  Mint a ServiceNow-ban (Idea, Demand, Change Request, CMDB); nem a meglévő modulokból indulunk ki.
- add `g-record-types` → `system#t-records` — **Rekordtípusok** · hiányzik
- add `d-rec-idea` → `system#g-record-types` — Ötlet (I-n): New → Considering → Accepted / Rejected / Snoozed / Duplicate · döntés · hiányzik
- add `d-rec-change` → `system#g-record-types` — Változás (C-n): Grilling → Jóváhagyásra vár → Megvalósítás → Kész / Elvetve · döntés · hiányzik
  A grilling magyar felirata: Interjú.
- add `d-rec-part` → `system#g-record-types` — Rész (a mai összetevő): aktív / kivezetett · döntés · hiányzik
- add `d-rec-doc` → `system#g-record-types` — Dokumentum: egy rész (vagy az egész) fejezetekre bontott leírása · döntés · hiányzik
- add `d-rec-item` → `system#g-record-types` — Spec-elem: érvényes / felváltva; megvalósítás: hiányzik → részben → kész · döntés · hiányzik
- add `d-rec-tools` → `system#g-record-types` — Eszköz-rekordok (vázlat, agent-futás, diasor) bármire hivatkozhatnak · döntés · hiányzik
- add `d-rec-milestone` → `system#g-record-types` — Mérföldkő (M-n): változások csoportja, haladása a változásaiból számolódik · döntés · hiányzik
  Egy változás legfeljebb egy mérföldkőhöz tartozik; a jegyek a változásukon át számítanak. Tervezett → Folyamatban → Kész; átvihető változás, a történetben látszik.
- add `d-rec-common` → `system#t-records` — Minden rekordban közös: azonosító, típus, életciklus-állapot, típusos hivatkozások, történet · döntés · hiányzik
  A hol tart? mindig ugyanúgy válaszolható: a rekord állapota és a hivatkozásai.
- add `p-rec-goal` → `system#t-records` — Cél / Kimenet rekordtípus · félretett · hiányzik
- add `d-spec-structure` → `system#t-records` — A Spec: az egész és egy szint rész; mindegyiknek a típusa szerinti dokumentumai · döntés · hiányzik
  Sima terméknél nincs rész, csak az egész (PRD, TECH): a mátrix egy sor. Az Új rész a jóváhagyó listán új sort hoz a típusához illő üres dokumentumokkal. Alrészek később, ha kellenek.
- add `p-subparts` → `system#t-records` — Alrészek (rész a részben) · félretett · hiányzik
- add `d-start-is-change` → `system#t-records` — A kezdet is változás: új projektnél az első ötletből C-1, meglévő kódnál C-1 Kiinduló állapot · döntés · hiányzik
  Új projektnél a grilling a szerkezetet (részek, dokumentumok) is javasolja; meglévő kódnál kódból jelölésű elemeket megvalósítási állapottal. Így a Spec minden eleme változásból születik.
- add `d-superseded` → `system#t-records` — A felülírt vagy kivett Spec-sor felváltva jelet kap (felváltotta: C-n), nem tűnik el · döntés · hiányzik
  A dokumentum alapból csak az érvényes sorokat mutatja, kapcsolóval a felváltottakat is; a gráfon is látszik (ADR-elv).
- add `d-change-fields` → `system#t-records` — A változás mezői: cím, honnan, probléma, keret, kihagyjuk, mérföldkő · döntés · hiányzik
  Claude tölti ki az interjúban a válaszokból (a keret = az interjú mérete); a lapon élőben látszik és átírható. A kihagyjuk jóváhagyáskor a Spec nem céljai közé kerül.
- add `records` → `parts` — Rekordtár · software · Az I-5 műszaki terve: a rekordok tárolása, a munkaterületek és az átállás.
- add `records/tech` → `records` — Groundwork — Rekordtár: Műszaki terv
- add `t-rec-arch` → `records/tech` — Architektúra és komponensek
  A Groundwork rekordtípusokra épül (t-records), ezért a rekordokat egyetlen közös tár kezeli a Magban. A tár nem felhasználói funkció, hanem infrastruktúra, mint a szerver vagy az élő frissítés: a modulok a manifestjükben jelentik be, milyen rekordtípust hoznak, a tár pedig olvassa, írja és számozza őket, betartatja a szabályaikat, és a hivatkozásokat mindkét irányban ismeri.

  Így a „hol tart?” kérdésre minden rekordnál ugyanúgy van válasz: a rekord állapota és a hivatkozásai, egy helyről. A munkaterületek (Áttekintés, Ötletek, Változások, Spec, Jegyek) ennek a tárnak a nézetei; a böngésző a `/api/records` felületen, Claude a `groundwork record` parancson át éri el, a forrás pedig mindig a `docs/product/` alatti Markdown.
- add `d-rec-store-core` → `records/tech#t-rec-arch` — Közös rekordtár a Magban; a munkaterületek a nézetei · döntés · hiányzik
  A modulok a manifestben jelentik be a rekordtípusaikat (előtag, mappa, életciklus); a tár olvas, ír, számoz és mindkét irányban ismeri a hivatkozásokat. Felülete: /api/records a böngészőnek, groundwork record … Claude-nak. Infrastruktúra, nem felhasználói funkció, így a Mag-elv (d-core-role) marad.
- add `x-rec-per-module` → `records/tech#t-rec-arch` — Minden munkaterület maga tárolja a rekordjait · kizárt · hiányzik
  A hol tart? válaszhoz az egész gráfot minden nézetnek végpontokból kellene összeraknia.
- add `t-rec-data` → `records/tech` — Adatok és tárolás
  Minden a projekt `docs/product/` mappájában él, gitben. Az első szint a modellt mutatja: minden rekordtípusnak saját mappája van (`ideas/`, `changes/`, `milestones/`), a Specnek is (`spec/`), az eszköz-rekordok pedig a maguk helyén maradnak (`sketches/`, `decks/`). Így egy rész neve soha nem ütközik rekordmappával.

  Minden rekord és minden Spec-dokumentum egyetlen Markdown-fájl, és ez maga a forrás. A szerkezet (fejezetek, elemek, állapot, megvalósítás, eredet, célhely) olvasható jelölésekben van benne, kanonikus formában, amelyet a tár ír és visszaolvas. Ennek oka a vegyes csapat: aki a Groundworkot nem használja (egy csapattárs, egy agent, egy CI-lépés), az a Markdownt látja és azt szerkeszti, és ezzel a forrást szerkeszti, nem egy másolatot. Szétcsúszni így nincs mi. A tár türelmesen olvas: ami nem illik a kanonikus formába, emberi szövegként megmarad, a következő eszközös írás csak a formát igazítja. Gépi JSON csak gyorsítótárként él a `.groundwork/` alatt, gitben nincs.

  A skillek (`implement`, `implement-spec`) ugyanezt a Markdownt olvassák. Minden elem mellett ott az azonosítója, hogy egy jegy `**Spec:**` sora egyetlen kereséssel a helyére találjon. Az `implement-spec` „spec”-je pedig nem a teljes Spec, hanem egy változás fájlja, amely a `to-spec` sablon szerkezetével önmagában olvasható specifikáció; a jegyei rá hivatkoznak.
- add `d-rec-layout` → `records/tech#t-rec-data` — Rekordtípusonként és a Specnek külön gyökérmappa a docs/product/ alatt · döntés · hiányzik
  ideas/, changes/, milestones/, spec/ (a Spec dokumentumai, pl. spec/core/TECH.md), sketches/, decks/. Rész neve így nem ütközhet rekordmappával; az első szintről látszik a modell.
- add `x-rec-layout-old` → `records/tech#t-rec-data` — A generált dokumentumok a mai helyükön, a rekordok egy records/ alá · kizárt · hiányzik
  Egy ideas vagy changes nevű rész ütközne; ma emiatt van az ideas/items/.
- add `x-rec-spec-one` → `records/tech#t-rec-data` — Egy közös Spec-fájl (mint a mindmap.json) · kizárt · hiányzik
  300 csomópont fölött nehezen olvasható diff, ágakon mindig ütközik.
- add `d-rec-skills-read-md` → `records/tech#t-rec-data` — A skillek (implement, implement-spec) ugyanazt a Markdownt olvassák, ami a forrás · döntés · hiányzik
  Minden elem mellett ott az azonosítója (pl. `d-npm`), így egy **Spec:** sor grep-pel megtalálható.
- add `d-rec-change-is-spec` → `records/tech#t-rec-data` — Az implement-spec specje a változás fájlja · döntés · hiányzik
  changes/C-007-….md önmagában olvasható, a to-spec sablon szerkezetével: fejlécben cím, ötletek, mérföldkő; törzsben probléma, megoldás, keret, kihagyjuk, kérdések, a javasolt elemek (op, azonosító, → cél), jegyek. Indítás: /implement-spec docs/product/changes/C-007-….md; a jegyek **Change:** C-7-tel mutatnak rá.
- add `d-rec-flat` → `records/tech#t-rec-data` — Az ötlet és a mérföldkő a legegyszerűbb eset: fejléc és leírás · döntés · hiányzik
  Ahogy ma az ötletek.
- add `d-rec-derived-not-stored` → `records/tech#t-rec-data` — Ami számolható, az nem kerül a fájlokba: szakasz, haladás, jegylista, gráf, visszafelé hivatkozás · döntés · hiányzik
  A fájlban csak tény áll (döntés, állapot, eredet); a számolt adat a nézetekben és a record show kimenetében. Így az eszköz nélkül dolgozó sem lát elavult számot. A változás .md-je a jegyekre csak keresési szabályt ír: a jegyek: **Change:** C-7.
- add `d-rec-md-source` → `records/tech#t-rec-data` — Minden rekord és Spec-dokumentum egyetlen Markdown-fájl, és ez a forrás · döntés · hiányzik
  Egy igazság, egy fájl: aki eszköz nélkül szerkeszt (ember vagy agent), a forrást szerkeszti, a Groundwork utána olvas. A szerkezet olvasható jelölésekben, kanonikus formában (fejezet {#t-…}, elemsor `d-…` · állapot · megvalósítás · C-n, alatta jegyzet és link).
- add `d-rec-tolerant` → `records/tech#t-rec-data` — Türelmes olvasó: ami nem olvasható vissza, emberi szövegként megmarad · döntés · hiányzik
  Az eszközös írás normalizálja a formát, de tartalmat nem dob el; a record check megmutatja a nem kanonikus sorokat.
- add `d-rec-cache` → `records/tech#t-rec-data` — JSON csak gyorsítótár és index a .groundwork/ alatt, gitben nincs · döntés · hiányzik
  Bármikor újraépül a Markdownból.
- add `x-rec-json-source` → `records/tech#t-rec-data` — JSON-forrás és mellette generált Markdown · kizárt · hiányzik
  Két fájl egy igazságra: aki a Groundworkot nem használja (csapattárs, agent), a .md-t írja át, és a JSON csendben elavul; a hash csak jelezni tudja.
- add `x-rec-ci-forbid` → `records/tech#t-rec-data` — JSON-forrás, a .md kézi szerkesztését a CI tiltja · kizárt · hiányzik
  Az eszközt nem használókra kényszerítene egy szabályt, amit nem ismernek.
- add `d-rec-spec-per-doc` → `records/tech#t-rec-data` — A Spec dokumentumonként egy fájl: spec/<rész>/<FAJTA>.md, az egészé spec/SYSTEM.md · döntés · hiányzik
  Két ágon csak azonos dokumentum ütközik; a beolvasztás több fájlt ír egy lépésben.
- add `d-rec-parts-file` → `records/tech#t-rec-data` — A részek listája: spec/parts.md, soronként egy rész · döntés · hiányzik
  Név, slug, típus, egymondatos leírás, aktív / kivezetett.
- add `t-rec-mixed` → `records/tech` — Vegyes csapat: munka a Groundwork nélkül
  A Groundworkos projektben is dolgozhat olyan ember vagy agent, aki az eszközt nem használja. Ő a Markdownt látja: olvassa, szerkeszti, kódot ír, jegyet nyit vagy nem nyit. Mivel a Markdown a forrás, ettől semmi nem csúszik szét, de keletkezhet olyan munka, ami a láncon kívül esik: tartalmi Spec-módosítás változás nélkül, megvalósítás a Spec frissítése nélkül, árva jegy. A fájlokban ezért csak tény áll; ami számolt (szakasz, haladás, jegylista), az a nézetekben él, így elavult számot senki nem lát.

  Amikor a Groundwork újra megnyílik, a tár a legutóbb látott commit óta történteket nézi meg. Ha az eszközön kívül változott valami, Claude felzárkózás-változást javasol: egyetlen változást, amely a kívülről jött módosításokat, az eltérő megvalósítási állapotokat és az árva jegyeket rendezi, és amelyet az ember ugyanúgy hagy jóvá, mint bármely más változást. A Spec így a Groundwork nélküli időszak után is csak változáson át módosul, és a történetben látszik, melyik rész volt felzárkózás.

  A `groundwork record check` szerver nélkül is fut, így pre-commit hookként vagy CI-lépésként bárki gépén jelezheti a minőségi hibákat, akkor is, ha ő maga a Groundworkot nem használja.
- add `n-rec-mixed-risks` → `records/tech#t-rec-mixed` — Kockázatok, ha valaki a Groundwork nélkül dolgozik · jegyzet · hiányzik
  Kód a Spec frissítése nélkül (hamis megvalósítási állapot); Spec-tartalom változás nélkül (eredet nélküli elem, nyomtalan törlés); jegy **Change:** nélkül; szabad formázás, új fájl, átnevezés; ötlet a láncon kívül.
- add `d-rec-check` → `records/tech#t-rec-mixed` — groundwork record check: szerver nélkül is fut, hibánál nem nullával lép ki · döntés · hiányzik
  Ismeretlen id egy jegyen, kettőzött szám, árva hivatkozás, nem kanonikus sor. Az init felajánlja pre-commit hookként vagy CI-lépésként, jóváhagyással.
- add `t-rec-ids` → `records/tech` — Azonosítók és hivatkozások
  Az ügy-rekordok (ötlet, változás, mérföldkő) folyamatos sorszámot kapnak az előtagjukkal, és egy szám soha nem használódik újra. A fájlnév a számot és egy olvasható slugot visel, de az azonosító a fejlécben is ott van, így egy átnevezés semmit nem tör el.

  A Spec azonosítói olvashatók: a rész a slugja, a dokumentum a rész és a fajta, az elem a mai `d-…`, `f-…` alakú id. Az elem azonosítója már a javasolt változásban megszületik, így a jegyek a beolvadás előtt is hivatkozhatnak rá, és mivel a felváltott elem megmarad, egy id soha nem jelent mást, mint amit egyszer jelentett.

  Minden hivatkozás egyszer van leírva: azon a rekordon, amelyik később született, a forrása felé (a változás az ötleteire, az elem a változására, a jegy a változására és az elemeire). A másik irányt a tár indexe számolja, így eszköz nélküli szerkesztés után sincs mit összehangolni. A rekord típusát az azonosító alakja adja.

  Két ágon születhet azonos szám. Ezt a `record check` jelzi, a `record renumber` pedig kézi indításra javítja, a hivatkozásokkal együtt; a GitHubon élő jegyekhez csak listát ad, mert azokat nem írja.
- add `d-rec-ids-case` → `records/tech#t-rec-ids` — I-n, C-n, M-n: folyamatos, soha újra nem használt sorszám · döntés · hiányzik
  Fájlnévben háromjegyű kitöltéssel és sluggal (C-007-sketch-bongeszo.md), hivatkozásban kitöltés nélkül (C-7). Az azonosító a fejlécben is áll, így az átnevezés nem változtatja.
- add `d-rec-ids-spec` → `records/tech#t-rec-ids` — Spec: rész = slug (core), dokumentum = rész/fajta (core/tech, az egészé system), elem = olvasható id · döntés · hiányzik
  Az elem-id (d-…, f-…, t-…) az egész Specben egyedi és újra nem használható, mert a felváltott elem megmarad. A javasolt elem már a változásban megkapja, így a jegy beolvadás előtt is hivatkozhat rá.
- add `d-rec-renumber` → `records/tech#t-rec-ids` — Ütközés két ágon: a record check jelzi, a record renumber javítja, kézi indításra · döntés · hiányzik
  Az újabb kap új számot; a rá mutató hivatkozások a docs/product/ alatt és a helyi jegyekben átíródnak, a GitHub-jegyek átírandó sorait kilistázza.
- add `d-rec-links-once` → `records/tech#t-rec-ids` — Minden hivatkozás egyszer áll: a később született rekordon, a forrása felé · döntés · hiányzik
  Változás fejlécében ideas: I-5, milestone: M-2; Spec-elemsoron C-7 (felváltásnál felváltotta: C-9); jegyen **Change:** és **Spec:**; vázlat és diasor a saját helyén; ötleten duplicate: I-3. A típust az id alakja adja (I-, C-, M-, #, Spec-id, vázlatnév).
- add `d-rec-links-reverse` → `records/tech#t-rec-ids` — A visszafelé irányt a tár indexe számolja, sehová nem írja · döntés · hiányzik
  Mi lett az ötletből, a változás elemei, mely jegyek dolgoznak egy elemen. Az ötlet links: mezője csak szabad lásd még hivatkozás marad.
- add `x-rec-links-both` → `records/tech#t-rec-ids` — Kétirányú tárolás · kizárt · hiányzik
  Elcsúszik, főleg eszköz nélküli szerkesztésnél.
- add `t-rec-history` → `records/tech` — Történet
  Minden ügy-rekord (ötlet, változás, mérföldkő) maga mondja el a saját életét: a fájl végén egy Történet lista áll, amelyhez a tár minden életciklus- és hivatkozásváltáskor egy sort ír. Ez a git nélkül is olvasható, és nem tűnik el, ha a commitokat összevonják; a részletes szöveges diff ettől még a gitben marad.

  A Spec-elemnek nincs külön listája: az elemsoron áll az eredete, az őt később érintő változások és, ha felváltották, a felváltó változás. A Spec teljes története így a változások sora, mert minden változás fájlja a beolvasztás után is megtartja, mit javasolt és hová került. Ha valaki eszköz nélkül vált állapotot, a felzárkózás veszi észre, és javasol hozzá történetsort.
- add `d-rec-history-section` → `records/tech#t-rec-history` — Az ügy-rekord fájljának végén ## Történet lista, a tár írja hozzá · döntés · hiányzik
  Minden életciklus- és hivatkozásváltáskor egy sor: dátum · ki · mi történt (pl. 2026-10-22 · human · jóváhagyva, beolvasztva (4 elem)). Eszköz és git nélkül is olvasható, és a squash-commit sem viszi el.
- add `d-rec-history-item` → `records/tech#t-rec-history` — A Spec-elem története az elemsoron: eredet, érintő változások, felváltotta · döntés · hiányzik
  Pl. C-7, C-12 · felváltotta: C-15. A Spec teljes története a változások sora: a változás fájlja a beolvasztás után is megtartja, mit javasolt és hová került.
- add `x-rec-history-git` → `records/tech#t-rec-history` — Történet csak a gitből · kizárt · hiányzik
  Életciklus-eseményt nem mond, squash után elvész; a részletes diff ettől még a gitben marad.
- add `x-rec-history-log` → `records/tech#t-rec-history` — Központi eseménynapló a docs/product/ alatt · kizárt · hiányzik
  Ágakon állandóan ütközne.
- add `t-rec-workspaces` → `records/tech` — Munkaterületek és a mai modulok
  A munkaterületek a rekordtár nézetei, és nem a mai modulhatárokat követik. A Plan eredetileg arra készült, hogy egy ködös ötletből Claude-dal közösen gondolatokat építsünk; ennek a helye most a változás, mert ott formálódik az, ami még nem igaz. Ezért a gondolattérkép a változás saját felülete: a gyökere az ötlet, az ágain gondolatok, kérdések, lehetőségek és döntések nőnek, és ami beérik, abból javasolt elem lesz célhellyel. A térkép így kicsi marad, mert egy változásé.

  A nagy képet a Spec adja, de nem a teljes, részletes térképpel. A Spec nyitólapja az Összkép: a produktum célja, a részei egy-egy mondattal, részenként néhány fő képesség és a rajtuk dolgozó változások, legfeljebb 30–40 csomóponton. A rész leírása és a fő jelölés is Spec-tartalom, ezért változáson át frissül, és Claude a jóváhagyáskor javasolja. A mátrix a második fül, a részletes térkép egy kattintásra nyílik. Az Összkép kipróbálásra készül: használat közben derül ki, elég-e.

  A Plan modul megszűnik: a térképszerkesztő közös komponens lesz (a Változások szerkesztve, a Spec olvasva használja), a dokumentumgenerálás pedig a Rekordtár kanonikus Markdown író-olvasója. A Build és az Agents egyetlen Jegyek munkaterület lesz, mert az agent mindig jegyen és ágon dolgozik; a Build áttekintője az Áttekintésbe, a dokumentumnézete a Specbe költözik. Az Ötletek modul az új állapotokkal él tovább, és az elfogadás egy lépésben változást nyit. A Vázlat és a Prezentáció eszköz marad.
- add `d-ideas-new` → `records/tech#t-rec-workspaces` — Ötletek: új mappa, új állapotok, az elfogadás változást nyit · döntés · hiányzik
  docs/product/ideas/ (az items/ alól). Állapotok: new · considering · accepted · rejected · snoozed (until:) · duplicate (duplicate: I-3); a to-develop accepted lesz. Csak az ember fogad el, a böngészőben; Claude továbbra is csak new és considering között mozgat. Interjú út: a tár egy lépésben létrehozza a C-n-t (ideas: I-n), elfogadottra állítja az ötletet, mindkettő történetébe ír, és megnyitja a változás lapját kész prompttal. Egyenesen jegy út: minimális változás, a lap a jegyíráshoz ad promptot (**Change:** C-n).
- add `d-ideas-removed` → `records/tech#t-rec-workspaces` — Megszűnik: /api/plan/todo, a from-ideas fejezet, az elvetett ötlet Nem cél-be vitele · döntés · hiányzik
  Ha egy elvetett ötletből nem cél lesz, az egy változás kihagyjuk tétele. Marad: hatás–ráfordítás mátrix, hasonló ötletek, 90 napos régi jelzés, groundwork ideas.
- add `t-rec-int` → `records/tech` — Integrációk és interfészek
  A modulszerződés marad: a modul egy mappa leíróval, nézettel, végpontokkal, írási joggal és skillekkel. Két új mezőt kap: a `records` bejelenti a modul rekordtípusait (előtag, mappa, életciklus és a rájuk vonatkozó szabályok), a `workspace` a modul helyét a fejlécben. A tár a Magé, a típus ismerete a modulé: az Ötletek modul mondja meg, mely állapotok között mozgathat Claude, a tár pedig minden írásnál betartatja.

  A munkaterületek egymás adatait csak a rekordtáron át látják. A mai modulközi végpontok megszűnnek; aki egy rekordot, a hivatkozásait vagy a számolt szakaszát keresi, a `/api/records`-ot kérdezi. A jegy is rekord, de a forrása a jegykezelő marad: a Jegyek modul adja be a tárnak a jegyolvasót, a tár pedig csak olvas.

  Ha egy típus modulja hiányzik, a rá mutató hivatkozás sima azonosítóként látszik, és semmi nem törik el.
- add `d-rec-manifest` → `records/tech#t-rec-int` — Két új manifest-mező: records (bejelentett típusok) és workspace (a fejlécbeli hely) · döntés · hiányzik
  records: előtag, mappa, életciklus és szabályok (pl. Claude csak new ↔ considering között mozgat ötletet); a tár minden írásnál betartatja. A típus ismerete a modulé, a tár a Magé. Sorrend: Áttekintés | Ötletek → Változások → Spec → Jegyek | Vázlat · Prezentáció.
- add `d-rec-api-only` → `records/tech#t-rec-int` — A munkaterületek egymás adatait csak a /api/records-on át látják · döntés · hiányzik
  Rekord, hivatkozások, számolt szakasz. Megszűnik: plan/ids, build/prd, build/ideas, plan/todo, agents/tickets.
- add `d-rec-missing-module` → `records/tech#t-rec-int` — Hiányzó modul: a típusára mutató hivatkozás sima azonosítóként látszik · döntés · hiányzik
  Link és számolás nélkül; semmi nem törik el. A d-module-endpoints helyett ez a működjön a másik nélkül szabály.
- add `x-rec-endpoints-stay` → `records/tech#t-rec-int` — Maradnak a modulközi végpontok, a tár csak az ügy-rekordokat kezeli · kizárt · hiányzik
  A végpontok egyenkénti karbantartása nem skálázódott.
- add `t-rec-migrate` → `records/tech` — Átállás a régi térképről
  Aki a régi, egyetlen térképes Groundworkról áll át, egy paranccsal teszi: a `groundwork migrate` a régi térképből a Spec dokumentumait írja, és minden elemet a C-1 Kiinduló állapot változáshoz köt, a mai megvalósítási állapottal. A fajták megmaradnak; ami eldöntetlen volt, az nem kerülhet a Specbe, ezért nyitott kérdésként egy külön változásba megy, ami pedig egy ötletre mutatott, az az ötlet rekordjában él tovább. Az ütemterv-fejezet döntéseiből mérföldkövek lesznek, a régi jegyek pedig átírás nélkül a C-1-hez tartoznak.

  A parancs kiválasztott ágakat külön, jóváhagyásra váró változásba is tehet. Ebben a projektben ez választja szét a két korszakot: a C-1 az I-5 előtti, nagyrészt megépült Groundwork, a C-2 az újratervezés mai döntései, amelyek egy jóváhagyással, még megvalósítatlanul olvadnak be. Az újratervezés jegyei így már a C-2-re hivatkoznak, és az új modell első változása saját maga.
- add `d-migrate-cmd` → `records/tech#t-rec-migrate` — groundwork migrate: bármely régi mindmap.json-ból C-1 Kiinduló állapot · döntés · hiányzik
  Projektfüggetlen: minden régi csomópont a Spec-be kerül, eredete C-1, a megvalósítási állapot a mai impl szerint; a C-1 beolvasztva, a történetében az átállás sora.
- add `d-migrate-split` → `records/tech#t-rec-migrate` — Kiválasztott ágak külön, jóváhagyásra váró változásba is mehetnek · döntés · hiányzik
  Pl. --split t-pipe,t-records,c-records --as "Újratervezés: rekordmodell és futószalag" --idea I-5: ezek javasolt elemek lesznek a mai helyükkel mint célhellyel, és egy jóváhagyással olvadnak be, hiányzik állapottal.
- add `d-migrate-here` → `records/tech#t-rec-migrate` — Ebben a projektben: C-1 Kiinduló állapot (I-5 előtt) és az újratervezés változásai (ideas: I-5) · döntés · hiányzik
  Az I-5 döntései (t-pipe, t-records, c-records, a Mag stackjének d-lit és d-typecheck döntése és elvetett párjaik) a C-2…C-5 változásokba kerülnek a szállítás sorrendje szerint (d-deliv-split); az újratervezés jegyei ezekre hivatkoznak. Az új modell első változásai saját maguk.
- add `x-migrate-all-c1` → `records/tech#t-rec-migrate` — Minden a C-1-be · kizárt · hiányzik
  A kiinduló állapot jelentése hamis lenne, az újratervezés munkája nem látszana változásként.
- add `d-migrate-kinds` → `records/tech#t-rec-migrate` — Fajták átállása: a döntés, jegyzet, kizárt, félretett Spec-elem lesz C-1 eredettel · döntés · hiányzik
  A topic csoport marad. Az inferred Spec-elem kódból, megerősítésre vár jelöléssel, a Spec listázza. Az ötletre mutató todo elmarad (az ötlet a saját rekordjában él); minden más todo nyitott kérdés egy külön C-n Nyitott kérdések az átállásból változásban, mert a Specben nem lehet eldöntetlen. A from-ideas fejezetek megszűnnek. Emberi bekezdés, jegyzet, link, fejezetszöveg, progress változatlanul átjön.
- add `d-migrate-roadmap` → `records/tech#t-rec-migrate` — Az ütemterv-fejezet döntéseiből mérföldkövek lesznek; a fejezet megszűnik · döntés · hiányzik
  Projektfüggetlenül: a system dokumentum ütemterv-fejezetének (a fajta kezdő fejezete, vagy --roadmap <id>) döntés-elemei M-n mérföldkövek, sorrendben; a félretett elemek Spec-elemek maradnak. Az állapotot (Tervezett, Folyamatban, Kész) Claude javasolja a jegyekből, az ember hagyja jóvá. Itt: M-1…M-7 Kész, M-8 Present Folyamatban (#40–46 nyitott), M-9 Újratervezés a C-2-vel; a p-export Spec-elem marad.
- add `d-migrate-old-tickets` → `records/tech#t-rec-migrate` — Change nélküli, PRD soros, a C-1 előtt született jegy a C-1-hez tartozik · döntés · hiányzik
  A tár szabálya, a jegyeket nem írjuk át (itt 46 GitHub-issue).
- add `x-roadmap-stays` → `records/tech#t-rec-migrate` — Az ütemterv Spec-fejezet marad, mérföldkövek csak az új munkától · kizárt · hiányzik
  Egy dolog két helyen lenne.
- add `t-rec-delivery` → `records/tech` — Szállítás sorrendje
  Az újratervezés négy egymásra épülő változásban érkezik, egy közös mérföldkő alatt, és mindegyik után használható a Groundwork. Először a rekordtár és a Markdown-forrás készül el az átállással együtt, mert ez a legkockázatosabb, és mert minden más erre épül; ekkor a régi felület még az új adatokon fut. Utána a Változások munkaterület hozza el a fő hurkot (ötlet, interjú, jóváhagyás, Spec), így a további két változás már a saját futószalagján megy végig. Harmadikként a Spec munkaterület érkezik az Összképpel, végül a Jegyek és az Áttekintés.

  A Present addig vár: az élő blokkjai a megszűnő végpontokra épülnének, ezért a C-5 után, a rekordtárra írva folytatódik.
- add `d-deliv-split` → `records/tech#t-rec-delivery` — Az újratervezés négy változás egy mérföldkő (M-9 Újratervezés) alatt · döntés · hiányzik
  Az implement-spec egy változást visz végig egy integrációs ágon; egy óriás változás óriás ág lenne. Mindegyik után használható a Groundwork. A szétválasztást a migrate --split előtt Claude javasolja, az ember hagyja jóvá.
- add `d-deliv-c2` → `records/tech#t-rec-delivery` — 1. C-2 Rekordtár és Markdown-forrás · döntés · hiányzik
  Rekordtár a Magban, kanonikus Markdown író-olvasó, index, record check / renumber, migrate (C-1, a további változások, M-1…M-9); az Ötletek a tárra költöznek; a Plan térképe ideiglenesen a tárból olvas és ír. Elöl, mert ez a legkockázatosabb (türelmes olvasó, átállás).
- add `d-deliv-c3` → `records/tech#t-rec-delivery` — 2. C-3 Változások · döntés · hiányzik
  A változás lapja, gondolattérkép a változásban, javasolt elemek célhellyel, jóváhagyó lista és beolvasztás, az új prd-maker skill, elfogadáskor változás az ötletből. Utána a fő hurok működik, és a C-4, C-5 már ezen az úton jöhet.
- add `d-deliv-c4` → `records/tech#t-rec-delivery` — 3. C-4 Spec munkaterület · döntés · hiányzik
  Összkép, mátrix, dokumentum-vázlat, részletes térkép lencseként, Lit-komponensek; a Plan modul megszűnik.
- add `d-deliv-c5` → `records/tech#t-rec-delivery` — 4. C-5 Jegyek és Áttekintés · döntés · hiányzik
  Build + Agents = Jegyek, új jegysorok és Checks, futószalag, mérföldkövek, új fejléc, felzárkózás-változás.
- add `d-deliv-present` → `records/tech#t-rec-delivery` — A Present (M-8) a C-5 után folytatódik, a rekordtárra írva · döntés · hiányzik
  Az élő blokkjai a Build mai végpontjaiból olvasnának, amelyek a C-5-ben megszűnnek; a #40–46 addig vár.
- add `t-rec-sec` → `records/tech` — Biztonság
  A rekordtár a meglévő biztonsági szabályokat viszi tovább: csak a projekt `docs/product/` és `.groundwork/` mappájába írhat, a jegykezelőt (helyi fájlok, GitHub) csak olvassa, és a rekordok Markdownját nyers HTML nélkül jeleníti meg, mert azt eszköz nélkül bárki szerkesztheti.
- add `d-rec-sec-writes` → `records/tech#t-rec-sec` — A tár csak a docs/product/ és a .groundwork/ alá ír; a jegykezelőt csak olvassa · döntés · hiányzik
  A d-sec-write és a modulonkénti writes szerint.
- add `d-rec-sec-html` → `records/tech#t-rec-sec` — A rekordok Markdownja nyers HTML nélkül jelenik meg · döntés · hiányzik
- add `t-rec-test` → `records/tech` — Tesztelés és minőség
  A legkockázatosabb rész a Markdown mint forrás, ezért a C-2 négy tesztréteggel bizonyít, `node --test`-tel. Az oda-vissza tesztek azt mutatják meg, hogy amit a tár ír, azt pontosan visszaolvassa, és a második írás már nem változtat. A türelmes olvasás tesztjei valódi, kézzel vagy agenttel elrontott fájlokon ellenőrzik, hogy tartalom nem vész el, és a hiba látszik. Az átállást ezen a repón próbáljuk ki, a teljes mai térképpel és a régi jegyekkel; végül egy forgatókönyv-teszt a vegyes csapatot játssza el, eszköz nélküli szerkesztéstől a felzárkózásig. Mellette a típusellenőrzés (d-typecheck) a rekordtípusokat és op-okat fogja.
- add `d-rec-test-roundtrip` → `records/tech#t-rec-test` — Oda-vissza: olvas(ír(x)) = x és ír(olvas(ír(x))) = ír(x), bájtra · döntés · hiányzik
  Minden rekordtípusra és Spec-dokumentumra, véletlen generált rekordokon is.
- add `d-rec-test-tolerant` → `records/tech#t-rec-test` — Türelmes olvasás: valódi, kézzel elrontott fájlok gyűjteménye · döntés · hiányzik
  Törölt jelölés, átírt elemsor, szabad bekezdés, git-ütközés jelei, agent által frissített megvalósítás: tartalom nem vész el, a record check pontosan jelez.
- add `d-rec-test-migrate` → `records/tech#t-rec-test` — Átállás ezen a repón: a mai térkép minden adata megvan, a régi jegyek PRD sora ugyanoda talál · döntés · hiányzik
  390 csomópont: id, jegyzet, link, emberi bekezdés, impl; 46 GitHub-jegy.
- add `d-typecheck` → `core/tech#t-core-stack` — JSDoc-típusok és tsc --noEmit ellenőrzés fejlesztési időben · döntés · hiányzik
  A rekordtárban és a modulszerződésben (rekordtípusok, op-ok, manifestek). Csak fejlesztői függőség, a csomagba nem kerül, a kód .mjs marad; az implement skill típusellenőrzése ezt futtatja.
- add `x-server-framework` → `core/tech#t-core-stack` — Szerver-keretrendszer (NestJS, Fastify) · kizárt · hiányzik
  A szerver kicsi, zömmel tartománylogika; a HTTP-réteg nem fáj.
- change `d-sec-write` → `core/tech#t-core-sec` — Írni csak a docs/product/ és a .groundwork/ alá; egyetlen kivétel a kézzel indított record renumber, amely a .scratch/ alatti helyi jegyekben is átírja a hivatkozásokat · döntés · kész
  A kivételt a #50 kéri (core/files.mjs: renumberFiles); más parancs és modul nem nyitja meg, és ugyanazok az útvonal-ellenőrzések védik.

## Jegyek

A jegyek a `**Change:** C-2` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · human · created by migrate from docs/product/mindmap.json (split: t-records, c-records, d-typecheck, x-server-framework; 85 proposed items)
- 2026-10-20 · human · merged; status: awaiting-approval → implementing
