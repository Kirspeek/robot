// Робот против людей: interface languages.
// The game is written in Russian. When another language is chosen, every Russian text that appears on the page
// (buttons, hints, messages, dialogs) is looked up in lang/<code>.js and replaced. Chat and player-written text is never touched.
'use strict';
const LANGS = [
  ['ru', 'Русский'], ['uk', 'Українська'], ['en', 'English'], ['es', 'Español (México)'], ['fr', 'Français'],
  ['it', 'Italiano'], ['de', 'Deutsch'], ['pl', 'Polski'], ['bg', 'Български'], ['pt', 'Português (Brasil)'],
  ['tr', 'Türkçe'], ['ja', '日本語'], ['zh', '中文'], ['ko', '한국어']
];
const LOCALE = {ru:'ru-RU', uk:'uk-UA', en:'en-GB', es:'es-MX', fr:'fr-FR', it:'it-IT', de:'de-DE', pl:'pl-PL', bg:'bg-BG', pt:'pt-BR', tr:'tr-TR', ja:'ja-JP', zh:'zh-CN', ko:'ko-KR'};
const I18N = (() => {
  let lang = 'ru';
  try { const s = JSON.parse(localStorage.getItem('forpost.settings')); if(s && LOCALE[s.lang]) lang = s.lang; } catch(e){}
  const CYR = /[А-Яа-яЁё]/;
  const RICH = /^(B|KBD|A|I|BR|EM|STRONG|SPAN|SMALL|CODE|U)$/;
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const ORIG = new WeakMap();     // text node -> its Russian text
  const MINE = new WeakMap();     // text node -> the text this script wrote (to ignore our own changes)
  const ORIGH = new WeakMap();    // element translated as a whole -> its Russian innerHTML
  const ORIGA = new WeakMap();    // element -> {attr: Russian value}
  let D = null, P = [], cache = new Map(), obs = null, depth = 0;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function use(dict){
    D = new Map(); P = []; cache = new Map();
    for(const k in dict){
      const v = dict[k]; if(!v) continue;
      if(/\{\d\}/.test(k)){
        const lits = k.split(/\{\d\}/).filter(Boolean);
        if(!lits.some(l => CYR.test(l))) continue;
        const order = [...k.matchAll(/\{(\d)\}/g)].map(m => m[1]);
        const re = new RegExp('^' + k.split(/\{\d\}/).map(esc).join('([\\s\\S]+?)') + '$');
        P.push({re, v, order, key: lits.reduce((a, b) => b.length > a.length ? b : a, '')});
      } else D.set(norm(k), v);
    }
    P.sort((a, b) => b.key.length - a.key.length);
  }

  function core(s){
    const d = D.get(s); if(d !== undefined) return d;
    for(const p of P){
      if(s.indexOf(p.key) < 0) continue;
      const m = p.re.exec(s); if(!m) continue;
      const g = {}; p.order.forEach((n, i) => { g[n] = m[i + 1]; });
      return p.v.replace(/\{(\d)\}/g, (_, n) => g[n] === undefined ? '' : T(g[n]));
    }
    return null;
  }
  // translates one string; unknown parts stay as they are
  function T(s){
    if(lang === 'ru' || !D || typeof s !== 'string' || !CYR.test(s)) return s;
    const c = cache.get(s); if(c !== undefined) return c;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), body = norm(m[2]);
    let out = core(body);
    if(out === null && depth < 4){
      depth++;
      // split into pieces at separators and translate each one
      const parts = body.split(/(\s[·—–|]\s|\n|:\s|;\s|,\s|\.\s|!\s|\?\s|\s\(|\)\s?)/);
      if(parts.length > 1){ const t = parts.map((x, i) => i % 2 ? x : T(x)).join(''); if(t !== body) out = t; }
      if(out === null){
        // leading/trailing emoji or symbols around a known phrase
        const e = /^([^А-Яа-яЁё0-9«"(]*)([\s\S]*?)([^А-Яа-яЁё0-9»")]*)$/.exec(body);
        if(e && (e[1] || e[3])){ const r = core(e[2]); if(r !== null) out = e[1] + r + e[3]; }
      }
      depth--;
    }
    if(out === null) out = body;
    out = m[1] + out + m[3];
    if(cache.size > 3000) cache.clear();
    cache.set(s, out);
    return out;
  }

  const skip = n => { const e = n.nodeType === 1 ? n : n.parentElement; return !e || !!e.closest('[translate="no"],script,style,textarea'); };
  function doText(n){
    if(MINE.get(n) === n.data) return;
    if(skip(n)) return;
    ORIG.set(n, n.data);
    const t = T(n.data);
    if(t !== n.data){ MINE.set(n, t); n.data = t; }
  }
  function doAttrs(el){
    for(const a of ATTRS){
      const v = el.getAttribute(a); if(v === null) continue;
      const o = ORIGA.get(el) || {};
      if(o['_' + a] === v) continue;      // our own value
      o[a] = v; const t = T(v); o['_' + a] = t; ORIGA.set(el, o);
      if(t !== v) el.setAttribute(a, t);
    }
  }
  // a paragraph with <b>, <kbd>, <a>… inside: translated as a whole, so the sentence stays in one piece
  function richKey(el){
    if(!el.firstElementChild || !CYR.test(el.textContent)) return null;
    for(const c of el.querySelectorAll('*')) if(!RICH.test(c.tagName) || c.id) return null;
    return norm(el.innerHTML);
  }
  function doRich(el){
    const k = richKey(el); if(k === null) return false;
    const t = core(k); if(t === null) return false;
    if(!ORIGH.has(el)) ORIGH.set(el, el.innerHTML);
    el.innerHTML = t; MINE.set(el, norm(el.innerHTML));
    return true;
  }
  function walk(root){
    if(root.nodeType === 3){ doText(root); return; }
    if(root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    if(doRich(root)) return;
    for(let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function onMut(list){
    for(const r of list){
      if(r.type === 'characterData'){ doText(r.target); continue; }
      if(r.type === 'attributes'){ if(r.target.nodeType === 1 && !skip(r.target)) doAttrs(r.target); continue; }
      const t = r.target;
      if(t.nodeType === 1 && MINE.get(t) === norm(t.innerHTML)) continue;
      if(t.nodeType === 1 && !skip(t) && richKey(t) !== null){ ORIGH.delete(t); if(doRich(t)) continue; }
      for(const n of r.addedNodes) walk(n);
    }
  }
  function start(){
    document.documentElement.lang = lang;
    if(lang === 'ru' || !D) return;
    walk(document.body);
    document.title = T(document.title);
    if(!obs) obs = new MutationObserver(onMut);
    obs.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  }
  // puts every translated text back into Russian (before switching to another language)
  function undo(root){
    if(root.nodeType === 3){ const o = ORIG.get(root); if(o !== undefined && MINE.get(root) === root.data){ root.data = o; } MINE.delete(root); return; }
    if(root.nodeType !== 1) return;
    const h = ORIGH.get(root);
    if(h !== undefined){ root.innerHTML = h; ORIGH.delete(root); MINE.delete(root); return; }
    const o = ORIGA.get(root);
    if(o) for(const a of ATTRS) if(o[a] !== undefined && root.getAttribute(a) === o['_' + a]) root.setAttribute(a, o[a]);
    ORIGA.delete(root);
    for(let c = root.firstChild; c; c = c.nextSibling) undo(c);
  }
  function set(code, done){
    if(!LOCALE[code] || code === lang){ if(done) done(); return; }
    if(obs) obs.disconnect();
    undo(document.body);
    document.title = 'Робот против людей';
    lang = code; cache = new Map();
    if(code === 'ru'){ D = null; start(); if(done) done(); return; }
    const sc = document.createElement('script');
    sc.src = 'lang/' + code + '.js';
    sc.onload = () => { use(window.LANG_DICT || {}); start(); if(done) done(); };
    sc.onerror = () => { if(done) done('err'); };
    document.head.appendChild(sc);
  }
  // the dictionary of the saved language is loaded before the game builds, so 3D signs come out translated too
  if(lang !== 'ru') document.write('<script src="lang/' + lang + '.js"><\/script>');
  return {
    T, start, set, use,
    get lang(){ return lang; },
    get locale(){ return LOCALE[lang]; },
    loaded(){ if(window.LANG_DICT && !D && lang !== 'ru') use(window.LANG_DICT); }
  };
})();
const tr = I18N.T;
// browser dialogs too
(() => {
  const a = window.alert.bind(window), c = window.confirm.bind(window), p = window.prompt.bind(window);
  window.alert = m => a(tr(String(m)));
  window.confirm = m => c(tr(String(m)));
  window.prompt = (m, d) => p(tr(String(m)), d);
})();
