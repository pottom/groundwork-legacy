# Ötlettől a produktumig: kutatás a Groundwork alapkoncepciójához

_Kutatási jegyzet, 2026-10-20. Kérdés: hogyan kell egy ötletet a tervbe, a tervet a megvalósításba vinni úgy, hogy egy és húsz dokumentumnál is látsszon, hol tart és hová került. A források elsődlegesek, ahol lehetett (a szerzők és a gyártók saját oldalai); ahol csak másodlagos forrás volt, azt jelzem. A mostani modulokat és döntéseket kiindulópontnak tekintem, nem kötöttségnek._

## Rövid összefoglaló

1. **Minden érett modellben van egy elkötelezési pont, és előtte meg utána más egység mozog.** Előtte olcsó, eldobható *opciók* vannak (Kanban upstream, Shape Up „raw idea”, Stage-Gate discovery), utána *vállalt munka*. Az ötlet ott ér véget, ahol valaki vállalja: Shape Up-ban a bet, Kanbanban a commitment point, Stage-Gate-ben a gate. A Groundwork „kidolgozza / elveti” döntése pontosan ez a pont, ezért jó helyen van.
2. **A terv két tengelyből áll, és a mostani modell ezt a kettőt összemossa.** Az egyik a *szerkezet*: miből áll a produktum, és mi most az igaz (részek, dokumentumok, fejezetek). A másik a *változás*: mi alakul most át, és miért. Az AI-s spec-eszközök közül az OpenSpec ezt tisztán szétválasztja: van egy „aktuális igazság” mappa képességenként, és mellette változásjavaslatok, amelyek *delta*-ként írják át. A Groundwork bajának gyökere, hogy az ötletnek a szerkezetben kell helyet keresni, mielőtt egyáltalán ki lenne dolgozva.
3. **Az ötletnek ne egy dokumentumban legyen a helye, hanem a saját változás-munkaterületén.** Ott él, amíg ki nem dolgozzák. A dokumentumba csak a kész eredmény kerül, elemenként, a jelentése szerinti fejezetbe. A célhelyet tehát nem egyszer kell eldönteni az egész ötletre, hanem elemenként, a grilling végén. A gépi javaslat itt sokkal pontosabb is, mert egy kész elemhez kell helyet találni, nem egy nyers mondathoz.
4. **Az érett eszközök nem húzogatással helyeznek el, hanem javaslattal és jóváhagyással.** A Linear Triage Intelligence csapatot, címkét és projektet javasol. A Productboard szülő-választója a legutóbbi helyekből kínál ötöt. A Productboard AI auto-linkje „nem ellenőrzött” állapotban születik, és ember erősíti meg. A Groundwork „Elfogad · Máshová… · Új rész” mintája tehát jó, csak a jóváhagyás egy diff-szerű lista legyen, ne térképes keresgélés.
5. **A gondolattérkép nem bírja el elsődleges nézetként a 300–3000 elemet.** Egy nagy mintán a valós mind mapek mediánja 31 csomópont. Az NN/g szerint a progresszív feltárás két szintig működik jól. Shneiderman mantrája: először áttekintés, aztán nagyítás és szűrés, végül részlet kérésre. Az elsődleges nézet legyen áttekintő mátrix, vázlat (outline) és keresés. A térkép maradjon lencse egy dokumentumra vagy egy fókusz köré (Furnas-féle érdeklődési fok).
6. **A dokumentum maradhat összetevőnként, ha az „aktuális igazság” szerepét tölti be.** Így működik a C4, az arc42 és az OpenSpec képesség szerinti specje. A *változás* viszont kezdeményezésenként éljen. Ha az összetevőnkénti PRD a változásokat is tartalmazza, abból lesz a „melyik PRD-be kerüljön” probléma.
7. **Az állapot számolt legyen, ne kézzel vezetett. A jegyszám viszont félrevezet.** A Jira Product Discovery és az Aha! a kapcsolt jegyekből számolja az ötlet haladását. A Shape Up szerint a feladatszám nem mutat haladást, mert a feladatok munka közben derülnek ki. Ezért a nyitott kérdések, vagyis az ismeretlenek száma is legyen haladásjel, ne csak a jegyek aránya.
8. **Az AI-interjú bevett minta, de méretezni kell.** Az Anthropic hivatalos Claude Code-útmutatója kifejezetten ajánlja, hogy Claude interjúvoljon, és spec-fájlt írjon. A Spec Kit `clarify` lépése lefedettségi kategóriák alapján legfeljebb öt kérdést tesz fel, hatás × bizonytalanság szerint rangsorolva. Böckeler (martinfowler.com) viszont kimutatta, hogy egy kis hibából is 16 elfogadási kritériumot csináltak. A „mindig kell grilling” elv legyen „mindig kell legalább egy rövid grilling”.
9. **Ne legyen végtelen ötlet-backlog.** A Shape Up alapválasza a nyers ötletre egy puha nem („érdekes, majd egyszer”), és amire nem fogadnak, az kiesik. A Linear szundit (snooze) ad. Az ötletláda kapjon elévülést vagy szundit, különben ugyanaz a hosszú lista lesz belőle.

---

## 1. Szakaszmodellek: hol ér véget az ötlet, és mi az egység, ami mozog?

