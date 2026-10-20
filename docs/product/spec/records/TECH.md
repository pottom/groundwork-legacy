# Groundwork — Rekordtár: Műszaki terv

_Műszaki terv_

## Architektúra és komponensek {#t-rec-arch}

A Groundwork rekordtípusokra épül (t-records), ezért a rekordokat egyetlen közös tár kezeli a Magban. A tár nem felhasználói funkció, hanem infrastruktúra, mint a szerver vagy az élő frissítés: a modulok a manifestjükben jelentik be, milyen rekordtípust hoznak, a tár pedig olvassa, írja és számozza őket, betartatja a szabályaikat, és a hivatkozásokat mindkét irányban ismeri.

Így a „hol tart?” kérdésre minden rekordnál ugyanúgy van válasz: a rekord állapota és a hivatkozásai, egy helyről. A munkaterületek (Áttekintés, Ötletek, Változások, Spec, Jegyek) ennek a tárnak a nézetei; a böngésző a `/api/records` felületen, Claude a `groundwork record` parancson át éri el, a forrás pedig mindig a `docs/product/` alatti Markdown.

- Közös rekordtár a Magban; a munkaterületek a nézetei · `d-rec-store-core` · döntés · kész · C-2
  A modulok a manifestben jelentik be a rekordtípusaikat (előtag, mappa, életciklus); a tár olvas, ír, számoz és mindkét irányban ismeri a hivatkozásokat. Felülete: /api/records a böngészőnek, groundwork record … Claude-nak. Infrastruktúra, nem felhasználói funkció, így a Mag-elv (d-core-role) marad.
- Minden munkaterület maga tárolja a rekordjait · `x-rec-per-module` · kizárt · C-2
  A hol tart? válaszhoz az egész gráfot minden nézetnek végpontokból kellene összeraknia.
- A beolvasztás a core rekordtárában él; a Changes modul végpontjai az ember nevében hívják · `d-merge-in-core` · döntés · kész · C-5
  A beolvasztás a változás és a Spec közös szabálya (sorrend, mind vagy semmi, eredet), ezért ott él, ahol a rekordtár és a Spec: merge(C-n) együtt írja a változás fájlját és a Spec dokumentumait. A Changes modul két végpontja (Jóváhagyás, Máshová…) a böngészőből jön, így az ember írása; a C-7 válaszai ugyanezen az úton egy harmadik végpontot kapnak.

## Adatok és tárolás {#t-rec-data}

Minden a projekt `docs/product/` mappájában él, gitben. Az első szint a modellt mutatja: minden rekordtípusnak saját mappája van (`ideas/`, `changes/`, `milestones/`), a Specnek is (`spec/`), az eszköz-rekordok pedig a maguk helyén maradnak (`sketches/`, `decks/`). Így egy rész neve soha nem ütközik rekordmappával.

Minden rekord és minden Spec-dokumentum egyetlen Markdown-fájl, és ez maga a forrás. A szerkezet (fejezetek, elemek, állapot, megvalósítás, eredet, célhely) olvasható jelölésekben van benne, kanonikus formában, amelyet a tár ír és visszaolvas. Ennek oka a vegyes csapat: aki a Groundworkot nem használja (egy csapattárs, egy agent, egy CI-lépés), az a Markdownt látja és azt szerkeszti, és ezzel a forrást szerkeszti, nem egy másolatot. Szétcsúszni így nincs mi. A tár türelmesen olvas: ami nem illik a kanonikus formába, emberi szövegként megmarad, a következő eszközös írás csak a formát igazítja. Gépi JSON csak gyorsítótárként él a `.groundwork/` alatt, gitben nincs.

A skillek (`implement`, `implement-spec`) ugyanezt a Markdownt olvassák. Minden elem mellett ott az azonosítója, hogy egy jegy `**Spec:**` sora egyetlen kereséssel a helyére találjon. Az `implement-spec` „spec”-je pedig nem a teljes Spec, hanem egy változás fájlja, amely a `to-spec` sablon szerkezetével önmagában olvasható specifikáció; a jegyei rá hivatkoznak.

- Rekordtípusonként és a Specnek külön gyökérmappa a docs/product/ alatt · `d-rec-layout` · döntés · kész · C-2
  ideas/, changes/, milestones/, spec/ (a Spec dokumentumai, pl. spec/core/TECH.md), sketches/, decks/. Rész neve így nem ütközhet rekordmappával; az első szintről látszik a modell.
