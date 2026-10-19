// The source of Plan's page: every file the manifest serves to the browser, as one text,
// for tests that check what the view says or loads.

import fs from 'node:fs'
import path from 'node:path'
import plan from './module.mjs'

export const viewSource = () => plan.view.files.map((f) => fs.readFileSync(path.join(plan.view.dir, f), 'utf8')).join('\n')
