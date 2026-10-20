# Groundwork — Mag: Műszaki terv

_Műszaki terv_

## Helyi szerver {#t-core-server .done}

Egyetlen helyi szerver szolgálja ki az összes modult, mindegyiket a saját API-jával. A szerver Node.js-en fut, csak beépített modulokkal, telepítendő függőség nélkül.

Az írási jog modulonként adható: a Plan a saját dokumentumait írja, a Build csak olvas.

A változásokról a szerver szól az oldalaknak (Server-Sent Events a `/api/events` alatt): a térkép, a helyi jegyek, a git és a GitHub-issue-k változása után az oldalak újraolvasnak, lekérdezgetés nélkül.

- Mindkettő Node, csak beépített modulokkal · `n-node-builtin` · döntés · kész · C-1
  [core/server.mjs](../../../../core/server.mjs)
- Egy közös szerver, modulonkénti API-val · `d-one-server` · döntés · kész · C-1
  Az írási jogot modulonként adjuk.
  [core/server.mjs](../../../../core/server.mjs)
- Modulonként külön szerver · `x-two-servers` · kizárt · C-1
- Élő frissítés Server-Sent Events-szel (/api/events) · `d-live-sse` · döntés · kész · C-1
  A mag figyeli a projektmappát; a modul manifestje mondja meg, melyik fájl melyik témához tartozik, és maga is küldhet értesítést (a Build percenként frissen megkérdezi a GitHubot, így a GitHubon történt változás egy percen belül látszik). Az oldalak csak értesítésre kérdeznek újra; újracsatlakozáskor mindent újraolvasnak.
  [core/events.mjs](../../../../core/events.mjs)
- Lekérdezgetés (polling) az oldalakból · `x-polling` · kizárt · C-1

## Modulszerződés {#t-core-contract .done}

Egy modul egy mappa a csomagon belül. Leírja magát (azonosító, név, verzió), a saját `/api/<module>/` útvonala alatt adja a szerver-végpontjait, és egy nézetet ad a közös keretbe. Hozhat skilleket és hookokat is, ezeket az `init` telepíti. Megnevezi a mappákat, ahová írhat; a Mag csak ezeket engedi.

Az első verzióban minden modul a csomagon belül él, de a szerződés úgy készül, hogy később külső npm-csomag is beépülhessen modulként.

- v1: a modulok a csomagon belül élnek · `d-builtin-modules` · döntés · C-1
- Külső npm-modulok (groundwork-module-*) · `p-external-modules` · félretett · C-1
  A szerződés már erre készül.
- **Egy modul egy mappa, benne:** · `g-module-parts` · C-1
  - Leíró: azonosító, név, verzió · `d-mod-manifest` · döntés · kész · C-1
    [modules/plan/module.mjs](../../../../modules/plan/module.mjs)
  - Szerver-végpontok a /api/<module>/ alatt · `d-mod-api` · döntés · kész · C-1
    [core/server.mjs](../../../../core/server.mjs)
  - Nézet a közös keretben · `d-mod-view` · döntés · kész · C-1
    A nézetet a Mag szolgálja ki a /<module>/ alatt, a közös keretben (fejléc, navigáció).
    [core/shell/shell.mjs](../../../../core/shell/shell.mjs)
  - Opcionális skillek és hookok (az init telepíti) · `d-mod-skills` · döntés · C-1
  - Mappák, ahová írhat (a Mag ellenőrzi) · `d-mod-writes` · döntés · kész · C-1
    [core/files.mjs](../../../../core/files.mjs)
- A modulok egymás kis, deklarált végpontjait olvassák · `d-module-endpoints` · döntés · kész · C-1
  Pl. plan/ids és build/prd; egy modulnak akkor is működnie kell, ha a másik hiányzik. A core nem kap felhasználói funkciót. Az I-5 szerint felváltja: a munkaterületek a rekordtáron (/api/records) át látják egymást (d-rec-api-only).
  [modules/README.md](../../../../modules/README.md)

## Közös keret (fejléc, navigáció, téma) {#t-core-shell .done}

Minden modul egy közös kinézetet használ, amelyet a Mag ad; ez követi az operációs rendszer világos vagy sötét beállítását. A felület alapnyelve angol, magyar fordítással. A generált dokumentumok nyelvét nem a felület, hanem a beszélgetés nyelve határozza meg.

- Felület angolul, magyar fordítással · `d-ui-lang` · döntés · kész · C-1
  A keret, a Plan és a Build is; a nyelvet a fejlécben lehet váltani.
  [core/shell/i18n.mjs](../../../../core/shell/i18n.mjs)
- Közös kinézet a Magból, minden modul ehhez igazodik · `d-shared-look` · döntés · kész · C-1
  A közös változók a /shell/theme.css-ben; a Plan és a Build is ezeket használja.
  [core/shell/theme.css](../../../../core/shell/theme.css)
