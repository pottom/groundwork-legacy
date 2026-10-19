// The Agents page's user interface strings, one set per UI language, for the core's translation
// (core/shell/i18n.mjs; {name} is a placeholder). English is the default. Labels are in sentence case.

export const UI_STRINGS = {
  en: {
    'title': 'Agents',
    'hint': 'Claude Code sessions and their subagents, as the hooks log them',
    'state.running': 'Running',
    'state.done': 'Done',
    'state.failed': 'Failed',
    'session': 'Session {id}',
    'agent.unnamed': 'Subagent',
    'started': 'Started {time}',
    'took': 'Duration {duration}',
    'no-agents': 'No subagents in this session',
    'empty.title': 'No agent activity yet',
    'empty.text': 'Run groundwork init in this project and restart Claude Code: its sessions and subagents show here as they run.',
    'error': 'Could not read the agents',
  },
  hu: {
    'title': 'Agentek',
    'hint': 'Claude Code munkamenetek és subagentjeik, ahogy a hookok naplózzák őket',
    'state.running': 'Fut',
    'state.done': 'Kész',
    'state.failed': 'Hibával állt le',
    'session': '{id} munkamenet',
    'agent.unnamed': 'Segédagent',
    'started': 'Indult: {time}',
    'took': 'Időtartam: {duration}',
    'no-agents': 'Ebben a munkamenetben nincs subagent',
    'empty.title': 'Még nincs agent-tevékenység',
    'empty.text': 'Futtasd a groundwork init parancsot ebben a projektben, és indítsd újra a Claude Code-ot: a munkamenetei és subagentjei futás közben itt jelennek meg.',
    'error': 'Nem sikerült beolvasni az agenteket',
  },
}
