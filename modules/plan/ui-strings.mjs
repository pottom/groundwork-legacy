// Plan's user interface strings, one set per UI language, for the core's translation
// (core/shell/i18n.mjs; {name} is a placeholder). English is the default.
//
// These are not the texts of the generated documents: those follow the map's document
// language and live in doc-strings.mjs.

export const UI_STRINGS = {
  en: {
    'sync.loading': 'loading…',
    'sync.live': 'live',
    'sync.saving': 'saving…',
    'sync.saved': 'saved {time}',
    'sync.updated': 'updated {time}',
    'sync.saveError': 'could not save: {error}',
    'sync.stale': 'the server restarted: the last edit was not saved, please make it again',
    'sync.offline': 'no connection',

    'focus.title': 'What the map shows',
    'focus.all': 'Whole map',
    'focus.whole': '{topic}: all of it',

    'view.map': 'Map',
    'view.split': 'Both',
    'view.prd': 'Document',
    'view.closePanel': 'Close the document',
    'view.openPanel': 'Open the document',

    'mode.edit': 'Editing',
    'mode.view': 'View',
    'mode.editTitle': 'Editing: click to lock',
    'mode.viewTitle': 'View only: click to edit',

    'dock.hint': 'Select a node',
    'dock.root': 'The root has no status',
    'dock.implTitle': 'Implementation: {label}',

    'panel.document': 'Document',
    'panel.live': 'live',
    'panel.autoUpdates': '{file} updates automatically',
    'panel.edit': 'Edit',
    'panel.yours': 'You wrote this · Claude does not overwrite it',
    'panel.add': '+ Your own paragraph',

    'editor.tipClaude': 'If you rewrite it, the paragraph becomes yours and Claude will not overwrite it.',
    'editor.tip': 'Markdown works. Ctrl+Enter: save, Esc: cancel.',
    'editor.save': 'Save',
    'editor.cancel': 'Cancel',
    'editor.delete': 'Delete',

    'empty.start': 'Start one:',
    'empty.topic': 'Topic',

    'map.newTopic': 'new branch',
    'menu.addChild': 'Add child',
    'menu.addParent': 'Add parent',
    'menu.addSibling': 'Add sibling',
    'menu.removeNode': 'Remove node',
    'menu.focus': 'Focus on this',
    'menu.cancelFocus': 'Leave focus',
    'menu.moveUp': 'Move up',
    'menu.moveDown': 'Move down',
    'menu.link': 'Link',
    'menu.linkBidirectional': 'Two-way link',
    'menu.clickTips': 'Click the target node',
    'menu.summary': 'Summary',

    'status.topic': 'topic',
    'status.decision': 'decision',
    'status.note': 'fact',
    'status.excluded': 'excluded',
    'status.parked': 'later',
    'status.todo': 'ask about it',
    'status.inferred': 'from code',

    'impl.done': 'done',
    'impl.partial': 'partial',
    'impl.missing': 'missing',

    'component.software': 'software',
    'component.service': 'service',
    'component.infra': 'infrastructure',
    'component.shared': 'shared',
  },
  hu: {
    'sync.loading': 'betöltés…',
    'sync.live': 'élő',
    'sync.saving': 'mentés…',
    'sync.saved': 'mentve {time}',
    'sync.updated': 'frissítve {time}',
    'sync.saveError': 'mentési hiba: {error}',
    'sync.stale': 'a szerver újraindult: az utolsó szerkesztés nem mentődött, ismételd meg',
    'sync.offline': 'nincs kapcsolat',

    'focus.title': 'Mit mutasson a térkép',
    'focus.all': 'Teljes térkép',
    'focus.whole': '{topic}: egész',

    'view.map': 'Térkép',
    'view.split': 'Mindkettő',
    'view.prd': 'Dokumentum',
    'view.closePanel': 'Dokumentum becsukása',
    'view.openPanel': 'Dokumentum megnyitása',

    'mode.edit': 'Szerkesztés',
    'mode.view': 'Nézet',
    'mode.editTitle': 'Szerkesztés: kattints a zároláshoz',
    'mode.viewTitle': 'Csak nézet: kattints a szerkesztéshez',

    'dock.hint': 'Jelölj ki egy csomópontot',
    'dock.root': 'A gyökérnek nincs státusza',
    'dock.implTitle': 'Megvalósítás: {label}',

    'panel.document': 'Dokumentum',
    'panel.live': 'élő',
    'panel.autoUpdates': '{file} automatikusan frissül',
    'panel.edit': 'Szerkesztés',
    'panel.yours': 'Te írtad · Claude nem írja felül',
    'panel.add': '+ Saját bekezdés',

    'editor.tipClaude': 'Ha átírod, a bekezdés a tiéd lesz, és Claude nem írja felül.',
    'editor.tip': 'Markdown is használható. Ctrl+Enter: mentés, Esc: mégse.',
    'editor.save': 'Mentés',
    'editor.cancel': 'Mégse',
    'editor.delete': 'Törlés',

    'empty.start': 'Indítsd:',
    'empty.topic': 'Téma',

    'map.newTopic': 'új ág',
    'menu.addChild': 'Új gyerek',
    'menu.addParent': 'Új szülő',
    'menu.addSibling': 'Új testvér',
    'menu.removeNode': 'Csomópont törlése',
    'menu.focus': 'Fókusz erre',
    'menu.cancelFocus': 'Fókusz vége',
    'menu.moveUp': 'Feljebb',
    'menu.moveDown': 'Lejjebb',
    'menu.link': 'Kapcsolat',
    'menu.linkBidirectional': 'Kétirányú kapcsolat',
    'menu.clickTips': 'Kattints a cél csomópontra',
    'menu.summary': 'Összegzés',

    'status.topic': 'téma',
    'status.decision': 'döntés',
    'status.note': 'tény',
    'status.excluded': 'kizárva',
    'status.parked': 'később',
    'status.todo': 'kérdezz rá',
    'status.inferred': 'kódból',

    'impl.done': 'kész',
    'impl.partial': 'részben',
    'impl.missing': 'hiányzik',

    'component.software': 'szoftver',
    'component.service': 'szolgáltatás',
    'component.infra': 'infrastruktúra',
    'component.shared': 'közös',
  },
}