**Shape Up (Basecamp).** A munka három lépésben halad: *shaping*, vagyis a nyers ötlet formára hozása, utána a *betting table*, végül a hat hetes ciklus. A shaping eredménye a *pitch*, öt összetevővel: probléma, appetite (mennyi időt ér meg), megoldás vázlata, rabbit holes (csapdák) és no-gos (amit kifejezetten kihagynak). Az appetite a becslés fordítottja: nem az a kérdés, mennyi idő kell, hanem hogy mennyit ér meg. Nincs központi backlog. Amire nem fogadnak, az kiesik, és ha fontos, valaki újra előhozza. A nyers ötletre a puha nem a válasz. A fogadás után a csapat maga fedezi fel a *scope*-okat: ezek a munka valódi szerkezetéből adódnak, nem szerepkörből vagy rétegből. A haladást hill chart mutatja (felfelé még ismeretlen, lefelé már csak végrehajtás), mert a feladatszám munka közben nő. → Itt az egység a pitch, majd a bet. Az ötlet a fogadásnál ér véget.

**Continuous Discovery és Opportunity Solution Tree (Teresa Torres).** A fa szintjei: kívánt kimenet (outcome) → lehetőségek (vevői igények, fájdalmak) → megoldások → feltevés-tesztek. Az ötlet itt *megoldás*, és mindig egy lehetőség alá tartozik. Egyszerre egy célzott lehetőségre kell ötletelni, és legalább három megoldást összevetni. Egy kimenetre egy fa jut, csapatonként. Cégszintű fát kifejezetten nem javasol. A beérkező feature requesteket nem teszi közvetlenül a fára, hanem az interjúkhoz használja inspirációnak. → Az ötlet nem önálló: mindig egy *miért*-hez kötődik.

**Dual-track / Inspired (Cagan, SVPG).** A discovery és a delivery párhuzamosan fut. A discovery eredménye a „validált backlog-elem”, a delivery-é a kiadható szoftver. Cagan szerint a hagyományos spec lassan készül, senki nem olvassa, és hamis biztonságot ad. A legjobb specnek a tesztelt prototípust tartja, egyetlen mesterpéldányban, „versionitis” nélkül. A nem-funkcionális követelményeket külön írja le. → A discoveryből a deliverybe egy validált egység lép át, és a specnek egyetlen igazságforrásnak kell lennie.

**Lean Startup (Ries).** Build–Measure–Learn kör: az MVP a legkisebb dolog, amiből a legtöbbet lehet tanulni, és a legkockázatosabb feltevést kell először tesztelni. Rendszeresen döntenek arról, hogy irányt váltanak (pivot) vagy kitartanak. (Itt csak másodlagos összefoglalókat értem el.) → Az ötletből feltevés lesz, és a terv addig él, amíg a feltevés áll.

**Stage-Gate (Cooper).** Szakaszok (koncepció → üzleti eset → fejlesztés → tesztelés → bevezetés), és mindegyik előtt egy kapu. A kapunak három része van: elvárt leszállítandók, kritériumok (érettség és üzleti érték) és döntés: Go, Kill, Hold vagy Recycle. A rendszert a kockázathoz kell méretezni. → A kapu explicit leszállítandót kér. Ennek a Groundworkben a „nincs nyitott csomópont” felel meg.

**Double Diamond (Design Council).** Discover → Define a probléma terében, Develop → Deliver a megoldás terében, váltakozó szétnyílással és szűküléssel, és vissza is lehet lépni. → A Define végén megfogalmazott probléma (brief) az átmenet. Az ötlet és a terv között nem a forma különbözik, hanem az, hogy a probléma tisztázva van-e.

**Kanban-módszer (Anderson), upstream Kanban.** A commitment point előtt *opciók* vannak, amelyeket a kapacitáshoz és a sürgősséghez mérnek. A pont után a munka már nem opcionális. Explicit szabályok mondják meg, mikor fogadnak el és mikor dobnak el valamit. A replenishment ritmus húzza át a munkát, a WIP-limit véd a túlterhelés ellen. (A djaa.com az Anderson-cég oldala, a többi gyakorlati blog.) → A „Mérlegelés” oszlopnak kellenek kimondott szabályok, és egy WIP-limit a „Tervezés alatt” oszlopra.

**Jobs-to-be-Done (Christensen és társai, HBR 2016).** A „job” az az előrelépés, amit a vevő egy adott helyzetben el akar érni. A milkshake-példát Ulwick bírálja, mert szerinte következetlen. → Egy jó ötletkártyán a probléma és a helyzet áll, nem csak a megoldás.

### Mit jelent a Groundworkre nézve

- A modellek egyetértenek abban, hogy kétféle egység van: **opció** (olcsó, sok, eldobható) és **vállalt változás** (kevés, formára hozott, határolt). Köztük egy kimondott döntés áll. A Groundwork mostani „ötlet → terv” lépése ezt a kettőt egy mozdulatba préseli: az ötletnek döntés után rögtön a szerkezetben kell helyet kapnia.
- Ahol a modellek precízek (Shape Up, Stage-Gate, Spec Kit), ott az elkötelezés utáni egység egy **formára hozott változás**, saját dokumentummal (pitch, business case, spec). Ez az egység nem azonos a termék állandó leírásával.
- A Shape Up scope-jai és Torres fája egyaránt azt mutatják, hogy a jó szerkezet a munka *jelentéséből* jön. Ez erősíti, hogy a kész elemek a jelentésük szerinti fejezetbe kerüljenek.
- Hogy hol ér véget az ötlet: a kidolgozott ötlet nem tűnik el, hanem **lezárt változássá** válik, amelynek eredménye a spec módosítása. Ettől kezdve a produktum leírásának része, de a eredete (miért, mikor, melyik ötletből) megmarad.

