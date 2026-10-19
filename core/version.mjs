// The one version of Groundwork: package.json's. The modules ship inside the package and carry
// the same version (their manifests import it), and the shell shows it in its header.
//
// RUNNER is how a project runs Groundwork once `groundwork init` set it up: the hooks and the
// skills call `<RUNNER> plan hook`, `<RUNNER> plan apply`, ... It names our scoped package (the
// unscoped npm `groundwork` is someone else's) at exactly this version, so a project runs the
// version init installed. --prefer-offline: npx then takes the package from its cache without
// asking the registry, so a hook that runs on every prompt needs no network after the first run
// (without it npx asks the registry each time, and waits a long time when it is unreachable).

import fs from 'node:fs'

const PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export const NAME = PKG.name
export const VERSION = PKG.version
export const RUNNER = `npx -y --prefer-offline ${NAME}@${VERSION}`
