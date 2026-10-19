// The Ideas page's user interface strings, one set per UI language, for the core's translation
// (core/shell/i18n.mjs; {name} is a placeholder). English is the default. Labels are in sentence case.

export const UI_STRINGS = {
  en: {
    'board.label': 'Ideas by status',
    'status.new': 'New',
    'status.considering': 'Considering',
    'status.to-develop': 'To develop',
    'status.rejected': 'Rejected',
    'author.claude': 'Claude',
    'author.human': 'Human',
    'kind.product': 'Product',
    'kind.engineering': 'Engineering',
    'card.source': 'Source: {source}',
    'column.empty': 'Nothing here',
    'empty.title': 'No ideas yet',
    'empty.text': 'Add one from the command line, or ask Claude to note an idea down.',
    'error.title': 'Could not read the ideas',
    'error.text': 'The server did not answer: {error}',
  },
  hu: {
    'board.label': 'Ötletek állapot szerint',
    'status.new': 'Új',
    'status.considering': 'Mérlegelés',
    'status.to-develop': 'Kidolgozásra',
    'status.rejected': 'Elvetve',
    'author.claude': 'Claude',
    'author.human': 'Ember',
    'kind.product': 'Termék',
    'kind.engineering': 'Mérnöki',
    'card.source': 'Forrás: {source}',
    'column.empty': 'Nincs itt semmi',
    'empty.title': 'Még nincs ötlet',
    'empty.text': 'Vegyél fel egyet a parancssorból, vagy kérd meg Claude-ot, hogy jegyezzen fel egy ötletet.',
    'error.title': 'Nem sikerült beolvasni az ötleteket',
    'error.text': 'A szerver nem válaszolt: {error}',
  },
}
