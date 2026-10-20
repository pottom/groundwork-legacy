# Groundwork — Ötletek modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Probléma és cél {#t-ideas-problem .done}

Az ötletek ma szétszóródnak: a chatben, a code review-k megjegyzéseiben, ideiglenes jegyzetfájlokban és GitHub-hozzászólásokban élnek. Az AI munka közben sok mindent észrevesz, és ilyenkor vagy rögtön megcsinálja, kérdezés nélkül, vagy elfelejtődik.

Az Ötletek modul egy közös, számozott ötletláda. Ember és Claude egyformán felírhat bele, a sorsáról viszont mindig az ember dönt: kidolgozásra szánja, vagy indoklással elveti. Így semmi nem vész el, és semmi nem történik meg úgy, hogy a fejlesztő nem döntött róla.

- Egy hely minden ötletnek, emberi döntéssel · `d-ideas-goal` · döntés · C-1

## Felhasználók és használati esetek {#t-ideas-users .done}

A fejlesztő a böngészőben látja az ötleteket, rendezi őket, és dönt róluk. Claude a beszélgetés vagy a munka közben vesz fel ötletet, ha valamit észrevesz, ami nem tartozik a mostani feladathoz, és becslést meg hasonló, korábbi ötleteket fűz hozzá. A projekt követői olvassák a ládát, hogy lássák, mi jöhet még, és mit vetettek el miért.

Tipikus esetek: egy code review találatai ötletként kerülnek a ládába, és a fejlesztő egyenként dönt róluk; egy termékötletből a Planben grilling lesz; egy mérnöki ötletből közvetlenül jegy.

- Ember és Claude is felírhat ötletet · `d-ideas-who` · döntés · C-1
- Kidolgozásról és elvetésről csak az ember dönt · `d-ideas-human-decides` · döntés · C-1
  Claude felvehet, pontosíthat, becsülhet és javasolhat, de nem dönt.

## Hatókör és fő funkciók {#t-ideas-scope .done}

A láda számozott ötletekből áll; a fő nézet egy négyoszlopos kanban, mellette egy hatás–ráfordítás mátrix, amelyen egy pillantásra látszanak a gyors nyerők. A kidolgozásra szánt ötlet a fajtája szerint ágazik el: a termékötlet todo csomópont lesz a Plan térképén, a mérnöki ötletből jegy készül. Az elvetett ötlet indoklással marad meg, így Claude nem javasolja újra, és a PRD „Nem cél” részébe is átvihető.

Claude egy parancssori eszközön és egy skillen át dolgozik a ládával, ugyanúgy, ahogy a Plan térképével.

- Számozott ötletek (I-1, I-2 …) szerzővel és forrással · `f-ideas-inbox` · döntés · kész · C-1
  [modules/ideas/store.mjs](../../../../modules/ideas/store.mjs)
- Kanban: Új · Mérlegelés · Kidolgozásra · Elvetve · `f-ideas-kanban` · döntés · kész · C-1
  [modules/ideas/view/board.mjs](../../../../modules/ideas/view/board.mjs)
- Hatás–ráfordítás mátrix nézet · `f-ideas-matrix` · döntés · kész · C-1
  A közepes (medium) becslés a kedvezőtlen oldalra számít (alacsony hatás, magas ráfordítás), így csak a biztos gyors nyerés látszik annak. Ha az ember egy ötletet másik kvadránsba mozgat, a megváltozott tengelyen high vagy low értéket kap.
  [modules/ideas/matrix.mjs](../../../../modules/ideas/matrix.mjs)
- Claude becslése és a hasonló ötletek jelzése · `f-ideas-assist` · döntés · kész · C-1
  [modules/ideas/similar.mjs](../../../../modules/ideas/similar.mjs)
- Termékötlet kidolgozásra: todo csomópont a Plan térképén, oda-vissza hivatkozással · `f-ideas-to-plan` · döntés · kész · C-1
  [modules/ideas/view/plan.mjs](../../../../modules/ideas/view/plan.mjs)
- Mérnöki ötletből jegy, ami hivatkozik az ötletre · `f-ideas-to-build` · döntés · kész · C-1
  [modules/ideas/ticket.mjs](../../../../modules/ideas/ticket.mjs)
- Elvetés indoklással; a PRD Nem cél részébe vihető · `f-ideas-reject` · döntés · kész · C-1
  [modules/ideas/view/reject.mjs](../../../../modules/ideas/view/reject.mjs)
- groundwork ideas parancs és skill Claude-nak · `f-ideas-claude` · döntés · kész · C-1
  [modules/ideas/ideas.mjs](../../../../modules/ideas/ideas.mjs)

## Funkcionális követelmények {#t-ideas-func .done}

Minden ötletnek van címe, leírása, szerzője (ember vagy Claude), forrása (beszélgetés, review, jegy), fajtája (termék vagy mérnöki), becsült hatása és ráfordítása, állapota, döntés esetén indoklása, és hivatkozásai más elemekre. A szám egyszer kiosztva az ötleté marad, akkor is, ha elvetik.

A döntő állapotokat (Kidolgozásra, Elvetve) csak a böngészőben lehet beállítani; Claude parancsa ezt elutasítja. Minden változás élőben jelenik meg minden megnyitott oldalon.

- Mezők: cím, leírás, szerző, forrás, fajta, hatás, ráfordítás, állapot, indoklás, hivatkozások · `d-ideas-fields` · döntés · C-1
- A számok soha nem használódnak újra · `d-ideas-numbers` · döntés · C-1
- Claude csak az Új és a Mérlegelés között mozgat · `d-ideas-ai-limits` · döntés · C-1
  A Kidolgozásra és az Elvetve állapotot csak a böngészőben, az ember állíthatja.
- A böngészőben szerkeszthető, élő frissítéssel · `d-ideas-edit` · döntés · C-1

## Nem funkcionális követelmények {#t-ideas-nfr .done}

Az Ötletek modul a közös dizájnrendszert használja, angolul és magyarul is működik, hálózat nélkül is, és belefér a közös teljesítménycélba (300 ms első kirajzolás, 50 ms kérésenként).

- A közös keret kinézete, angol és magyar felület, offline, a teljesítménycélon belül · `d-ideas-nfr` · döntés · C-1