- Világos vagy sötét az OS beállítása szerint · `d-theme-os` · döntés · kész · C-1
  Kapcsoló nincs; a nézetek újratöltés nélkül is követik a váltást.
  [core/shell/theme.css](../../../../core/shell/theme.css)
- A keret birtokolja az élő kapcsolatot, a verziót, a nyelvet és a projekt nevét · `d-shell-owns` · döntés · kész · C-1
  Fülenként egy eseményfolyam; a modulok a /shell/live.mjs-en át kapják, és nem ismétlik a keret jelzéseit.
  [core/shell/live.mjs](../../../../core/shell/live.mjs)
- Fülváltáskor a modulok életben maradnak · `d-keep-alive` · döntés · kész · C-1
  A keret modulonként egy keretet tart meg, és csak elrejti; a térkép megtartja a nagyítást és kijelölést, a Build a görgetést és a szűrőket.
  [core/shell/frames.mjs](../../../../core/shell/frames.mjs)
- A modulok eszköztára a modulban marad · `d-toolbars` · döntés · C-1
  A keret modulfüggetlen marad; harmadik modulnál újragondolható.
- A gondolattérkép közös Lit-komponens a core-ban (`<gw-mind-map>`), a csomagba tett Mind Elixirrel · `d-map-component` · döntés · kész · C-4
  Most csak olvasható módban, a Plan térképtémájával. A mai Plan-térkép összenőtt a Plan állapotával, ezért az marad, ahogy van; a C-10 szünteti meg (d-lit-scope-c3, d-plan-dissolves).

## Csomagolás és terjesztés {#t-core-dist .done}

A Groundwork npm-csomagként jut el a felhasználóhoz, és `npx groundwork` paranccsal indítható. Minden függőségét magával hozza, így internet nélkül is működik. Egyetlen közös verziószáma van (semver), a modulok a csomaggal együtt verziózódnak.

Az `npx groundwork init` a projektbe teszi a Claude Code-hoz szükséges részeket: a skilleket a `.claude/skills/` alá, a hookot a `.claude/settings.json`-ba, a helyi állapot mappáját pedig a `.gitignore`-ba. A meglévő beállításokat megtartja, és csak azután ír, hogy megmutatta, mit fog módosítani, és jóváhagytad. Claude Code pluginként később is kiadható.

A kód új, `groundwork` nevű repóban él; a prd-maker prototípus ennek a magja, és ide költözik a fejlesztési dashboard-prototípus is. A licenc MIT.

- npm-csomag: npx groundwork · `d-npm` · döntés · C-1
- Claude Code plugin · `p-plugin` · félretett · C-1
- Bemásolható mappa · `x-copy` · kizárt · C-1
- Új groundwork repó (ez a mappa, átnevezve) · `d-repo` · döntés · C-1
- A dashboard-prototípus beköltözik · `d-move-dashboard` · döntés · kész · C-1
  [modules/build/module.mjs](../../../../modules/build/module.mjs)
- npx groundwork init: skillek és hook a projektbe · `d-init` · döntés · C-1
  A .claude/skills/ alá és a .claude/settings.json-ba, a meglévőt megtartva, csak jóváhagyás után.
- Minden függőség a csomagban, internet nélkül is működik · `d-offline` · döntés · kész · C-1
  [core/vendor/README.md](../../../../core/vendor/README.md)
- Egy közös semver verzió, a modulok a csomaggal együtt · `d-semver` · döntés · C-1
- Külön oldal–indító verziópár · `x-pair-version` · kizárt · C-1

## Biztonság {#t-core-sec .done}

Egyetlen szerver ír és olvas, ezért a hozzáférés szűk: csak a helyi gépről (`127.0.0.1`) érhető el, és idegen `Host` fejlécű kérést elutasít. Írni csak a projekt dokumentációs mappájába (`docs/product/`) és a saját helyi állapotába (`.groundwork/`) tud.

Saját tokent vagy jelszót nem kér és nem tárol. A GitHub olvasásához a felhasználó meglévő `gh`-bejelentkezését vagy a `GITHUB_TOKEN` / `GH_TOKEN` környezeti változót használhatja; ezt sehova nem menti, és az oldalakhoz soha nem jut el: az oldal csak az issue-kat kapja meg.

- Csak 127.0.0.1, idegen Host → 403 · `d-sec-local` · döntés · kész · C-1
  [core/server.mjs](../../../../core/server.mjs)
- Írni csak a docs/product/ és a .groundwork/ alá; egyetlen kivétel a kézzel indított record renumber, amely a .scratch/ alatti helyi jegyekben is átírja a hivatkozásokat · `d-sec-write` · döntés · kész · C-1, C-2
  A kivételt a #50 kéri (core/files.mjs: renumberFiles); más parancs és modul nem nyitja meg, és ugyanazok az útvonal-ellenőrzések védik.
  [core/files.mjs](../../../../core/files.mjs)