## 2. Beérkezés és triázs: hogyan kerül az ötlet a terv jó helyére?

**Productboard.** A beérkező jegyzetekből *insight* lesz, amelyet egy hierarchiaelemhez kötnek: termék → komponens → feature → subfeature. A kötés felugró ablakából új feature is létrehozható. Az insight később áthelyezhető vagy egy második helyhez is köthető. Feature áthelyezésekor a szülő-választó a legutóbbi elhelyezések alapján legfeljebb öt szülőt ajánl, és alatta ott a teljes hierarchia. Az AI auto-link „nem ellenőrzött” állapotban születik, és ember erősíti meg. Az újabb Spark irányított beszélgetésben ír speceket lehetőségekből és bizonyítékokból, és GitHub-repóhoz is köthető. → Javaslat, megerősítés, áthelyezhetőség: ugyanaz a minta, mint a Groundwork tervezett „Elfogad · Máshová…” lépése.

**Aha!** Az ötletportálról az ötlet *előléptethető* kezdeményezéssé, epickké, kiadássá, feature-ré vagy követelménnyé. A kapcsolat megmarad, a követelmény állapota visszaírja az ötletét („Shipped”), és a szavazók értesítést kapnak. 2026-tól előléptetéskor a teljes feature-űrlap nyílik meg AI-asszisztenssel. → Az ötlet nem szűnik meg, hanem kapcsolat marad a megvalósításhoz, és az állapot onnan számolódik.

**Linear.** A Triage egy csapatonkénti közös bejövő tálca a backlog előtt. Négy döntés van: elfogad, duplikátum (a csatolmányok átkerülnek a kanonikus elemre), elutasít, szundi. Vannak triázs-szabályok, amelyek csapatot, projektet, címkét állíthatnak, és ha egy elem másik csapat triázsába kerül, ott annak a szabályai futnak. Van ügyeleti rotáció is. A Triage Intelligence a munkaterület múltja alapján javasol tulajdonságokat és rokon vagy duplikált elemeket. A szerkezet: kezdeményezés (initiative, maga is egymásba ágyazható) → projekt (saját dokumentumokkal, specekkel) → jegy. Az initiative kézzel válogatott projektlista, a haladás és az állapot a projektekből gördül fel. → A Linearben a **projekt** a változás egysége, és a spec a projekthez tartozik, nem egy komponenshez.

**Jira Product Discovery.** Termékenként vagy csapatonként egy discovery-projekt. Több csapat egy projekten belül szekciókkal és névkonvenciókkal válik szét. Az ötlethez insightok (bizonyítékok) és delivery-jegyek kapcsolódnak, akár több szoftverprojektben több epic is. A „Delivery progress” és „Delivery status” mező a kapcsolt jegyekből számol, a nézet lehet lista, mátrix, tábla vagy idővonal. Az ötlet archiválható, és merge-nél a delivery-kapcsolat is átvihető. → Itt **az ötlet maga marad a horgony** a deliveryig. Nincs külön „terv” egység, ezért nincs mit elhelyezni.

**Canny.** Feedback-táblák, duplikátum-összevonás (az Autopilot automatikusan is összevon), kétirányú Jira-kapcsolat állapotszinkronnal. (Hivatalos doksit nem értem el, ez másodlagos forrás.)

**Hogyan skáláznak?** Három megoldást láttam. (a) Particionálás: a Linear csapatonként tálcáz, a JPD projektenként különít el. (b) Javasolt elhelyezés megerősítéssel: Productboard, Linear Intelligence. (c) A hely kiváltása kapcsolattal: a JPD és az Aha! esetén az ötlet nem kerül *bele* semmibe, csak *rámutat* a megvalósításra. Egyik eszköz sem kéri, hogy az ember egy nagy fában keresse meg a helyet. A keresés mindig egy rövid, rangsorolt javaslatlistára szűkül.

### Mit jelent a Groundworkre nézve

- Az egyetlen beérkezési pont jó (Linear Triage). A hely azonban ne az egész ötlet egy dokumentuma legyen, hanem a változás saját munkaterülete. A dokumentumbeli hely elemenként, a végén dőljön el.
- A „duplikátum” és a „szundi” hiányzik a mostani döntési készletből. Mindkettő olcsó, és nagy ládánál fontos.
- A javaslat legyen „nem ellenőrzött → megerősített” állapotú, és mindig áthelyezhető (Productboard). Az AI ugyanazt a javaslatmotort használja, mint a felület.

## 3. Nyomonkövethetőség ötlettől kódig, dokumentumburjánzás nélkül

**Követelmény-nyomonkövetés (ISO/IEC/IEEE 29148).** A szabvány a követelmény-folyamatokat, a jó követelmény jellemzőit és az információs elemeket írja le: BRS/StRS → SyRS → SRS. A nyomonkövethetőség (traceable) minőségi jellemző. A gyakorlatban kétirányú link fut az eredettől a tervezési elemen és a megvalósító összetevőn át a tesztig, és az RVTM ezt táblázatba gyűjti. (A szabvány szövege fizetős, ezért csak az előnézetet és másodlagos összefoglalókat láttam.) → A *forrás → követelmény → megvalósítás → ellenőrzés* lánc a lényeg, és hogy mindkét irányban bejárható legyen.

