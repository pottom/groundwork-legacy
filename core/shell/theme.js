// Light or dark: the one switch for the shell and every module page. Served at /shell/theme.js.
// A plain (not module) script, so it runs before the page paints: put it first in <head>,
//
//   <script src="/shell/theme.js"></script>
//   <link rel="stylesheet" href="/shell/theme.css">
//
// The choice is 'system' (the default: follow the OS), 'light' or 'dark'. It lives in
// localStorage under 'groundwork:theme', shared by every page of the origin, so a reload keeps
// it and the module frames agree with the shell; missing or blocked storage means 'system'.
// A forced choice is set as <html data-theme="light|dark">, which theme.css reads; 'system'
// sets none and the CSS follows prefers-color-scheme.
//
// A page whose code draws with colours of its own (a canvas, a library) follows the effective theme:
//
//   groundworkTheme.theme            'light' or 'dark', as shown now
//   groundworkTheme.choice           'system', 'light' or 'dark'
//   groundworkTheme.onChange((theme, choice) => ...)   after every change, also an OS switch while
//                                    the choice is 'system'; returns a function that stops it
//   groundworkTheme.set(choice)      switches: keeps the choice and tells the other pages (the shell's control)
//
// A change reaches the other pages through the storage event, and the frames of the page that
// made it also through a postMessage { type: 'groundwork:theme', choice } (only from its own origin).

;(function (win) {
  'use strict'
  var KEY = 'groundwork:theme'
  var MESSAGE = 'groundwork:theme'
  var known = function (c) { return c === 'light' || c === 'dark' ? c : 'system' }
  var root = win.document.documentElement
  var scheme = null
  try { scheme = win.matchMedia('(prefers-color-scheme: dark)') } catch (e) {}
  var listeners = []

  var read = function () { try { return known(win.localStorage.getItem(KEY)) } catch (e) { return 'system' } }
  var choice = read()
  var effective = function () { return choice === 'system' ? (scheme && scheme.matches ? 'dark' : 'light') : choice }
  var theme = effective()

  var apply = function () {
    if (choice === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', choice)
  }
  // Re-reads the effective theme; tells the listeners when it or the choice changed.
  var change = function (next) {
    var before = theme, chosen = choice
    choice = known(next)
    theme = effective()
    apply()
    if (theme === before && choice === chosen) return false
    listeners.slice().forEach(function (fn) { fn(theme, choice) })
    return true
  }
  apply()

  if (scheme && scheme.addEventListener) scheme.addEventListener('change', function () { change(choice) })
  win.addEventListener('storage', function (e) { if (e.key === KEY) change(e.newValue) })
  win.addEventListener('message', function (e) {
    if (e.origin === win.location.origin && e.data && e.data.type === MESSAGE) change(e.data.choice)
  })

  win.groundworkTheme = {
    get theme() { return theme },
    get choice() { return choice },
    set: function (next) {
      change(next)
      try { win.localStorage.setItem(KEY, choice) } catch (e) {}
      var origin = win.location.origin
      Array.prototype.forEach.call(win.frames || [], function (f) {
        try { f.postMessage({ type: MESSAGE, choice: choice }, origin && origin !== 'null' ? origin : '*') } catch (e) {}
      })
    },
    onChange: function (fn) {
      listeners.push(fn)
      return function () { listeners = listeners.filter(function (x) { return x !== fn }) }
    },
  }
})(window)
