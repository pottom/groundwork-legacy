# Groundwork — Ötletek modul: Műszaki terv

_Műszaki terv_

## Architektúra és komponensek {#t-ideas-arch .done}

Az Ötletek a Planhez és a Buildhez hasonló modul: a manifestje adja a nézetet, a /api/ideas/ végpontokat, a groundwork ideas parancsot és a groundwork init által telepített skillt. A böngészőoldal kis ES-modulokból áll, a nézeteket lit-html rajzolja, az élő frissítést a keret továbbítja.

- Önálló modul a modulszerződés szerint: nézet, végpontok, groundwork ideas parancs, skill · `d-ideas-module` · döntés · C-1
- Kis ES-modulok, lit-html nézetek · `d-ideas-view` · döntés · C-1

## Adatok és tárolás {#t-ideas-data .done}

Minden ötlet egy saját Markdown-fájl a docs/product/ideas/items/ alatt: a fejléc tartalmazza a mezőket, a törzs a leírást és a megbeszélést. Gitben van, így a csapat látja, és a döntések visszakövethetők. A következő szám a legnagyobb meglévő plusz egy; ha két ágon ugyanaz a szám születik, összefésüléskor az újabb ötlet új számot kap.

- Ötletenként egy Markdown-fájl a docs/product/ideas/items/ alatt, gitben · `d-ideas-store` · döntés · C-1
  Pl. I-012-gyors-tabvaltas.md, fejlécben a mezőkkel; a docs/product/ideas/ mappában a modul saját PRD-je és TECH-je is ott van.
- Két ágon azonos szám születhet; összefésüléskor az újabb új számot kap · `n-ideas-collide` · jegyzet · C-1

## Integrációk és interfészek {#t-ideas-int .done}

A termékötletből a Plan saját, kis végpontja készít todo csomópontot, a térképet tehát továbbra is csak a Plan írja; a csomópont hivatkozik az ötletre, az ötlet a csomópontra. A mérnöki ötletből Claude készít jegyet, amelynek első sorai között szerepel az **Idea:** I-12 hivatkozás, a Build pedig ezt linkként mutatja.

- A Plan egy kis végponton vesz fel todo csomópontot (POST /api/plan/todo) · `d-ideas-plan-endpoint` · döntés · C-1
  A d-module-endpoints szerint; a térképet továbbra is csak a Plan írja.
- A jegyben **Idea:** I-12 sor; a Build hivatkozásként mutatja · `d-ideas-ticket-line` · döntés · C-1
  Az I-5 szerint felváltja a **Change:** sor; a régi **Idea:** sort a tár az ötlet változásaként olvassa (d-ticket-old-lines).

## Biztonság {#t-ideas-sec .done}

A modul a core írójával dolgozik, és csak a docs/product/ideas/items/ mappába írhat. A Markdown-tartalom biztonságos renderelővel jelenik meg, nyers HTML nélkül.

- Csak a docs/product/ideas/items/ alá írhat · `d-ideas-writes` · döntés · C-1