- A generált dokumentumok a mai helyükön, a rekordok egy records/ alá · `x-rec-layout-old` · kizárt · C-2
  Egy ideas vagy changes nevű rész ütközne; ma emiatt van az ideas/items/.
- Egy közös Spec-fájl (mint a mindmap.json) · `x-rec-spec-one` · kizárt · C-2
  300 csomópont fölött nehezen olvasható diff, ágakon mindig ütközik.
- A skillek (implement, implement-spec) ugyanazt a Markdownt olvassák, ami a forrás · `d-rec-skills-read-md` · döntés · kész · C-2
  Minden elem mellett ott az azonosítója (pl. `d-npm`), így egy **Spec:** sor grep-pel megtalálható.
- Az implement-spec specje a változás fájlja · `d-rec-change-is-spec` · döntés · kész · C-2
  changes/C-007-….md önmagában olvasható, a to-spec sablon szerkezetével: fejlécben cím, ötletek, mérföldkő; törzsben probléma, megoldás, keret, kihagyjuk, kérdések, a javasolt elemek (op, azonosító, → cél), jegyek. Indítás: /implement-spec docs/product/changes/C-007-….md; a jegyek **Change:** C-7-tel mutatnak rá.
- Az ötlet és a mérföldkő a legegyszerűbb eset: fejléc és leírás · `d-rec-flat` · döntés · kész · C-2
  Ahogy ma az ötletek.
- Ami számolható, az nem kerül a fájlokba: szakasz, haladás, jegylista, gráf, visszafelé hivatkozás · `d-rec-derived-not-stored` · döntés · kész · C-2
  A fájlban csak tény áll (döntés, állapot, eredet); a számolt adat a nézetekben és a record show kimenetében. Így az eszköz nélkül dolgozó sem lát elavult számot. A változás .md-je a jegyekre csak keresési szabályt ír: a jegyek: **Change:** C-7.