- Saját token- vagy jelszókezelés (bekérés, tárolás) · `x-sec-token` · kizárt · C-1
- GitHub olvasása a meglévő gh-bejelentkezéssel vagy GITHUB_TOKEN / GH_TOKEN változóval · `d-sec-github` · döntés · kész · C-1
  A szerver nem tárolja a tokent, és nem küldi az oldalnak; a hibaüzenetből is kivágja a tokennek látszó részt. Token nélkül a nyilvános repók olvashatók.
  [modules/build/github-source.mjs](../../../../modules/build/github-source.mjs)

## Platform és futtatási környezet {#t-core-platform .done}

A Groundwork Windowson, macOS-en és Linuxon fut, Node 20 vagy újabb verzióval. Chrome, Edge, Firefox és Safari böngészőben használható.

- Windows, macOS, Linux · `d-os` · döntés · C-1
- Node 20 vagy újabb · `d-node` · döntés · C-1
- Chrome, Edge, Firefox, Safari · `d-browsers` · döntés · C-1
- Teljesítménycél: 300 ms első kirajzolás, 100 ms fülváltás, 50 ms kérésenként · `d-perf` · döntés · részben · C-1
  Helyben, meleg indulásnál; a #19 mérése ehhez viszonyít.

## Technológiai stack {#t-core-stack .done}

Az egész Groundwork sima JavaScript ES-modulokból áll, keretrendszer és fordítási lépés nélkül. Amit módosítunk, az azonnal fut, offline is, és nincs függőségi lánc, ami csendben eltörhetne; az agentek is közvetlenül tudják futtatni és javítani a kódot.

A felület mégsem kézzel épített DOM-ból áll: a nézeteket egy kicsi, a csomagba tett sablonkönyvtár, a lit-html rajzolja deklaratívan és hatékonyan, a közös megjelenést pedig a keret theme.css-e adja kész komponensekkel. Hogy a kód áttekinthető maradjon, minden modul oldala kis fájlokra bomlik (nézetek, állapot, adatlekérés), nem egyetlen nagy index.html-re. Így megkapjuk egy keretrendszer előnyeit, a build-lépés és a függőségi lánc nélkül.

- Sima JavaScript ES-modulok, build-lépés nélkül · `d-vanilla` · döntés · C-1
  Mindkét meglévő eszköz már így készült.
- Modulonként több kisebb fájl, nem egy óriásfájl · `d-small-files` · döntés · kész · C-1
  A Plan oldala a modules/plan/view/, a Buildé a modules/build/page/ alatti kis ES-modulokból áll; build-lépés nincs, a böngésző a szerverről tölti be őket. A közös téma is több fájl: a theme.css a tokeneket tartja és importálja a komponenseket.
- Keretrendszer (React, Svelte, …) · `x-framework` · kizárt · C-1
- Fordítási lépés · `x-build-step` · kizárt · C-1
- Deklaratív nézetek lit-html-lel, a csomagba téve · `d-lit-html` · döntés · kész · C-1
  lit-html 3.2.1, kb. 7 KB, a core/vendor/ alatt; fordítási lépés nélkül fut, offline is.
  [core/vendor/lit-html/lit-html.js](../../../../core/vendor/lit-html/lit-html.js)
- Közös dizájnrendszer a theme.css-ben (.gw-* komponensek) · `d-design-system` · döntés · kész · C-1
  [core/shell/theme.css](../../../../core/shell/theme.css)
- JSDoc-típusok és tsc --noEmit ellenőrzés fejlesztési időben · `d-typecheck` · döntés · kész · C-2
  A rekordtárban és a modulszerződésben (rekordtípusok, op-ok, manifestek). Csak fejlesztői függőség, a csomagba nem kerül, a kód .mjs marad; az implement skill típusellenőrzése ezt futtatja.
- Szerver-keretrendszer (NestJS, Fastify) · `x-server-framework` · kizárt · C-2
  A szerver kicsi, zömmel tartománylogika; a HTTP-réteg nem fáj.
- Lit (LitElement) a munkaterületek közös komponenseihez · `d-lit` · döntés · kész · C-3
  Az I-5-tel: térképszerkesztő, rekordkártya, hivatkozás-chip, jóváhagyó lista mint web-komponens (pl. <gw-record-chip>). Fordítás nélkül fut, vendorolva a core/vendor/ alatt, kb. 15 KB; a mai lit-html sablonok változatlanul futnak benne, az áttérés fokozatos.
- Svelte vagy React a munkaterületekhez (újragondolva az I-5-nél) · `x-svelte-react` · kizárt · C-3
  Build-lépést és eszközláncot kívánna minden fejlesztőtől és agenttől; a párhuzamos worktree-kben dolgozó agenteknek az azonnali kör többet ér.
- SolidJS a munkaterületekhez · `x-solid` · kizárt · C-3
  Könnyű és gyors, de a természetes formája a JSX, ami build-lépést kíván; a fordítás nélküli útja (solid-js/html) másodrangú. A mai lit-html sablonok a Litben változatlanul futnak, Solidra minden lapot újra kellene írni.