**ADR (Nygard, adr.github.io).** Egy döntés egy kis, számozott, változatlan fájl. Ha a döntés megfordul, nem törlik, hanem „superseded” jelet kap, és a helyettesítőjére mutat. Nygard szerint a nagy spec-dokumentum gyorsan elavul, és senki nem olvassa. → A Groundwork döntés-elemei ADR-szerűen viselkedhetnének: felülírás helyett „felváltva I-31 által”.

**Living documentation és docs-as-code.** Martraire szerint az élő dokumentáció megbízható, kevés munkával tartható karban, közös munkából születik, és megmutatja a döntéseket meg a nyitott kérdéseket. A tudás nagy része már a kódban, a tesztekben és az emberekben van. A Write the Docs docs-as-code elve: a dokumentáció verziókezelőben, plain textben él, review-n megy át, és automatikusan tesztelhető. → A Groundwork generált dokumentumai ezt már teljesítik. A térkép a forrás, a Markdown a kimenet.

**Spec-driven development AI-val.**
- **GitHub Spec Kit.** Constitution → specify → clarify → plan → tasks → implement. Minden feature-nek saját számozott spec-mappája és ága van. A sablon `[NEEDS CLARIFICATION]` jelet kér találgatás helyett, és a spec csak akkor kész, ha nem maradt ilyen jel. A filozófia szerint „a kód a specet szolgálja”, és minden technikai döntés visszavezet egy követelményre.
- **Kiro.** Specenként `requirements.md` (EARS-formában: WHEN … THE SYSTEM SHALL …), `design.md` és `tasks.md`, élő feladatállapottal. Van gyors spec is, jóváhagyási kapuk nélkül, és külön bugfix-spec. Az állandó kontextust a „steering” fájlok adják (product, tech, structure).
- **OpenSpec.** `openspec/specs/<képesség>/spec.md` az aktuális igazság, `openspec/changes/<változás>/` alatt pedig proposal, design, tasks és **delta specek** (ADDED/MODIFIED/REMOVED). Archiváláskor a deltákat beolvasztják az aktuális specbe, a változás pedig dátummal megmarad az archívumban. Elvei: rugalmas, nem merev, iteratív, kész kódbázison (brownfield) is működik, kis projekttől nagyig skálázik.
- **Böckeler kritikája (martinfowler.com).** Három szint: spec-first, spec-anchored, spec-as-source. A legtöbb eszköz csak spec-first: a Spec Kit specje egy változáskérés idejéig él, nem a feature-ével. Gondok: egy munkafolyamat minden méretre, túl sok átnézendő Markdown, hamis kontrollérzet, és homályos határ a funkcionális és a technikai rész között.

### Mit jelent a Groundworkre nézve

- A Groundwork térképe már **spec-anchored**: élő, összetevőnkénti igazság, stabil elemazonosítókkal és generált dokumentumokkal. Ez ritka, és érdemes megtartani. Ami hiányzik, az az OpenSpec *changes* oldala: hogy egy ötlet hatása egy helyen, deltaként látsszon, és jóváhagyáskor olvadjon be.
- A mostani `idea: I-12` címke valójában **utólagos delta**: utólag szedi össze, mit adott az ötlet a tervhez. Ha a delta a változás munkaterületén *előbb* készül el, és jóváhagyáskor kerül a helyére, akkor a hely kiválasztása az utolsó lépés lesz, nem az első. A címke pedig eredetjelzőként megmarad.
- A `[NEEDS CLARIFICATION]` a Groundwork nyitott csomópontjainak felel meg, a „kész, ha nincs nyitott” pedig ugyanaz a kapu. Jó egyezés.
- A `**PRD:**` sor elég nyomonkövethetőséghez. Érdemes egy `**Idea:**` vagy változás-hivatkozást is kötelezővé tenni, hogy az ötlet kártyája közvetlenül számolhasson, ne csak az elemeken át.

## 4. Nagy terv szerkezete és bejárása

**User Story Mapping (Patton).** A lapos backlog Patton szerint „kontextus nélküli mulcs”. A térkép tetején a felhasználói tevékenységek gerince (backbone) áll balról jobbra, alattuk a történetek, a kiadásokat vízszintes sávok jelölik. A gerinc nem priorizálható, csak az alatta lévők. → Nem a fa a lényeg, hanem két tengely: a folyamat és a prioritás.

**Impact Mapping (Adzic).** Miért (cél) → ki (szereplő) → hogyan (viselkedésváltozás) → mit (leszállítandó). Minden leszállítandó egy hatás kontextusában áll, ami a scope creep ellen véd. → A „miért” lánc ugyanaz, mint Torres fájában: a megoldás-elem mindig egy célra mutat.

**C4 (Simon Brown).** Szoftverrendszer → konténer → komponens → kód, mindegyikhez saját diagram, kiegészítve rendszertérképpel, dinamikus és telepítési nézettel. → Az *összetevő* szerinti tagolás a rendszer leírásának bevett formája. Ez a terv szerkezeti tengelye, nem a változásé.