- Minden rekord és Spec-dokumentum egyetlen Markdown-fájl, és ez a forrás · `d-rec-md-source` · döntés · kész · C-2
  Egy igazság, egy fájl: aki eszköz nélkül szerkeszt (ember vagy agent), a forrást szerkeszti, a Groundwork utána olvas. A szerkezet olvasható jelölésekben, kanonikus formában (fejezet {#t-…}, elemsor `d-…` · állapot · megvalósítás · C-n, alatta jegyzet és link).
- Türelmes olvasó: ami nem olvasható vissza, emberi szövegként megmarad · `d-rec-tolerant` · döntés · kész · C-2
  Az eszközös írás normalizálja a formát, de tartalmat nem dob el; a record check megmutatja a nem kanonikus sorokat.
- JSON csak gyorsítótár és index a .groundwork/ alatt, gitben nincs · `d-rec-cache` · döntés · kész · C-2
  Bármikor újraépül a Markdownból.
- JSON-forrás és mellette generált Markdown · `x-rec-json-source` · kizárt · C-2
  Két fájl egy igazságra: aki a Groundworkot nem használja (csapattárs, agent), a .md-t írja át, és a JSON csendben elavul; a hash csak jelezni tudja.
- JSON-forrás, a .md kézi szerkesztését a CI tiltja · `x-rec-ci-forbid` · kizárt · C-2
  Az eszközt nem használókra kényszerítene egy szabályt, amit nem ismernek.
- A Spec dokumentumonként egy fájl: spec/<rész>/<FAJTA>.md, az egészé spec/SYSTEM.md · `d-rec-spec-per-doc` · döntés · kész · C-2
  Két ágon csak azonos dokumentum ütközik; a beolvasztás több fájlt ír egy lépésben.
- A részek listája: spec/parts.md, soronként egy rész · `d-rec-parts-file` · döntés · kész · C-2
  Név, slug, típus, egymondatos leírás, aktív / kivezetett.
- A térkép a változás .md-jében él, a Gondolatok szakaszban, beágyazott listaként · `d-map-in-md` · döntés · kész · C-4
  A behúzás adja az ágakat, a sor eleji jel a csomópont típusát. Egy változás egy fájl marad: kézzel írható, a diffje olvasható, és a felvillanás meg a commit óta jelölés ugyanúgy működik rá, mint a lap többi részére.
- Csomóponttípusok: gondolat, kérdés, lehetőség, döntés, megkötés, kihagyjuk · `d-map-types` · döntés · kész · C-4
- A változás nyitott kérdései a térkép kérdés-csomópontjai; a Kérdések lista megszűnik · `d-map-questions` · döntés · kész · C-4
  Egy forrás: a kérdés ott áll, ahol a gondolatmenetben felmerült, és az interjú szakasza (Grilling / Jóváhagyásra vár, d-changes-stage-interview) a térkép nyitott kérdéseiből számolódik.
- A kérdés opciói a gyerekei, lehetőség-csomópontként; Claude javaslata jelölve · `d-map-options` · döntés · kész · C-4
  A térképen is látszik, mi közül választunk; a panel ugyanezeket mutatja, és a válasz a lapról (C-7) ezekből gombokat csinál.
- Az opciók és a javaslat a kérdés megjegyzésében, szövegként · `x-map-rec-in-note` · kizárt · C-4
  A térképen nem látszana, mi közül választottunk.
- A megválaszolt kérdés-csomópont maga válik a válasszá (döntés, kihagyjuk, megkötés) · `d-map-answer` · döntés · kész · C-4
  A térkép a mostani állapotot mutatja, nem a történetet; hogy mit változtatott egy válasz, a commit óta jelölés mutatja. Ha a kérdés maga is fontos, a válasz megjegyzésébe kerül.
- A nem választott lehetőségekről Claude dönt: a komoly alternatíva kihagyjuk-gyerek lesz, a töltelék eltűnik · `d-map-rejected-options` · döntés · kész · C-4
  Így a térkép nem telik meg elvetett opciókkal, a valódi alternatíva viszont látszik, és belőle lesz a javasolt elemek kizárt sora.
- A csomópont típusa nyelvfüggetlen jel a sor elején: ? kérdés · ~ lehetőség · ~! javasolt · = döntés · ! megkötés · x kihagyjuk; jel nélkül gondolat · `d-map-signs` · döntés · kész · C-4
  A típus elöl áll, egy oszlopban, és a fájl nyelvétől független. A hivatkozás a sor végén (→ `id`), a megjegyzés alatta behúzva, mint a lap többi részén. A fájlt Claude írja, a lapon ikon és szín mutatja; a jelmagyarázat a modul README-jében.
- A típus szóval, a sor végén vagy szögletes zárójelben ([kérdés]) · `x-map-words` · kizárt · C-4
  A szó nyelvfüggő: magyar és angol dokumentumnyelv mellett vegyesen állna, és az olvasónak minden nyelv szavait ismernie kellene.
- A térkép gyökere a változás címe; nem külön tárolódik · `d-map-root` · döntés · kész · C-4
  Egy változásnak egy neve van; ötlet nélküli változásnál is működik, és ha a cím élesedik, a gyökér vele élesedik.
- A Javasolt elemek külön lista marad; a beérett csomópont a javasolt elem id-jére hivatkozik · `d-map-item-link` · döntés · kész · C-4
  Az elemnek célhely és a Spec nyelvén írt szöveg kell, ezt a térkép nem adja. A lapon a csomóponton látszik: javasolva → célhely.
- A Kérdések és a Javasolt elemek a térképtől független listák, Claude tartja szinkronban · `x-map-lists-apart` · kizárt · C-4
  Két helyen élő kérdések biztosan szétcsúsznak.
- A Javasolt elemek a térképből generálódnak · `x-map-generates-items` · kizárt · C-4
  A célhely és a Spec-szöveg nem a gondolkodás része; a térkép kicsi és laza maradjon.
- A térkép külön fájlban a változás mellett (map.json vagy a mai mindmap.json formátuma) · `x-map-own-file` · kizárt · C-4
  Két fájl egy változásért; a JSON diffje olvashatatlan, kézzel nem írható.

## Vegyes csapat: munka a Groundwork nélkül {#t-rec-mixed}

A Groundworkos projektben is dolgozhat olyan ember vagy agent, aki az eszközt nem használja. Ő a Markdownt látja: olvassa, szerkeszti, kódot ír, jegyet nyit vagy nem nyit. Mivel a Markdown a forrás, ettől semmi nem csúszik szét, de keletkezhet olyan munka, ami a láncon kívül esik: tartalmi Spec-módosítás változás nélkül, megvalósítás a Spec frissítése nélkül, árva jegy. A fájlokban ezért csak tény áll; ami számolt (szakasz, haladás, jegylista), az a nézetekben él, így elavult számot senki nem lát.

Amikor a Groundwork újra megnyílik, a tár a legutóbb látott commit óta történteket nézi meg. Ha az eszközön kívül változott valami, Claude felzárkózás-változást javasol: egyetlen változást, amely a kívülről jött módosításokat, az eltérő megvalósítási állapotokat és az árva jegyeket rendezi, és amelyet az ember ugyanúgy hagy jóvá, mint bármely más változást. A Spec így a Groundwork nélküli időszak után is csak változáson át módosul, és a történetben látszik, melyik rész volt felzárkózás.

A `groundwork record check` szerver nélkül is fut, így pre-commit hookként vagy CI-lépésként bárki gépén jelezheti a minőségi hibákat, akkor is, ha ő maga a Groundworkot nem használja.

- Kockázatok, ha valaki a Groundwork nélkül dolgozik · `n-rec-mixed-risks` · jegyzet · C-2
  Kód a Spec frissítése nélkül (hamis megvalósítási állapot); Spec-tartalom változás nélkül (eredet nélküli elem, nyomtalan törlés); jegy **Change:** nélkül; szabad formázás, új fájl, átnevezés; ötlet a láncon kívül.
- groundwork record check: szerver nélkül is fut, hibánál nem nullával lép ki · `d-rec-check` · döntés · kész · C-2
  Ismeretlen id egy jegyen, kettőzött szám, árva hivatkozás, nem kanonikus sor. Az init felajánlja pre-commit hookként vagy CI-lépésként, jóváhagyással.

## Azonosítók és hivatkozások {#t-rec-ids}

Az ügy-rekordok (ötlet, változás, mérföldkő) folyamatos sorszámot kapnak az előtagjukkal, és egy szám soha nem használódik újra. A fájlnév a számot és egy olvasható slugot visel, de az azonosító a fejlécben is ott van, így egy átnevezés semmit nem tör el.

A Spec azonosítói olvashatók: a rész a slugja, a dokumentum a rész és a fajta, az elem a mai `d-…`, `f-…` alakú id. Az elem azonosítója már a javasolt változásban megszületik, így a jegyek a beolvadás előtt is hivatkozhatnak rá, és mivel a felváltott elem megmarad, egy id soha nem jelent mást, mint amit egyszer jelentett.

Minden hivatkozás egyszer van leírva: azon a rekordon, amelyik később született, a forrása felé (a változás az ötleteire, az elem a változására, a jegy a változására és az elemeire). A másik irányt a tár indexe számolja, így eszköz nélküli szerkesztés után sincs mit összehangolni. A rekord típusát az azonosító alakja adja.

Két ágon születhet azonos szám. Ezt a `record check` jelzi, a `record renumber` pedig kézi indításra javítja, a hivatkozásokkal együtt; a GitHubon élő jegyekhez csak listát ad, mert azokat nem írja.

- I-n, C-n, M-n: folyamatos, soha újra nem használt sorszám · `d-rec-ids-case` · döntés · kész · C-2
  Fájlnévben háromjegyű kitöltéssel és sluggal (C-007-sketch-bongeszo.md), hivatkozásban kitöltés nélkül (C-7). Az azonosító a fejlécben is áll, így az átnevezés nem változtatja.
- Spec: rész = slug (core), dokumentum = rész/fajta (core/tech, az egészé system), elem = olvasható id · `d-rec-ids-spec` · döntés · kész · C-2
  Az elem-id (d-…, f-…, t-…) az egész Specben egyedi és újra nem használható, mert a felváltott elem megmarad. A javasolt elem már a változásban megkapja, így a jegy beolvadás előtt is hivatkozhat rá.
- Ütközés két ágon: a record check jelzi, a record renumber javítja, kézi indításra · `d-rec-renumber` · döntés · kész · C-2
  Az újabb kap új számot; a rá mutató hivatkozások a docs/product/ alatt és a helyi jegyekben átíródnak, a GitHub-jegyek átírandó sorait kilistázza.
- Minden hivatkozás egyszer áll: a később született rekordon, a forrása felé · `d-rec-links-once` · döntés · kész · C-2
  Változás fejlécében ideas: I-5, milestone: M-2; Spec-elemsoron C-7 (felváltásnál felváltotta: C-9); jegyen **Change:** és **Spec:**; vázlat és diasor a saját helyén; ötleten duplicate: I-3. A típust az id alakja adja (I-, C-, M-, #, Spec-id, vázlatnév).
- A visszafelé irányt a tár indexe számolja, sehová nem írja · `d-rec-links-reverse` · döntés · kész · C-2
  Mi lett az ötletből, a változás elemei, mely jegyek dolgoznak egy elemen. Az ötlet links: mezője csak szabad lásd még hivatkozás marad.
- Kétirányú tárolás · `x-rec-links-both` · kizárt · C-2
  Elcsúszik, főleg eszköz nélküli szerkesztésnél.

## Történet {#t-rec-history}

Minden ügy-rekord (ötlet, változás, mérföldkő) maga mondja el a saját életét: a fájl végén egy Történet lista áll, amelyhez a tár minden életciklus- és hivatkozásváltáskor egy sort ír. Ez a git nélkül is olvasható, és nem tűnik el, ha a commitokat összevonják; a részletes szöveges diff ettől még a gitben marad.

A Spec-elemnek nincs külön listája: az elemsoron áll az eredete, az őt később érintő változások és, ha felváltották, a felváltó változás. A Spec teljes története így a változások sora, mert minden változás fájlja a beolvasztás után is megtartja, mit javasolt és hová került. Ha valaki eszköz nélkül vált állapotot, a felzárkózás veszi észre, és javasol hozzá történetsort.

- Az ügy-rekord fájljának végén ## Történet lista, a tár írja hozzá · `d-rec-history-section` · döntés · kész · C-2
  Minden életciklus- és hivatkozásváltáskor egy sor: dátum · ki · mi történt (pl. 2026-10-22 · human · jóváhagyva, beolvasztva (4 elem)). Eszköz és git nélkül is olvasható, és a squash-commit sem viszi el.
- A Spec-elem története az elemsoron: eredet, érintő változások, felváltotta · `d-rec-history-item` · döntés · kész · C-2
  Pl. C-7, C-12 · felváltotta: C-15. A Spec teljes története a változások sora: a változás fájlja a beolvasztás után is megtartja, mit javasolt és hová került.
- Történet csak a gitből · `x-rec-history-git` · kizárt · C-2
  Életciklus-eseményt nem mond, squash után elvész; a részletes diff ettől még a gitben marad.
- Központi eseménynapló a docs/product/ alatt · `x-rec-history-log` · kizárt · C-2
  Ágakon állandóan ütközne.

## Munkaterületek és a mai modulok {#t-rec-workspaces}

A munkaterületek a rekordtár nézetei, és nem a mai modulhatárokat követik. A Plan eredetileg arra készült, hogy egy ködös ötletből Claude-dal közösen gondolatokat építsünk; ennek a helye most a változás, mert ott formálódik az, ami még nem igaz. Ezért a gondolattérkép a változás saját felülete: a gyökere az ötlet, az ágain gondolatok, kérdések, lehetőségek és döntések nőnek, és ami beérik, abból javasolt elem lesz célhellyel. A térkép így kicsi marad, mert egy változásé.

A nagy képet a Spec adja, de nem a teljes, részletes térképpel. A Spec nyitólapja az Összkép: a produktum célja, a részei egy-egy mondattal, részenként néhány fő képesség és a rajtuk dolgozó változások, legfeljebb 30–40 csomóponton. A rész leírása és a fő jelölés is Spec-tartalom, ezért változáson át frissül, és Claude a jóváhagyáskor javasolja. A mátrix a második fül, a részletes térkép egy kattintásra nyílik. Az Összkép kipróbálásra készül: használat közben derül ki, elég-e.

A Plan modul megszűnik: a térképszerkesztő közös komponens lesz (a Változások szerkesztve, a Spec olvasva használja), a dokumentumgenerálás pedig a Rekordtár kanonikus Markdown író-olvasója. A Build és az Agents egyetlen Jegyek munkaterület lesz, mert az agent mindig jegyen és ágon dolgozik; a Build áttekintője az Áttekintésbe, a dokumentumnézete a Specbe költözik. Az Ötletek modul az új állapotokkal él tovább, és az elfogadás egy lépésben változást nyit. A Vázlat és a Prezentáció eszköz marad.

- Ötletek: új mappa, új állapotok, az elfogadás változást nyit · `d-ideas-new` · döntés · részben · C-2
  docs/product/ideas/ (az items/ alól). Állapotok: new · considering · accepted · rejected · snoozed (until:) · duplicate (duplicate: I-3); a to-develop accepted lesz. Csak az ember fogad el, a böngészőben; Claude továbbra is csak new és considering között mozgat. Interjú út: a tár egy lépésben létrehozza a C-n-t (ideas: I-n), elfogadottra állítja az ötletet, mindkettő történetébe ír, és megnyitja a változás lapját kész prompttal. Egyenesen jegy út: minimális változás, a lap a jegyíráshoz ad promptot (**Change:** C-n).
- Megszűnik: /api/plan/todo, a from-ideas fejezet, az elvetett ötlet Nem cél-be vitele · `d-ideas-removed` · döntés · hiányzik · C-2
  Ha egy elvetett ötletből nem cél lesz, az egy változás kihagyjuk tétele. Marad: hatás–ráfordítás mátrix, hasonló ötletek, 90 napos régi jelzés, groundwork ideas.
- A gondolattérkép a változás saját felülete · `d-map-in-change` · döntés · kész · C-4
  Gyökere a ködös ötlet; ágain gondolatok, kérdések, lehetőségek, döntések. Ember és Claude együtt építi: Claude rajzol, az ember a chatben alakítja. A beérett ágakból (döntés, megkötés, kihagyjuk) javasolt elem lesz célhely-javaslattal; a többi a változásban marad. Forrása a változás .md-jének Gondolatok vázlata. Kicsi marad, mert egy változásé.
- A térkép önálló eszköz, mint a Vázlat · `x-map-tool` · kizárt · C-4
  A gondolkodás a változásban történik; külön eszközként csak hivatkozás lenne rá.
- A Plan eredeti célja: ködös ötletből Claude-dal közösen gondolatokat építeni · `n-plan-purpose` · jegyzet · C-4

## Integrációk és interfészek {#t-rec-int}

A modulszerződés marad: a modul egy mappa leíróval, nézettel, végpontokkal, írási joggal és skillekkel. Két új mezőt kap: a `records` bejelenti a modul rekordtípusait (előtag, mappa, életciklus és a rájuk vonatkozó szabályok), a `workspace` a modul helyét a fejlécben. A tár a Magé, a típus ismerete a modulé: az Ötletek modul mondja meg, mely állapotok között mozgathat Claude, a tár pedig minden írásnál betartatja.

A munkaterületek egymás adatait csak a rekordtáron át látják. A mai modulközi végpontok megszűnnek; aki egy rekordot, a hivatkozásait vagy a számolt szakaszát keresi, a `/api/records`-ot kérdezi. A jegy is rekord, de a forrása a jegykezelő marad: a Jegyek modul adja be a tárnak a jegyolvasót, a tár pedig csak olvas.

Ha egy típus modulja hiányzik, a rá mutató hivatkozás sima azonosítóként látszik, és semmi nem törik el.

- Két új manifest-mező: records (bejelentett típusok) és workspace (a fejlécbeli hely) · `d-rec-manifest` · döntés · részben · C-2
  records: előtag, mappa, életciklus és szabályok (pl. Claude csak new ↔ considering között mozgat ötletet); a tár minden írásnál betartatja. A típus ismerete a modulé, a tár a Magé. Sorrend: Áttekintés | Ötletek → Változások → Spec → Jegyek | Vázlat · Prezentáció.
- A munkaterületek egymás adatait csak a /api/records-on át látják · `d-rec-api-only` · döntés · részben · C-2
  Rekord, hivatkozások, számolt szakasz. Megszűnik: plan/ids, build/prd, build/ideas, plan/todo, agents/tickets.
- Hiányzó modul: a típusára mutató hivatkozás sima azonosítóként látszik · `d-rec-missing-module` · döntés · kész · C-2
  Link és számolás nélkül; semmi nem törik el. A d-module-endpoints helyett ez a működjön a másik nélkül szabály.
- Maradnak a modulközi végpontok, a tár csak az ügy-rekordokat kezeli · `x-rec-endpoints-stay` · kizárt · C-2
  A végpontok egyenkénti karbantartása nem skálázódott.

## Átállás a régi térképről {#t-rec-migrate}

Aki a régi, egyetlen térképes Groundworkról áll át, egy paranccsal teszi: a `groundwork migrate` a régi térképből a Spec dokumentumait írja, és minden elemet a C-1 Kiinduló állapot változáshoz köt, a mai megvalósítási állapottal. A fajták megmaradnak; ami eldöntetlen volt, az nem kerülhet a Specbe, ezért nyitott kérdésként egy külön változásba megy, ami pedig egy ötletre mutatott, az az ötlet rekordjában él tovább. Az ütemterv-fejezet döntéseiből mérföldkövek lesznek, a régi jegyek pedig átírás nélkül a C-1-hez tartoznak.

A parancs kiválasztott ágakat külön, jóváhagyásra váró változásba is tehet. Ebben a projektben ez választja szét a két korszakot: a C-1 az I-5 előtti, nagyrészt megépült Groundwork, a C-2 az újratervezés mai döntései, amelyek egy jóváhagyással, még megvalósítatlanul olvadnak be. Az újratervezés jegyei így már a C-2-re hivatkoznak, és az új modell első változása saját maga.

- groundwork migrate: bármely régi mindmap.json-ból C-1 Kiinduló állapot · `d-migrate-cmd` · döntés · hiányzik · C-2
  Projektfüggetlen: minden régi csomópont a Spec-be kerül, eredete C-1, a megvalósítási állapot a mai impl szerint; a C-1 beolvasztva, a történetében az átállás sora.
- Kiválasztott ágak külön, jóváhagyásra váró változásba is mehetnek · `d-migrate-split` · döntés · hiányzik · C-2
  Pl. --split t-pipe,t-records,c-records --as "Újratervezés: rekordmodell és futószalag" --idea I-5: ezek javasolt elemek lesznek a mai helyükkel mint célhellyel, és egy jóváhagyással olvadnak be, hiányzik állapottal.
- Ebben a projektben: C-1 Kiinduló állapot (I-5 előtt) és az újratervezés változásai (ideas: I-5) · `d-migrate-here` · döntés · kész · C-2
  Az I-5 döntései (t-pipe, t-records, c-records, a Mag stackjének d-lit és d-typecheck döntése és elvetett párjaik) a C-2…C-5 változásokba kerülnek a szállítás sorrendje szerint (d-deliv-split); az újratervezés jegyei ezekre hivatkoznak. Az új modell első változásai saját maguk.
- Minden a C-1-be · `x-migrate-all-c1` · kizárt · C-2
  A kiinduló állapot jelentése hamis lenne, az újratervezés munkája nem látszana változásként.
- Fajták átállása: a döntés, jegyzet, kizárt, félretett Spec-elem lesz C-1 eredettel · `d-migrate-kinds` · döntés · kész · C-2
  A topic csoport marad. Az inferred Spec-elem kódból, megerősítésre vár jelöléssel, a Spec listázza. Az ötletre mutató todo elmarad (az ötlet a saját rekordjában él); minden más todo nyitott kérdés egy külön C-n Nyitott kérdések az átállásból változásban, mert a Specben nem lehet eldöntetlen. A from-ideas fejezetek megszűnnek. Emberi bekezdés, jegyzet, link, fejezetszöveg, progress változatlanul átjön.
- Az ütemterv-fejezet döntéseiből mérföldkövek lesznek; a fejezet megszűnik · `d-migrate-roadmap` · döntés · kész · C-2
  Projektfüggetlenül: a system dokumentum ütemterv-fejezetének (a fajta kezdő fejezete, vagy --roadmap <id>) döntés-elemei M-n mérföldkövek, sorrendben; a félretett elemek Spec-elemek maradnak. Az állapotot (Tervezett, Folyamatban, Kész) Claude javasolja a jegyekből, az ember hagyja jóvá. Itt: M-1…M-7 Kész, M-8 Present Folyamatban (#40–46 nyitott), M-9 Újratervezés a C-2-vel; a p-export Spec-elem marad.
- Change nélküli, PRD soros, a C-1 előtt született jegy a C-1-hez tartozik · `d-migrate-old-tickets` · döntés · hiányzik · C-2
  A tár szabálya, a jegyeket nem írjuk át (itt 46 GitHub-issue).
- Az ütemterv Spec-fejezet marad, mérföldkövek csak az új munkától · `x-roadmap-stays` · kizárt · C-2
  Egy dolog két helyen lenne.

## Szállítás sorrendje {#t-rec-delivery}

Az újratervezés négy egymásra épülő változásban érkezik, egy közös mérföldkő alatt, és mindegyik után használható a Groundwork. Először a rekordtár és a Markdown-forrás készül el az átállással együtt, mert ez a legkockázatosabb, és mert minden más erre épül; ekkor a régi felület még az új adatokon fut. Utána a Változások munkaterület hozza el a fő hurkot (ötlet, interjú, jóváhagyás, Spec), így a további két változás már a saját futószalagján megy végig. Harmadikként a Spec munkaterület érkezik az Összképpel, végül a Jegyek és az Áttekintés.

A Present addig vár: az élő blokkjai a megszűnő végpontokra épülnének, ezért a C-5 után, a rekordtárra írva folytatódik.

- Az újratervezés négy változás egy mérföldkő (M-9 Újratervezés) alatt · `d-deliv-split` · döntés · részben · C-2
  Az implement-spec egy változást visz végig egy integrációs ágon; egy óriás változás óriás ág lenne. Mindegyik után használható a Groundwork. A szétválasztást a migrate --split előtt Claude javasolja, az ember hagyja jóvá.
- 1. C-2 Rekordtár és Markdown-forrás · `d-deliv-c2` · döntés · kész · C-2
  Rekordtár a Magban, kanonikus Markdown író-olvasó, index, record check / renumber, migrate (C-1, a további változások, M-1…M-9); az Ötletek a tárra költöznek; a Plan térképe ideiglenesen a tárból olvas és ír. Elöl, mert ez a legkockázatosabb (türelmes olvasó, átállás).
- 2. C-3 Változások · `d-deliv-c3` · döntés · részben · C-2
  A változás lapja, gondolattérkép a változásban, javasolt elemek célhellyel, jóváhagyó lista és beolvasztás, az új prd-maker skill, elfogadáskor változás az ötletből. Utána a fő hurok működik, és a C-4, C-5 már ezen az úton jöhet.
- 3. C-4 Spec munkaterület · `d-deliv-c4` · döntés · részben · C-2
  Összkép, mátrix, dokumentum-vázlat, részletes térkép lencseként, Lit-komponensek; a Plan modul megszűnik.
- 4. C-5 Jegyek és Áttekintés · `d-deliv-c5` · döntés · hiányzik · C-2
  Build + Agents = Jegyek, új jegysorok és Checks, futószalag, mérföldkövek, új fejléc, felzárkózás-változás.
- A Present (M-8) a C-5 után folytatódik, a rekordtárra írva · `d-deliv-present` · döntés · hiányzik · C-2
  Az élő blokkjai a Build mai végpontjaiból olvasnának, amelyek a C-5-ben megszűnnek; a #40–46 addig vár.

## Biztonság {#t-rec-sec}

A rekordtár a meglévő biztonsági szabályokat viszi tovább: csak a projekt `docs/product/` és `.groundwork/` mappájába írhat, a jegykezelőt (helyi fájlok, GitHub) csak olvassa, és a rekordok Markdownját nyers HTML nélkül jeleníti meg, mert azt eszköz nélkül bárki szerkesztheti.

- A tár csak a docs/product/ és a .groundwork/ alá ír; a jegykezelőt csak olvassa · `d-rec-sec-writes` · döntés · kész · C-2
  A d-sec-write és a modulonkénti writes szerint.
- A rekordok Markdownja nyers HTML nélkül jelenik meg · `d-rec-sec-html` · döntés · kész · C-2

## Tesztelés és minőség {#t-rec-test}

A legkockázatosabb rész a Markdown mint forrás, ezért a C-2 négy tesztréteggel bizonyít, `node --test`-tel. Az oda-vissza tesztek azt mutatják meg, hogy amit a tár ír, azt pontosan visszaolvassa, és a második írás már nem változtat. A türelmes olvasás tesztjei valódi, kézzel vagy agenttel elrontott fájlokon ellenőrzik, hogy tartalom nem vész el, és a hiba látszik. Az átállást ezen a repón próbáljuk ki, a teljes mai térképpel és a régi jegyekkel; végül egy forgatókönyv-teszt a vegyes csapatot játssza el, eszköz nélküli szerkesztéstől a felzárkózásig. Mellette a típusellenőrzés (d-typecheck) a rekordtípusokat és op-okat fogja.

- Oda-vissza: olvas(ír(x)) = x és ír(olvas(ír(x))) = ír(x), bájtra · `d-rec-test-roundtrip` · döntés · kész · C-2
  Minden rekordtípusra és Spec-dokumentumra, véletlen generált rekordokon is.
- Türelmes olvasás: valódi, kézzel elrontott fájlok gyűjteménye · `d-rec-test-tolerant` · döntés · kész · C-2
  Törölt jelölés, átírt elemsor, szabad bekezdés, git-ütközés jelei, agent által frissített megvalósítás: tartalom nem vész el, a record check pontosan jelez.
- Átállás ezen a repón: a mai térkép minden adata megvan, a régi jegyek PRD sora ugyanoda talál · `d-rec-test-migrate` · döntés · hiányzik · C-2
  390 csomópont: id, jegyzet, link, emberi bekezdés, impl; 46 GitHub-jegy.
