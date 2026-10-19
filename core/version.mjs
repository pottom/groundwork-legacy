// The one version of Groundwork: package.json's. The modules ship inside the package and carry
// the same version (their manifests import it), and the shell shows it in its header.

import fs from 'node:fs'

export const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