**Információs architektúra.** Shneiderman (1996): „overview first, zoom and filter, then details-on-demand”, a fa és a hálózat külön adattípus. Furnas (1986): a fisheye nézet minden elemet érdeklődési fok szerint mutat (a priori fontosság mínusz távolság a fókusztól), és csak a küszöb felettieket jeleníti meg. NN/g: progresszív feltárás, a gyakori elöl, a többi felé világos út, és jellemzően legfeljebb két szint. Mind mapek empirikusan: Beel és társai elemzésében a medián 31 csomópont, a nagyon nagy térkép ritka kivétel. Kontrollált „outline vs. mind map” összevetést nem találtam. A fórumos tapasztalatok szerint ezres nagyságrendnél a térkép zsúfolttá válik.

### Mit jelent a Groundworkre nézve

- **Az elsődleges nézet ne a teljes térkép legyen.** Három szint javasolt: (1) **áttekintő mátrix**, ahol a sorok a részek, az oszlopok a dokumentumfajták, a cellában állapot, nyitott kérdések és megvalósítás; (2) **dokumentum-vázlat**, vagyis outline fejezetekkel és elemekkel, összecsukhatóan; (3) **térkép-lencse**: egy dokumentum vagy egy fókuszelem környezete, Furnas szerint vágva. A keresés mindenhonnan elérhető.
- 300–3000 elemnél a navigáció fő eszköze a **keresés és a szűrő** (állapot, fajta, ötlet, rész). A szűrt nézet mindig kiírja, mit rejt (5. döntés).
- A story map és az impact map nem külön adatmodell, hanem **nézet ugyanazokon az elemeken** (pl. Present- vagy Plan-lencseként). Ehhez annyi kell, hogy az elemnek legyen „cél” vagy „szereplő” kapcsolata.

## 5. Egyéb szempontok egy alapos újragondoláshoz

- **Egy PRD vagy sok?** A Linear a specet a *projekthez* köti, a Spec Kit és a Kiro a *feature-höz*, az OpenSpec a változást a változáshoz, az aktuális igazságot a *képességhez*. Az Amazon PR/FAQ-ja ötletenként vagy projektenként egy dokumentum (egy oldal sajtóközlemény, legfeljebb öt oldal FAQ). Cagan egyetlen mesterpéldányt követel. A közös minta: **a változásnak saját dokumentuma van, az állandó leírás pedig szerkezet szerint tagolódik.** Ha a kettő egybeesik, az egyik oldalon dokumentumburjánzás lesz (Spec Kit: spec-mappa feature-önként, élő igazság nélkül), a másikon a „hová kerüljön” probléma (Groundwork: összetevőnkénti PRD).
- **Az AI-interjú.** A Claude Code hivatalos útmutatója szerint nagyobb feature-nél Claude interjúvoljon az `AskUserQuestion` eszközzel, a nehéz részekre kérdezzen, írjon önálló spec-fájlt (fájlok, interfészek, mi van a körön kívül, végponttól végpontig ellenőrzés), aztán friss session hajtsa végre. A Spec Kit `clarify` lépése lefedettségi kategóriákat jelöl tisztának, részlegesnek vagy hiányzónak, egyszerre egy kérdést tesz fel, összesen legfeljebb ötöt, és a válaszokat visszaírja a specbe. A Productboard Spark szintén irányított beszélgetés. → A Groundwork grillingje jó irány. Érdemes átvenni a *lefedettségi listát* (dokumentumfajtánként), a *kérdéskeretet* és a *méretezést*.
- **Méretezett szertartás.** A Kiro „Quick Spec”-je és Böckeler kritikája is azt mondja, hogy kis ötletnek kis folyamat kell. Az „egyenesen jegy” út ezt részben kezeli. Kell egy köztes fokozat is: rövid grilling (1–3 kérdés), amely egy-két elemet ír a tervbe.
- **Döntéstörténet.** Az ADR-elv szerint a megfordított döntés nem tűnik el. Ha egy ötlet egy meglévő döntést ír felül, a régi elem „felváltva” jelet kapjon, ne szerkesszék át csendben.
- **Kész kódbázis (brownfield).** Az OpenSpec kifejezetten célozza. A Groundwork térképe egy induló importtal készül; ez legyen maga is egy „változás” (pl. „Kiinduló állapot”), hogy minden elemnek legyen eredete.

---

## A mostani döntések a kutatás tükrében

