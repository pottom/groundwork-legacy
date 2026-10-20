# Groundwork — Present modul: Műszaki terv

_Műszaki terv_

## Architektúra és komponensek {#t-present-arch .done}

A Present a többihez hasonló modul: nézet, /api/present/ végpontok, groundwork present parancs és skill; a böngészőoldal kis ES-modulokból áll, lit-html-lel. Az élő blokkok a többi modul deklarált, nyilvános végpontjaiból olvasnak, így a Present nem nyúl más modul adataihoz közvetlenül.

- Önálló modul: nézet, végpontok, groundwork present parancs, skill; kis ES-modulok, lit-html · `d-present-module` · döntés · C-1
- Az élő blokkok a többi modul deklarált nyilvános végpontjaiból olvasnak · `d-present-blocks` · döntés · C-1
  A d-module-endpoints szerint, pl. a Build haladás-végpontja.

## Adatok és tárolás {#t-present-data .done}

Minden diasor egy Markdown-fájl a docs/product/decks/ alatt: a diákat egy --- sor választja el, az élő blokkok gw: kezdetű kódblokkok (például gw:milestone 5), az előadói jegyzetek a Note: sor után állnak. A fejléc a címet, a nyelvet és a sablont tárolja. Így a diasor olvasható, diffelhető, és gitben él.

- Diasoronként egy Markdown-fájl a docs/product/decks/ alatt, gitben · `d-present-store` · döntés · C-1
  A diákat --- választja el; az élő blokkok gw: kódblokkok; a jegyzetek Note: után.

## Biztonság {#t-present-sec .done}

A modul csak a docs/product/decks/ alá írhat. A diák Markdownja biztonságos renderelővel jelenik meg, nyers HTML és veszélyes hivatkozások nélkül.

- Csak a docs/product/decks/ alá írhat; a Markdown nyers HTML nélkül jelenik meg · `d-present-writes` · döntés · C-1
