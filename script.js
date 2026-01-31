  // ===== Utilities
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };

  function normalizeInlineWordlist(list){
    if(!Array.isArray(list)) return [];
    const cleaned = list.map(w => String(w || '').trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }

  function exportData(){
    const data = {};
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    const d = new Date();
    const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    a.href = URL.createObjectURL(blob);
    a.download = `startpage-backup-${ts}.json`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
  }
  function importDataFromFile(ev){
    const file = ev.target.files && ev.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if(!obj || typeof obj !== 'object') throw new Error('Invalid JSON');
        if(!confirm('Daten importieren? Bestehende Einträge werden überschrieben.')) return;
        if(!('wordlist.inline' in obj)) obj['wordlist.inline'] = [];
        obj['wordlist.inline'] = normalizeInlineWordlist(obj['wordlist.inline']);
        Object.keys(obj).forEach(k=> localStorage.setItem(k, JSON.stringify(obj[k])));
        location.reload();
      } catch(err){ alert('Import fehlgeschlagen: ' + err.message); }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  const DATA_PRESETS_MANIFEST = 'assets/data-presets.json';
  const DATA_USER_PRESETS_MANIFEST = 'assets/user-presets/data-presets.json';
  const DATA_USER_PRESETS_DIR = 'assets/user-presets/';
  let dataPresetsCache = null;
  const onboardingState = { step: 0, pendingReload: false };

  function resolvePresetFilePath(file, source){
    if(!file) return '';
    const f = String(file).trim();
    if(/^https?:\/\//i.test(f)) return f;
    if(f.startsWith('assets/')) return f;
    if(source === 'user') return DATA_USER_PRESETS_DIR + f.replace(/^\.?\/+/, '');
    return f;
  }

  function normalizePresetEntry(p, source, idx){
    if(!p) return null;
    const id = String(p.id || `${source || 'preset'}-${idx}`);
    return {
      ...p,
      id,
      name: p.name || id,
      file: resolvePresetFilePath(p.file || '', source),
      source: source || 'preset',
      tags: Array.isArray(p.tags) ? p.tags : []
    };
  }

  async function loadPresetManifest(url, source){
    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error('Manifest nicht gefunden');
      const json = await res.json();
      if(!Array.isArray(json)) throw new Error('Manifest ist kein Array');
      return json.map((p,i)=> normalizePresetEntry(p, source, i)).filter(Boolean);
    }catch(err){
      console.warn(`Presets (${source||'preset'}) laden fehlgeschlagen`, err);
      return [];
    }
  }

  async function discoverUserPresetsFromListing(){
    try{
      const res = await fetch(DATA_USER_PRESETS_DIR);
      if(!res.ok) return [];
      const text = await res.text();
      const matches = Array.from(text.matchAll(/href="([^"]+\.json)"/gi)).map(m=> decodeURIComponent(m[1]));
      const files = Array.from(new Set(matches.map(f=> f.split('/').pop()).filter(Boolean)));
      return files.map((file, idx)=>{
        const base = file.replace(/\.json$/i,'');
        const human = base.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
        const safeId = base.replace(/[^a-z0-9]+/ig,'-').replace(/^-+|-+$/g,'') || idx;
        return normalizePresetEntry({
          id: `user-${safeId}`,
          name: human || `User Preset ${idx+1}`,
          description: 'Lokales Preset aus assets/user-presets/',
          file: file,
          tags: ['user']
        }, 'user', idx);
      });
    }catch(err){
      console.warn('User-Presets nicht gefunden', err);
      return [];
    }
  }

  async function loadDataPresets(){
    if(dataPresetsCache) return dataPresetsCache;
    const [builtIn, userManifest] = await Promise.all([
      loadPresetManifest(DATA_PRESETS_MANIFEST, 'preset'),
      loadPresetManifest(DATA_USER_PRESETS_MANIFEST, 'user')
    ]);
    const userFound = userManifest.length ? userManifest : await discoverUserPresetsFromListing();
    const merged = [...builtIn, ...userFound];
    const deduped = new Map();
    merged.forEach(p=>{ if(!p) return; deduped.set(String(p.id), p); });
    dataPresetsCache = Array.from(deduped.values());
    return dataPresetsCache;
  }

  async function applyPresetFromEntry(current, contextLabel='Preset', opts={ reload:true, markDone:true }){
    if(!current){ alert('Kein Preset verfügbar.'); return; }
    if(!current.file){ alert('Preset-Datei fehlt.'); return; }
    try{
      const res = await fetch(current.file);
      if(!res.ok) throw new Error('Datei nicht gefunden');
      const obj = await res.json();
      if(!obj || typeof obj !== 'object') throw new Error('Preset ungültig');
      if(!('wordlist.inline' in obj)) obj['wordlist.inline'] = [];
      obj['wordlist.inline'] = normalizeInlineWordlist(obj['wordlist.inline']);
      const name = current.name || current.id || 'Preset';
      if(!confirm(`${contextLabel} "${name}" anwenden? Bestehende Einträge werden überschrieben.`)) return;
      Object.keys(obj).forEach(k=> localStorage.setItem(k, JSON.stringify(obj[k])));
      if(opts.markDone) store.set('onboarding.done', true);
      if(opts.reload !== false) location.reload();
    }catch(err){
      alert('Preset laden fehlgeschlagen: ' + err.message);
    }
  }

  async function renderDataPresets(){
    const select = $('#dataPresetSelect');
    const meta = $('#dataPresetMeta');
    const btn = $('#applyPreset');
    if(!select || !meta) return;
    select.innerHTML = '';
    select.disabled = true;
    if(btn) btn.disabled = true;
    meta.textContent = 'Lade Presets...';
    const presets = await loadDataPresets();
    if(!presets.length){
      const opt = document.createElement('option'); opt.value=''; opt.textContent='Keine Presets gefunden';
      select.appendChild(opt);
      meta.textContent = 'Lege exportierte JSONs unter assets/presets/ (Manifest: assets/data-presets.json) oder lokal unter assets/user-presets/ ab.';
      return;
    }
    presets.forEach((p,i)=>{
      const opt = document.createElement('option');
      opt.value = p.id || 'preset-' + i;
      const label = p.name || p.id || ('Preset ' + (i+1));
      const prefix = p.source === 'user' && !/^user:/i.test(String(label).trim()) ? 'User: ' : '';
      opt.textContent = prefix + label;
      select.appendChild(opt);
    });
    select.disabled = false;
    if(btn) btn.disabled = false;
    updateDataPresetMeta();
  }

  async function updateDataPresetMeta(){
    const select = $('#dataPresetSelect');
    const meta = $('#dataPresetMeta');
    if(!select || !meta) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    if(current){
      const tags = Array.isArray(current.tags) ? [...current.tags] : [];
      if(current.source === 'user' && !tags.includes('user')) tags.unshift('user');
      const tagText = tags.length ? ` (Tags: ${tags.join(', ')})` : '';
      const description = current.description || (current.source === 'user' ? 'Lokales Preset anwenden' : 'Preset anwenden');
      meta.textContent = description + tagText;
      select.value = current.id || select.value;
    } else {
      meta.textContent = 'Kein Preset ausgewählt.';
    }
  }

  async function applyDataPreset(){
    const select = $('#dataPresetSelect');
    if(!select) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    await applyPresetFromEntry(current, 'Preset');
  }

  function prettyDate(d=new Date()) {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    return fmt.format(d);
  }

  function openUrl(url, title='Link') {
    addRecent({ title, url });
    window.location.href = url;
  }

  // ===== Clock & Date
  function tickClock(){
    const now = new Date();
    $('#clock').textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    $('#date').textContent = prettyDate(now);
    requestAnimationFrame(()=> setTimeout(tickClock, 1000 - (now.getTime()%1000)));
  }

  // ===== Theme
  function applyTheme(mode){
    const root = document.documentElement;
    if(mode === 'auto'){
      const prefers = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light';
      root.setAttribute('data-theme', prefers);
    } else {
      root.setAttribute('data-theme', mode);
    }
    bgOnThemeChange();
  }

  // ===== Search with engines + bangs + custom shortcuts
  const ENGINES = {
    google: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    ddg: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    bing: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    yt: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    wikipedia: q => `https://de.wikipedia.org/wiki/Spezial:Suche?search=${encodeURIComponent(q)}`,
    maps: q => `https://www.google.com/maps/search/${encodeURIComponent(q)}`
  };
  const BANGS = { '!g':'google', '!ddg':'ddg', '!bing':'bing', '!yt':'yt', '!wiki':'wikipedia', '!maps':'maps' };
  const WORDLIST_URL = 'assets/wordlist.json';
  let globalWordlistPromise = null;
  let searchSuggest = { box:null, items:[], active:-1 };

  function getShortcuts(){
    return store.get('shortcuts', { '!etc':'https://julianverse.de/etc' });
  }

  function loadGlobalWordlist(){
    if(globalWordlistPromise) return globalWordlistPromise;
    globalWordlistPromise = fetch(WORDLIST_URL).then(r=> r.ok ? r.json() : []).catch(()=>[]);
    return globalWordlistPromise;
  }

  function getInlineWordlist(){
    return normalizeInlineWordlist(store.get('wordlist.inline', []));
  }

  function setInlineWordlist(list){
    const normalized = normalizeInlineWordlist(list);
    store.set('wordlist.inline', normalized);
    return normalized;
  }

  function parseWordlistInput(str){
    if(!str) return [];
    return str.split(/[\n,]/).map(w=> w.trim()).filter(Boolean);
  }

  async function loadWordlist(){
    const globalWords = await loadGlobalWordlist();
    const presetWords = getInlineWordlist();
    const all = Array.from(new Set([...(Array.isArray(globalWords)?globalWords:[]), ...presetWords].map(w=> String(w||'').trim()).filter(Boolean)));
    return all;
  }

  function recentSearchQueries(){
    const list = store.get('recent', []);
    const out = [];
    list.forEach(entry=>{
      if(entry.type === 'search' && entry.query) out.push(String(entry.query));
      else if(entry.title && entry.title.startsWith('Suche')){
        const parts = entry.title.split(' – ');
        if(parts[1]) out.push(parts[1].trim());
      }
    });
    return out;
  }

  async function buildSearchSuggestions(queryRaw){
    const raw = String(queryRaw||'');
    const q = raw.trim().toLowerCase();
    const lastSpace = raw.lastIndexOf(' ');
    const prefix = lastSpace >= 0 ? raw.slice(0, lastSpace + 1) : '';
    const lastToken = (raw.slice(lastSpace + 1) || '').toLowerCase();
    const suggestions = [];
    const seen = new Set();
    const push = (value, label, type)=>{
      if(!value) return;
      const key = `${type}:${String(value).toLowerCase()}`;
      if(seen.has(key)) return;
      seen.add(key);
      suggestions.push({ value, label: label||value, type });
    };

    const shortcuts = getShortcuts();
    Object.keys(BANGS).forEach(b=>{ if(!q || b.startsWith(q)) push(b, `${b} (Bang)`, 'bang'); });
    Object.keys(shortcuts).forEach(s=>{ if(!q || s.startsWith(q)) push(s, `${s} (Shortcut)`, 'shortcut'); });
    recentSearchQueries().forEach(r=>{ if(!q || r.toLowerCase().includes(q)) push(r, r, 'recent'); });

    if(lastToken.length){
      const words = await loadWordlist();
      words.forEach(w=>{ if(w.toLowerCase().startsWith(lastToken)) push(prefix + w, w, 'word'); });
    }

    return suggestions.slice(0, 8);
  }

  function renderSearchSuggest(list){
    const box = searchSuggest.box;
    if(!box) return;
    box.innerHTML = '';
    searchSuggest.items = list;
    searchSuggest.active = list.length ? 0 : -1;
    if(!list.length){ box.classList.add('hidden'); return; }
    list.forEach((s, i)=>{
      const li = document.createElement('div');
      li.className = 'suggest-item' + (i===0 ? ' active' : '');
      li.setAttribute('data-index', String(i));
      li.innerHTML = `<span class="suggest-type">${s.type}</span><span class="suggest-text">${escapeHtml(s.label)}</span>`;
      li.addEventListener('mouseenter', ()=> setSearchSuggestActive(i, false));
      li.addEventListener('mousedown', e=>{ e.preventDefault(); selectSearchSuggestion(i, false); });
      box.appendChild(li);
    });
    box.classList.remove('hidden');
  }

  function setSearchSuggestActive(idx, scroll=true){
    const box = searchSuggest.box; if(!box) return;
    const children = Array.from(box.children);
    children.forEach(c=> c.classList.remove('active'));
    if(idx >=0 && idx < children.length){
      children[idx].classList.add('active');
      searchSuggest.active = idx;
      if(scroll) children[idx].scrollIntoView({ block:'nearest' });
    } else {
      searchSuggest.active = -1;
    }
  }

  function selectSearchSuggestion(idx, submit){
    const s = searchSuggest.items[idx];
    const input = $('#query'); if(!s || !input) return;
    if(s.type === 'word'){
      // ensure a trailing space for smooth multi-word entry
      input.value = s.value.endsWith(' ') ? s.value : (s.value + ' ');
    } else {
      input.value = s.value;
    }
    renderSearchSuggest([]);
    if(submit) doSearch();
  }

  async function updateSearchSuggest(){
    const input = $('#query'); if(!input) return;
    const list = await buildSearchSuggestions(input.value);
    renderSearchSuggest(list);
  }

  function doSearch(){
    let q = $('#query').value.trim();
    if(!q) return;
    const first = q.split(/\s+/)[0];

    // custom shortcuts first
    const shortcuts = getShortcuts();
    if(first.startsWith('!') && shortcuts[first]){
      const rest = q.replace(first, '').trim();
      let target = String(shortcuts[first]);
      if(target.includes('{q}')) target = target.replaceAll('{q}', encodeURIComponent(rest));
      else if(rest) target += (target.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(rest);
      addRecent({ title: `Shortcut ${first} – ${rest||''}`, url: target });
      window.location.href = target; return;
    }

    // built-in bangs
    let engine = $('#engine').value;
    if(BANGS[first]){ engine = BANGS[first]; q = q.replace(first, '').trim(); }
    const url = ENGINES[engine](q);
    addRecent({ title: `Suche (${engine}) – ${q}`, url, query:q, type:'search' });
    renderSearchSuggest([]);
    window.location.href = url;
  }

  // ===== Todo
  function renderTodos(){
    const list = store.get('todos', []);
    const wrap = $('#todoList');
    wrap.innerHTML = '';
    list.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'todo-item' + (t.done ? ' done' : '');
      el.innerHTML = `
        <input type="checkbox" ${t.done?'checked':''} aria-label="Fertig">
        <div class="title">${escapeHtml(t.text)}</div>
        <button class="btn" title="Löschen">🗑</button>
      `;
      el.querySelector('input').addEventListener('change', e=>{
        list[i].done = e.target.checked; store.set('todos', list); renderTodos();
      });
      el.querySelector('button').addEventListener('click', ()=>{
        list.splice(i,1); store.set('todos', list); renderTodos();
      });
      wrap.appendChild(el);
    });
  }

  function addTodo(text){
    const list = store.get('todos', []);
    list.unshift({ text, done:false, ts: Date.now() });
    store.set('todos', list); renderTodos();
  }

  // ===== Notes
  function initNotes(){
    const area = $('#notesArea');
    area.value = store.get('notes','');
    area.addEventListener('input', ()=> store.set('notes', area.value));
  }

  // ===== Tiles (CRUD + drag&drop + favicons)
  function defaultTiles(){
    return [
      { title:'GitHub', url:'https://github.com', key:'gh' },
      { title:'YouTube', url:'https://youtube.com', key:'yt' },
      { title:'Gmail', url:'https://mail.google.com', key:'gm' },
      { title:'ChatGPT', url:'https://chat.openai.com', key:'ai' },
      { title:'Hacker News', url:'https://news.ycombinator.com', key:'hn' },
      { title:'Wikipedia', url:'https://de.wikipedia.org', key:'wk' },
      { title:'Docs', url:'https://devdocs.io', key:'dd' },
      { title:'Calendar', url:'https://calendar.google.com', key:'cal' }
    ];
  }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  }

  function renderTiles(){
    const data = store.get('tiles', defaultTiles());
    const grid = $('#tiles'); grid.innerHTML = '';
    data.forEach((t, i)=>{
      const el = document.createElement('div');
      el.className='tile';
      el.draggable = true;
      const host = (new URL(t.url)).hostname;
      const firstLetter = host.split('.')[0][0]?.toUpperCase() || '·';
      el.innerHTML = `
        <div class="favicon"><img alt="favicon" src="https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(t.url)}"></div>
        <div class="meta">
          <a href="#" class="title">${escapeHtml(t.title)}</a>
          <div class="url">${escapeHtml(host)}</div>
        </div>
        <div class="actions">
          <button title="Bearbeiten" aria-label="Bearbeiten">✏️</button>
          <button title="Löschen" aria-label="Löschen">🗑️</button>
        </div>`;

      // Fallback, wenn Favicon nicht lädt → Buchstabe zeigen
      const img = el.querySelector('.favicon img');
      img.addEventListener('error', ()=>{ const fv=el.querySelector('.favicon'); fv.textContent=firstLetter; img.remove(); });

      el.querySelector('.title').addEventListener('click', (e)=>{ e.preventDefault(); openUrl(t.url, t.title); });
      el.querySelectorAll('button')[1].addEventListener('click', ()=>{ data.splice(i,1); store.set('tiles', data); renderTiles(); });
      el.querySelectorAll('button')[0].addEventListener('click', ()=> editTile(i));

      // Drag & drop
      el.addEventListener('dragstart', e=>{
        e.dataTransfer.setData('text/plain', i.toString());
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
      el.addEventListener('dragover', e=> e.preventDefault());
      el.addEventListener('drop', e=>{
        e.preventDefault();
        const from = +e.dataTransfer.getData('text/plain');
        const to = i; if(from===to) return;
        const item = data.splice(from,1)[0];
        data.splice(to,0,item);
        store.set('tiles', data); renderTiles();
      });

      grid.appendChild(el);
    });
  }

  function editTile(index){
    const data = store.get('tiles', defaultTiles());
    const t = data[index];
    const title = prompt('Titel', t.title);
    if(title===null) return;
    const url = prompt('URL', t.url);
    if(url===null) return;
    try { new URL(url) } catch { alert('Ungültige URL'); return }
    data[index] = { ...t, title, url };
    store.set('tiles', data); renderTiles();
  }

  function addTile(){
    const title = prompt('Titel der Kachel'); if(!title) return;
    const url = prompt('URL (https://…)'); if(!url) return;
    try { new URL(url) } catch { alert('Ungültige URL'); return }
    const data = store.get('tiles', defaultTiles());
    data.unshift({ title, url });
    store.set('tiles', data); renderTiles();
  }

  // ===== Recent actions
  function addRecent(entry){
    const list = store.get('recent', []);
    list.unshift({ ...entry, ts: Date.now() });
    store.set('recent', list.slice(0, 12));
  }
  function renderRecent(){
    const list = store.get('recent', []);
    const wrap = $('#recentList');
    wrap.innerHTML='';
    list.forEach(it=>{
      const a = document.createElement('a');
      a.href = it.url; a.className='chip'; a.textContent = it.title; a.target='_self';
      wrap.appendChild(a);
    })
  }

  // ===== Weather (Open‑Meteo)
  async function lookupCity(name){
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=de&format=json`);
    if(!res.ok) throw new Error('Geocoding fehlgeschlagen');
    const data = await res.json();
    if(!data || !data.results || !data.results.length) throw new Error('Ort nicht gefunden');
    const c = data.results[0];
    return { name: `${c.name}${c.admin1 ? ', '+c.admin1 : ''}`, lat: c.latitude, lon: c.longitude };
  }

  async function resolveCity(city){
    const name = (city || '').trim();
    if(!name) throw new Error('Stadt fehlt');
    const cached = store.get('weather.coords', null);
    const fresh = 1000*60*60*12; // 12h cache
    if(cached && cached.city === name && (Date.now() - cached.ts) < fresh) return cached;
    const loc = await lookupCity(name);
    const payload = { ...loc, city: name, ts: Date.now() };
    store.set('weather.coords', payload);
    return payload;
  }

  function wmoText(code){
    const map = { 0:'Klar', 1:'Überwiegend klar', 2:'Wechselhaft', 3:'Bewölkt', 45:'Nebel', 48:'Nebel', 51:'Sprühregen', 53:'Sprühregen', 55:'Sprühregen', 61:'Regen', 63:'Regen', 65:'Starker Regen', 71:'Schnee', 80:'Schauer', 95:'Gewitter' };
    return map[code] || 'Wetter';
  }

  function weatherIconSVG(code){
    const c = Number(code);
    const sun = '<circle cx="20" cy="20" r="8" fill="#FFD166"/><g stroke="#FFD166" stroke-width="2">'
      + '<line x1="20" y1="2" x2="20" y2="8"/>'
      + '<line x1="20" y1="32" x2="20" y2="38"/>'
      + '<line x1="2" y1="20" x2="8" y2="20"/>'
      + '<line x1="32" y1="20" x2="38" y2="20"/>'
      + '<line x1="6" y1="6" x2="10" y2="10"/>'
      + '<line x1="30" y1="30" x2="34" y2="34"/>'
      + '<line x1="6" y1="34" x2="10" y2="30"/>'
      + '<line x1="30" y1="10" x2="34" y2="6"/></g>';
    const cloud = '<ellipse cx="22" cy="24" rx="12" ry="8" fill="#cfd8e3"/><ellipse cx="14" cy="26" rx="9" ry="6" fill="#d9e3ef"/>';
    const rain = '<g stroke="#4dabf7" stroke-width="2"><line x1="14" y1="32" x2="12" y2="38"/><line x1="20" y1="32" x2="18" y2="38"/><line x1="26" y1="32" x2="24" y2="38"/></g>';
    const snow = '<g fill="#a5b4fc"><circle cx="14" cy="34" r="2"/><circle cx="20" cy="34" r="2"/><circle cx="26" cy="34" r="2"/></g>';
    const bolt = '<polygon points="22,30 16,30 24,18 24,24 30,24 22,36" fill="#F59E0B"/>';
    const fog = '<g stroke="#cbd5e1" stroke-width="2"><line x1="10" y1="30" x2="30" y2="30"/><line x1="8" y1="34" x2="28" y2="34"/></g>';
    let body = '';
    if([0,1].includes(c)) body = sun;
    else if([2,3].includes(c)) body = sun + cloud;
    else if([45,48].includes(c)) body = cloud + fog;
    else if([51,53,55,61,63,65,80].includes(c)) body = cloud + rain;
    else if([71].includes(c)) body = cloud + snow;
    else if([95].includes(c)) body = cloud + bolt;
    else body = cloud;
    return `<svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }
  function updateWeatherIcon(code){
    const el = document.getElementById('weatherIcon');
    if(!el) return;
    if(code === null || code === undefined){ el.innerHTML=''; return; }
    try { el.innerHTML = weatherIconSVG(code); } catch { el.textContent = ''; }
  }

  function parseWeatherTime(str, offsetSeconds){
    if(!str) return null;
    const base = new Date(str + 'Z');
    if(Number.isNaN(base.getTime())) return null;
    return new Date(base.getTime() + (offsetSeconds||0)*1000);
  }

  async function loadWeather(){
    const city = (store.get('weather.city', 'Hannover') || '').trim();
    $('#cityInput').value = city;
    const tempEl = $('#tempNow');
    const textEl = $('#weatherText');
    const minmaxEl = $('#minmax');
    const hourlyEl = $('#hourly');
    textEl.textContent = city ? 'Lade Wetter...' : 'Ort eingeben, um Wetter zu laden.';
    tempEl.textContent = '—°C';
    minmaxEl.textContent = '— / — °C';
    hourlyEl.innerHTML = '';
    updateWeatherIcon(null);
    if(!city) return;

    try {
      const loc = await resolveCity(city);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,weathercode&current_weather=true&timezone=auto&daily=temperature_2m_max,temperature_2m_min&forecast_days=1`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('Wetter abrufen fehlgeschlagen');
      const data = await res.json();
      const offset = Number(data.utc_offset_seconds) || 0;
      const curr = data.current_weather || {};
      updateWeatherIcon(curr.weathercode);
      const t = Math.round(curr.temperature ?? NaN);
      tempEl.textContent = isFinite(t) ? `${t}°C` : '—°C';
      textEl.textContent = `${loc.name} · ${wmoText(curr.weathercode)}`;
      const dmax = Math.round((data.daily?.temperature_2m_max?.[0]) ?? NaN);
      const dmin = Math.round((data.daily?.temperature_2m_min?.[0]) ?? NaN);
      minmaxEl.textContent = isFinite(dmin)&&isFinite(dmax) ? `${dmin} / ${dmax} °C` : '— / — °C';

      const hours = data.hourly?.time || [];
      const temps = data.hourly?.temperature_2m || [];
      const codes = data.hourly?.weathercode || [];
      const container = hourlyEl; container.innerHTML='';
      const now = Date.now() - (30*60*1000);
      let added = 0;
      for(let i=0;i<hours.length;i+=3){
        const tDate = parseWeatherTime(hours[i], offset);
        if(!tDate) continue;
        if(tDate.getTime() < now) continue;
        const chip = document.createElement('div');
        chip.className='chip';
        const timeLabel = tDate.toLocaleTimeString([], {hour:'2-digit'});
        const tempVal = Math.round(temps[i]);
        chip.innerHTML = `<div class="chip-top"><span>${timeLabel}</span><span class="chip-temp">${isFinite(tempVal)? tempVal+'°' : '—°'}</span></div><div class="chip-text">${wmoText(codes[i])}</div>`;
        container.appendChild(chip);
        added++;
        if(added>=8) break;
      }
      if(!added) container.innerHTML = '<div class="muted">Keine Prognose</div>';
      // Normalize degree symbols / overwrite any garbled text
      try {
        const t2 = Math.round((data.current_weather||{}).temperature ?? NaN);
        tempEl.textContent = isFinite(t2) ? `${t2}°C` : '-°C';
        const dmax2 = Math.round((data.daily?.temperature_2m_max?.[0]) ?? NaN);
        const dmin2 = Math.round((data.daily?.temperature_2m_min?.[0]) ?? NaN);
        minmaxEl.textContent = isFinite(dmin2)&&isFinite(dmax2) ? `${dmin2} / ${dmax2} °C` : '- / - °C';
      } catch {}
    } catch(err){
      console.warn(err);
      textEl.textContent = err.message === 'Stadt fehlt' ? 'Ort eingeben, um Wetter zu laden.' : 'Wetter konnte nicht geladen werden.';
      tempEl.textContent = '—°C';
      minmaxEl.textContent = '— / — °C';
      hourlyEl.innerHTML='';
      updateWeatherIcon(null);
    }
  }

  // ===== Transport (departures)
  const TRANSPORT_API = 'https://api-startpage.julianverse.de/api';
  const TRANSPORT_MAX_DURATION = 120;
  const TRANSPORT_MIN_INTERVAL = 800;
  const transportSearchSeqs = { main: 0, settings: 0, default: 0, onboarding: 0 };
  let transportSearchTimer = null;
  let transportSearchSeq = 0;
  let transportSuggestItems = [];
  const TRANSPORT_MIN_QUERY = 3;
  let transportLastRequestAt = 0;

  async function transportFetch(url, options){
    const now = Date.now();
    const wait = transportLastRequestAt ? Math.max(0, TRANSPORT_MIN_INTERVAL - (now - transportLastRequestAt)) : 0;
    if(wait) await new Promise(r=> setTimeout(r, wait));
    transportLastRequestAt = Date.now();
    return fetch(url, options);
  }

  function clampTransportDuration(value){
    const v = Number(value);
    if(!Number.isFinite(v)) return 60;
    return Math.min(Math.max(v, 10), TRANSPORT_MAX_DURATION);
  }
  function getTransportDuration(){
    return clampTransportDuration(store.get('transport.duration', 60));
  }
  function setTransportDuration(value){
    const v = clampTransportDuration(value);
    store.set('transport.duration', v);
    return v;
  }
  function formatTransportTime(raw){
    if(!raw) return '-';
    const d = new Date(raw);
    if(Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }
  function formatTransportDelay(raw){
    const n = Number(raw);
    if(!Number.isFinite(n) || n === 0) return '';
    return n > 0 ? `+${n}` : `${n}`;
  }
  function transportTypeLabel(type){
    if(type === 'station') return 'Station';
    if(type === 'stop') return 'Stop';
    return '';
  }
  function normalizeTransportLocation(loc){
    if(!loc || !loc.id || !loc.name) return null;
    let type = loc.type;
    if(type !== 'station' && type !== 'stop'){
      type = (loc.station || loc.isStation) ? 'station' : 'stop';
    }
    return {
      id: String(loc.id),
      name: String(loc.name),
      type,
      place: loc.place || loc.address || (loc.location && loc.location.name) || ''
    };
  }
  function setTransportSelectedText(text){
    const el = $('#transportSelected');
    if(el) el.textContent = text;
  }
  function renderTransportSuggestTo(box, items, message, onSelect){
    transportSuggestItems = items || [];
    if(!box) return;
    box.innerHTML = '';
    if((!items || !items.length) && message){
      const hint = document.createElement('div');
      hint.className = 'muted';
      hint.style.padding = '6px 10px';
      hint.textContent = message;
      box.appendChild(hint);
      box.classList.remove('hidden');
      return;
    }
    if(!items || !items.length){
      box.classList.add('hidden');
      return;
    }
    items.forEach(item=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'transport-suggest-item';
      const name = document.createElement('span');
      name.className = 'transport-suggest-name';
      name.textContent = item.place ? `${item.name} - ${item.place}` : item.name;
      const meta = document.createElement('span');
      meta.className = 'transport-suggest-meta';
      meta.textContent = transportTypeLabel(item.type);
      btn.appendChild(name);
      if(meta.textContent) btn.appendChild(meta);
      btn.addEventListener('click', ()=> onSelect && onSelect(item));
      box.appendChild(btn);
    });
    box.classList.remove('hidden');
  }
  function renderTransportSuggest(items, message){
    const box = $('#transportSuggest');
    renderTransportSuggestTo(box, items, message, selectTransportStation);
  }
  async function transportSearchCore(query, attempt, seqKey, renderFn){
    const q = String(query || '').trim();
    if(!q || q.length < TRANSPORT_MIN_QUERY){
      renderFn([], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`);
      return;
    }
    const seq = ++transportSearchSeqs[seqKey];
    try{
      const url = `${TRANSPORT_API}/locations?query=${encodeURIComponent(q)}&results=8&stops=true&addresses=false&poi=false`;
      const res = await transportFetch(url);
      if(!res.ok){
        if(res.status === 504 && attempt < 1){
          await new Promise(r=> setTimeout(r, 350));
          return transportSearchCore(q, attempt + 1, seqKey, renderFn);
        }
        throw new Error(`Transport search error: ${res.status}`);
      }
      const data = await res.json();
      if(seq !== transportSearchSeqs[seqKey]) return;
      const list = Array.isArray(data) ? data : (data.locations || data.data || data.results || []);
      const items = (Array.isArray(list) ? list : []).map(normalizeTransportLocation).filter(Boolean);
      if(!items.length) renderFn([], 'Keine Treffer');
      else renderFn(items);
    }catch(e){
      if(seq !== transportSearchSeqs[seqKey]) return;
      const msg = e && /504/.test(String(e.message)) ? 'Proxy Timeout' : 'Fehler beim Laden';
      renderFn([], msg);
    }
  }
  async function transportSearch(query, attempt=0){
    return transportSearchCore(query, attempt, 'main', renderTransportSuggest);
  }
  function selectTransportStation(item){
    if(!item || !item.id) return;
    store.set('transport.station', { id: item.id, name: item.name, type: item.type, place: item.place || '' });
    store.set('transport.query', item.name);
    const input = $('#transportQuery'); if(input) input.value = item.name;
    renderTransportSuggest([]);
    loadTransportDepartures();
  }
  function isLocalTransit(dep){
    const line = dep && dep.line ? dep.line : null;
    const raw = String((line && (line.product || line.mode || line.name || line.id)) || '').toLowerCase();
    if(!raw) return false;
    return raw.includes('bus') || raw.includes('tram') || raw.includes('street') || raw.includes('strassen') || raw.includes('straße') || raw.includes('strasse') || raw.includes('u-bahn') || raw.includes('ubahn') || raw.includes('subway') || raw.includes('metro') || raw.includes('stadtbahn') || raw.includes('urban') || raw.includes('s-bahn') || raw.includes('sbahn');
  }
  function renderTransportList(items){
    const ul = $('#transportList'); if(!ul) return;
    ul.innerHTML = '';
    const filtered = (items || []).filter(dep=>{
      if(dep && dep.cancelled) return true;
      const delayVal = (typeof dep.delay === 'number') ? dep.delay : (dep.stop && typeof dep.stop.departureDelay === 'number' ? dep.stop.departureDelay : 0);
      if(!Number.isFinite(delayVal)) return true;
      if(isLocalTransit(dep)) return delayVal <= 60;
      return true;
    });
    if(!filtered.length){
      ul.innerHTML = '<li class="muted">Keine Abfahrten</li>';
      return;
    }
    const duration = getTransportDuration();
    const cutoff = Date.now() + (duration * 60 * 1000);
    const within = filtered.filter(dep=>{
      const whenRaw = dep.when || dep.plannedWhen || (dep.stop && (dep.stop.departure || dep.stop.plannedDeparture));
      if(!whenRaw) return true;
      const t = new Date(whenRaw).getTime();
      if(Number.isNaN(t)) return true;
      return t <= cutoff;
    });
    within.forEach(dep=>{
      const li = document.createElement('li');
      li.className = 'transport-item';
      const main = document.createElement('div');
      main.className = 'transport-main';
      const line = document.createElement('div');
      line.className = 'transport-line';
      line.textContent = (dep.line && (dep.line.name || dep.line.id || dep.line.product || dep.line.mode)) || '-';
      const dir = document.createElement('div');
      dir.className = 'transport-dir';
      dir.textContent = dep.direction || dep.destination || dep.provenance || '-';
      main.appendChild(line);
      main.appendChild(dir);

      const meta = document.createElement('div');
      meta.className = 'transport-meta';
      const time = document.createElement('div');
      time.className = 'transport-time';
      const whenRaw = dep.when || dep.plannedWhen || (dep.stop && (dep.stop.departure || dep.stop.plannedDeparture));
      time.textContent = formatTransportTime(whenRaw);
      meta.appendChild(time);

      const platformRaw = dep.platform ?? dep.plannedPlatform ?? (dep.stop && (dep.stop.platform ?? dep.stop.plannedPlatform));
      if(platformRaw){
        const platform = document.createElement('div');
        platform.className = 'transport-platform';
        platform.textContent = `Gl. ${platformRaw}`;
        meta.appendChild(platform);
      }

      const delayVal = (typeof dep.delay === 'number') ? dep.delay : (dep.stop && typeof dep.stop.departureDelay === 'number' ? dep.stop.departureDelay : null);
      const delayText = formatTransportDelay(delayVal);
      if(delayText){
        const delay = document.createElement('div');
        delay.className = 'transport-delay' + (delayVal > 0 ? ' late' : ' early');
        delay.textContent = delayText;
        meta.appendChild(delay);
      }

      if(dep.cancelled){
        const cancelled = document.createElement('div');
        cancelled.className = 'transport-cancelled';
        cancelled.textContent = 'Fällt aus';
        meta.appendChild(cancelled);
      }

      li.appendChild(main);
      li.appendChild(meta);
      ul.appendChild(li);
    });
  }
  async function loadTransportDepartures(){
    const ul = $('#transportList'); if(!ul) return;
    const station = store.get('transport.station', null);
    if(!station || !station.id){
      ul.innerHTML = '<li class="muted">Station auswählen...</li>';
      setTransportSelectedText('Keine Station gewählt');
      return;
    }
    const duration = getTransportDuration();
    setTransportSelectedText(station.place ? `${station.name} - ${station.place}` : station.name);
    ul.innerHTML = '<li class="muted">Lade...</li>';
    try{
      const preferStation = (station.type === 'station' || station.isStation);
      const first = preferStation ? 'stations' : 'stops';
      const second = preferStation ? 'stops' : 'stations';
      const fetchDepartures = async (kind)=>{
        const url = `${TRANSPORT_API}/${kind}/${encodeURIComponent(station.id)}/departures?duration=${duration}`;
        const res = await transportFetch(url);
        return { res, kind };
      };
      let { res } = await fetchDepartures(first);
      if(res.status === 404){
        const retry = await fetchDepartures(second);
        res = retry.res;
      }
      if(!res.ok) throw new Error(`Transport error: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.departures || data.results || []);
      renderTransportList(Array.isArray(list) ? list : []);
    }catch(err){
      ul.innerHTML = '<li class="muted">Fehler beim Laden</li>';
    }
  }
  function initTransport(){
    const input = $('#transportQuery');
    const select = $('#transportDuration');
    const refresh = $('#refreshTransport');
    if(store.get('transport.duration', null) == null) store.set('transport.duration', 60);
    if(select){
      const val = getTransportDuration();
      select.value = String(val);
      select.addEventListener('change', e=>{
        const next = setTransportDuration(e.target.value);
        if(select.value !== String(next)) select.value = String(next);
        loadTransportDepartures();
      });
    }
    if(input){
      let savedStation = store.get('transport.station', null);
      const defaultStation = store.get('transport.default', null);
      if(!savedStation && defaultStation && defaultStation.id){
        savedStation = defaultStation;
        store.set('transport.station', defaultStation);
        store.set('transport.query', defaultStation.name || '');
      }
      const savedQuery = store.get('transport.query', '');
      input.value = (savedStation && savedStation.name) ? savedStation.name : (savedQuery || '');
      input.addEventListener('input', ()=>{
        const q = input.value.trim();
        store.set('transport.query', q);
        if(transportSearchTimer) clearTimeout(transportSearchTimer);
        if(!q){
          renderTransportSuggest([]);
          store.set('transport.station', null);
          setTransportSelectedText('Keine Station gewählt');
          return;
        }
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggest([], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`);
          return;
        }
        const current = store.get('transport.station', null);
        if(current && q !== current.name){
          store.set('transport.station', null);
          setTransportSelectedText('Keine Station gewählt');
        }
        transportSearchTimer = setTimeout(()=> transportSearch(q), 320);
      });
      input.addEventListener('focus', ()=>{
        const q=input.value.trim();
        if(!q) return;
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggest([], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`);
          return;
        }
        transportSearch(q);
      });
      input.addEventListener('keydown', e=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          if(transportSuggestItems.length) selectTransportStation(transportSuggestItems[0]);
          else if(input.value.trim()) transportSearch(input.value.trim());
        }
        if(e.key === 'Escape') renderTransportSuggest([]);
      });
    }
    if(refresh) refresh.addEventListener('click', loadTransportDepartures);
    document.addEventListener('click', e=>{
      const card = $('#transportCard');
      if(!card) return;
      if(!card.contains(e.target)) renderTransportSuggest([]);
    });
    if(!store.get('transport.station', null)){
      const defaultStation = store.get('transport.default', null);
      if(defaultStation && defaultStation.name && !defaultStation.id){
        transportSearchCore(defaultStation.name, 0, 'default', (items)=>{
          if(!items || !items.length) return;
          const pick = items[0];
          const payload = { id: pick.id, name: pick.name, type: pick.type, place: pick.place || '' };
          store.set('transport.default', payload);
          store.set('transport.station', payload);
          store.set('transport.query', pick.name);
          const input = $('#transportQuery'); if(input) input.value = pick.name;
          loadTransportDepartures();
        });
        return;
      }
    }
    loadTransportDepartures();
  }

  // ===== Quote of the day (local)
  const QUOTES = [
    'Move fast, refactor often.',
    'Accessibility isn\'t a feature – it\'s the default.',
    'Done > Perfect. Iterate.',
    'If it\'s not monitored, it doesn\'t exist.',
    'Good UX is invisible. Bad UX is unforgettable.',
    'Make it work, make it right, make it fast.',
    'Small steps. Massive outcomes.',
    'Simplicity scales. Complexity fails.',
    'Automate the boring stuff.',
    'Measure twice, deploy once.'
  ];
  function loadQuote(){
    const day = Math.floor(Date.now() / (1000*60*60*24));
    $('#quote').textContent = QUOTES[day % QUOTES.length];
  }

  // ===== News (RSS)
  function defaultFeeds(){
    return {
      'Heise': 'https://www.heise.de/rss/heise-atom.xml',
      'Tagesschau': 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml',
      'TechCrunch': 'https://techcrunch.com/feed/'
    };
  }
  function getFeeds(){
    const custom = store.get('news.custom', {});
    return { ...defaultFeeds(), ...custom };
  }
  function fillNewsSources(){
    const select = $('#newsSource');
    const sources = getFeeds();
    const current = store.get('news.source', Object.keys(sources)[0]);
    select.innerHTML='';
    Object.keys(sources).forEach(name=>{
      const opt = document.createElement('option'); opt.value=name; opt.textContent=name; if(name===current) opt.selected=true; select.appendChild(opt);
    });
  }
  async function loadNews(){
    const sources = getFeeds();
    const sourceName = store.get('news.source', Object.keys(sources)[0]);
    const feedUrl = sources[sourceName];
    $('#newsList').innerHTML = '<li class="muted">Lade…</li>';
    try{
      const res = await fetch(`https://api-startpage.julianverse.de/api/rss?url=${encodeURIComponent(feedUrl)}`);
      if(!res.ok) throw new Error(`RSS proxy error: ${res.status}`);
      const data = { contents: await res.text() };
      const parser = new DOMParser();
      const xml = parser.parseFromString(data.contents, 'text/xml');
      const items = xml.querySelectorAll('item');
      const ul = $('#newsList'); ul.innerHTML='';
      const max = 8;
      items.forEach((it,i)=>{ if(i<max){
        const title = it.querySelector('title')?.textContent || '—';
        const link = it.querySelector('link')?.textContent || '#';
        const li = document.createElement('li');
        li.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${title}</a>`;
        ul.appendChild(li);
      }});
      if(!ul.children.length){ ul.innerHTML = '<li class="muted">Keine Items</li>'; }
    }catch(e){ $('#newsList').innerHTML = '<li class="muted">Fehler beim Laden</li>'; }
  }

  // ===== Settings UI
  function openSettings(){
    const modal = $('#settingsModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    rebuildSettingsPanels();
    fillSettings();
    bgRenderSettings();
    initSettingsTabs();
    const last = store.get('settings.tab','general');
    selectSettingsTab(last);
  }
  function closeSettings(){
    const modal = $('#settingsModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  }
  function fillSettings(){
    const theme = store.get('theme','auto');
    $('#themeSelect').value = theme;
    $('#defaultCity').value = store.get('weather.city','Hannover');
    const defaultTransport = store.get('transport.default', null);
    const transportDefaultInput = $('#transportDefaultInput');
    if(transportDefaultInput){
      transportDefaultInput.value = defaultTransport && defaultTransport.name ? defaultTransport.name : '';
    }

    // Engines
    const pills = $('#enginePills'); pills.innerHTML='';
    Object.keys(ENGINES).forEach(key=>{
      const on = (store.get('engines.enabled', Object.keys(ENGINES))).includes(key);
      const pill = document.createElement('button');
      pill.className='btn'; pill.textContent = key + (on?' ✓':' ✕');
      pill.addEventListener('click', ()=>{
        let enabled = store.get('engines.enabled', Object.keys(ENGINES));
        if(on) enabled = enabled.filter(e=>e!==key); else enabled = Array.from(new Set([...enabled, key]));
        store.set('engines.enabled', enabled);
        fillSettings(); renderEngines();
      });
      pills.appendChild(pill);
    });

    // Shortcuts
    $('#shortcutConfig').value = JSON.stringify(getShortcuts(), null, 2);

    // Wordlist
    const inlineWords = getInlineWordlist();
    const wordlistEditor = $('#wordlistEditor'); if(wordlistEditor) wordlistEditor.value = inlineWords.join('\n');

    // Feeds
    $('#feedsConfig').value = JSON.stringify(store.get('news.custom', {}), null, 2);

    // Widgets toggle list
    const defaults = widgetDefaults();
    const conf = store.get('widgets', defaults);
    const wrap = $('#widgetToggles'); wrap.innerHTML='';
    Object.keys(defaults).forEach(k=>{
      const id = `w_${k}`;
      const label = document.createElement('label'); label.style.display='inline-flex'; label.style.alignItems='center'; label.style.gap='6px';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.checked = conf[k];
      cb.addEventListener('change', ()=>{ const cur=store.get('widgets', defaults); cur[k]=cb.checked; store.set('widgets', cur); applyWidgets(); });
      label.appendChild(cb); label.appendChild(document.createTextNode(k));
      wrap.appendChild(label);
    });

    // Widget colors editor
    const editor = $('#widgetColorEditor'); editor.innerHTML='';
    const names = { todo:'To‑Do', notes:'Notizen', tiles:'Favoriten', weather:'Wetter', transport:'Transport', quote:'Quote', recent:'Zuletzt', system:'System', news:'News' };
    const colors = store.get('widget.colors', widgetColorDefaults());
    Object.keys(names).forEach(k=>{
      const box = document.createElement('div'); box.style.display='inline-flex'; box.style.alignItems='center'; box.style.gap='6px'; box.style.padding='6px 8px'; box.style.background='var(--glass)'; box.style.border='1px solid rgba(255,255,255,.08)'; box.style.borderRadius='10px';
      const label = document.createElement('span'); label.textContent = names[k];
      const input = document.createElement('input'); input.type='color'; input.value = (colors[k] && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colors[k])) ? colors[k] : '#7c5cff';
      input.addEventListener('input', ()=>{ const cur = store.get('widget.colors', widgetColorDefaults()); cur[k]=input.value; store.set('widget.colors', cur); applyWidgetColors(); });
      const clear = document.createElement('button'); clear.className='btn'; clear.textContent='Reset';
      clear.addEventListener('click', ()=>{ const cur = store.get('widget.colors', widgetColorDefaults()); cur[k]=''; store.set('widget.colors', cur); applyWidgetColors(); fillSettings(); });
      box.appendChild(label); box.appendChild(input); box.appendChild(clear);
      editor.appendChild(box);
    });

    const cardStyle = store.get('ui.cardStyle', 'glass');
    const styleSelect = $('#cardStyle'); if(styleSelect) styleSelect.value = ['glass','solid','transparent','minimal'].includes(cardStyle) ? cardStyle : 'glass';

    const clockInput = $('#clockColor'); if(clockInput){
      const value = store.get('ui.clock.color','');
      clockInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '#7c5cff';
    }
    const searchInput = $('#searchColor'); if(searchInput){
      const value = store.get('ui.search.color','');
      searchInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '#54d6ff';
    }
  }

  function selectSettingsTab(name){
    const valid = ['general','background','search','widgets','data','guide'];
    if(!valid.includes(name)) name = 'general';
    const buttons = $$('.tab-btn', $('#settingsModal'));
    const panels = [
      {n:'general', el: $('#tab-general')},
      {n:'background', el: $('#tab-background')},
      {n:'search', el: $('#tab-search')},
      {n:'widgets', el: $('#tab-widgets')},
      {n:'data', el: $('#tab-data')},
      {n:'guide', el: $('#tab-guide')},
    ];
    buttons.forEach(b=>{ const on = b.getAttribute('data-tab')===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); });
    panels.forEach(p=>{ if(p.el) p.el.classList.toggle('active', p.n===name); });
    store.set('settings.tab', name);
    if(name === 'background') bgRenderSettings();
  }
  function initSettingsTabs(){
    const root = $('#settingsModal'); if(!root) return;
    $$('.tab-btn', root).forEach(btn=>{
      btn.addEventListener('click', ()=> selectSettingsTab(btn.getAttribute('data-tab')));
    });
  }

  // Make sure tabs contain the right rows regardless of initial HTML structure
  function rebuildSettingsPanels(){
    const sheet = $('#settingsModal .sheet'); if(!sheet) return;
    const tabs = sheet.querySelector('.tabs'); if(!tabs) return;
    // Collect rows from root and any pre-existing panels BEFORE removing them
    const rows = Array.from(sheet.querySelectorAll(':scope > .row, :scope > .tab-panel > .row'))
      .filter(row=> !row.closest('#tab-guide'));
    // Remove old panels
    sheet.querySelectorAll(':scope > .tab-panel').forEach(p=> p.remove());

    const panelGeneral = document.createElement('div'); panelGeneral.id='tab-general'; panelGeneral.className='tab-panel';
    const panelBackground = document.createElement('div'); panelBackground.id='tab-background'; panelBackground.className='tab-panel';
    const panelSearch = document.createElement('div'); panelSearch.id='tab-search'; panelSearch.className='tab-panel';
    const panelWidgets = document.createElement('div'); panelWidgets.id='tab-widgets'; panelWidgets.className='tab-panel';
    const panelData = document.createElement('div'); panelData.id='tab-data'; panelData.className='tab-panel';
    const panelGuide = document.createElement('div'); panelGuide.id='tab-guide'; panelGuide.className='tab-panel';

    const assign = (row, target)=>{ if(!row) return; if(row.parentElement) row.parentElement.removeChild(row); target.appendChild(row); };
    rows.forEach(row=>{
      const has = sel => row.querySelector(sel);
      if(has('#themeSelect')) assign(row, panelGeneral);
      else if(has('#bgEngine')) assign(row, panelBackground);
      else if(has('#enginePills') || has('#shortcutConfig') || has('#feedsConfig') || has('#wordlistEditor')) assign(row, panelSearch);
      else if(has('#widgetToggles') || has('#widgetColorEditor') || has('#cardStyle') || has('#clockColor') || has('#searchColor') || has('#defaultCity') || has('#transportDefaultInput')) assign(row, panelWidgets);
      else if(has('#exportData') || has('#importData') || has('#dataNote') || has('#dataPresetSelect') || has('#applyPreset') || has('#restartOnboarding')) assign(row, panelData);
      else assign(row, panelGeneral);
    });

    // Build static guide content
    panelGuide.innerHTML = `
      <div class="row"><label>User Guide</label>
        <div>
          <h5>Overview</h5>
          <ul>
            <li>Startseite mit Suche, Favoriten, To-Do, Notizen, Wetter, News.</li>
            <li>Alles lokal: Daten bleiben im Browser (localStorage).</li>
          </ul>
          <h5>Shortcuts</h5>
          <ul>
            <li>Ctrl/Cmd+K: Command Palette öffnen</li>
            <li>1-9: Erste 9 Favoriten öffnen (wenn nicht tippen)</li>
            <li>/ : Suche fokussieren (auch über Palette)</li>
            <li>Enter in Suche: Startet die Suche</li>
            <li>ESC: Modals schliessen</li>
            <li>Palette: Schnellaktionen für Widgets, Theme, Hintergrund, Daten, Favoriten</li>
            <li>Palette: Taste C wechselt den Kachel-Stil, "Header-Farben zurücksetzen" stellt Suche & Uhr zurück</li>
          </ul>
          <h5>Suche & Autocomplete</h5>
          <ul>
            <li>Bangs: !g !ddg !bing !yt !wiki !maps</li>
            <li>Eigene Shortcuts: JSON in den Einstellungen; {q} als Platzhalter</li>
            <li>Autocomplete: Bangs, Shortcuts, Recent-Suchen, Wortliste (global + Preset)</li>
            <li>Tab übernimmt Vorschlag, Enter startet Suche</li>
          </ul>
          <h5>Tiles</h5>
          <ul>
            <li>Drag&Drop zum Sortieren, Klick zum öffnen</li>
            <li>+ Kachel: Neue Favoriten hinzufügen</li>
            <li>Reset: Standardfavoriten wiederherstellen</li>
          </ul>
          <h5>Widgets & Layout</h5>
          <ul>
            <li>Sichtbarkeit je Widget umschaltbar</li>
            <li>Kachel-Stil global anpassbar (Glas, Vollfläche, Transparent, Soft Minimal)</li>
            <li>Eigene Farben für Uhr/Suche; Reset bringt Stilvorgabe zurück</li>
            <li>Widget-Farben & Button "Widgets einfürben" setzen Akzent pro Karte</li>
          </ul>
          <h5>Hintergrund</h5>
          <ul>
            <li>Presets, Uploads, Sammlungen, Rotation (Zeit/Thema/Intervall)</li>
            <li>Akzentfarbe wird aus dem aktiven Hintergrund extrahiert</li>
          </ul>
          <h5>Daten</h5>
          <ul>
            <li>Export/Import als JSON</li>
            <li>Data Presets laden (assets/presets/*.json aus dem Repo)</li>
          </ul>
        </div>
      </div>`;

    tabs.insertAdjacentElement('afterend', panelGeneral);
    panelGeneral.insertAdjacentElement('afterend', panelBackground);
    panelBackground.insertAdjacentElement('afterend', panelSearch);
    panelSearch.insertAdjacentElement('afterend', panelWidgets);

    panelWidgets.insertAdjacentElement('afterend', panelData);
    panelData.insertAdjacentElement('afterend', panelGuide);

    // Activate default panel before selectSettingsTab runs
    panelGeneral.classList.add('active');
  }
  function renderEngines(){
    const enabled = store.get('engines.enabled', Object.keys(ENGINES));
    const select = $('#engine');
    const current = select.value;
    select.innerHTML = '';
    enabled.forEach(k=>{
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = ({google:'Google',ddg:'DuckDuckGo',bing:'Bing',yt:'YouTube',wikipedia:'Wikipedia',maps:'Google Maps'})[k]||k;
      select.appendChild(opt);
    });
    if(enabled.includes(current)) select.value = current; else select.value = enabled[0];
  }

  // ===== Onboarding
  async function onboardingRenderPresets(){
    const select = $('#onbPresetSelect');
    const meta = $('#onbPresetMeta');
    if(!select || !meta) return;
    select.innerHTML = '';
    meta.textContent = 'Lade Presets...';
    const presets = await loadDataPresets();
    if(!presets.length){
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Keine Presets gefunden';
      select.appendChild(opt);
      meta.textContent = 'Leg ein Preset unter assets/presets/ oder assets/user-presets/ ab.';
      return;
    }
    presets.forEach((p,i)=>{
      const opt = document.createElement('option');
      opt.value = p.id || 'preset-' + i;
      const label = p.name || p.id || ('Preset ' + (i+1));
      const prefix = p.source === 'user' && !/^user:/i.test(String(label).trim()) ? 'User: ' : '';
      opt.textContent = prefix + label;
      select.appendChild(opt);
    });
    const current = presets[0];
    select.value = current ? current.id : select.value;
    onboardingUpdatePresetMeta();
  }

  function onboardingRenderBgPresets(){
    const select = $('#onbBgPreset');
    if(!select) return;
    select.innerHTML = '';
    const optNone = document.createElement('option'); optNone.value=''; optNone.textContent='Aktives Bild behalten';
    select.appendChild(optNone);
    BG_PRESETS.forEach(p=>{
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label || p.id;
      select.appendChild(opt);
    });
    const state = bgLoadState();
    if(state && state.active && state.active.type==='preset' && state.active.id){
      select.value = state.active.id;
    }
  }

  async function onboardingUpdatePresetMeta(){
    const select = $('#onbPresetSelect');
    const meta = $('#onbPresetMeta');
    if(!select || !meta) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    if(current){
      meta.textContent = current.description || 'Preset anwenden oder überspringen.';
    } else {
      meta.textContent = 'Preset optional.';
    }
  }

  async function onboardingApplyPreset(){
    const select = $('#onbPresetSelect');
    if(!select) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    await applyPresetFromEntry(current, 'Setup-Preset', { reload:false, markDone:false });
    store.set('onboarding.done', false);
    store.set('onboarding.resume', true);
    store.set('onboarding.step', onboardingState.step);
    onboardingState.pendingReload = true;
    onboardingUpdatePresetMeta();
    location.reload();
  }

  function onboardingUpdateUi(){
    const modal = $('#onboarding');
    if(!modal) return;
    const steps = $$('.onb-step', modal);
    const total = steps.length || 1;
    steps.forEach((stepEl, idx)=> stepEl.classList.toggle('active', idx === onboardingState.step));
    const prev = $('#onbPrev'); if(prev) prev.disabled = onboardingState.step === 0;
    const next = $('#onbNext'); if(next) next.textContent = onboardingState.step >= total-1 ? 'Fertig' : 'Weiter';
    const label = $('#onbProgressLabel'); if(label) label.textContent = `Schritt ${Math.min(onboardingState.step+1,total)} von ${total}`;
    const dots = $('#onbDots');
    if(dots){
      dots.innerHTML = '';
      for(let i=0;i<total;i++){
        const dot = document.createElement('span');
        dot.className = 'onb-dot' + (i === onboardingState.step ? ' active' : '');
        dots.appendChild(dot);
      }
    }
  }

  function onboardingCommitStep(){
    const modal = $('#onboarding'); if(!modal) return;
    const steps = $$('.onb-step', modal);
    const current = steps[onboardingState.step];
    const stepId = current ? current.getAttribute('data-step') : '';
    if(stepId === 'appearance'){
      const themeSelect = $('#onbTheme'); if(themeSelect){ const v = themeSelect.value; store.set('theme', v); applyTheme(v); }
      const cardSelect = $('#onbCardStyle'); if(cardSelect){ const allowed=['glass','solid','transparent','minimal']; const val = allowed.includes(cardSelect.value) ? cardSelect.value : 'glass'; store.set('ui.cardStyle', val); applyCardStyle(); }
      const bgSelect = $('#onbBgPreset');
      const bgRotate = $('#onbBgRotate');
      if(bgSelect){
        const val = bgSelect.value;
        if(val){
          bgApply({ type:'preset', id: val });
        }
        if(bgRotate){
          bgUpdateState(state => {
            state.rotation.enabled = !!bgRotate.checked;
            return state;
          });
        }
      }
    } else if(stepId === 'search'){
      const engineSelect = $('#onbEngine');
      if(engineSelect){
        const val = engineSelect.value;
        const enabled = store.get('engines.enabled', Object.keys(ENGINES)).filter(k=>k!==val);
        store.set('engines.enabled', [val, ...enabled]);
        renderEngines();
      }
    } else if(stepId === 'widgets'){
      const checks = $$('.onb-widget-toggle');
      if(checks.length){
        const conf = store.get('widgets', widgetDefaults());
        checks.forEach(cb=>{ const key=cb.getAttribute('data-widget'); if(key) conf[key]=!!cb.checked; });
        store.set('widgets', conf);
        applyWidgets();
      }
      const tint = $('#onbTint');
      if(tint && tint.checked) tintWidgets();
      const transportInput = $('#onbTransportInput');
      if(transportInput){
        const conf = store.get('widgets', widgetDefaults());
        const val = transportInput.value.trim();
        if(conf.transport){
          if(val){
            const existing = store.get('transport.default', null);
            if(existing && existing.name === val && existing.id){
              store.set('transport.station', existing);
            } else {
              store.set('transport.default', { name: val });
              store.set('transport.station', null);
            }
            store.set('transport.query', val);
            const transportQuery = $('#transportQuery');
            if(transportQuery) transportQuery.value = val;
            initTransport();
          }
        } else {
          store.set('transport.default', null);
        }
      }
    } else if(stepId === 'weather'){
      const city = $('#onbCity');
      if(city){
        const val = city.value.trim();
        store.set('weather.city', val);
        loadWeather();
      }
    }
  }

  function onboardingNext(){
    onboardingCommitStep();
    const modal = $('#onboarding');
    if(!modal) return;
    const steps = $$('.onb-step', modal);
    const total = steps.length || 1;
    if(onboardingState.step >= total-1){
      onboardingFinish();
      return;
    }
    onboardingState.step = Math.min(total-1, onboardingState.step + 1);
    onboardingUpdateUi();
  }

  function onboardingPrev(){
    onboardingState.step = Math.max(0, onboardingState.step - 1);
    onboardingUpdateUi();
  }

  function onboardingFinish(){
    onboardingCommitStep();
    if(onboardingState.pendingReload){
      store.set('onboarding.resume', false);
      store.set('onboarding.step', 0);
      store.set('onboarding.done', true);
      location.reload();
      return;
    }
    store.set('onboarding.resume', false);
    store.set('onboarding.step', 0);
    store.set('onboarding.done', true);
    onboardingClose();
  }

  function onboardingSkip(){
    const shouldReload = onboardingState.pendingReload;
    onboardingState.pendingReload = false;
    store.set('onboarding.resume', false);
    store.set('onboarding.step', 0);
    store.set('onboarding.done', true);
    if(shouldReload){
      location.reload();
      return;
    }
    onboardingClose();
  }

  function onboardingClose(){
    const modal = $('#onboarding');
    if(!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    const settingsOpen = $('#settingsModal') && $('#settingsModal').classList.contains('open');
    if(!settingsOpen) document.body.classList.remove('modal-open');
  }

  function onboardingFillFields(){
    const theme = store.get('theme','auto');
    const themeSelect = $('#onbTheme');
    if(themeSelect){ themeSelect.value = theme; }
    const cardStyle = store.get('ui.cardStyle','glass');
    const cardSelect = $('#onbCardStyle');
    if(cardSelect){ cardSelect.value = cardStyle; }
    onboardingRenderBgPresets();
    const bgRotate = $('#onbBgRotate'); if(bgRotate){ const state=bgLoadState(); bgRotate.checked = !!(state && state.rotation && state.rotation.enabled); }
    const engineSelect = $('#onbEngine');
    if(engineSelect){
      const enabled = store.get('engines.enabled', Object.keys(ENGINES));
      engineSelect.value = enabled[0] || 'google';
    }
    const widgetConf = store.get('widgets', widgetDefaults());
    $$('.onb-widget-toggle').forEach(cb=>{ const key=cb.getAttribute('data-widget'); if(key && key in widgetConf) cb.checked = !!widgetConf[key]; });
    const tint = $('#onbTint'); if(tint){ tint.checked = false; }
    const city = store.get('weather.city','');
    const cityInput = $('#onbCity');
    if(cityInput){ cityInput.value = city; }
    const onbTransportField = $('#onbTransportField');
    const onbTransportInput = $('#onbTransportInput');
    const transportOn = widgetConf.transport;
    if(onbTransportField) onbTransportField.style.display = transportOn ? '' : 'none';
    if(onbTransportInput){
      const def = store.get('transport.default', null);
      const query = store.get('transport.query', '');
      onbTransportInput.value = (def && def.name) ? def.name : (query || '');
    }
  }

  function onboardingOpen(force=false){
    const modal = $('#onboarding');
    if(!modal) return;
    const resume = store.get('onboarding.resume', false);
    if(store.get('onboarding.done', false) && !force && !resume) return;
    const steps = $$('.onb-step', modal);
    const maxStep = Math.max(0, steps.length - 1);
    const resumeStep = Number(store.get('onboarding.step', 0)) || 0;
    onboardingState.step = resumeStep >=0 ? Math.min(resumeStep, maxStep) : 0;
    onboardingState.pendingReload = false;
    store.set('onboarding.resume', false);
    store.set('onboarding.step', 0);
    onboardingFillFields();
    onboardingRenderPresets();
    onboardingUpdateUi();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
  }

  // ===== Background engine
  
  const BG_PRESETS = [
    {
      id: 'aurora',
      label: 'Aurora Ridge',
      url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=80',
      tone: 'dark',
      tags: ['night', 'nature'],
      credit: 'Photo: Joshua Earle - Unsplash'
    },
    {
      id: 'city-neon',
      label: 'Neon City',
      url: 'https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=1920&q=80',
      tone: 'dark',
      tags: ['city', 'urban'],
      credit: 'Photo: Denys Nevozhai - Unsplash'
    },
    {
      id: 'mountain-dawn',
      label: 'Mountain Dawn',
      url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80',
      tone: 'light',
      tags: ['mountain', 'sunrise'],
      credit: 'Photo: Nathan Anderson - Unsplash'
    },
    {
      id: 'forest-mist',
      label: 'Forest Mist',
      url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=80',
      tone: 'neutral',
      tags: ['forest', 'mist'],
      credit: 'Photo: Julia Caesar - Unsplash'
    },
    {
      id: 'ocean-calm',
      label: 'Ocean Calm',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
      tone: 'light',
      tags: ['ocean', 'blue'],
      credit: 'Photo: Fabian Wiktor - Unsplash'
    }
  ];
  const BG_TIME_SLOTS = [
    { id: 'morning', label: 'Morning 05-11' },
    { id: 'day', label: 'Day 11-17' },
    { id: 'evening', label: 'Evening 17-21' },
    { id: 'night', label: 'Night 21-05' }
  ];
  const BG_MAX_UPLOADS = 8;
  const BG_ACCENT_DEFAULTS = {
    dark: { primary: '#7c5cff', secondary: '#54d6ff' },
    light: { primary: '#5b43ff', secondary: '#17a4da' }
  };
  let bgCurrentAccent = null;
  let bgAccentCache = {};
  let bgRotationTimer = null;

  function bgCloneRef(ref){
    return ref ? JSON.parse(JSON.stringify(ref)) : null;
  }

  function bgCssBg(url){
    if(!url) return '';
    const safe = String(url).replace(/'/g, "\'");
    return "background-image:url('" + safe + "')";
  }

  function bgDefaultState(){
    const makePreset = index => BG_PRESETS[index] ? { type: 'preset', id: BG_PRESETS[index].id } : null;
    const first = makePreset(0);
    const fallback = first ? bgCloneRef(first) : { type: 'custom', url: '' };
    const morning = makePreset(2) || (first ? bgCloneRef(first) : null);
    const day = makePreset(3) || (first ? bgCloneRef(first) : null);
    const evening = makePreset(1) || (first ? bgCloneRef(first) : null);
    const night = makePreset(0) || makePreset(1) || bgCloneRef(fallback);
    return {
      active: first ? bgCloneRef(first) : bgCloneRef(fallback),
      customUrl: '',
      uploads: [],
      favorites: first ? [bgCloneRef(first)] : [],
      collections: [],
      history: [],
      accentCache: {},
      rotation: {
        enabled: false,
        strategy: 'time',
        intervalMinutes: 90,
        locked: false,
        lastApplied: 0,
        sources: { presets: true, favorites: true, uploads: true, collections: true, custom: true },
        schedule: {
          morning: morning ? bgCloneRef(morning) : bgCloneRef(fallback),
          day: day ? bgCloneRef(day) : bgCloneRef(fallback),
          evening: evening ? bgCloneRef(evening) : bgCloneRef(fallback),
          night: night ? bgCloneRef(night) : bgCloneRef(fallback),
          light: day ? bgCloneRef(day) : bgCloneRef(fallback),
          dark: night ? bgCloneRef(night) : bgCloneRef(fallback)
        }
      },
      ui: { tab: 'presets' }
    };
  }

  function bgClampByte(v){ return Math.max(0, Math.min(255, Math.round(v))); }
  function bgRgbToHex(r,g,b){
    const toHex = (n)=> bgClampByte(n).toString(16).padStart(2,'0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
    }
  function bgHexToRgb(hex){
    if(typeof hex !== 'string') return null;
    let h = hex.trim();
    if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return null;
    if(h.length === 4) h = '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
    const r = parseInt(h.slice(1,3),16); const g = parseInt(h.slice(3,5),16); const b = parseInt(h.slice(5,7),16);
    if([r,g,b].some(x=>Number.isNaN(x))) return null;
    return { r, g, b };
  }
  function bgRgbSaturation(r,g,b){
    const rn=r/255, gn=g/255, bn=b/255;
    const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
    if(max === min) return 0;
    const l = (max + min) / 2;
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    return s;
  }
  function bgAdjustHex(hex, factor=0){
    const rgb = bgHexToRgb(hex); if(!rgb) return '';
    const f = Math.max(-1, Math.min(1, factor));
    const target = f >= 0 ? 255 : 0;
    const mix = (v)=> bgClampByte(v + (target - v) * Math.abs(f));
    return bgRgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
  }
  function bgAccentFallback(){
    const theme = bgGetEffectiveTheme ? bgGetEffectiveTheme() : 'dark';
    return (BG_ACCENT_DEFAULTS[theme] || BG_ACCENT_DEFAULTS.dark);
  }
  function bgApplyAccentVars(primary, secondary){
    const root = document.documentElement; if(!root) return;
    const fallback = bgAccentFallback();
    const p = normalizeHex(primary) || fallback.primary;
    let s = normalizeHex(secondary);
    if(!s) s = bgAdjustHex(p, 0.18);
    if(!s) s = fallback.secondary;
    root.style.setProperty('--accent', p);
    root.style.setProperty('--accent-2', s);
    root.style.setProperty('--ring', `color-mix(in srgb, ${p} 55%, transparent)`);
    root.style.setProperty('--link', s);
    root.style.setProperty('--link-visited', s);
    const cardBase = bgGetBaseVar('--card-border-current');
    const tileBase = bgGetBaseVar('--tile-border-current');
    const cardTint = p && cardBase ? `color-mix(in srgb, ${p} 32%, ${cardBase})` : cardBase;
    const tileTint = p && tileBase ? `color-mix(in srgb, ${p} 32%, ${tileBase})` : tileBase;
    if(cardTint) root.style.setProperty('--card-border-current', cardTint);
    if(tileTint) root.style.setProperty('--tile-border-current', tileTint);
    bgCurrentAccent = { primary: p, secondary: s };
  }
  function bgExtractAccent(url){
    return new Promise((resolve, reject)=>{
      if(!url) return reject(new Error('missing url'));
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = ()=> {
        try {
          const size = 42;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0,0,size,size).data;
          const buckets = {};
          const quant = v => Math.min(255, Math.max(0, Math.round(v / 24) * 24));
          for(let i=0;i<data.length;i+=4){
            const a = data[i+3]; if(a < 40) continue;
            const r = data[i], g = data[i+1], b = data[i+2];
            const lum = 0.2126*r + 0.7152*g + 0.0722*b;
            if(lum < 24 || lum > 240) continue;
            const bucketKey = `${quant(r)},${quant(g)},${quant(b)}`;
            if(!buckets[bucketKey]) buckets[bucketKey] = { r: quant(r), g: quant(g), b: quant(b), count:0, sat:0, lum:0 };
            buckets[bucketKey].count++;
            buckets[bucketKey].sat += bgRgbSaturation(r,g,b);
            buckets[bucketKey].lum += lum;
          }
          let best = null; let bestScore = -Infinity;
          Object.values(buckets).forEach(b=>{
            const avgSat = b.sat / b.count;
            const avgLum = b.lum / b.count;
            const balance = 1 - Math.abs(avgLum - 140) / 140;
            const score = (avgSat * 1.35) + balance + Math.min(1, b.count / 160);
            if(score > bestScore){
              bestScore = score;
              best = b;
            }
          });
          if(best){
            const primary = bgRgbToHex(best.r, best.g, best.b);
            const secondary = bgAdjustHex(primary, 0.2);
            resolve({ primary, secondary });
          } else {
            reject(new Error('no accent'));
          }
        } catch(err){ reject(err); }
      };
      img.onerror = ()=> reject(new Error('image load failed'));
      img.src = url;
    });
  }
  function bgApplyAccent(resolved, state){
    const fallback = bgAccentFallback();
    if(!resolved || !resolved.url){
      bgApplyAccentVars(fallback.primary, fallback.secondary);
      return;
    }
    const key = resolved.url;
    const cache = bgAccentCache[key] || (state && state.accentCache && state.accentCache[key]);
    if(cache && cache.primary){
      bgCurrentAccent = { primary: cache.primary, secondary: cache.secondary || fallback.secondary };
      bgApplyAccentVars(cache.primary, cache.secondary);
      return;
    }
    bgExtractAccent(key).then(acc=>{
      bgCurrentAccent = acc;
      bgAccentCache[key] = { ...acc, ts: Date.now() };
      if(state && state.accentCache){
        state.accentCache[key] = bgAccentCache[key];
        bgSaveState(state);
      }
      bgApplyAccentVars(acc.primary, acc.secondary);
    }).catch(()=> bgApplyAccentVars(fallback.primary, fallback.secondary));
  }

  function bgNormalizeState(raw){
    const base = bgDefaultState();
    if(!raw || typeof raw !== 'object') return base;
    const state = { ...base, ...raw };
    state.customUrl = typeof raw.customUrl === 'string' ? raw.customUrl.trim() : '';
    state.uploads = Array.isArray(raw.uploads) ? raw.uploads.filter(Boolean).map(u => ({
      id: String(u.id || 'upload-' + Date.now()),
      name: typeof u.name === 'string' ? u.name : 'Upload',
      dataUrl: typeof u.dataUrl === 'string' ? u.dataUrl : '',
      width: Number(u.width) || 0,
      height: Number(u.height) || 0,
      created: Number(u.created) || Date.now()
    })).filter(u => u.dataUrl).slice(0, BG_MAX_UPLOADS) : [];
    state.favorites = Array.isArray(raw.favorites) ? raw.favorites.map(bgCloneRef).filter(Boolean).slice(0, 32) : base.favorites;
    state.collections = Array.isArray(raw.collections) ? raw.collections.map(col => ({
      id: String(col.id || 'col-' + Math.random().toString(36).slice(2,8)),
      name: typeof col.name === 'string' && col.name.trim() ? col.name.trim() : 'Collection',
      urls: Array.isArray(col.urls) ? col.urls.map(String).map(u => u.trim()).filter(Boolean).slice(0, 40) : [],
      cache: col.cache && typeof col.cache === 'object' ? col.cache : {},
      allowRotation: col.allowRotation !== false,
      created: Number(col.created) || Date.now(),
      updated: Number(col.updated) || Date.now()
    })).filter(col => col.urls.length).slice(0, 12) : [];
    state.accentCache = raw.accentCache && typeof raw.accentCache === 'object' ? raw.accentCache : {};
    state.history = Array.isArray(raw.history) ? raw.history.map(bgCloneRef).filter(Boolean).slice(0, 20) : [];
    const rotationRaw = raw.rotation && typeof raw.rotation === 'object' ? raw.rotation : {};
    state.rotation = {
      ...base.rotation,
      ...rotationRaw,
      intervalMinutes: Number(rotationRaw.intervalMinutes) || base.rotation.intervalMinutes,
      sources: { ...base.rotation.sources, ...(rotationRaw.sources || {}) },
      schedule: { ...base.rotation.schedule }
    };
    if(rotationRaw.schedule && typeof rotationRaw.schedule === 'object'){
      Object.keys(rotationRaw.schedule).forEach(key => {
        state.rotation.schedule[key] = rotationRaw.schedule[key] ? bgCloneRef(rotationRaw.schedule[key]) : null;
      });
    }
    if(rotationRaw.locked === true || rotationRaw.locked === false) state.rotation.locked = rotationRaw.locked;
    state.active = raw.active ? bgCloneRef(raw.active) : base.active;
    if(!state.active) state.active = base.active;
    state.ui = {
      tab: raw.ui && typeof raw.ui === 'object' && typeof raw.ui.tab === 'string' ? raw.ui.tab : base.ui.tab
    };
    return state;
  }

  function bgLoadState(){
    const raw = store.get('bg.state', null);
    if(raw) return bgNormalizeState(raw);
    const legacy = store.get('bg.url', '');
    if(legacy){
      try { localStorage.removeItem('bg.url'); } catch (err) {}
      const base = bgDefaultState();
      base.customUrl = legacy;
      base.active = { type: 'custom', url: legacy };
      return base;
    }
    return bgDefaultState();
  }

  function bgSaveState(state){
    store.set('bg.state', bgNormalizeState(state));
  }

  function bgUpdateState(mutator){
    const state = bgLoadState();
    const next = mutator ? mutator(state) || state : state;
    const normalized = bgNormalizeState(next);
    bgSaveState(normalized);
    return normalized;
  }

  function bgEncodeRef(ref){
    if(!ref || !ref.type) return '';
    if(ref.type === 'preset') return 'preset::' + (ref.id || '');
    if(ref.type === 'upload') return 'upload::' + (ref.id || '');
    if(ref.type === 'collection') return 'collection::' + (ref.collectionId || '') + '::' + encodeURIComponent(ref.url || '');
    if(ref.type === 'custom') return 'custom::' + encodeURIComponent(ref.url || '');
    return '';
  }

  function bgDecodeRef(token){
    if(!token) return null;
    const parts = token.split('::');
    const type = parts[0];
    if(type === 'preset') return { type: 'preset', id: parts[1] || '' };
    if(type === 'upload') return { type: 'upload', id: parts[1] || '' };
    if(type === 'collection') return { type: 'collection', collectionId: parts[1] || '', url: decodeURIComponent(parts[2] || '') };
    if(type === 'custom') return { type: 'custom', url: decodeURIComponent(parts[1] || '') };
    return null;
  }

  function bgRefKey(ref){
    return bgEncodeRef(ref);
  }

  function bgResolveRef(state, ref){
    if(!ref || !ref.type) return null;
    if(ref.type === 'preset'){
      const preset = BG_PRESETS.find(p => p.id === ref.id);
      if(!preset) return null;
      return {
        ref: { type: 'preset', id: preset.id },
        url: preset.url,
        title: preset.label,
        subtitle: 'Preset',
        meta: preset.tags && preset.tags.length ? preset.tags.join(', ') : '',
        credit: preset.credit || ''
      };
    }
    if(ref.type === 'upload'){
      const upload = (state.uploads || []).find(u => u.id === ref.id);
      if(!upload) return null;
      return {
        ref: { type: 'upload', id: upload.id },
        url: upload.dataUrl,
        title: upload.name || 'Upload',
        subtitle: 'Upload',
        meta: upload.width && upload.height ? Math.round(upload.width) + 'x' + Math.round(upload.height) : ''
      };
    }
    if(ref.type === 'collection'){
      const collection = (state.collections || []).find(c => c.id === ref.collectionId);
      if(!collection || !collection.urls.length) return null;
      const url = ref.url || collection.urls[0];
      if(!url) return null;
      const cached = collection.cache && collection.cache[url];
      return {
        ref: { type: 'collection', collectionId: collection.id, url },
        url: cached || url,
        title: collection.name,
        subtitle: 'Collection',
        meta: url
      };
    }
    if(ref.type === 'custom'){
      const url = ref.url || state.customUrl;
      if(!url) return null;
      return {
        ref: { type: 'custom', url },
        url,
        title: 'Custom URL',
        subtitle: 'Custom',
        meta: url
      };
    }
    return null;
  }
  function bgApplyResolved(resolved, state){
    const body = document.body;
    if(!body) return;
    if(resolved && resolved.url){
      const safe = resolved.url.replace(/"/g, '\\"');
      body.style.backgroundImage = 'url("' + safe + '")';
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    } else {
      body.style.backgroundImage = '';
    }
    body.dataset.bgType = resolved ? resolved.ref.type : '';
    bgApplyAccent(resolved, state);
  }

  function bgRenderPreview(state, resolved){
    const preview = document.getElementById('bgCurrentPreview');
    if(preview){
      preview.style.backgroundImage = resolved && resolved.url ? 'url("' + resolved.url.replace(/"/g, '\\"') + '")' : '';
    }
    const title = document.getElementById('bgCurrentTitle');
    if(title) title.textContent = resolved ? resolved.title : 'Kein Hintergrund';
    const meta = document.getElementById('bgCurrentMeta');
    if(meta){
      const parts = [];
      if(resolved){
        if(resolved.subtitle) parts.push(resolved.subtitle);
        if(resolved.meta) parts.push(resolved.meta);
        if(resolved.credit) parts.push(resolved.credit);
      }
      meta.textContent = parts.length ? parts.join(' | ') : 'Kein Bild ausgewählt';
    }
    const undoBtn = document.getElementById('bgActionUndo');
    if(undoBtn) undoBtn.disabled = !(state.history && state.history.length);
    const lockBtn = document.getElementById('bgActionLock');
    if(lockBtn){
      lockBtn.textContent = state.rotation && state.rotation.locked ? 'Rotation fortsetzen' : 'Rotation sperren';
      lockBtn.dataset.locked = state.rotation && state.rotation.locked ? 'true' : 'false';
    }
  }

  function bgRenderPresets(state){
    const panel = document.getElementById('bgPanel-presets');
    if(!panel) return;
    if(!BG_PRESETS.length){
      panel.innerHTML = '<div class="bg-empty">Keine Presets vorhanden.</div>';
      return;
    }
    const favKeys = new Set((state.favorites || []).map(bgRefKey));
    const activeKey = bgRefKey(state.active);
    const cards = BG_PRESETS.map(p => {
      const ref = { type: 'preset', id: p.id };
      const key = bgRefKey(ref);
      const isActive = key && key === activeKey;
      const isFav = favKeys.has(key);
      const metaParts = [];
      if(p.tags && p.tags.length) metaParts.push(p.tags.join(', '));
      if(p.tone) metaParts.push('Tone: ' + p.tone);
      const meta = metaParts.join(' | ');
      return '<div class="bg-card' + (isActive ? ' highlight' : '') + '" data-ref="' + key + '">' +
        '<div class="bg-thumb" style="' + bgCssBg(p.url) + '"></div>' +
        '<div class="bg-card-title">' + escapeHtml(p.label) + '</div>' +
        '<div class="bg-card-meta">' + (meta ? escapeHtml(meta) : '') + '</div>' +
        '<div class="bg-card-actions">' +
          '<button type="button" data-action="bg-apply" data-ref="' + key + '"' + (isActive ? ' data-active="true"' : '') + '>Setzen</button>' +
          '<button type="button" data-action="bg-favorite" data-ref="' + key + '">' + (isFav ? 'Favorit' : 'Favorisieren') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
    panel.innerHTML = '<div class="bg-grid">' + cards + '</div>';
  }

  function bgRenderFavorites(state){
    const panel = document.getElementById('bgPanel-favorites');
    if(!panel) return;
    if(!state.favorites.length){
      panel.innerHTML = '<div class="bg-empty">Noch keine Favoriten. Markiere Presets oder Uploads.</div>';
      return;
    }
    const activeKey = bgRefKey(state.active);
    const cards = state.favorites.map(ref => {
      const resolved = bgResolveRef(state, ref);
      if(!resolved) return '';
      const key = bgRefKey(resolved.ref);
      const isActive = key === activeKey;
      return '<div class="bg-card' + (isActive ? ' highlight' : '') + '" data-ref="' + key + '">' +
        '<div class="bg-thumb" style="' + bgCssBg(resolved.url) + '"></div>' +
        '<div class="bg-card-title">' + escapeHtml(resolved.title) + '</div>' +
        '<div class="bg-card-meta">' + (resolved.meta ? escapeHtml(resolved.meta) : '') + '</div>' +
        '<div class="bg-card-actions">' +
          '<button type="button" data-action="bg-apply" data-ref="' + key + '"' + (isActive ? ' data-active="true"' : '') + '>Setzen</button>' +
          '<button type="button" data-action="bg-favorite-remove" data-ref="' + key + '">Entfernen</button>' +
        '</div>' +
      '</div>';
    }).filter(Boolean).join('');
    panel.innerHTML = '<div class="bg-grid">' + cards + '</div>';
  }

  function bgRenderUploads(state){
    const panel = document.getElementById('bgPanel-uploads');
    if(!panel) return;
    const activeKey = bgRefKey(state.active);
    const list = (state.uploads || []).map(upload => {
      const ref = { type: 'upload', id: upload.id };
      const key = bgRefKey(ref);
      const isActive = key === activeKey;
      const size = upload.width && upload.height ? Math.round(upload.width) + 'x' + Math.round(upload.height) : '';
      return '<div class="bg-card' + (isActive ? ' highlight' : '') + '">' +
        '<div class="bg-thumb" style="' + bgCssBg(upload.dataUrl) + '"></div>' +
        '<div class="bg-card-title">' + escapeHtml(upload.name || 'Upload') + '</div>' +
        '<div class="bg-card-meta">' + escapeHtml(size) + '</div>' +
        '<div class="bg-card-actions">' +
          '<button type="button" data-action="bg-apply" data-ref="' + key + '"' + (isActive ? ' data-active="true"' : '') + '>Setzen</button>' +
          '<button type="button" data-action="bg-favorite" data-ref="' + key + '">Favorisieren</button>' +
          '<button type="button" data-action="bg-delete-upload" data-upload="' + upload.id + '">Entfernen</button>' +
        '</div>' +
      '</div>';
    }).join('');
    panel.innerHTML =
      '<div class="bg-upload-drop" id="bgUploadDrop">' +
        '<div>Dateien hier ablegen</div>' +
        '<button type="button" data-action="bg-upload-browse">Datei auswählen</button>' +
        '<input type="file" id="bgUploadInput" multiple accept="image/*" hidden>' +
        '<div class="bg-upload-note">Wir verkleinern Bilder automatisch (16:9, max 2560px) und speichern sie lokal. Max ' + BG_MAX_UPLOADS + ' Dateien.</div>' +
      '</div>' +
      (state.uploads && state.uploads.length ? '<div class="bg-grid">' + list + '</div>' : '<div class="bg-empty">Noch keine Uploads vorhanden.</div>');
  }

  function bgRenderCollections(state){
    const panel = document.getElementById('bgPanel-collections');
    if(!panel) return;
    const cards = (state.collections || []).map(col => {
      const count = col.urls.length;
      const previewUrl = col.urls.length ? (col.cache && col.cache[col.urls[0]]) || col.urls[0] : '';
      return '<div class="bg-collection" data-collection="' + col.id + '">' +
        '<div class="bg-collection-header">' +
          '<div>' +
            '<div class="bg-collection-title">' + escapeHtml(col.name) + '</div>' +
            '<div class="bg-collection-count">' + count + ' Quellen</div>' +
          '</div>' +
          '<div class="bg-collection-actions">' +
            '<button type="button" data-action="bg-collection-apply" data-collection="' + col.id + '">Zufällig</button>' +
            '<button type="button" data-action="bg-collection-cache" data-collection="' + col.id + '">Offline speichern</button>' +
            '<button type="button" data-action="bg-collection-remove" data-collection="' + col.id + '">Entfernen</button>' +
          '</div>' +
        '</div>' +
        (previewUrl ? '<div class="bg-thumb" style="' + bgCssBg(previewUrl) + '"></div>' : '') +
        '<details>' +
          '<summary>Quellen ansehen</summary>' +
          '<ul>' + col.urls.map(u => '<li><code>' + escapeHtml(u) + '</code></li>').join('') + '</ul>' +
          '<label style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;">' +
            '<input type="checkbox" data-action="bg-collection-rotation" data-collection="' + col.id + '"' + (col.allowRotation !== false ? ' checked' : '') + '> Rotation verwenden' +
          '</label>' +
        '</details>' +
      '</div>';
    }).join('');
    panel.innerHTML =
      '<div class="bg-selector">' +
        '<label for="bgCollectionName">Neue Sammlung</label>' +
        '<input id="bgCollectionName" type="text" placeholder="Meine Sammlung">' +
        '<textarea id="bgCollectionUrls" rows="4" placeholder="Eine Bild-URL pro Zeile"></textarea>' +
        '<div class="bg-inline-actions">' +
          '<button type="button" data-action="bg-collection-save">Speichern</button>' +
          '<button type="button" data-action="bg-collection-clear">Felder leeren</button>' +
        '</div>' +
        '<p class="bg-mini-text">URLs werden lokal gespeichert. Remote Quellen benötigen CORS für Bilder.</p>' +
      '</div>' +
      (cards ? '<div class="bg-collection-list">' + cards + '</div>' : '<div class="bg-empty">Noch keine Sammlungen angelegt.</div>');
  }

  function bgBuildRotationOptions(state){
    const options = [];
    const seen = new Set();
    const add = (label, ref) => {
      const key = bgRefKey(ref);
      if(!key || seen.has(key)) return;
      seen.add(key);
      options.push({ value: key, label });
    };
    BG_PRESETS.forEach(p => add('Preset: ' + p.label, { type: 'preset', id: p.id }));
    (state.uploads || []).forEach(u => add('Upload: ' + (u.name || u.id), { type: 'upload', id: u.id }));
    (state.favorites || []).forEach(f => {
      const resolved = bgResolveRef(state, f);
      add('Favorit: ' + (resolved ? resolved.title : bgRefKey(f)), f);
    });
    if(state.customUrl) add('Custom: gespeicherte URL', { type: 'custom', url: state.customUrl });
    return options;
  }

  function bgRenderRotation(state){
    const panel = document.getElementById('bgPanel-rotation');
    if(!panel) return;
    const options = bgBuildRotationOptions(state);
    const schedule = state.rotation.schedule || {};
    const buildSelect = slot => {
      const selected = schedule[slot] ? bgRefKey(schedule[slot]) : '';
      const opts = ['<option value="">Kein festes Bild</option>']
        .concat(options.map(opt => '<option value="' + opt.value + '"' + (opt.value === selected ? ' selected' : '') + '>' + escapeHtml(opt.label) + '</option>'))
        .join('');
      return '<select data-action="bg-rotation-slot" data-slot="' + slot + '">' + opts + '</select>';
    };
    const sources = state.rotation.sources || {};
    const sourceControls = [
      { key: 'presets', label: 'Presets' },
      { key: 'favorites', label: 'Favoriten' },
      { key: 'uploads', label: 'Uploads' },
      { key: 'collections', label: 'Sammlungen' },
      { key: 'custom', label: 'Custom URL' }
    ].map(item => '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" data-action="bg-rotation-source" data-source="' + item.key + '"' + (sources[item.key] ? ' checked' : '') + '> ' + item.label + '</label>').join('');
    panel.innerHTML =
      '<div class="bg-rotation-grid">' +
        '<div class="bg-rotation-card">' +
          '<label><input type="checkbox" id="bgRotationEnabled"' + (state.rotation.enabled ? ' checked' : '') + '> Automatische Rotation aktiv</label>' +
          '<div class="bg-mini-text">' + (state.rotation.locked ? 'Rotation ist aktuell gesperrt.' : 'Hintergründe wechseln nach dem Plan.') + '</div>' +
          '<div class="bg-selector">' +
            '<label for="bgRotationStrategy">Modus</label>' +
            '<select id="bgRotationStrategy">' +
              '<option value="time"' + (state.rotation.strategy === 'time' ? ' selected' : '') + '>Zeitabhängig</option>' +
              '<option value="interval"' + (state.rotation.strategy === 'interval' ? ' selected' : '') + '>Intervall</option>' +
              '<option value="theme"' + (state.rotation.strategy === 'theme' ? ' selected' : '') + '>Theme</option>' +
            '</select>' +
          '</div>' +
          '<div class="bg-selector">' +
            '<label for="bgRotationInterval">Intervall in Minuten</label>' +
            '<input id="bgRotationInterval" type="number" min="5" step="5" value="' + (Number(state.rotation.intervalMinutes) || 60) + '">' +
            '<div class="bg-mini-text">Relevanz nur im Intervall Modus.</div>' +
          '</div>' +
        '</div>' +
        '<div class="bg-rotation-card">' +
          '<label>Quellen für Zufall</label>' +
          '<div class="bg-selector">' + sourceControls + '</div>' +
        '</div>' +
        '<div class="bg-rotation-card">' +
          '<label>Zeitplan</label>' +
          BG_TIME_SLOTS.map(slot => '<div class="bg-selector"><span>' + slot.label + '</span>' + buildSelect(slot.id) + '</div>').join('') +
        '</div>' +
        '<div class="bg-rotation-card">' +
          '<label>Theme Plan</label>' +
          '<div class="bg-selector"><span>Theme Light</span>' + buildSelect('light') + '</div>' +
          '<div class="bg-selector"><span>Theme Dark</span>' + buildSelect('dark') + '</div>' +
          '<div class="bg-mini-text">Theme Plan wird genutzt, wenn der Modus auf Theme steht.</div>' +
        '</div>' +
      '</div>';
  }

  function bgRenderCustom(state){
    const panel = document.getElementById('bgPanel-custom');
    if(!panel) return;
    panel.innerHTML =
      '<div class="bg-selector">' +
        '<label for="bgCustomUrl">Eigene Bild URL</label>' +
        '<input id="bgCustomUrl" type="url" placeholder="https://example.com/image.jpg" value="' + escapeHtml(state.customUrl || '') + '">' +
        '<div class="bg-inline-actions">' +
          '<button type="button" data-action="bg-custom-apply">Setzen</button>' +
          '<button type="button" data-action="bg-custom-save">Speichern</button>' +
          (state.customUrl ? '<button type="button" data-action="bg-custom-clear">Löschen</button>' : '') +
        '</div>' +
        '<p class="bg-mini-text">URL wird lokal gespeichert. Server muss CORS für Bilder erlauben.</p>' +
      '</div>';
  }

  function bgBindUploadInput(){
    const input = document.getElementById('bgUploadInput');
    if(input && !input.dataset.bound){
      input.addEventListener('change', event => {
        const files = Array.from(event.target.files || []);
        bgHandleFiles(files);
        input.value = '';
      });
      input.dataset.bound = 'true';
    }
  }

  function bgRenderSettings(){
    const engine = document.getElementById('bgEngine');
    if(!engine) return;
    const state = bgLoadState();
    const resolved = bgResolveRef(state, state.active);
    bgRenderPreview(state, resolved);
    bgRenderPresets(state);
    bgRenderFavorites(state);
    bgRenderUploads(state);
    bgRenderCollections(state);
    bgRenderRotation(state);
    bgRenderCustom(state);
    bgSetActiveTab((state.ui && state.ui.tab) || 'presets', false);
    bgBindUploadInput();
  }

  function bgSetActiveTab(name, persist){
    const engine = document.getElementById('bgEngine');
    if(!engine) return;
    engine.querySelectorAll('.bg-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === name);
    });
    engine.querySelectorAll('.bg-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'bgPanel-' + name);
    });
    if(persist){
      bgUpdateState(state => {
        if(!state.ui) state.ui = { tab: name };
        else state.ui.tab = name;
        return state;
      });
    }
  }
  function bgApply(ref, options){
    const opts = options || {};
    if(!ref){
      const state = bgLoadState();
      const resolved = bgResolveRef(state, state.active);
      bgApplyResolved(resolved, state);
      bgRenderPreview(state, resolved);
      return resolved;
    }
    let resolved = null;
    const state = bgUpdateState(current => {
      const candidate = bgResolveRef(current, ref);
      if(!candidate) return current;
      resolved = candidate;
      const currentKey = bgRefKey(current.active);
      const nextKey = bgRefKey(candidate.ref);
      if(!opts.skipHistory && currentKey && nextKey && currentKey !== nextKey){
        current.history = [bgCloneRef(current.active), ...(current.history || [])].filter(Boolean).slice(0, 20);
      }
      current.active = bgCloneRef(candidate.ref);
      current.rotation.lastApplied = Date.now();
      return current;
    });
    if(resolved) bgApplyResolved(resolved, state);
    bgRenderSettings();
    if(!opts.skipSchedule) bgRestartTimer(state);
    return resolved;
  }

  function bgToggleFavorite(ref){
    if(!ref) return;
    const key = bgRefKey(ref);
    bgUpdateState(state => {
      const list = state.favorites || [];
      const index = list.findIndex(item => bgRefKey(item) === key);
      if(index >= 0) list.splice(index, 1);
      else list.unshift(bgCloneRef(ref));
      state.favorites = list.slice(0, 32);
      return state;
    });
    bgRenderSettings();
  }

  function bgRemoveFavorite(ref){
    if(!ref) return;
    const key = bgRefKey(ref);
    bgUpdateState(state => {
      state.favorites = (state.favorites || []).filter(item => bgRefKey(item) !== key);
      return state;
    });
    bgRenderSettings();
  }

  function bgDeleteUpload(id){
    if(!id) return;
    let removedActive = false;
    bgUpdateState(state => {
      state.uploads = (state.uploads || []).filter(u => u.id !== id);
      state.history = (state.history || []).filter(r => !(r && r.type === 'upload' && r.id === id));
      if(state.active && state.active.type === 'upload' && state.active.id === id){
        removedActive = true;
        state.active = bgDefaultState().active;
      }
      return state;
    });
    if(removedActive) bgApply(null, { skipHistory: true });
    bgRenderSettings();
  }

  function bgSaveCollection(){
    const nameInput = document.getElementById('bgCollectionName');
    const urlsInput = document.getElementById('bgCollectionUrls');
    if(!urlsInput) return;
    const name = nameInput ? nameInput.value.trim() : '';
    const urls = urlsInput.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    if(!urls.length){
      alert('Mindestens eine URL eintragen.');
      return;
    }
    bgUpdateState(state => {
      const collection = {
        id: 'col-' + Date.now().toString(36),
        name: name || 'Sammlung ' + (state.collections.length + 1),
        urls,
        cache: {},
        allowRotation: true,
        created: Date.now(),
        updated: Date.now()
      };
      state.collections.unshift(collection);
      state.collections = state.collections.slice(0, 12);
      return state;
    });
    if(nameInput) nameInput.value = '';
    urlsInput.value = '';
    bgRenderSettings();
  }

  function bgClearCollectionForm(){
    const nameInput = document.getElementById('bgCollectionName');
    if(nameInput) nameInput.value = '';
    const urlsInput = document.getElementById('bgCollectionUrls');
    if(urlsInput) urlsInput.value = '';
  }

  function bgApplyCollection(id){
    const state = bgLoadState();
    const collection = state.collections.find(c => c.id === id);
    if(!collection || !collection.urls.length){
      alert('Sammlung ist leer.');
      return;
    }
    const options = collection.urls.map(url => ({ type: 'collection', collectionId: collection.id, url }));
    const pick = options[Math.floor(Math.random() * options.length)];
    bgApply(bgCloneRef(pick));
  }

  async function bgCacheCollection(id){
    const state = bgLoadState();
    const collection = state.collections.find(c => c.id === id);
    if(!collection || !collection.urls.length){
      alert('Sammlung ist leer.');
      return;
    }
    const button = document.querySelector('[data-action="bg-collection-cache"][data-collection="' + id + '"]');
    if(button) button.disabled = true;
    const cached = {};
    try {
      for(const url of collection.urls){
        const data = await bgFetchImageData(url);
        if(data) cached[url] = data;
      }
      bgUpdateState(stateUpdate => {
        const target = stateUpdate.collections.find(c => c.id === id);
        if(target){
          target.cache = { ...target.cache, ...cached };
          target.updated = Date.now();
        }
        return stateUpdate;
      });
      alert('Sammlung lokal gespeichert.');
    } catch (err) {
      console.error(err);
      alert('Fehler beim Laden. Prüfe CORS Vorgaben.');
    } finally {
      if(button) button.disabled = false;
    }
    bgRenderSettings();
  }

  function bgHandleCustom(action){
    const input = document.getElementById('bgCustomUrl');
    if(!input) return;
    const value = input.value.trim();
    if(action === 'save'){
      bgUpdateState(state => { state.customUrl = value; return state; });
      bgRenderSettings();
      return;
    }
    if(action === 'apply'){
      if(!value){
        alert('Bitte eine URL eintragen.');
        return;
      }
      bgUpdateState(state => { state.customUrl = value; return state; });
      bgApply({ type: 'custom', url: value });
      return;
    }
    if(action === 'clear'){
      bgUpdateState(state => {
        state.customUrl = '';
        state.history = (state.history || []).filter(ref => ref.type !== 'custom');
        if(state.active && state.active.type === 'custom') state.active = bgDefaultState().active;
        return state;
      });
      bgApply(null, { skipHistory: true });
      bgRenderSettings();
    }
  }

  function bgHandleClick(event){
    const target = event.target;
    if(!target) return;
    const tabBtn = target.closest('.bg-tab');
    if(tabBtn){
      bgSetActiveTab(tabBtn.dataset.panel, true);
      return;
    }
    const action = target.dataset.action;
    if(!action) return;
    if(action === 'bg-random'){
      bgRandomPick();
      return;
    }
    if(action === 'bg-undo'){
      bgUndo();
      return;
    }
    if(action === 'bg-lock'){
      bgToggleLock();
      return;
    }
    if(action === 'bg-apply'){
      const ref = bgDecodeRef(target.dataset.ref);
      if(ref) bgApply(ref);
      return;
    }
    if(action === 'bg-favorite'){
      const ref = bgDecodeRef(target.dataset.ref);
      if(ref) bgToggleFavorite(ref);
      return;
    }
    if(action === 'bg-favorite-remove'){
      const ref = bgDecodeRef(target.dataset.ref);
      if(ref) bgRemoveFavorite(ref);
      return;
    }
    if(action === 'bg-delete-upload'){
      bgDeleteUpload(target.dataset.upload);
      return;
    }
    if(action === 'bg-upload-browse'){
      const input = document.getElementById('bgUploadInput');
      if(input) input.click();
      return;
    }
    if(action === 'bg-collection-save'){
      bgSaveCollection();
      return;
    }
    if(action === 'bg-collection-clear'){
      bgClearCollectionForm();
      return;
    }
    if(action === 'bg-collection-apply'){
      bgApplyCollection(target.dataset.collection);
      return;
    }
    if(action === 'bg-collection-cache'){
      bgCacheCollection(target.dataset.collection);
      return;
    }
    if(action === 'bg-collection-remove'){
      const id = target.dataset.collection;
      bgUpdateState(state => {
        state.collections = (state.collections || []).filter(c => c.id !== id);
        state.history = (state.history || []).filter(ref => !(ref && ref.type === 'collection' && ref.collectionId === id));
        if(state.active && state.active.type === 'collection' && state.active.collectionId === id){
          state.active = bgDefaultState().active;
        }
        return state;
      });
      bgApply(null, { skipHistory: true });
      bgRenderSettings();
      return;
    }
    if(action === 'bg-custom-apply'){
      bgHandleCustom('apply');
      return;
    }
    if(action === 'bg-custom-save'){
      bgHandleCustom('save');
      return;
    }
    if(action === 'bg-custom-clear'){
      bgHandleCustom('clear');
      return;
    }
    if(action === 'bg-tint-widgets'){
      tintWidgets();
      return;
    }
  }

  function bgHandleChange(event){
    const target = event.target;
    if(!target) return;
    if(target.id === 'bgRotationEnabled'){
      const checked = target.checked;
      const state = bgUpdateState(state => { state.rotation.enabled = checked; return state; });
      if(checked) bgEvaluateRotation('enabled');
      bgRestartTimer(state);
      bgRenderSettings();
      return;
    }
    if(target.id === 'bgRotationStrategy'){
      const strategy = target.value || 'time';
      const state = bgUpdateState(state => { state.rotation.strategy = strategy; return state; });
      bgEvaluateRotation('strategy');
      bgRestartTimer(state);
      bgRenderSettings();
      return;
    }
    if(target.id === 'bgRotationInterval'){
      const mins = Math.max(5, Number(target.value) || 5);
      const state = bgUpdateState(state => { state.rotation.intervalMinutes = mins; return state; });
      bgRestartTimer(state);
      bgRenderSettings();
      return;
    }
    const action = target.dataset.action;
    if(action === 'bg-rotation-source'){
      const key = target.dataset.source;
      bgUpdateState(state => {
        state.rotation.sources[key] = target.checked;
        return state;
      });
      bgRestartTimer(bgLoadState());
      return;
    }
    if(action === 'bg-rotation-slot'){
      const slot = target.dataset.slot;
      const token = target.value;
      bgUpdateState(state => {
        state.rotation.schedule[slot] = token ? bgCloneRef(bgDecodeRef(token)) : null;
        return state;
      });
      bgRenderSettings();
      bgEvaluateRotation('schedule');
      return;
    }
    if(action === 'bg-collection-rotation'){
      const id = target.dataset.collection;
      bgUpdateState(state => {
        const collection = (state.collections || []).find(c => c.id === id);
        if(collection) collection.allowRotation = target.checked;
        return state;
      });
    }
  }

  function bgHandleDrag(event){
    const drop = document.getElementById('bgUploadDrop');
    if(!drop) return;
    if(event.type === 'dragover'){
      event.preventDefault();
      drop.classList.add('dragging');
    } else if(event.type === 'dragleave'){
      drop.classList.remove('dragging');
    }
  }

  function bgHandleDrop(event){
    const drop = document.getElementById('bgUploadDrop');
    if(!drop) return;
    event.preventDefault();
    drop.classList.remove('dragging');
    const files = Array.from(event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : []);
    if(files.length) bgHandleFiles(files);
  }
  async function bgHandleFiles(files){
    if(!files || !files.length) return;
    const queue = [];
    for(const file of files){
      if(queue.length >= BG_MAX_UPLOADS) break;
      if(file.type && !file.type.startsWith('image/')) continue;
      queue.push(file);
    }
    for(const file of queue){
      try {
        await bgProcessFile(file);
      } catch (err) {
        console.error(err);
      }
    }
    bgRenderSettings();
  }

  async function bgProcessFile(file){
    const dataUrl = await bgReadFileAsDataUrl(file);
    const img = await bgLoadImage(dataUrl);
    const scaled = bgResizeImage(img);
    const entry = {
      id: 'upload-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6),
      name: file.name ? file.name.replace(/\.[^.]+$/, '') : 'Upload',
      dataUrl: scaled.dataUrl,
      width: scaled.width,
      height: scaled.height,
      created: Date.now()
    };
    bgUpdateState(state => {
      state.uploads.unshift(entry);
      state.uploads = state.uploads.slice(0, BG_MAX_UPLOADS);
      return state;
    });
  }

  function bgReadFileAsDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Lesen fehlgeschlagen'));
      reader.readAsDataURL(file);
    });
  }

  function bgLoadImage(dataUrl){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = dataUrl;
    });
  }

  function bgResizeImage(img){
    const targetRatio = 16 / 9;
    const maxWidth = 2560;
    const maxHeight = 1440;
    let width = maxWidth;
    let height = Math.round(width / targetRatio);
    if(height > maxHeight){
      height = maxHeight;
      width = Math.round(height * targetRatio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if(!ctx){
      return { dataUrl: img.src, width: img.width, height: img.height };
    }
    const sourceRatio = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if(sourceRatio > targetRatio){
      sh = img.height;
      sw = sh * targetRatio;
      sx = (img.width - sw) / 2;
    } else {
      sw = img.width;
      sh = sw / targetRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    } catch (err) {
      dataUrl = img.src;
    }
    return { dataUrl, width, height };
  }

  function bgFetchImageData(url){
    return fetch(url, { mode: 'cors' })
      .then(res => {
        if(!res.ok) throw new Error('Fetch fehlgeschlagen');
        return res.blob();
      })
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Konvertierung fehlgeschlagen'));
        reader.readAsDataURL(blob);
      }));
  }

  function bgCollectCandidates(state, includeActive){
    const allow = state.rotation.sources || {};
    const list = [];
    const activeKey = bgRefKey(state.active);
    if(allow.presets){
      BG_PRESETS.forEach(p => list.push({ type: 'preset', id: p.id }));
    }
    if(allow.uploads){
      (state.uploads || []).forEach(u => list.push({ type: 'upload', id: u.id }));
    }
    if(allow.favorites){
      (state.favorites || []).forEach(f => list.push(bgCloneRef(f)));
    }
    if(allow.collections){
      (state.collections || []).forEach(col => {
        if(col.allowRotation === false) return;
        col.urls.forEach(url => list.push({ type: 'collection', collectionId: col.id, url }));
      });
    }
    if(allow.custom && state.customUrl){
      list.push({ type: 'custom', url: state.customUrl });
    }
    return list.filter(ref => {
      const key = bgRefKey(ref);
      if(!key) return false;
      if(!includeActive && key === activeKey) return false;
      return !!bgResolveRef(state, ref);
    });
  }

  function bgRandomPick(){
    const state = bgLoadState();
    const candidates = bgCollectCandidates(state, false);
    if(!candidates.length){
      alert('Keine Hintergründe verfügbar.');
      return;
    }
    const pick = bgCloneRef(candidates[Math.floor(Math.random() * candidates.length)]);
    bgApply(pick);
  }

  function bgUndo(){
    let resolved = null;
    const state = bgUpdateState(current => {
      if(!current.history || !current.history.length) return current;
      const previous = current.history.shift();
      const candidate = bgResolveRef(current, previous);
      if(!candidate) return current;
      resolved = candidate;
      current.active = bgCloneRef(candidate.ref);
      return current;
    });
    if(resolved) bgApplyResolved(resolved, state);
    bgRenderSettings();
  }

  function bgToggleLock(){
    const state = bgUpdateState(current => {
      current.rotation.locked = !current.rotation.locked;
      return current;
    });
    if(state.rotation.locked && bgRotationTimer){
      clearTimeout(bgRotationTimer);
      bgRotationTimer = null;
    }
    if(!state.rotation.locked) bgEvaluateRotation('unlock');
    bgRenderSettings();
  }

  function bgGetEffectiveTheme(){
    const mode = store.get('theme', 'auto');
    if(mode === 'dark' || mode === 'light') return mode;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function bgCurrentSlot(){
    const hour = new Date().getHours();
    if(hour >= 5 && hour < 11) return 'morning';
    if(hour >= 11 && hour < 17) return 'day';
    if(hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  function bgPickSlot(state){
    const schedule = state.rotation.schedule || {};
    const ref = schedule[bgCurrentSlot()];
    return ref ? bgCloneRef(ref) : null;
  }

  function bgPickTheme(state){
    const schedule = state.rotation.schedule || {};
    const theme = bgGetEffectiveTheme();
    return schedule[theme] ? bgCloneRef(schedule[theme]) : null;
  }

  function bgComputeDelay(state){
    if(state.rotation.strategy === 'interval'){
      const mins = Math.max(5, Number(state.rotation.intervalMinutes) || 60);
      return mins * 60000;
    }
    if(state.rotation.strategy === 'time'){
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const checkpoints = [5, 11, 17, 21];
      let nextHour = checkpoints.find(h => h > hour || (h === hour && minute < 1));
      const target = new Date(now);
      if(nextHour === undefined){
        target.setDate(target.getDate() + 1);
        target.setHours(5, 0, 5, 0);
      } else {
        target.setHours(nextHour, 0, 5, 0);
      }
      const diff = target.getTime() - now.getTime();
      return Math.max(diff, 60000);
    }
    if(state.rotation.strategy === 'theme'){
      return 5 * 60000;
    }
    return null;
  }

  function bgRestartTimer(state){
    if(bgRotationTimer){
      clearTimeout(bgRotationTimer);
      bgRotationTimer = null;
    }
    if(!state.rotation.enabled || state.rotation.locked) return;
    const delay = bgComputeDelay(state);
    if(!delay) return;
    bgRotationTimer = setTimeout(() => bgRunRotation('timer'), delay);
  }

  function bgRunRotation(trigger){
    const state = bgLoadState();
    if(!state.rotation.enabled || state.rotation.locked) return;
    let ref = null;
    if(state.rotation.strategy === 'time') ref = bgPickSlot(state);
    else if(state.rotation.strategy === 'theme') ref = bgPickTheme(state);
    if(!ref){
      const candidates = bgCollectCandidates(state, false);
      if(candidates.length) ref = bgCloneRef(candidates[Math.floor(Math.random() * candidates.length)]);
    }
    if(ref) bgApply(ref, { skipSchedule: true, fromAuto: true });
    bgRestartTimer(bgLoadState());
  }

  function bgEvaluateRotation(reason){
    const state = bgLoadState();
    if(!state.rotation.enabled || state.rotation.locked) return;
    let ref = null;
    if(state.rotation.strategy === 'time') ref = bgPickSlot(state);
    else if(state.rotation.strategy === 'theme') ref = bgPickTheme(state);
    if(ref){
      const nextKey = bgRefKey(ref);
      if(nextKey && nextKey !== bgRefKey(state.active)) bgApply(ref, { fromAuto: true });
    }
    bgRestartTimer(bgLoadState());
  }

  function bgInitBackgroundEngine(){
    const engine = document.getElementById('bgEngine');
    if(!engine) return;
    engine.addEventListener('click', bgHandleClick);
    engine.addEventListener('change', bgHandleChange);
    engine.addEventListener('dragover', bgHandleDrag);
    engine.addEventListener('dragleave', bgHandleDrag);
    engine.addEventListener('drop', bgHandleDrop);
    bgRenderSettings();
    bgApply();
    const state = bgLoadState();
    bgRestartTimer(state);
    bgEvaluateRotation('startup');
  }

  function bgOnThemeChange(){
    bgEvaluateRotation('theme');
    if(bgCurrentAccent) bgApplyAccentVars(bgCurrentAccent.primary, bgCurrentAccent.secondary);
    else bgApplyAccentVars();
  }

  function applyBackground(ref){
    return bgApply(ref);
  }

  // ===== System Status
  function renderSystem(){
    const info = [];
    if('deviceMemory' in navigator) info.push(`RAM: ${navigator.deviceMemory} GB`);
    if('hardwareConcurrency' in navigator) info.push(`CPU‑Kerne: ${navigator.hardwareConcurrency}`);
    if('connection' in navigator && navigator.connection){
      const c = navigator.connection;
      info.push(`Netz: ${c.downlink ?? '–'} Mbit/s · ${c.effectiveType ?? '–'}${c.saveData? ' · SaveData':''}`);
    }
    $('#systemInfo').innerHTML = info.length? info.join('<br>') : 'Keine Daten verfügbar';
  }

  // ===== Widgets visibility
  function widgetDefaults(){
    return { todo:true, notes:true, tiles:true, weather:true, transport:true, quote:true, recent:true, system:true, news:true };
  }
  function applyWidgets(){
    const conf = store.get('widgets', widgetDefaults());
    const map = { todo:'#todo', notes:'#notes', tiles:'#tilesCard', weather:'#weather', transport:'#transportCard', quote:'#quoteCard', recent:'#recent', system:'#systemCard', news:'#newsCard' };
    Object.entries(map).forEach(([k,sel])=>{ const el=$(sel); if(el) el.style.display = conf[k] ? '' : 'none'; });
  }

  // ===== Widget colors
  function widgetColorDefaults(){
    return { todo:'', notes:'', tiles:'', weather:'', transport:'', quote:'', recent:'', system:'', news:'' };
  }
  function hexToRgba(hex, a=0.18){
    if(!hex) return '';
    let h = hex.replace('#','');
    if(h.length===3) h = h.split('').map(c=>c+c).join('');
    const r = parseInt(h.slice(0,2),16); const g = parseInt(h.slice(2,4),16); const b = parseInt(h.slice(4,6),16);
    if([r,g,b].some(v=>Number.isNaN(v))) return '';
    return `rgba(${r},${g},${b},${a})`;
  }
  function bgGetBaseVar(name){
    const body = document.body;
    const root = document.documentElement;
    const target = body || root; if(!target) return '';
    const prev = target.style.getPropertyValue(name);
    if(prev) target.style.removeProperty(name);
    let val = getComputedStyle(target).getPropertyValue(name).trim();
    if(prev) target.style.setProperty(name, prev);
    if(val) return val;
    if(target !== root && root){
      const rootPrev = root.style.getPropertyValue(name);
      if(rootPrev) root.style.removeProperty(name);
      val = getComputedStyle(root).getPropertyValue(name).trim();
      if(rootPrev) root.style.setProperty(name, rootPrev);
    }
    return val;
  }
  function applyWidgetColors(){
    const colors = store.get('widget.colors', widgetColorDefaults());
    const map = { todo:'#todo', notes:'#notes', tiles:'#tilesCard', weather:'#weather', transport:'#transportCard', quote:'#quoteCard', recent:'#recent', system:'#systemCard', news:'#newsCard' };
    const theme = bgGetEffectiveTheme ? bgGetEffectiveTheme() : 'dark';
    const baseBgRaw = bgGetBaseVar('--card-bg-current') || '';
    const baseBorderRaw = bgGetBaseVar('--card-border-current') || '';
    const fallbackBg = (baseBgRaw && baseBgRaw !== 'transparent') ? baseBgRaw : (theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)');
    const fallbackBorder = baseBorderRaw || (theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)');
    Object.entries(map).forEach(([k,sel])=>{
      const el = $(sel); if(!el) return;
      const hex = colors[k];
      if(hex){
        const tint = hexToRgba(hex, 0.32);
        const border = hexToRgba(hex, 0.42);
        const bgLayer = tint ? `linear-gradient(0deg, ${tint}, ${tint}), ${fallbackBg}` : fallbackBg;
        el.style.background = bgLayer;
        el.style.borderColor = border || fallbackBorder;
      } else {
        el.style.background = '';
        el.style.borderColor = '';
      }
    });
  }

  function tintWidgets(){
    const root = document.documentElement;
    const style = root ? getComputedStyle(root) : null;
    const primary = normalizeHex(style?.getPropertyValue('--accent').trim()) || '#7c5cff';
    const secondary = normalizeHex(style?.getPropertyValue('--accent-2').trim()) || primary;
    const colors = store.get('widget.colors', widgetColorDefaults());
    const assignments = {
      todo: primary,
      notes: secondary,
      tiles: primary,
      weather: secondary,
      transport: primary,
      quote: primary,
      recent: secondary,
      system: primary,
      news: secondary
    };
    Object.entries(assignments).forEach(([k,v])=> colors[k] = normalizeHex(v));
    colors.tiles = colors.tiles || primary;
    store.set('widget.colors', colors);
    applyWidgetColors();
    // also tint clock & search to stay consistent
    store.set('ui.clock.color', primary);
    store.set('ui.search.color', secondary);
    applySurfaceColors();
    const modal = $('#settingsModal');
    if(modal && modal.classList.contains('open')) fillSettings();
  }

  function normalizeHex(hex){
    if(typeof hex !== 'string') return '';
    let h = hex.trim();
    if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return '';
    if(h.length === 4) h = '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
    return `#${h.slice(1).toLowerCase()}`;
  }

  function applyAccentTint(){
    const root = document.documentElement; if(!root) return;
    const style = getComputedStyle(root);
    const accent = normalizeHex(style.getPropertyValue('--accent'));
    const secondary = normalizeHex(style.getPropertyValue('--accent-2'));
    const cardBase = bgGetBaseVar('--card-border-current');
    const tileBase = bgGetBaseVar('--tile-border-current');
    const cardTint = accent && cardBase ? `color-mix(in srgb, ${accent} 32%, ${cardBase})` : cardBase;
    const tileTint = accent && tileBase ? `color-mix(in srgb, ${accent} 32%, ${tileBase})` : tileBase;
    if(cardTint) root.style.setProperty('--card-border-current', cardTint);
    if(tileTint) root.style.setProperty('--tile-border-current', tileTint);
    if(accent) root.style.setProperty('--ring', `color-mix(in srgb, ${accent} 55%, transparent)`);
    if(secondary) root.style.setProperty('--link', secondary);
    if(secondary) root.style.setProperty('--link-visited', secondary);
  }

  function applySurfaceColor(prefix, raw){
    const root = document.documentElement; if(!root) return;
    const body = document.body;
    const bodyStyle = body ? getComputedStyle(body) : null;
    const rootStyle = getComputedStyle(root);
    const baseBg = (bodyStyle && bodyStyle.getPropertyValue('--card-bg-current').trim()) || rootStyle.getPropertyValue('--card-bg-current').trim() || 'transparent';
    const baseBorder = (bodyStyle && bodyStyle.getPropertyValue('--card-border-current').trim()) || rootStyle.getPropertyValue('--card-border-current').trim() || 'transparent';
    const baseShadow = (bodyStyle && bodyStyle.getPropertyValue('--card-shadow-current').trim()) || rootStyle.getPropertyValue('--card-shadow-current').trim() || 'none';
    const baseBackdrop = (bodyStyle && bodyStyle.getPropertyValue('--card-backdrop-current').trim()) || rootStyle.getPropertyValue('--card-backdrop-current').trim() || 'none';
    const hex = normalizeHex(raw);
    if(hex){
      const tint = hexToRgba(hex, 0.22);
      const border = hexToRgba(hex, 0.34) || baseBorder;
      const bgLayer = tint ? `linear-gradient(0deg, ${tint}, ${tint}), ${baseBg}` : baseBg;
      root.style.setProperty(`--${prefix}-bg`, bgLayer);
      root.style.setProperty(`--${prefix}-border`, border || baseBorder);
      root.style.setProperty(`--${prefix}-shadow`, baseShadow);
      root.style.setProperty(`--${prefix}-backdrop`, baseBackdrop);
    } else {
      root.style.setProperty(`--${prefix}-bg`, baseBg);
      root.style.setProperty(`--${prefix}-border`, baseBorder);
      root.style.setProperty(`--${prefix}-shadow`, baseShadow);
      root.style.setProperty(`--${prefix}-backdrop`, baseBackdrop);
    }
  }

  function applySurfaceColors(){
    applySurfaceColor('clock', store.get('ui.clock.color',''));
    applySurfaceColor('search', store.get('ui.search.color',''));
  }

  function applyCardStyle(){
    const body = document.body; if(!body) return;
    const current = store.get('ui.cardStyle','glass');
    const allowed = ['glass','solid','transparent','minimal'];
    const value = allowed.includes(current) ? current : 'glass';
    body.setAttribute('data-card-style', value);
    applySurfaceColors();
    applyWidgetColors();
    applyAccentTint();
  }

  function cycleCardStyle(){
    const order = ['glass','solid','transparent','minimal'];
    const current = store.get('ui.cardStyle','glass');
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    store.set('ui.cardStyle', next);
    applyCardStyle();
    const modal = $('#settingsModal');
    if(modal && modal.classList.contains('open')) fillSettings();
  }

  function resetSurfaceColors(){
    store.set('ui.clock.color','');
    store.set('ui.search.color','');
    applySurfaceColors();
    const modal = $('#settingsModal');
    if(modal && modal.classList.contains('open')) fillSettings();
  }

  // ===== Command Palette (Ctrl/Cmd+K)
  function openSettingsTab(name){
    openSettings();
    selectSettingsTab(name);
  }
  function toggleWidget(key, force){
    const defaults = widgetDefaults();
    const conf = store.get('widgets', defaults);
    const next = typeof force == 'boolean' ? force : !conf[key];
    conf[key] = next;
    store.set('widgets', conf);
    applyWidgets();
    const modal = $('#settingsModal');
    if(modal && modal.classList.contains('open')) fillSettings();
    return next;
  }
  function focusWidget(key){
    const focusMap = {
      todo: '#todoInput',
      notes: '#notesArea',
      tiles: '#tiles',
      weather: '#weather',
      transport: '#transportQuery',
      quote: '#quoteCard',
      recent: '#recent',
      system: '#systemCard',
      news: '#newsCard'
    };
    const sel = focusMap[key];
    const el = sel ? $(sel) : null;
    if(!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if(el.focus) el.focus();
  }
  function appendNote(text){
    const clean = String(text || '').trim();
    if(!clean) return;
    const current = store.get('notes', '');
    const next = current ? current + '\n' + clean : clean;
    store.set('notes', next);
    const area = $('#notesArea');
    if(area) area.value = next;
  }
  function setSearchEngine(key){
    const enabled = store.get('engines.enabled', Object.keys(ENGINES));
    if(!enabled.includes(key)){
      enabled.unshift(key);
      store.set('engines.enabled', enabled);
      renderEngines();
    }
    const select = $('#engine');
    if(select) select.value = key;
  }
  async function buildPaletteItems(){
    const items = [];
    const add = (t, opts)=> items.push({ t, ...opts });
    const widgetNames = { todo:'Todo', notes:'Notizen', tiles:'Favoriten', weather:'Wetter', transport:'Transport', quote:'Quote', recent:'Zuletzt', system:'System', news:'News' };
    const engineLabels = { google:'Google', ddg:'DuckDuckGo', bing:'Bing', yt:'YouTube', wikipedia:'Wikipedia', maps:'Google Maps' };

    // Commands
    add('Suche fokussieren', { k:'/', g:'command', a: ()=> $('#query').focus() });
    add('Suche starten', { g:'search', a: ()=>{ renderSearchSuggest([]); doSearch(); } });
    add('Einstellungen öffnen', { k:'S', g:'settings', a: openSettings });
    add('Einstellungen: Allgemein', { g:'settings', a: ()=> openSettingsTab('general') });
    add('Einstellungen: Hintergrund', { g:'settings', a: ()=> openSettingsTab('background') });
    add('Einstellungen: Suche', { g:'settings', a: ()=> openSettingsTab('search') });
    add('Einstellungen: Widgets', { g:'settings', a: ()=> openSettingsTab('widgets') });
    add('Einstellungen: Daten', { g:'settings', a: ()=> openSettingsTab('data') });
    add('Einstellungen: Guide', { g:'settings', a: ()=> openSettingsTab('guide') });
    add('Theme wechseln (Auto/Dark/Light)', { k:'T', g:'theme', a: ()=>{ const cur=store.get('theme','auto'); const next = cur==='dark' ? 'light' : cur==='light' ? 'auto' : 'dark'; store.set('theme', next); applyTheme(next); }});
    add('Theme: Auto', { g:'theme', a: ()=>{ store.set('theme','auto'); applyTheme('auto'); }});
    add('Theme: Dark', { g:'theme', a: ()=>{ store.set('theme','dark'); applyTheme('dark'); }});
    add('Theme: Light', { g:'theme', a: ()=>{ store.set('theme','light'); applyTheme('light'); }});
    add('Kachel-Stil: Glass', { g:'theme', a: ()=>{ store.set('ui.cardStyle','glass'); applyCardStyle(); }});
    add('Kachel-Stil: Solid', { g:'theme', a: ()=>{ store.set('ui.cardStyle','solid'); applyCardStyle(); }});
    add('Kachel-Stil: Transparent', { g:'theme', a: ()=>{ store.set('ui.cardStyle','transparent'); applyCardStyle(); }});
    add('Kachel-Stil: Minimal', { g:'theme', a: ()=>{ store.set('ui.cardStyle','minimal'); applyCardStyle(); }});
    add('Header-Farben zurücksetzen', { g:'theme', a: resetSurfaceColors });
    add('Akzentfarben neu berechnen', { g:'theme', a: applyAccentTint });
    add('Hintergrund: Rotation umschalten', { g:'theme', a: ()=>{ bgUpdateState(state=>{ state.rotation.enabled = !state.rotation.enabled; return state; }); bgRenderSettings(); }});
    add('Hintergrund: Rotation sperren/fortsetzen', { g:'theme', a: ()=>{ bgUpdateState(state=>{ state.rotation.locked = !state.rotation.locked; return state; }); bgRenderSettings(); }});

    // Widget actions
    add('Widgets: Alle anzeigen', { g:'widgets', a: ()=>{ const next = {}; Object.keys(widgetNames).forEach(k=> next[k]=true); store.set('widgets', next); applyWidgets(); if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings(); }});
    add('Widgets: Alle ausblenden', { g:'widgets', a: ()=>{ const next = {}; Object.keys(widgetNames).forEach(k=> next[k]=false); store.set('widgets', next); applyWidgets(); if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings(); }});
    Object.keys(widgetNames).forEach(key=>{
      add(`Widget: ${widgetNames[key]} umschalten`, { g:'widgets', a: ()=> toggleWidget(key) });
      add(`Widget: ${widgetNames[key]} fokussieren`, { g:'widgets', a: ()=> focusWidget(key) });
    });

    // Quick add
    add('Todo hinzufügen', { g:'quick', a: ()=>{ const v = prompt('Todo'); if(v && v.trim()) addTodo(v.trim()); }});
    add('Notiz hinzufügen', { g:'quick', a: ()=>{ const v = prompt('Notiz'); if(v && v.trim()) appendNote(v.trim()); }});

    // Tiles and widgets refresh
    add('Tile hinzufügen', { k:'+', g:'tiles', a: addTile });
    add('Tiles zurücksetzen', { g:'tiles', a: ()=>{ if(confirm('Standard-Kacheln wiederherstellen?')){ store.set('tiles', defaultTiles()); renderTiles(); }} });
    add('Wetter aktualisieren', { g:'command', a: loadWeather });
    add('News aktualisieren', { g:'command', a: loadNews });
    add('Transport aktualisieren', { g:'command', a: loadTransportDepartures });
    add('System aktualisieren', { g:'command', a: renderSystem });
    add('Alle Widgets aktualisieren', { g:'command', a: ()=>{ loadWeather(); loadNews(); loadTransportDepartures(); renderSystem(); }});

    // Search engines
    Object.keys(ENGINES).forEach(key=>{
      const label = engineLabels[key] || key;
      add(`Engine: ${label}`, { g:'search', a: ()=>{ setSearchEngine(key); $('#query').focus(); } });
    });

    // Background presets
    BG_PRESETS.forEach(p=>{
      add(`Hintergrund: ${p.label}`, { g:'theme', a: ()=> bgApply({ type:'preset', id: p.id }) });
    });

    // Data actions + presets
    add('Daten exportieren', { g:'data', a: exportData });
    add('Daten importieren', { g:'data', a: ()=>{ const file = $('#importFile'); if(file) file.click(); }});
    try{
      const presets = await loadDataPresets();
      presets.forEach(p=>{
        const label = p.label || p.id || 'Preset';
        add(`Data Preset: ${label}`, { g:'data', a: ()=> applyPresetFromEntry(p, `Preset: ${label}`) });
      });
    }catch{}

    // Tiles
    const tiles = store.get('tiles', defaultTiles());
    tiles.forEach(t=> items.push({ t:`${t.title}`, s:t.url, g:'tile', a: ()=> openUrl(t.url, t.title) }));
    return items;
  }
  function fuzzyIncludes(text, q){
    text = (text||'').toLowerCase(); q = (q||'').toLowerCase();
    if(!q) return true;
    let i=0; for(const ch of text){ if(ch===q[i]) i++; if(i===q.length) return true; }
    return false;
  }
  function scoreMatch(text, q){
    const t = (text||'').toLowerCase();
    const query = (q||'').toLowerCase();
    if(!query) return 1;
    if(t.startsWith(query)) return 100;
    if(t.split(/\s+/).some(w=> w.startsWith(query))) return 80;
    if(t.includes(query)) return 60;
    if(fuzzyIncludes(t, query)) return 40;
    return 0;
  }
  function openPalette(){
    const modal = $('#palette'); const input = $('#paletteInput'); const list = $('#paletteList');
    if(modal.classList.contains('open')){
      input.focus();
      return;
    }
    const groupOrder = ['command','settings','search','widgets','theme','data','tiles','tile','quick'];
    const groupLabels = {
      command: 'Befehle',
      settings: 'Einstellungen',
      search: 'Suche',
      widgets: 'Widgets',
      theme: 'Theme & Hintergrund',
      data: 'Daten',
      tiles: 'Tiles',
      tile: 'Favoriten',
      quick: 'Schnell'
    };
    let isLoading = true;
    let all = [];
    let filtered = [];
    let flat = [];
    let idx = 0;
    function flatten(items){
      const out = [];
      const remaining = items.slice();
      groupOrder.forEach(g=>{
        items.forEach(it=>{ if(it.g===g) out.push(it); });
        for(let i=remaining.length-1;i>=0;i--){ if(remaining[i].g===g) remaining.splice(i,1); }
      });
      remaining.forEach(it=> out.push(it));
      return out;
    }
    function render(){
      list.innerHTML='';
      if(isLoading){
        const loading = document.createElement('li');
        loading.className = 'palette-empty';
        loading.textContent = 'Lade...';
        list.appendChild(loading);
        input.setAttribute('aria-activedescendant','');
        return;
      }
      if(!flat.length){
        const empty = document.createElement('li');
        empty.className = 'palette-empty';
        empty.textContent = 'Keine Treffer';
        list.appendChild(empty);
        input.setAttribute('aria-activedescendant','');
        return;
      }
      const addSection = (group)=>{
        const items = filtered.filter(it=> it.g===group);
        if(!items.length) return;
        const header = document.createElement('li');
        header.className = 'palette-section';
        header.textContent = groupLabels[group] || group;
        list.appendChild(header);
        items.forEach(it=>{
          const i = flat.indexOf(it);
          const li = document.createElement('li');
          li.className = 'palette-item' + (i===idx ? ' active':'');
          li.setAttribute('role','option');
          li.id = `palette-item-${i}`;
          li.innerHTML = `<span>${escapeHtml(it.t)}</span>${it.s?`<span class="muted">${escapeHtml(it.s)}</span>`:''}${it.k?`<span class="k">${it.k}</span>`:''}`;
          li.addEventListener('click', ()=>{ it.a && it.a(); closePalette(); });
          li.addEventListener('mouseenter', ()=>{ idx = i; input.focus({ preventScroll: true }); render(); });
          list.appendChild(li);
        });
      };
      groupOrder.forEach(addSection);
      const active = list.querySelector('.palette-item.active');
      if(active) active.scrollIntoView({ block:'nearest' });
      input.setAttribute('aria-activedescendant', `palette-item-${idx}`);
    }
    function applyFilter(){
      if(isLoading) return;
      const q = input.value.trim();
      const scored = all.map((it, i)=> {
        const score = scoreMatch(it.t+' '+(it.s||''), q);
        return { it, i, score };
      }).filter(x=> x.score > 0);
      scored.sort((a,b)=> b.score - a.score || a.i - b.i);
      filtered = scored.map(x=> x.it);
      flat = flatten(filtered);
      idx = 0;
      render();
    }
    function onKey(e){
      if(e.key==='Escape'){ e.preventDefault(); closePalette(); }
      else if(e.key==='ArrowDown'){ e.preventDefault(); idx = Math.min(idx+1, Math.max(0, flat.length-1)); render(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); idx = Math.max(idx-1, 0); render(); }
      else if(e.key==='Home'){ e.preventDefault(); idx = 0; render(); }
      else if(e.key==='End'){ e.preventDefault(); idx = Math.max(0, flat.length-1); render(); }
      else if(e.key==='Enter'){ e.preventDefault(); const it=flat[idx]; if(it){ it.a && it.a(); closePalette(); } }
    }
    function onOverlayClick(e){ if(e.target.id==='palette') closePalette(); }
    function onListMouseDown(e){ e.preventDefault(); input.focus({ preventScroll: true }); }
    async function loadItems(){
      all = await buildPaletteItems();
      isLoading = false;
      applyFilter();
    }
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    input.value=''; input.focus(); render();
    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', onKey);
    modal.addEventListener('click', onOverlayClick);
    list.addEventListener('mousedown', onListMouseDown);
    loadItems();
    function closePalette(){
      modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
      input.removeEventListener('input', applyFilter);
      input.removeEventListener('keydown', onKey);
      modal.removeEventListener('click', onOverlayClick);
      list.removeEventListener('mousedown', onListMouseDown);
      input.setAttribute('aria-activedescendant','');
    }
    // expose for ESC in global handler
    window.__closePalette = closePalette;
  }

// ===== Init
  function init(){
    // Theme
    const theme = store.get('theme','auto');
    applyTheme(theme);
    applyCardStyle();
    $('#themeToggle').addEventListener('click', ()=>{
      const current = store.get('theme','auto');
      const next = current==='dark' ? 'light' : current==='light' ? 'auto' : 'dark';
      store.set('theme', next); applyTheme(next);
    });
    $('#openSettings').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#themeSelect').addEventListener('change', e=>{ store.set('theme', e.target.value); applyTheme(e.target.value); });
    if(window.matchMedia){
      const media = matchMedia('(prefers-color-scheme: dark)');
      if(media && media.addEventListener){
        media.addEventListener('change', () => { if(store.get('theme','auto') === 'auto') bgOnThemeChange(); });
      }
    }
    $('#defaultCity').addEventListener('change', e=>{ store.set('weather.city', e.target.value.trim()); loadWeather(); });
    const transportDefaultInput = $('#transportDefaultInput');
    const transportDefaultSuggest = $('#transportDefaultSuggest');
    if(transportDefaultInput && transportDefaultSuggest){
      let timer = null;
      transportDefaultInput.addEventListener('input', ()=>{
        const q = transportDefaultInput.value.trim();
        if(timer) clearTimeout(timer);
        if(!q){
          store.set('transport.default', null);
          transportDefaultSuggest.classList.add('hidden');
          transportDefaultSuggest.innerHTML = '';
          return;
        }
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggestTo(transportDefaultSuggest, [], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`, null);
          return;
        }
        timer = setTimeout(()=> transportSearchCore(q, 0, 'settings', (items, message)=>{
          renderTransportSuggestTo(transportDefaultSuggest, items, message, item=>{
            store.set('transport.default', { id: item.id, name: item.name, type: item.type, place: item.place || '' });
            transportDefaultInput.value = item.name;
            transportDefaultSuggest.classList.add('hidden');
            transportDefaultSuggest.innerHTML = '';
          });
        }), 320);
      });
      transportDefaultInput.addEventListener('focus', ()=>{
        const q = transportDefaultInput.value.trim();
        if(!q) return;
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggestTo(transportDefaultSuggest, [], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`, null);
          return;
        }
        transportSearchCore(q, 0, 'settings', (items, message)=>{
          renderTransportSuggestTo(transportDefaultSuggest, items, message, item=>{
            store.set('transport.default', { id: item.id, name: item.name, type: item.type, place: item.place || '' });
            transportDefaultInput.value = item.name;
            transportDefaultSuggest.classList.add('hidden');
            transportDefaultSuggest.innerHTML = '';
          });
        });
      });
      document.addEventListener('click', e=>{
        if(!transportDefaultSuggest.contains(e.target) && e.target !== transportDefaultInput){
          transportDefaultSuggest.classList.add('hidden');
        }
      });
    }

    const cardSelect = $('#cardStyle');
    if(cardSelect) cardSelect.addEventListener('change', e=>{ const allowed = ['glass','solid','transparent','minimal']; const val = allowed.includes(e.target.value) ? e.target.value : 'glass'; store.set('ui.cardStyle', val); applyCardStyle(); if(val !== e.target.value) fillSettings(); });
    const clockColorInput = $('#clockColor');
    if(clockColorInput) clockColorInput.addEventListener('input', ()=>{ const val = normalizeHex(clockColorInput.value); store.set('ui.clock.color', val); applySurfaceColors(); });
    const clockReset = $('#clockColorReset'); if(clockReset) clockReset.addEventListener('click', ()=>{ store.set('ui.clock.color',''); applySurfaceColors(); fillSettings(); });
    const searchColorInput = $('#searchColor');
    if(searchColorInput) searchColorInput.addEventListener('input', ()=>{ const val = normalizeHex(searchColorInput.value); store.set('ui.search.color', val); applySurfaceColors(); });
    const searchReset = $('#searchColorReset'); if(searchReset) searchReset.addEventListener('click', ()=>{ store.set('ui.search.color',''); applySurfaceColors(); fillSettings(); });

    // Engines & Search
    renderEngines();
    const suggestBox = document.createElement('div');
    suggestBox.id = 'searchSuggest';
    suggestBox.className = 'search-suggest hidden';
    const searchBox = $('#searchBox');
    if(searchBox) searchBox.appendChild(suggestBox);
    searchSuggest.box = suggestBox;
    $('#go').addEventListener('click', ()=>{ renderSearchSuggest([]); doSearch(); });
    $('#query').addEventListener('input', ()=> updateSearchSuggest());
    $('#query').addEventListener('focus', ()=> updateSearchSuggest());
    $('#query').addEventListener('keydown', e=>{
      if(e.key === 'ArrowDown'){ e.preventDefault(); setSearchSuggestActive(Math.min(searchSuggest.active+1, searchSuggest.items.length-1)); return; }
      if(e.key === 'ArrowUp'){ e.preventDefault(); setSearchSuggestActive(Math.max(searchSuggest.active-1, 0)); return; }
      if(e.key === 'Tab'){
        if(searchSuggest.items.length){
          e.preventDefault();
          const idx = searchSuggest.active >=0 ? searchSuggest.active : 0;
          selectSearchSuggestion(idx, false);
        }
      }
      if(e.key === 'Enter'){
        if(searchSuggest.active >=0 && searchSuggest.items[searchSuggest.active]){
          e.preventDefault(); selectSearchSuggestion(searchSuggest.active, true); return;
        }
        renderSearchSuggest([]); doSearch(); return;
      }
      if(e.key === 'Escape'){ renderSearchSuggest([]); }
    });
    document.addEventListener('click', e=>{
      const s = $('#searchBox');
      if(!s) return;
      if(!s.contains(e.target)) renderSearchSuggest([]);
    });

    // Export / Import
    const exp = $('#exportData'); if(exp) exp.addEventListener('click', exportData);
    const imp = $('#importData'); if(imp) imp.addEventListener('click', ()=> $('#importFile').click());
    const file = $('#importFile'); if(file) file.addEventListener('change', importDataFromFile);
    const dataNote = $('#dataNote'); if(dataNote) dataNote.textContent = 'Export speichert sämtliche Einstellungen und Daten lokal als JSON. Import überschreibt vorhandene Einträge.';
    renderDataPresets();
    const presetSelect = $('#dataPresetSelect'); if(presetSelect) presetSelect.addEventListener('change', updateDataPresetMeta);
    const presetApply = $('#applyPreset'); if(presetApply) presetApply.addEventListener('click', applyDataPreset);
    const restartOnb = $('#restartOnboarding'); if(restartOnb) restartOnb.addEventListener('click', ()=>{ store.set('onboarding.done', false); onboardingOpen(true); });

    // Onboarding modal
    const onbNext = $('#onbNext'); if(onbNext) onbNext.addEventListener('click', onboardingNext);
    const onbPrev = $('#onbPrev'); if(onbPrev) onbPrev.addEventListener('click', onboardingPrev);
    const onbSkip = $('#onbSkip'); if(onbSkip) onbSkip.addEventListener('click', onboardingSkip);
    const onbClose = $('#onbClose'); if(onbClose) onbClose.addEventListener('click', onboardingSkip);
    const onbPresetSelect = $('#onbPresetSelect'); if(onbPresetSelect) onbPresetSelect.addEventListener('change', onboardingUpdatePresetMeta);
    const onbApplyPresetBtn = $('#onbApplyPreset'); if(onbApplyPresetBtn) onbApplyPresetBtn.addEventListener('click', onboardingApplyPreset);
    const onbTheme = $('#onbTheme'); if(onbTheme) onbTheme.addEventListener('change', e=>{ const v=e.target.value; store.set('theme', v); applyTheme(v); });
    const onbCardStyle = $('#onbCardStyle'); if(onbCardStyle) onbCardStyle.addEventListener('change', e=>{ const allowed=['glass','solid','transparent','minimal']; const val = allowed.includes(e.target.value) ? e.target.value : 'glass'; store.set('ui.cardStyle', val); applyCardStyle(); });
    const onbBgPreset = $('#onbBgPreset'); if(onbBgPreset) onbBgPreset.addEventListener('change', ()=>{ const val=onbBgPreset.value; if(val) bgApply({ type:'preset', id: val }); });
    const onbBgRotate = $('#onbBgRotate'); if(onbBgRotate) onbBgRotate.addEventListener('change', ()=>{ const checked=!!onbBgRotate.checked; bgUpdateState(state=>{ state.rotation.enabled = checked; return state; }); });
    const onbCity = $('#onbCity'); if(onbCity) onbCity.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); onboardingNext(); } });
    const onbModal = $('#onboarding'); if(onbModal) onbModal.addEventListener('click', e=>{ if(e.target.id==='onboarding') onboardingSkip(); });
    const onbTransportToggle = document.querySelector('.onb-widget-toggle[data-widget="transport"]');
    const onbTransportField = $('#onbTransportField');
    const onbTransportInput = $('#onbTransportInput');
    const onbTransportSuggest = $('#onbTransportSuggest');
    if(onbTransportToggle && onbTransportField){
      onbTransportToggle.addEventListener('change', ()=>{
        onbTransportField.style.display = onbTransportToggle.checked ? '' : 'none';
      });
    }
    if(onbTransportInput && onbTransportSuggest){
      let timer = null;
      const handleSelect = item=>{
        store.set('transport.default', { id: item.id, name: item.name, type: item.type, place: item.place || '' });
        store.set('transport.query', item.name);
        onbTransportInput.value = item.name;
        onbTransportSuggest.classList.add('hidden');
        onbTransportSuggest.innerHTML = '';
      };
      onbTransportInput.addEventListener('input', ()=>{
        const q = onbTransportInput.value.trim();
        if(timer) clearTimeout(timer);
        if(!q){
          onbTransportSuggest.classList.add('hidden');
          onbTransportSuggest.innerHTML = '';
          return;
        }
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggestTo(onbTransportSuggest, [], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`, null);
          return;
        }
        timer = setTimeout(()=> transportSearchCore(q, 0, 'onboarding', (items, message)=>{
          renderTransportSuggestTo(onbTransportSuggest, items, message, handleSelect);
        }), 320);
      });
      onbTransportInput.addEventListener('focus', ()=>{
        const q = onbTransportInput.value.trim();
        if(!q) return;
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggestTo(onbTransportSuggest, [], `Mindestens ${TRANSPORT_MIN_QUERY} Zeichen`, null);
          return;
        }
        transportSearchCore(q, 0, 'onboarding', (items, message)=>{
          renderTransportSuggestTo(onbTransportSuggest, items, message, handleSelect);
        });
      });
      document.addEventListener('click', e=>{
        if(!onbTransportSuggest.contains(e.target) && e.target !== onbTransportInput){
          onbTransportSuggest.classList.add('hidden');
        }
      });
    }

    // Persist settings fields (shortcuts, feeds, wordlist)
    $('#shortcutConfig').addEventListener('change', ()=>{ try{ const j=JSON.parse($('#shortcutConfig').value); store.set('shortcuts', j);}catch{ alert('Ungültiges Shortcuts-JSON'); } });
    $('#feedsConfig').addEventListener('change', ()=>{ try{ const j=JSON.parse($('#feedsConfig').value); store.set('news.custom', j); fillNewsSources(); loadNews(); }catch{ alert('Ungültiges Feeds-JSON'); } });
    const wordlistEditor = $('#wordlistEditor');
    const wordlistSave = $('#wordlistSave');
    const wordlistReset = $('#wordlistReset');
    const applyInlineWordlist = ()=>{ if(!wordlistEditor) return; const words = setInlineWordlist(parseWordlistInput(wordlistEditor.value)); wordlistEditor.value = words.join('\n'); updateSearchSuggest(); };
    if(wordlistSave) wordlistSave.addEventListener('click', applyInlineWordlist);
    if(wordlistEditor) wordlistEditor.addEventListener('change', applyInlineWordlist);
    if(wordlistReset) wordlistReset.addEventListener('click', ()=>{ setInlineWordlist([]); if(wordlistEditor) wordlistEditor.value=''; updateSearchSuggest(); });

    // Clock
    tickClock();

    // Todo
    renderTodos();
    $('#todoAdd').addEventListener('click', ()=>{ const v=$('#todoInput').value.trim(); if(v){ addTodo(v); $('#todoInput').value=''; }});
    $('#todoInput').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#todoAdd').click(); } });
    $('#todoClearDone').addEventListener('click', ()=>{ const list=store.get('todos',[]).filter(t=>!t.done); store.set('todos', list); renderTodos(); });

    // Notes
    initNotes();

    // Tiles
    if(!localStorage.getItem('tiles')) store.set('tiles', defaultTiles());
    renderTiles();
    $('#addTile').addEventListener('click', addTile);
    $('#resetTiles').addEventListener('click', ()=>{ if(confirm('Standard‑Kacheln wiederherstellen?')){ store.set('tiles', defaultTiles()); renderTiles(); }});

    // Weather
    $('#setCity').addEventListener('click', ()=>{ const v=$('#cityInput').value.trim(); if(v){ store.set('weather.city', v); loadWeather(); }});
    loadWeather();

    // Transport
    initTransport();

    // Quote
    loadQuote();

    // Recent
    renderRecent();

    // Background
    bgInitBackgroundEngine();
    applyBackground();
    const tintBtn = document.getElementById('bgActionTintWidgets');
    if(tintBtn) tintBtn.addEventListener('click', e=>{ e.preventDefault(); tintWidgets(); });

    // System
    renderSystem();
    if(navigator.connection && 'onchange' in navigator.connection){ navigator.connection.addEventListener('change', renderSystem); }

    // News
    fillNewsSources(); loadNews();
    $('#newsSource').addEventListener('change', e=>{ store.set('news.source', e.target.value); loadNews(); });
    $('#refreshNews').addEventListener('click', loadNews);

    // Widgets visibility
    applyWidgets();
    applyWidgetColors();

    // Close modal on Escape / overlay click
    $('#settingsModal').addEventListener('click', e=>{ if(e.target.id==='settingsModal') closeSettings(); });
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape'){
        if($('#onboarding') && $('#onboarding').classList.contains('open')) onboardingSkip();
        else closeSettings();
      }
    });

    // Command Palette (Ctrl/Cmd+K)
    document.addEventListener('keydown', e=>{
      const target = e.target;
      const isTyping = target && (target.tagName==='INPUT' || target.tagName==='TEXTAREA' || target.isContentEditable);
      if((e.ctrlKey||e.metaKey) && (e.key==='k' || e.key==='K')){ e.preventDefault(); openPalette(); return; }
      // Quick keys 1-9 for tiles when not typing
      if(!isTyping && !e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)){
        const n = Number(e.key)-1; const tiles = store.get('tiles', defaultTiles());
        if(tiles[n]) openUrl(tiles[n].url, tiles[n].title);
      }
    });
    setTimeout(()=> onboardingOpen(false), 350);
    applyAccentTint();
  }

  document.addEventListener('DOMContentLoaded', init);
  
