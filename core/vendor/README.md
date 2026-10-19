# core/vendor

The browser-side dependencies, shipped in the package so Groundwork works without a network. The core server serves this folder at `/vendor/...` (only `.js`, `.css`, `.woff2` and the other types in `core/http.mjs`; never a path outside the folder). Nothing here is installed or built: the files are copied unchanged from the npm packages below.

| Package | Version | License | Files here | Source |
|---|---|---|---|---|
| `mind-elixir` | 5.15.1 | MIT | `mind-elixir/MindElixir.js`, `mind-elixir/MindElixir.css` (from `dist/`) | https://www.npmjs.com/package/mind-elixir/v/5.15.1 |
| `marked` | 12.0.2 | MIT (plus the BSD notice of the original Markdown, in `LICENSE.md`) | `marked/marked.esm.js` (from `lib/`) | https://www.npmjs.com/package/marked/v/12.0.2 |
| `lit-html` | 3.2.1 | BSD-3-Clause | `lit-html/lit-html.js`, `lit-html/directive.js`, `lit-html/directive-helpers.js`, `lit-html/directives/{repeat,class-map,live,unsafe-html}.js` (the package's minified ES modules, unchanged) | https://www.npmjs.com/package/lit-html/v/3.2.1 |
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 | `fonts/inter/inter-latin{,-ext}-wght-normal.woff2` (Inter, variable weight) | https://www.npmjs.com/package/@fontsource-variable/inter/v/5.3.0 |
| `@fontsource-variable/source-serif-4` | 5.3.1 | OFL-1.1 | `fonts/source-serif-4/source-serif-4-latin{,-ext}-opsz-{normal,italic}.woff2` (Source Serif 4, variable weight and optical size) | https://www.npmjs.com/package/@fontsource-variable/source-serif-4/v/5.3.1 |

Each package's license file sits next to its files (`LICENSE`, `LICENSE.md`). `fonts.css` is ours: the `@font-face` rules for the fonts above, under the family names the pages use (`Inter`, `'Source Serif 4'`), in place of Google Fonts. Only the latin and latin-ext subsets are shipped, which cover English and Hungarian.

To update a package: `npm pack <name>@<version>` in a scratch folder, copy the same files over, and change the version here and in the page that loads it. `core/offline.test.mjs` checks that this table lists every package and that no page loads anything from another host.
