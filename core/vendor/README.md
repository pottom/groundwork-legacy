# core/vendor

The browser-side dependencies, shipped in the package so Groundwork works without a network. The core server serves this folder at `/vendor/...` (only `.js`, `.css`, `.woff2` and the other types in `core/http.mjs`; never a path outside the folder). Nothing here is installed or built: the files are copied unchanged from the npm packages below.

| Package | Version | License | Files here | Source |
|---|---|---|---|---|
| `mind-elixir` | 5.15.1 | MIT | `mind-elixir/MindElixir.js`, `mind-elixir/MindElixir.css` (from `dist/`) | https://www.npmjs.com/package/mind-elixir/v/5.15.1 |
| `marked` | 12.0.2 | MIT (plus the BSD notice of the original Markdown, in `LICENSE.md`) | `marked/marked.esm.js` (from `lib/`) | https://www.npmjs.com/package/marked/v/12.0.2 |
| `lit-html` | 3.2.1 | BSD-3-Clause | `lit-html/lit-html.js`, `lit-html/directive.js`, `lit-html/directive-helpers.js`, `lit-html/directives/{repeat,class-map,live,unsafe-html}.js` (the package's minified ES modules, unchanged) | https://www.npmjs.com/package/lit-html/v/3.2.1 |
| `lit-element` | 4.1.1 | BSD-3-Clause | `lit-element/lit-element.js` (LitElement; the package's minified ES module, unchanged) | https://www.npmjs.com/package/lit-element/v/4.1.1 |
| `@lit/reactive-element` | 2.0.4 | BSD-3-Clause | `reactive-element/reactive-element.js`, `reactive-element/css-tag.js` (the base class LitElement extends; unchanged) | https://www.npmjs.com/package/@lit/reactive-element/v/2.0.4 |
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 | `fonts/inter/inter-latin{,-ext}-wght-normal.woff2` (Inter, variable weight) | https://www.npmjs.com/package/@fontsource-variable/inter/v/5.3.0 |
| `@fontsource-variable/source-serif-4` | 5.3.1 | OFL-1.1 | `fonts/source-serif-4/source-serif-4-latin{,-ext}-opsz-{normal,italic}.woff2` (Source Serif 4, variable weight and optical size) | https://www.npmjs.com/package/@fontsource-variable/source-serif-4/v/5.3.1 |
| `@excalidraw/excalidraw` | 0.17.6 | MIT (`LICENSE`; plus the third-party notices in the `*.LICENSE.txt` files beside the scripts) | `excalidraw/excalidraw.production.min.js` and `excalidraw/excalidraw-assets/` (fonts, `locales/`, the lazily loaded `vendor-*.js` chunk), from `dist/`; the UMD build, global `ExcalidrawLib` | https://www.npmjs.com/package/@excalidraw/excalidraw/v/0.17.6 |
| `react` | 18.3.1 | MIT | `react/react.production.min.js` (from `umd/`; global `React`) | https://www.npmjs.com/package/react/v/18.3.1 |
| `react-dom` | 18.3.1 | MIT | `react-dom/react-dom.production.min.js` (from `umd/`; global `ReactDOM`) | https://www.npmjs.com/package/react-dom/v/18.3.1 |

Each package's license file sits next to its files (`LICENSE`, `LICENSE.md`). `fonts.css` is ours: the `@font-face` rules for the fonts above, under the family names the pages use (`Inter`, `'Source Serif 4'`), in place of Google Fonts. Only the latin and latin-ext subsets are shipped, which cover English and Hungarian.

Lit (LitElement, d-lit) is these three packages, the versions the `lit` 3.2.1 package pins, not the `lit` package itself, which only re-exports them. `lit-element.js` names its two dependencies by their package names (`import … from "lit-html"`, `"@lit/reactive-element"`), which a browser resolves only through an import map, so a page that uses Lit has one inline in its `<head>`, before any module script, and imports Lit as `/vendor/lit-element/lit-element.js` (the Changes page, `modules/changes/index.html`):

```html
<script type="importmap">{ "imports": { "lit-html": "/vendor/lit-html/lit-html.js", "@lit/reactive-element": "/vendor/reactive-element/reactive-element.js" } }</script>
```

The map points `lit-html` at the copy above, so the pages that use lit-html alone and the Lit components share one lit-html.

Excalidraw and React are loaded only by the Sketch module's page (`modules/sketch/index.html`), so no other page pays for their size. Excalidraw is the 0.17 UMD build, which runs from a plain `<script>` with React 18's UMD builds beside it; the newer 0.18 ships only as ES modules with some twenty bare imports, which would need a bundler (React 19 has no UMD build at all). The page sets `window.EXCALIDRAW_ASSET_PATH = '/vendor/excalidraw/'` before the script, or Excalidraw would fetch its fonts and locales from unpkg. Its npm package has no license file, so `excalidraw/LICENSE` is the MIT text of the excalidraw repository (tag v0.17.6). One string in `excalidraw.production.min.js` names another host: the template of an embedded tweet; `core/offline.test.mjs` allows exactly that one, and the Sketch page turns embeds off.

To update a package: `npm pack <name>@<version>` in a scratch folder, copy the same files over, and change the version here and in the page that loads it. `core/offline.test.mjs` checks that this table lists every package and that no page loads anything from another host.