| # | Döntés | Értékelés | Miért |
|---|---|---|---|
| 1 | Egy projekt = egy térkép = a produktum; három szakasz saját egységgel, hivatkozásokkal | **Támogatott, egy kiegészítéssel** | Az élő, egyetlen igazságforrás egyezik Cagan „single master” elvével és az OpenSpec `specs/` mappájával. Hiányzik viszont a **változás** mint látható egység: az ötlet nem „szűnik meg és lesz terv”, hanem lezárt változássá válik, amelynek deltái beolvadtak a tervbe (OpenSpec archive, Aha!/JPD horgony). Lehet, hogy ugyanazt az I-számot viszi tovább. |
| 2 | Az ember csak dönt: kidolgozza vagy elveti, és döntéskor utat választ | **Támogatott, bővíteni** | Ez a commitment point (Kanban, Shape Up, Stage-Gate Go/Kill). Hiányzik a **szundi** vagy elévülés (Linear, Shape Up puha nem) és a **duplikátum** (Linear, Canny). Az út választása a méretezett szertartás helye: tervezésre / rövid grilling / egyenesen jegy. |
| 3 | Egyetlen Beérkezett tálca a térképen; a rendszer célDOKUMENTUMOT javasol; az ötlet a dokumentum Ötletek fejezetébe kerül; a grilling bontja szét | **Változtatni** | Az egyetlen beérkezési pont és a javaslat + megerősítés jó (Linear, Productboard). A hely viszont túl korán, túl durván dől el: egy nyers ötletre kell dokumentumot találni, és minden dokumentumban külön Ötletek fejezet nő. Jobb így: a tálca helyett az ötletnek saját **változás-nézete** van (nem a térkép része). A grilling ott termeli az elemeket, mindegyikhez **elemszintű célhely-javaslattal**. Jóváhagyáskor diff-szerű lista erősíti meg és olvasztja be őket. Új rész létrehozása is itt történik. |
| 4 | Az ötlet szakasza számolt; táblaoszlopok; a lezárt kártyán számolt összefoglaló | **Támogatott** | JPD Delivery progress, Aha! állapot-visszaírás, Linear felgördülő haladás. Kiegészítés: a haladásjel ne csak „2/5 jegy” legyen, hanem a nyitott kérdések száma is (Shape Up hill chart: a feladatszám félrevezet). Kell WIP-limit a „Tervezés alatt” oszlopra (Kanban). |
| 5 | A Plan áttekintője mutatja a részeket és dokumentumokat; a szűrt nézet kiírja, mit rejt | **Erősen támogatott, kiterjeszteni** | Shneiderman, NN/g, Furnas. Kiterjesztés: az áttekintő legyen a Plan **nyitólapja**, és a teljes térkép legyen lencse, ne az elsődleges nézet. |

---

## Javasolt alapmodell

Úgy írom le, mintha nulláról indulnánk. A keretek: helyi, projektfüggetlen, Claude Code-dal használt, az ember dönt, az AI interjúvol.

### Az alapgondolat

A Groundwork **két dolgot tart nyilván, és egy dolgot mutat**:

- **A produktum leírása (Spec).** Ami *most igaz* a produktumról, szerkezet szerint: részek → dokumentumok → fejezetek → elemek. Ez az élő igazság, ebből generálódnak a dokumentumok. Csak változáson keresztül módosul.
- **A változások (Change).** Ami *most alakul*: minden kidolgozásra szánt ötletből egy változás lesz. Ez tartja a miértet, a nyitott kérdéseket, a javasolt deltákat (új, módosított vagy visszavont elemek) és a hozzá tartozó jegyeket.
- **Ahol tart (számolt állapot).** Minden szinten: ötlet, változás, rész, elem.

Az ötlet és a változás **ugyanaz a dolog két életszakaszban**. Az I-12 ötlet elfogadva az I-12 változás lesz, ugyanazzal az azonosítóval és kártyával. Így a felhasználónak nem kell új fogalmat megtanulnia, csak a kártya „belseje” nő.

### Egységek és szakaszok

| Szakasz | Egység | Hol él | Ki mozgatja | Kész, ha |
|---|---|---|---|---|
| Opció | ötlet (I-n) | Ötletek tábla | az ember dönt: kidolgoz / elvet / szundi / duplikátum | döntés született |
| Formálás | változás (ugyanaz az I-n) | a változás saját nézete | AI-interjú, az ember válaszol | nincs nyitott kérdés, van ≥1 javasolt delta |
| Beolvasztás | delta → spec-elem | a változás nézetében lista, célhely-javaslattal | AI javasol, az ember jóváhagyja (Elfogad · Máshová… · Új rész) | minden delta a helyén van, az elemeken `idea: I-n` |
| Megvalósítás | jegy | Build | Claude vagy ember | a jegyek lezárva; a jegyen `**PRD:**` és `**Idea:**` |
| Lezárás | lezárt változás | Ötletek tábla, összecsukva | számolt | minden spec-elem kész, jegy nem maradt nyitva |

Az „egyenesen jegy” út az *Opció* után a *Megvalósításra* ugrik, delta nélkül. A „rövid grilling” út egy-három kérdéssel és egy-két deltával megy végig ugyanezen a láncon.

### Hol mi látszik

- **Ötletek tábla:** Új · Mérlegelés · Formálás alatt (WIP-limittel) · Beolvasztva / megvalósítás alatt · Lezárt (összecsukva) · Elvetett / szundi. A kártyán számolt összefoglaló: nyitott kérdések, beolvasztott elemek, jegyek.
- **Változás nézet (a mostani tálca helyett):** a probléma és a miért (Shape Up pitch-mezői: probléma, keret, kihagyott dolgok), a nyitott kérdések, a javasolt delták, mindegyiken célhely-javaslattal, a már beolvasztott elemek linkjei és a jegyek. Ez a nézet *a változásé*, ezért 1 és 20 dokumentumnál ugyanígy néz ki. A grilling ezt a nézetet tölti.
- **Plan nyitólap (áttekintő mátrix):** a sorokban a részek (egy rész esetén egy sor), az oszlopokban a dokumentumfajták. A cellában állapot, nyitott kérdések, megvalósítás, és hogy hány aktív változás érinti. Innen nyílik a dokumentum.
- **Dokumentum-vázlat:** outline, összecsukható fejezetekkel. Minden elemen ott van az állapot és a eredete (melyik változásból jött). A térkép ennek egy nézete: egy dokumentum vagy egy fókuszelem környezete, fisheye-vágással.
- **Keresés és szűrő mindenhol.** A szűrt nézet kiírja, mit rejt.
- **Build:** jegyek, és mellettük a változás és az elem, ahonnan jöttek. A haladás a változáson és a részen is felgördül.

