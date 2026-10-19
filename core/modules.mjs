// The modules the core server loads. In the first version every module lives inside the package.
// The order is the order of the shell's tabs, the first one shown at /: the flow, Ideas → Plan → Build, then the tools (Sketch, Agents), behind a separator.

import ideas from '../modules/ideas/module.mjs'
import plan from '../modules/plan/module.mjs'
import build from '../modules/build/module.mjs'
import sketch from '../modules/sketch/module.mjs'
import agents from '../modules/agents/module.mjs'

export const MODULES = [ideas, plan, build, sketch, agents]
