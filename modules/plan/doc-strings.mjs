// The fixed texts of the generated documents, one set per document language.
// Shared by the server (documents.mjs writes the .md files) and the browser (the document panel).
//
// The map stores its document language on the root (nodeData.metadata.lang); a map without
// one is Hungarian. The document language is the language of the interview, independent of
// the language of the user interface: these are not UI strings.
//
// To add a language, add a set here with the same keys; nothing else changes.
//   kinds[kind]      subtitle, the titles of the generated closing sections (cross), and the
//                    starting sections the skill proposes
//   otherCross       closing section titles of a kind not listed in kinds
//   sectionCounts(c, sep)  how many sections are done, in progress and untouched
//   status(c)        the status line under the header
//   inferredCount(n) how many items read from the code wait for confirmation
//   ideasSection     the section of the PRD that holds the ideas the Ideas module sends (todo.mjs)

const huCounts = (c, sep) => `${c.done} kész${sep}${c.active} folyamatban${sep}${c.untouched} érintetlen fejezet`
const enCounts = (c, sep) => `Sections: ${c.done} done${sep}${c.active} in progress${sep}${c.untouched} untouched`

export const DOC_STRINGS = {
  hu: {
    name: 'magyar',
    kinds: {
      system:  { subtitle: 'Rendszer-áttekintés', cross: { nonGoals: 'Nem része a rendszernek', later: 'Későbbi szakaszok', open: 'Nyitott kérdések' },
        sections: ['Cél és érintettek', 'Összetevők és határaik', 'Közös ütemterv', 'Kockázatok és függőségek', 'Költségek'] },
      prd:     { subtitle: 'Termékkövetelmény-dokumentum (PRD)', cross: { nonGoals: 'Nem célok', later: 'Későbbi verziók', open: 'Nyitott kérdések' },
        sections: ['Probléma és cél', 'Felhasználók és használati esetek', 'Hatókör és fő funkciók', 'Funkcionális követelmények', 'Nem funkcionális követelmények'] },
      tech:    { subtitle: 'Műszaki terv', cross: { nonGoals: 'Elvetett megoldások', later: 'Későbbre halasztva', open: 'Nyitott műszaki kérdések' },
        sections: ['Platform és futtatási környezet', 'Technológiai stack', 'Architektúra és komponensek', 'Adatok és tárolás', 'Integrációk és interfészek', 'Biztonság', 'Build, kiadás, telepítés', 'Tesztelés és minőség', 'Döntésnapló'] },
      service: { subtitle: 'Szolgáltatásleírás', cross: { nonGoals: 'Nem része a szolgáltatásnak', later: 'Későbbi bővítések', open: 'Nyitott kérdések' },
        sections: ['Kinek és mit', 'Szolgáltatási szint (SLA)', 'Csatornák', 'Feltételek és árazás', 'Mérőszámok'] },
      process: { subtitle: 'Folyamatleírás', sections: ['Szerepek', 'Fő folyamatok', 'Eszkaláció', 'Átadások'] },
      infra:   { subtitle: 'Infrastruktúra-terv', cross: { nonGoals: 'Elvetett megoldások', later: 'Későbbre halasztva', open: 'Nyitott kérdések' },
        sections: ['Környezetek', 'Hálózat', 'Kapacitás', 'Biztonság', 'Mentés'] },
      ops:     { subtitle: 'Üzemeltetési terv', sections: ['Monitorozás', 'Incidenskezelés', 'Mentés és helyreállítás', 'Karbantartás', 'Támogatási modell'] },
      rollout: { subtitle: 'Bevezetési terv', sections: ['Ütemezés', 'Migráció', 'Oktatás', 'Kommunikáció', 'Visszaállítási terv'] },
    },
    otherCross: { nonGoals: 'Nem része', later: 'Későbbre halasztva', open: 'Nyitott kérdések' },
    progress: { done: 'kész', active: 'folyamatban', untouched: 'érintetlen' },
    impl: { done: 'kész', partial: 'részben', missing: 'hiányzik' },
    about: 'A grilling-interjú közben készül; a felsorolások a gondolattérképből jönnek.',
    related: 'Kapcsolódó',
    sectionCounts: huCounts,
    status: (c) => `Állapot: ${huCounts(c, ', ')}.`,
    inferredCount: (n) => `${n} kódból kiolvasott elem megerősítésre vár.`,
    implementation: 'Megvalósítás',
    inferred: 'kódból, megerősítésre vár',
    untouchedSection: 'érintetlen fejezet',
    notDiscussed: 'Még nem beszéltük át.',
    notDiscussedItem: 'még nem beszéltük át',
    glossary: 'Fogalmak',
    see: 'Lásd',
    ideasSection: 'Ötletek',
  },
  en: {
    name: 'English',
    kinds: {
      system:  { subtitle: 'System overview', cross: { nonGoals: 'Not part of the system', later: 'Later phases', open: 'Open questions' },
        sections: ['Goal and stakeholders', 'Components and their boundaries', 'Shared roadmap', 'Risks and dependencies', 'Costs'] },
      prd:     { subtitle: 'Product requirements document (PRD)', cross: { nonGoals: 'Non-goals', later: 'Later versions', open: 'Open questions' },
        sections: ['Problem and goal', 'Users and use cases', 'Scope and main features', 'Functional requirements', 'Non-functional requirements'] },
      tech:    { subtitle: 'Technical design', cross: { nonGoals: 'Rejected alternatives', later: 'Deferred', open: 'Open technical questions' },
        sections: ['Platform and runtime', 'Technology stack', 'Architecture and components', 'Data and storage', 'Integrations and interfaces', 'Security', 'Build, release, deployment', 'Testing and quality', 'Decision log'] },
      service: { subtitle: 'Service description', cross: { nonGoals: 'Not part of the service', later: 'Later extensions', open: 'Open questions' },
        sections: ['Who and what', 'Service level (SLA)', 'Channels', 'Terms and pricing', 'Metrics'] },
      process: { subtitle: 'Process description', sections: ['Roles', 'Main processes', 'Escalation', 'Handovers'] },
      infra:   { subtitle: 'Infrastructure plan', cross: { nonGoals: 'Rejected alternatives', later: 'Deferred', open: 'Open questions' },
        sections: ['Environments', 'Network', 'Capacity', 'Security', 'Backup'] },
      ops:     { subtitle: 'Operations plan', sections: ['Monitoring', 'Incident management', 'Backup and recovery', 'Maintenance', 'Support model'] },
      rollout: { subtitle: 'Rollout plan', sections: ['Schedule', 'Migration', 'Training', 'Communication', 'Rollback plan'] },
    },
    otherCross: { nonGoals: 'Not included', later: 'Deferred', open: 'Open questions' },
    progress: { done: 'done', active: 'in progress', untouched: 'untouched' },
    impl: { done: 'done', partial: 'partial', missing: 'missing' },
    about: 'Written during the grilling interview; the lists come from the mind map.',
    related: 'Related',
    sectionCounts: enCounts,
    status: (c) => `${enCounts(c, ', ')}.`,
    inferredCount: (n) => (n === 1 ? '1 item read from the code awaits confirmation.' : `${n} items read from the code await confirmation.`),
    implementation: 'Implementation',
    inferred: 'from the code, awaiting confirmation',
    untouchedSection: 'untouched section',
    notDiscussed: 'Not discussed yet.',
    notDiscussedItem: 'not discussed yet',
    glossary: 'Glossary',
    see: 'See',
    ideasSection: 'Ideas',
  },
}

// The documents' default language; the UI's default is DEFAULT_LANG in core/shell/i18n.mjs.
export const DEFAULT_DOC_LANG = 'hu'

// The language a map's documents are written in.
export const langOf = (data) => data.nodeData?.metadata?.lang || DEFAULT_DOC_LANG

// The strings of a language; an unknown one falls back to the default.
export const docStrings = (lang) => DOC_STRINGS[lang] || DOC_STRINGS[DEFAULT_DOC_LANG]