### Miért működik 1 és 20 dokumentummal is

Az ötletnek soha nem kell dokumentumot választania. A célhely-választás elemszintű, a grilling végén történik, amikor a tartalom már ismert, és az AI rövid, rangsorolt listát ad. Egy dokumentumnál a lista egy elemű, és a lépés észrevétlen. A mátrix egy sorra zsugorodik. A változás nézete méretfüggetlen.

### Mérlegelt alternatívák

- **A. Mostani modell (az ötlet a Beérkezett tálcán át egy dokumentum Ötletek fejezetébe kerül).** Egyszerű adatmodell, de a hely túl korán dől el, a fejezetek burjánoznak, és nincs egy hely, ahol az ötlet teljes hatása látszik. Elvetném.
- **B. Ötlet-központú modell (JPD, Aha!).** Az ötlet a horgony, és a delivery-jegyek rá mutatnak. Nincs élő, szerkezet szerinti spec. A haladás jól látszik, de nincs „mi most igaz” leírás, ami a Groundwork egyik fő értéke (generált dokumentumok). Elvetném, a számolt összefoglalót viszont átveszem belőle.
- **C. Változásonkénti spec (Spec Kit, Kiro).** Minden ötletnek saját spec-mappája van, élő igazság nélkül. Böckeler kritikája szerint ebből fájlburjánzás és elavuló specek lesznek. Elvetném.
- **D. Élő spec + változás-delták (OpenSpec-szerű hibrid).** Ez a javaslat. Költsége egy új fogalom (delta) és egy jóváhagyó lépés. Ezt csökkenti, hogy a változás ugyanaz a kártya, mint az ötlet.
- **E. Story map vagy opportunity tree mint elsődleges szerkezet.** Termékfejlesztésre erős, de egy rendszerterv vagy egy szolgáltatás nem mindig fér bele (projektfüggetlenség). Inkább lencseként érdemes kínálni.

### Mi marad meg a mai darabokból

- **Marad:** az Ötletek tábla és az I-azonosítók; a grilling (lefedettségi listával és méretezéssel kiegészítve); a térkép adatmodellje (részek → dokumentumok → fejezetek → elemek, az elemfajták és a megvalósítási állapot); a generált dokumentumok; a `**PRD:**` sor; a számolt kártyaösszefoglaló; a „szűrt nézet kiírja, mit rejt” elv; a Sketch, az Agents és a Present mint eszközök (a Sketch rajza a változáshoz is köthető).
- **Átalakul:** a Beérkezett tálcából változás nézet lesz; az `idea: I-12` címke a delta beolvasztásakor automatikusan kerül fel, és eredetjelzőként szolgál; a dokumentumonkénti Ötletek fejezet megszűnik (a nyitott kérdések a változásban vannak); a teljes térkép nyitólapból lencse lesz; a „Tervezés alatt” oszlop kap egy WIP-limitet.
- **Új:** a delta és a jóváhagyó lista; a szundi és a duplikátum; a rövid grilling; a „felváltva” jel a döntéseken; a Plan nyitólapja mátrixként.

---

## Nyitott kérdések a felhasználónak

1. **Csak változáson át módosulhat a spec?** Vagy közvetlen szerkesztés is maradjon (pl. elírás javítása), és csak az ötletből jövő munka menjen delta-úton?
2. **Ugyanaz az azonosító?** Az ötlet és a belőle lett változás ugyanazt az I-számot vigye, vagy a változás kapjon saját (pl. C-n) azonosítót?
3. **Mi a Plan nyitólapja?** Áttekintő mátrix, dokumentum-vázlat vagy továbbra is a térkép?
4. **Mikor olvadjanak be a delták?** A grilling végén, elemenként azonnal, vagy egy közös „változás jóváhagyása” lépésben?
5. **Kötelező-e a grilling?** Mindig legyen (rövid változattal), vagy a „rövid grilling” út teljesen kihagyható legyen?
6. **Mire hivatkozzon a jegy?** Csak elemre (`**PRD:**`), csak változásra (`**Idea:**`), vagy mindkettőre kötelezően?
7. **Hogyan kezelje a láda a régi ötleteket?** Legyen elévülés vagy szundi (pl. 90 nap után „Mérlegelés”-ből automatikusan „Szundi”)? Kell-e WIP-limit a formálás alatt lévő ötletekre?
8. **Mi a dokumentum alapegysége?** Összetevő × fajta (mint ma), vagy elég a fajta, és az összetevő csak fejezet vagy címke?
9. **Felülírt döntés:** törlődjön, vagy maradjon „felváltva” jellel a dokumentumban vagy egy döntésnaplóban?
10. **Kiinduló állapot (brownfield):** a meglévő térkép egy „Kiinduló állapot” változásként kapjon eredetet, vagy maradjon eredet nélkül?
11. **Kap-e a változás pitch-mezőket?** Kell-e kötelező „keret” (appetite) és „kihagyott dolgok” mező?

---

## Források

