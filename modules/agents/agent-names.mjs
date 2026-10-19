// What the module calls a subagent, shared by the server and the page (plain functions, no
// imports; hook.mjs keeps its own copy, as it must stay one file).
//
//   AGENT_TOOLS          the tool that starts a subagent: Agent, and Task, its older name
//   isAgentTool(name)    whether a tool call starts a subagent
//   agentLabel(agent)    its label: the Agent call's description, else its type, else null

export const AGENT_TOOLS = ['Agent', 'Task']

export const isAgentTool = (name) => AGENT_TOOLS.includes(name)

export const agentLabel = (agent) => agent?.description || agent?.type || null