**Szakaszmodellek**
- Ryan Singer: *Shape Up* (Basecamp): [Principles of Shaping](https://basecamp.com/shapeup/0.3-chapter-01), [Set Boundaries](https://basecamp.com/shapeup/1.2-chapter-03), [Write the Pitch](https://basecamp.com/shapeup/1.5-chapter-06), [Bets, Not Backlogs](https://basecamp.com/shapeup/2.1-chapter-07), [Map the Scopes](https://basecamp.com/shapeup/3.3-chapter-12), [Show Progress](https://basecamp.com/shapeup/3.4-chapter-13)
- Teresa Torres: [Opportunity Solution Trees](https://www.producttalk.org/opportunity-solution-trees/)
- Marty Cagan (SVPG): [Dual-Track Agile](https://www.svpg.com/dual-track-agile/), [Revisiting the Product Spec](https://svpg.com/revisiting-the-product-spec/)
- Stage-Gate International: [The Stage-Gate Model: An Overview](https://www.stage-gate.com/blog/the-stage-gate-model-an-overview/)
- Design Council: [Framework for Innovation / Double Diamond](https://www.designcouncil.org.uk/resources/framework-for-innovation/)
- David J. Anderson & Associates: [What Do We Mean by “Upstream Kanban”?](https://djaa.com/what-do-we-mean-by-upstream-kanban/); [Businessmap: Upstream Kanban](https://businessmap.io/blog/upstream-discovery-kanban) (másodlagos)
- Christensen, Hall, Dillon, Duncan: Know Your Customers' “Jobs to Be Done”, HBR 2016 (hbr.org/2016/09); Ulwick kritikája: [Strategyn](https://strategyn.com/2013/01/16/market-segmentation-is-soured-by-milkshake-marketing/)
- Eric Ries: *The Lean Startup* (csak másodlagos összefoglalók, pl. [entrepreneurship.de](https://entrepreneurship.de/en/kb/the-lean-startup-eric-ries))
- Amazon: [Working Backwards, PR/FAQ](https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes)

**Beérkezés és triázs**
- Productboard: [Insightok kötése](https://support.productboard.com/hc/en-us/articles/360056354514), [Hierarchia](https://support.productboard.com/hc/en-us/articles/360058212333), [Áthelyezés](https://support.productboard.com/hc/en-us/articles/360058220713), [AI auto-link](https://support.productboard.com/hc/en-us/articles/26949590820627), [Spark](https://support.productboard.com/hc/en-us/articles/44571897288723-Productboard-Spark)
- Aha!: [Promote ideas to your roadmap](https://www.aha.io/support/roadmaps/strategic-roadmaps/ideas/promote-ideas-directly-to-your-roadmap/content-only), [Prioritize customer ideas](https://www.aha.io/support/roadmaps/strategic-roadmaps/best-practices/prioritize-customer-ideas)
- Linear: [Triage](https://linear.app/docs/triage), [Initiatives](https://linear.app/docs/initiatives), [Project overview](https://linear.app/docs/project-overview), [Documents](https://linear.app/docs/documents)
- Atlassian Jira Product Discovery: [Delivery](https://www.atlassian.com/software/jira/product-discovery/guides/delivery/overview), [Ideas](https://www.atlassian.com/software/jira/product-discovery/guides/ideas/overview), [Projects](https://www.atlassian.com/software/jira/product-discovery/guides/projects/overview)
- Canny: [Canny for Jira](https://marketplace.atlassian.com/apps/1217889/canny-for-jira); Autopilot csak másodlagos forrásból

**Nyomonkövethetőség és spec-driven development**
- ISO/IEC/IEEE 29148:2018 ([ANSI előnézet, 2011-es kiadás](https://webstore.ansi.org/preview-pages/ISO/preview_ISO+IEC+IEEE+29148-2011.pdf)); [IEEE TechNav: Requirements Management](https://technav.ieee.org/topic/requirements-management/)
- Michael Nygard: [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions); [adr.github.io](https://adr.github.io/)
- Cyrille Martraire: *Living Documentation* ([InformIT](https://informit.com/livingdoc), [InfoQ recenzió](https://www.infoq.com/articles/book-review-living-documentation/))
- Write the Docs: [Docs as Code](https://www.writethedocs.org/guide/docs-as-code/)
- GitHub Spec Kit: [repó](https://github.com/github/spec-kit), [spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md); a `clarify` lépés leírása: [Mintlify mirror](https://www.mintlify.com/github/spec-kit/commands/clarify) (másodlagos)
- Kiro: [Specs](https://kiro.dev/docs/specs/)
- OpenSpec (Fission-AI): [README, npm 1.4.1](https://cdn.jsdelivr.net/npm/@fission-ai/openspec@1.4.1/README.md), [openspec.dev](https://openspec.dev/docs/faq)
- Birgitta Böckeler: [Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- Anthropic: [Claude Code best practices, „Let Claude interview you”](https://code.claude.com/docs/en/best-practices)

**Szerkezet és bejárás**
- Jeff Patton: [The New User Story Backlog is a Map](https://www.jpattonassociates.com/the-new-backlog/)
- Gojko Adzic: [Impact Mapping](https://www.impactmapping.org/about.html)
- Simon Brown: [C4 model](https://c4model.com/)
- Ben Shneiderman: [The Eyes Have It (1996)](https://drum.lib.umd.edu/handle/1903/5784)
- George W. Furnas: [Generalized Fisheye Views (CHI '86)](https://cspages.ucalgary.ca/~saul/581/exer.eps/4furnas86.pdf)
- Nielsen Norman Group: [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Beel és társai: [An Exploratory Analysis of Mind Maps](https://isg.beel.org/pubs/An%20Exploratory%20Analysis%20of%20Mind%20Maps%20--%20preprint.pdf)
