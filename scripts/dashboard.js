  // ===== Clock & Date
  function tickClock(){
    const now = new Date();
    $('#clock').textContent = now.toLocaleTimeString(localeToIntl(i18nLocale) || undefined, {hour:'2-digit', minute:'2-digit'});
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
    applySurfaceColors();
    applyControlColors();
    applyWidgetColors();
    applyAccentTint();
    bgOnThemeChange();
  }

  // ===== Search with engines + bangs + custom shortcuts
  const SEARXNG_DEFAULT_BASE_URL = 'https://search.julianverse.de/';
  const SEARCH_ENGINE_SELECTED_KEY = 'search.engine.selected';

  function normalizeSearxngBaseUrl(raw){
    const input = String(raw || '').trim();
    if(!input) return null;
    const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
    const marker = '__STARTPAGE_QUERY__';
    const parseTarget = withScheme.includes('{q}') ? withScheme.replaceAll('{q}', marker) : withScheme;
    try{
      const url = new URL(parseTarget);
      if(!/^https?:$/i.test(url.protocol)) return null;
      url.hash = '';
      let out = url.toString();
      if(withScheme.includes('{q}')) out = out.replaceAll(marker, '{q}');
      return out;
    }catch{
      return null;
    }
  }

  function getSearxngBaseUrl(){
    const stored = store.get('search.searxng.baseUrl', SEARXNG_DEFAULT_BASE_URL);
    return normalizeSearxngBaseUrl(stored) || SEARXNG_DEFAULT_BASE_URL;
  }

  function buildSearxngSearchUrl(query){
    const base = getSearxngBaseUrl();
    if(base.includes('{q}')) return base.replaceAll('{q}', encodeURIComponent(query));
    return base + (base.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(query);
  }

  function ensureSearxngEngineEnabled(){
    if(store.get('search.searxng.enabledMigration.v1', false)) return;
    const enabledStored = store.get('engines.enabled', Object.keys(ENGINES));
    const enabled = Array.isArray(enabledStored) ? enabledStored.filter(key=> key in ENGINES) : Object.keys(ENGINES);
    if(!enabled.includes('searxng')) enabled.push('searxng');
    store.set('engines.enabled', enabled);
    store.set('search.searxng.enabledMigration.v1', true);
  }

  function getSelectedSearchEngine(){
    const engine = String(store.get(SEARCH_ENGINE_SELECTED_KEY, '') || '').trim();
    return (engine in ENGINES) ? engine : '';
  }

  function setSelectedSearchEngine(engine){
    if(engine in ENGINES) store.set(SEARCH_ENGINE_SELECTED_KEY, engine);
  }

  const ENGINES = {
    google: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    ddg: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    bing: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    searxng: q => buildSearxngSearchUrl(q),
    yt: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    wikipedia: q => `https://${getLocaleLang()}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
    maps: q => `https://www.google.com/maps/search/${encodeURIComponent(q)}`
  };
  const BANGS = { '!g':'google', '!ddg':'ddg', '!bing':'bing', '!sx':'searxng', '!yt':'yt', '!wiki':'wikipedia', '!maps':'maps' };
  const WORDLIST_URL = 'assets/wordlist.json';
  let globalWordlistPromise = null;
  let searchSuggest = { box:null, items:[], active:-1 };

  function getShortcuts(){
    const raw = store.get('shortcuts', { '!etc':'https://julianverse.de/etc' });
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const safe = {};
    Object.entries(raw).forEach(([key, value])=>{
      const url = normalizeHttpUrlTemplate(value);
      if(String(key || '').startsWith('!') && url) safe[key] = url;
    });
    return safe;
  }

  function normalizeDirectUrlCandidate(raw){
    const input = String(raw || '').trim();
    if(!input || /\s/.test(input)) return null;
    if(/^javascript:/i.test(input)) return null;
    const parseHttpUrl = value=>{
      try{
        const url = new URL(value);
        if(!/^https?:$/i.test(url.protocol)) return null;
        return url.href;
      }catch{
        return null;
      }
    };
    const direct = parseHttpUrl(input);
    if(direct) return direct;
    if(input.startsWith('//')) return parseHttpUrl(`https:${input}`);
    const hostLike = /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\]|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d{1,5})?(?:[/?#].*)?$/i;
    if(!hostLike.test(input)) return null;
    return parseHttpUrl(`https://${input}`);
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
    Object.keys(BANGS).forEach(b=>{ if(!q || b.startsWith(q)) push(b, t('search.suggest.bang', { bang: b }, `${b} (Bang)`), 'bang'); });
    Object.keys(shortcuts).forEach(s=>{ if(!q || s.startsWith(q)) push(s, t('search.suggest.shortcut', { shortcut: s }, `${s} (Shortcut)`), 'shortcut'); });
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
      li.innerHTML = `<span class="suggest-type">${escapeHtml(t(`search.suggest.type.${s.type}`, null, s.type))}</span><span class="suggest-text">${escapeHtml(s.label)}</span>`;
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
      addRecent({ title: t('search.recentShortcut', { shortcut: first, query: rest||'' }), url: target });
      window.location.href = target; return;
    }

    const directUrl = normalizeDirectUrlCandidate(q);
    if(directUrl){
      addRecent({ title: directUrl, url: directUrl });
      renderSearchSuggest([]);
      window.location.href = directUrl;
      return;
    }

    // built-in bangs
    let engine = $('#engine').value;
    if(BANGS[first]){ engine = BANGS[first]; q = q.replace(first, '').trim(); }
    const url = ENGINES[engine](q);
    addRecent({ title: t('search.recentSearch', { engine, query: q }), url, query:q, type:'search' });
    renderSearchSuggest([]);
    window.location.href = url;
  }

  // ===== Todo
  function renderTodos(){
    const list = store.get('todos', []);
    const wrap = $('#todoList');
    wrap.innerHTML = '';
    list.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'todo-item' + (item.done ? ' done' : '');
      el.draggable = true;
      el.innerHTML = `
        <input type="checkbox" ${item.done?'checked':''} aria-label="${escapeHtml(t('todo.doneAria'))}">
        <div class="title">${escapeHtml(item.text)}</div>
        <button class="btn icon-only" title="${escapeHtml(t('common.delete'))}" aria-label="${escapeHtml(t('common.delete'))}">${iconSvg('trash')}</button>
      `;
      el.querySelector('input').addEventListener('change', e=>{
        list[i].done = e.target.checked; store.set('todos', list); renderTodos();
      });
      el.querySelector('button').addEventListener('click', ()=>{
        list.splice(i,1); store.set('todos', list); renderTodos();
      });
      el.addEventListener('dragstart', e=>{
        e.dataTransfer.setData('text/plain', i.toString());
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
      el.addEventListener('dragover', e=> e.preventDefault());
      el.addEventListener('drop', e=>{
        e.preventDefault();
        const from = +e.dataTransfer.getData('text/plain');
        const to = i;
        if(from === to) return;
        const moved = list.splice(from, 1)[0];
        list.splice(to, 0, moved);
        store.set('todos', list);
        renderTodos();
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

  function syncTodoViewportHeight(){
    const notes = $('#notesArea');
    const list = $('#todoList');
    if(!notes || !list) return;
    const height = Math.max(260, Math.round(notes.getBoundingClientRect().height));
    list.style.maxHeight = `${height}px`;
  }

  function initTodoViewportSync(){
    const notes = $('#notesArea');
    if(!notes) return;
    syncTodoViewportHeight();
    if(window.ResizeObserver){
      const observer = new ResizeObserver(()=> syncTodoViewportHeight());
      observer.observe(notes);
    }
    window.addEventListener('resize', syncTodoViewportHeight);
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

  function normalizeHttpUrl(value){
    try{
      const url = new URL(String(value || '').trim());
      if(url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.href;
    }catch{
      return '';
    }
  }

  function normalizeHttpUrlTemplate(value){
    const marker = '__STARTPAGE_QUERY__';
    const raw = String(value || '').trim();
    const safe = normalizeHttpUrl(raw.replaceAll('{q}', marker));
    return safe ? safe.replaceAll(marker, '{q}') : '';
  }

  const OLLAMA_GUIDE_OS_IDS = ['linux', 'macos', 'windows'];
  let ollamaGuideState = {
    detectedOs: '',
    expanded: {},
    checkStatus: 'idle',
    checkMessage: ''
  };

  function detectGuideOs(){
    const platform = String((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    const ua = String(navigator.userAgent || '').toLowerCase();
    if(platform.includes('win') || ua.includes('windows')) return 'windows';
    if(platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad') || ua.includes('mac os')) return 'macos';
    if(platform.includes('linux') || platform.includes('x11') || ua.includes('linux')) return 'linux';
    return '';
  }

  function getGuideDetectedOs(){
    if(!ollamaGuideState.detectedOs) ollamaGuideState.detectedOs = detectGuideOs();
    return ollamaGuideState.detectedOs;
  }

  function getGuideExpandedState(osId){
    if(Object.prototype.hasOwnProperty.call(ollamaGuideState.expanded, osId)) return !!ollamaGuideState.expanded[osId];
    return false;
  }

  function escapeAttr(value){
    return escapeHtml(String(value || ''));
  }

  async function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(String(text || ''));
      return true;
    }
    const el = document.createElement('textarea');
    el.value = String(text || '');
    el.setAttribute('readonly', 'readonly');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if(!ok) throw new Error('copy failed');
    return true;
  }

  function guideCheckStatusHtml(){
    const text = ollamaGuideState.checkMessage || t('settings.ollamaGuide.check.idle', null, 'Use "Check setup" to test the configured Ollama host.');
    return `<p class="muted ollama-guide-status">${escapeHtml(text)}</p>`;
  }

  function buildGuideCodeBlock(command, label){
    return '' +
      '<div class="ollama-code-block">' +
        `<div class="ollama-code-header"><span>${escapeHtml(label)}</span><button class="btn" type="button" data-copy="${escapeAttr(command)}">${escapeHtml(t('settings.ollamaGuide.actions.copy', null, 'Copy command'))}</button></div>` +
        `<pre><code>${escapeHtml(command)}</code></pre>` +
      '</div>';
  }

  function getCurrentStartpageInfo(){
    const fallback = {
      pageUrl: 'https://julianverse.de/startpage/',
      origin: 'https://julianverse.de',
      isLocal: false
    };
    try {
      const loc = window.location;
      const protocol = String(loc && loc.protocol || '').toLowerCase();
      if(protocol !== 'http:' && protocol !== 'https:') return fallback;
      const pageUrl = String(loc.href || '').trim() || fallback.pageUrl;
      const origin = String(loc.origin || '').trim() || fallback.origin;
      const host = String(loc.hostname || '').toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
      return { pageUrl, origin, isLocal };
    } catch {
      return fallback;
    }
  }

  function buildGuideOsSection(osId){
    const installTitle = t('settings.ollamaGuide.steps.install', null, 'Install Ollama');
    const originTitle = t('settings.ollamaGuide.steps.origins', null, 'Allow your Startpage origin');
    const startTitle = t('settings.ollamaGuide.steps.start', null, 'Start Ollama');
    const modelTitle = t('settings.ollamaGuide.steps.model', null, 'Install a model');
    const testTitle = t('settings.ollamaGuide.steps.test', null, 'Test the model');
    const firewallTitle = t('settings.ollamaGuide.steps.network', null, 'Port and network access');
    const alternativeLabel = t('settings.ollamaGuide.alternativeLabel', null, 'Alternative');
    const host = getAgentHost();
    const startpageInfo = getCurrentStartpageInfo();
    const examplePageUrl = startpageInfo.pageUrl;
    const exampleOrigin = startpageInfo.origin;
    const originEnvValue = startpageInfo.isLocal ? exampleOrigin : exampleOrigin;
    const originIntro = startpageInfo.isLocal
      ? t('settings.ollamaGuide.originsIntroLocal', { origin: exampleOrigin }, `Your current Startpage origin is ${exampleOrigin}. Localhost-style origins are usually allowed by Ollama already, so OLLAMA_ORIGINS is often not needed during local development.`)
      : t('settings.ollamaGuide.originsIntro', null, 'Ollama allows localhost-style origins by default. If your Startpage runs from another origin, you must explicitly allow it with OLLAMA_ORIGINS and, for remote access, usually bind OLLAMA_HOST to 0.0.0.0:11434.');
    const sections = {
      linux: {
        name: t('settings.ollamaGuide.os.linux', null, 'Linux'),
        installBody: buildGuideCodeBlock('curl -fsSL https://ollama.com/install.sh | sh', installTitle),
        installNote: t('settings.ollamaGuide.osNotes.linux', null, 'If you use a distro package manager, keep the official Ollama docs nearby because package versions may lag behind.'),
        alternatives: '',
        originBody:
          `<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.linuxServiceHint', null, 'If Ollama runs as a systemd service, create an override instead of editing the main unit file directly.'))}</p>` +
          buildGuideCodeBlock(`[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\nEnvironment="OLLAMA_ORIGINS=${originEnvValue}"`, 'systemd override') +
          buildGuideCodeBlock('sudo systemctl edit ollama', 'open override editor') +
          buildGuideCodeBlock('sudo systemctl daemon-reload\nsudo systemctl restart ollama', 'reload and restart service'),
        originNote: startpageInfo.isLocal
          ? t('settings.ollamaGuide.originLinuxLocal', { pageUrl: examplePageUrl, origin: exampleOrigin }, `Your current Startpage runs from ${examplePageUrl}. If you later deploy it under another domain, replace OLLAMA_ORIGINS with that deployed origin.`)
          : t('settings.ollamaGuide.originLinux', { pageUrl: examplePageUrl, origin: exampleOrigin }, `If your Startpage runs from ${examplePageUrl}, add the origin ${exampleOrigin} to OLLAMA_ORIGINS.`),
        networkNote: t('settings.ollamaGuide.networkLinux', { host }, `If Startpage runs in another browser profile, VM, or container, make sure ${host} is reachable and the local firewall allows port 11434.`)
      },
      macos: {
        name: t('settings.ollamaGuide.os.macos', null, 'macOS'),
        installBody:
          `<p>${escapeHtml(t('settings.ollamaGuide.downloadHint', null, 'Download the installer from the official Ollama website.'))}</p>` +
          `<div class="settings-guide-actions"><a class="btn" href="https://ollama.com/download" target="_blank" rel="noopener">${escapeHtml(t('settings.ollamaGuide.actions.download', null, 'Open download page'))}</a></div>`,
        installNote: t('settings.ollamaGuide.osNotes.macos', null, 'Homebrew is useful on developer machines; the direct download is usually simpler for first-time setup.'),
        alternatives: buildGuideCodeBlock('brew install ollama', `${alternativeLabel}: Homebrew`),
        originBody:
          buildGuideCodeBlock(`launchctl setenv OLLAMA_HOST "0.0.0.0:11434"\nlaunchctl setenv OLLAMA_ORIGINS "${originEnvValue}"`, 'launchctl') +
          `<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.restartMacos', null, 'Restart the Ollama app after changing launchctl environment variables.'))}</p>`,
        originNote: startpageInfo.isLocal
          ? t('settings.ollamaGuide.originMacosLocal', { pageUrl: examplePageUrl, origin: exampleOrigin }, `Your current Startpage runs from ${examplePageUrl}. If you later deploy it under another domain, replace OLLAMA_ORIGINS with that deployed origin.`)
          : t('settings.ollamaGuide.originMacos', { pageUrl: examplePageUrl, origin: exampleOrigin }, `If your Startpage runs from ${examplePageUrl}, add the origin ${exampleOrigin} to OLLAMA_ORIGINS.`),
        networkNote: t('settings.ollamaGuide.networkMacos', { host }, `If the browser cannot reach ${host}, check macOS firewall prompts and allow local incoming connections for Ollama.`)
      },
      windows: {
        name: t('settings.ollamaGuide.os.windows', null, 'Windows'),
        installBody:
          `<ol><li>${escapeHtml(t('settings.ollamaGuide.windows.downloadStep', null, 'Download Ollama from the official website.'))}</li><li>${escapeHtml(t('settings.ollamaGuide.windows.runInstaller', null, 'Run the installer and complete the setup wizard.'))}</li></ol>` +
          `<div class="settings-guide-actions"><a class="btn" href="https://ollama.com/download" target="_blank" rel="noopener">${escapeHtml(t('settings.ollamaGuide.actions.download', null, 'Open download page'))}</a></div>`,
        installNote: t('settings.ollamaGuide.osNotes.windows', null, 'On managed Windows systems, the installer or the first Ollama launch may trigger Windows Defender or firewall prompts.'),
        alternatives: buildGuideCodeBlock('winget install Ollama.Ollama', `${alternativeLabel}: winget`),
        originBody:
          `<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.windowsEnvHint', null, 'Open Windows environment variables, create user variables named OLLAMA_HOST and OLLAMA_ORIGINS, then restart the Ollama app.'))}</p>` +
          buildGuideCodeBlock(`OLLAMA_HOST=0.0.0.0:11434\nOLLAMA_ORIGINS=${originEnvValue}`, 'User environment variables') +
          buildGuideCodeBlock('taskkill /IM ollama.exe /F', 'optional full restart') +
          `<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.restartWindows', null, 'Quit and restart the Ollama app after saving the environment variables.'))}</p>`,
        originNote: startpageInfo.isLocal
          ? t('settings.ollamaGuide.originWindowsLocal', { pageUrl: examplePageUrl, origin: exampleOrigin }, `Your current Startpage runs from ${examplePageUrl}. If you later deploy it under another domain, replace OLLAMA_ORIGINS with that deployed origin.`)
          : t('settings.ollamaGuide.originWindows', { pageUrl: examplePageUrl, origin: exampleOrigin }, `If your Startpage runs from ${examplePageUrl}, add the origin ${exampleOrigin} to OLLAMA_ORIGINS.`),
        networkNote: t('settings.ollamaGuide.networkWindows', { host }, `If Startpage cannot reach ${host}, allow Ollama through Windows Defender Firewall and keep port 11434 available locally.`)
      }
    };
    const item = sections[osId];
    if(!item) return '';
    const detected = getGuideDetectedOs() === osId;
    const detectedLabel = detected ? `<span class="ollama-os-meta"><span>${escapeHtml(t('settings.ollamaGuide.detectedBadge', null, 'Detected on this device'))}</span></span>` : '';
    return '' +
      `<section class="ollama-os${detected ? ' is-detected' : ''}${getGuideExpandedState(osId) ? ' is-open' : ''}" data-os="${escapeAttr(osId)}">` +
        `<button class="ollama-os-toggle" type="button" aria-expanded="${getGuideExpandedState(osId) ? 'true' : 'false'}"><span>${escapeHtml(item.name)}</span>${detectedLabel}</button>` +
        '<div class="ollama-os-body">' +
          '<div class="ollama-os-body-inner">' +
            `<div class="ollama-step"><h6>${escapeHtml(installTitle)}</h6>${item.installBody}${item.alternatives ? item.alternatives : ''}<p class="settings-guide-note">${escapeHtml(item.installNote)}</p></div>` +
            `<div class="ollama-step"><h6>${escapeHtml(originTitle)}</h6><p class="settings-guide-note">${escapeHtml(originIntro)}</p>${item.originBody}<p class="settings-guide-note">${escapeHtml(item.originNote)}</p></div>` +
            `<div class="ollama-step"><h6>${escapeHtml(startTitle)}</h6>${buildGuideCodeBlock('ollama serve', startTitle)}</div>` +
            `<div class="ollama-step"><h6>${escapeHtml(modelTitle)}</h6>${buildGuideCodeBlock('ollama pull ministral-3:8b', 'ministral-3:8b')}<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.modelHint', null, 'You can install other Ollama models as well, but ministral-3:8b is the recommended default for this Startpage setup.'))}</p></div>` +
            `<div class="ollama-step"><h6>${escapeHtml(testTitle)}</h6>${buildGuideCodeBlock('ollama run ministral-3:8b', testTitle)}</div>` +
            `<div class="ollama-step"><h6>${escapeHtml(firewallTitle)}</h6><p class="settings-guide-note">${escapeHtml(item.networkNote)}</p></div>` +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function buildOllamaGuideHtml(){
    const host = getAgentHost();
    return '' +
      '<section class="settings-guide-card ollama-guide" id="ollama-guide">' +
        '<div class="ollama-guide-header">' +
          '<div>' +
            `<h5>${escapeHtml(t('settings.ollamaGuide.title', null, 'Ollama setup for Startpage Agent'))}</h5>` +
            `<p>${escapeHtml(t('settings.ollamaGuide.intro', { host }, `Startpage Agent runs locally through Ollama on your machine. Install Ollama, start the local service, pull a model, and make sure Startpage can reach ${host}.`))}</p>` +
            `<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.hostInfo', { host }, `Current configured host: ${host}`))}</p>` +
            `<p class="settings-guide-note">${escapeHtml(t('settings.ollamaGuide.jumpNote', null, 'This guide stays available in Settings > Guide, even if the AI tab is hidden.'))}</p>` +
          '</div>' +
          '<div>' +
            `<div class="settings-guide-actions"><button class="btn" type="button" data-action="check-ollama-guide">${escapeHtml(t('settings.ollamaGuide.actions.check', null, 'Check setup'))}</button></div>` +
            guideCheckStatusHtml() +
          '</div>' +
        '</div>' +
        `<div class="ollama-guide-os-list">${OLLAMA_GUIDE_OS_IDS.map(buildGuideOsSection).join('')}</div>` +
      '</section>';
  }

  function buildSettingsGuideHtml(){
    return '' +
      '<div class="settings-guide-stack">' +
        `<section class="settings-guide-card">${t('settings.guideHtml')}</section>` +
        buildOllamaGuideHtml() +
        buildGuideExternalSourcesHtml() +
      '</div>';
  }

  function renderSettingsGuide(){
    const panelGuide = $('#tab-guide');
    if(!panelGuide) return;
    const openStates = {};
    $$('.ollama-os', panelGuide).forEach(el => {
      const os = el.getAttribute('data-os');
      if(os) openStates[os] = el.classList.contains('is-open');
    });
    if(Object.keys(openStates).length) ollamaGuideState.expanded = openStates;
    panelGuide.innerHTML = buildSettingsGuideHtml();
    syncOllamaAccordionHeights(panelGuide);
  }

  function syncOllamaAccordionHeights(root=document){
    $$('.ollama-os', root).forEach(section => {
      const body = $('.ollama-os-body', section);
      const toggle = $('.ollama-os-toggle', section);
      if(!body || !toggle) return;
      const open = section.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.style.maxHeight = open ? 'none' : '0px';
    });
  }

  function animateOllamaAccordion(section, nextOpen){
    if(!section) return;
    const body = $('.ollama-os-body', section);
    const inner = $('.ollama-os-body-inner', section);
    const toggle = $('.ollama-os-toggle', section);
    if(!body || !inner || !toggle) return;

    body.style.overflow = 'hidden';
    body.style.maxHeight = `${inner.scrollHeight}px`;

    requestAnimationFrame(()=>{
      section.classList.toggle('is-open', nextOpen);
      toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      const targetHeight = nextOpen ? `${inner.scrollHeight}px` : '0px';
      requestAnimationFrame(()=>{
        body.style.maxHeight = targetHeight;
      });
    });

    const onEnd = ev => {
      if(ev.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', onEnd);
      if(section.classList.contains('is-open')){
        body.style.maxHeight = 'none';
      }
    };
    body.addEventListener('transitionend', onEnd);
  }

  function openOllamaGuide(){
    openSettingsTab('guide');
    requestAnimationFrame(()=>{
      const target = $('#ollama-guide');
      if(target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function checkOllamaGuideConnection(){
    ollamaGuideState.checkStatus = 'checking';
    ollamaGuideState.checkMessage = t('settings.ollamaGuide.check.checking', null, 'Checking the configured Ollama host...');
    renderSettingsGuide();
    try {
      const available = await checkOllamaAvailable();
      if(available){
        ollamaGuideState.checkStatus = 'success';
        ollamaGuideState.checkMessage = t('settings.ollamaGuide.check.success', { host: getAgentHost() }, `Ollama responded successfully at ${getAgentHost()}.`);
      } else {
        ollamaGuideState.checkStatus = 'error';
        ollamaGuideState.checkMessage = t('settings.ollamaGuide.check.unavailable', { host: getAgentHost() }, `No response from ${getAgentHost()}. Check whether Ollama is running and whether port 11434 is reachable.`);
      }
    } catch (err){
      const message = err && err.message ? err.message : 'unknown error';
      ollamaGuideState.checkStatus = 'error';
      ollamaGuideState.checkMessage = t('settings.ollamaGuide.check.error', { error: message }, `Ollama check failed: ${message}`);
    }
    renderSettingsGuide();
  }

  function iconSvg(name){
    const icons = {
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"/>',
      check: '<path d="m5 12 4 4 10-10"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>'
    };
    return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
  }

  function renderTiles(){
    const data = store.get('tiles', defaultTiles());
    const grid = $('#tiles'); grid.innerHTML = '';
    data.forEach((tile, i)=>{
      const safeUrl = normalizeHttpUrl(tile && tile.url);
      if(!safeUrl) return;
      const el = document.createElement('div');
      el.className='tile';
      el.draggable = true;
      const host = (new URL(safeUrl)).hostname;
      const firstLetter = host.split('.')[0][0]?.toUpperCase() || '\u00b7';
      el.innerHTML = `
        <div class="favicon"><img alt="favicon" src="https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(safeUrl)}"></div>
        <div class="meta">
          <a href="#" class="title">${escapeHtml(tile.title)}</a>
          <div class="url">${escapeHtml(host)}</div>
        </div>
        <div class="actions">
          <button class="icon-only" title="${escapeHtml(t('tiles.edit'))}" aria-label="${escapeHtml(t('tiles.edit'))}">${iconSvg('edit')}</button>
          <button class="icon-only" title="${escapeHtml(t('common.delete'))}" aria-label="${escapeHtml(t('common.delete'))}">${iconSvg('trash')}</button>
        </div>`;

      // Fallback, when favicon fails to load, show first letter
      const img = el.querySelector('.favicon img');
      img.addEventListener('error', ()=>{ const fv=el.querySelector('.favicon'); fv.textContent=firstLetter; img.remove(); });

      el.querySelector('.title').addEventListener('click', (e)=>{ e.preventDefault(); openUrl(safeUrl, tile.title); });
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

  async function editTile(index){
    const data = store.get('tiles', defaultTiles());
    const tile = data[index];
    if(!tile) return;
    const next = await openTileDialog({ mode:'edit', title: tile.title, url: tile.url });
    if(!next) return;
    if(!next.title || !next.url) return;
    const safeUrl = normalizeHttpUrl(next.url);
    if(!safeUrl){ await uiAlert(t('tiles.invalidUrl')); return; }
    data[index] = { ...tile, title: next.title, url: safeUrl };
    store.set('tiles', data); renderTiles();
  }

  async function addTile(){
    const next = await openTileDialog({ mode:'add', title:'', url:'' });
    if(!next) return;
    if(!next.title || !next.url) return;
    const safeUrl = normalizeHttpUrl(next.url);
    if(!safeUrl){ await uiAlert(t('tiles.invalidUrl')); return; }
    const data = store.get('tiles', defaultTiles());
    data.unshift({ title: next.title, url: safeUrl });
    store.set('tiles', data); renderTiles();
  }

  // ===== Recent actions
  function normalizeRecentMax(value){
    const num = Number(value);
    if(!Number.isFinite(num)) return RECENT_MAX_DEFAULT;
    return Math.max(RECENT_MAX_MIN, Math.min(RECENT_MAX_LIMIT, Math.round(num)));
  }
  function getRecentMax(){
    return normalizeRecentMax(store.get(RECENT_MAX_KEY, RECENT_MAX_DEFAULT));
  }
  function getRecentEntries(){
    const raw = store.get('recent', []);
    return Array.isArray(raw) ? raw : [];
  }
  function normalizeRecentUrl(url){
    return normalizeHttpUrl(url);
  }
  function dedupeRecentEntries(list){
    if(!Array.isArray(list)) return [];
    const out = [];
    const seenUrls = new Set();
    list.forEach(entry=>{
      if(!entry || typeof entry !== 'object') return;
      const normalizedUrl = normalizeRecentUrl(entry.url);
      if(!normalizedUrl || seenUrls.has(normalizedUrl)) return;
      seenUrls.add(normalizedUrl);
      out.push({ ...entry, url: normalizedUrl });
    });
    return out;
  }
  function persistRecentEntries(list){
    const max = getRecentMax();
    const trimmed = dedupeRecentEntries(list).slice(0, max);
    store.set('recent', trimmed);
    return trimmed;
  }
  function setRecentMax(value){
    const max = normalizeRecentMax(value);
    store.set(RECENT_MAX_KEY, max);
    persistRecentEntries(getRecentEntries());
    return max;
  }
  function clearRecent(){
    store.set('recent', []);
  }
  function addRecent(entry){
    const list = getRecentEntries();
    list.unshift({ ...entry, ts: Date.now() });
    persistRecentEntries(list);
  }
  function renderRecent(){
    const list = persistRecentEntries(getRecentEntries());
    const wrap = $('#recentList');
    if(!wrap) return;
    wrap.innerHTML='';
    list.forEach(it=>{
      const a = document.createElement('a');
      a.href = it.url; a.className='chip'; a.textContent = it.title; a.target='_self';
      wrap.appendChild(a);
    })
  }

  // ===== Weather (Open-Meteo)
  async function lookupCity(name){
    const lang = getLocaleLang();
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${encodeURIComponent(lang)}&format=json`);
    if(!res.ok) throw new Error(t('weather.errors.geocodingFailed'));
    const data = await res.json();
    if(!data || !data.results || !data.results.length) throw new Error(t('weather.errors.locationNotFound'));
    const c = data.results[0];
    return { name: `${c.name}${c.admin1 ? ', '+c.admin1 : ''}`, lat: c.latitude, lon: c.longitude };
  }

  async function resolveCity(city){
    const name = (city || '').trim();
    if(!name) throw new Error(t('weather.errors.cityMissing'));
    const cacheKey = name.toLowerCase();
    const cache = getWeatherCoordsCache();
    const cached = cache[cacheKey];
    const fresh = 1000*60*60*12; // 12h cache
    if(cached && (Date.now() - cached.ts) < fresh) return cached;
    const loc = await lookupCity(name);
    const payload = { ...loc, city: name, ts: Date.now() };
    cache[cacheKey] = payload;
    store.set(WEATHER_COORDS_CACHE_KEY, cache);
    return payload;
  }

  function wmoText(code){
    const key = `weather.codes.${code}`;
    const label = tRaw(key);
    if(typeof label === 'string') return label;
    return t('weather.codes.default');
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

  function updateWeatherAppLink(place, loc){
    const link = $('#weatherAppLink');
    if(!link) return;
    const url = new URL('https://julianverse.de/weather/');
    const name = String((loc && (loc.name || loc.city)) || place || '').trim();
    const lat = Number(loc && loc.lat);
    const lon = Number(loc && loc.lon);
    if(Number.isFinite(lat) && Number.isFinite(lon)){
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      if(name) url.searchParams.set('name', name);
    } else if(name){
      url.searchParams.set('place', name);
    }
    link.href = url.toString();
    link.hidden = !name;
  }

  function parseWeatherTime(str, offsetSeconds){
    if(!str) return null;
    const base = new Date(str + 'Z');
    if(Number.isNaN(base.getTime())) return null;
    return new Date(base.getTime() + (offsetSeconds||0)*1000);
  }

  function renderWeatherCityList(){
    const wrap = $('#weatherCities');
    if(!wrap) return;
    const entries = getWeatherEntries();
    const activeId = getWeatherActiveId(entries);
    wrap.innerHTML = '';
    entries.forEach(entry=>{
      const chip = document.createElement('div');
      chip.className = 'chip weather-city-chip' + (entry.id === activeId ? ' active' : '');
      chip.setAttribute('role', 'button');
      chip.tabIndex = 0;
      chip.setAttribute('aria-pressed', entry.id === activeId ? 'true' : 'false');
      chip.innerHTML = `<span>${escapeHtml(entry.city)}</span>`;
      const removeEntry = ()=>{
        const list = getWeatherEntries().filter(item=> item.id !== entry.id);
        const nextActive = activeId === entry.id ? (list[0] ? list[0].id : '') : activeId;
        setWeatherState(list, nextActive);
        loadWeather();
      };
      if(entries.length > 1){
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'weather-city-chip-remove';
        remove.setAttribute('aria-label', t('common.delete', null, 'Delete'));
        remove.textContent = 'x';
        remove.addEventListener('click', e=>{
          e.preventDefault();
          e.stopPropagation();
          removeEntry();
        });
        chip.appendChild(remove);
      }
      chip.addEventListener('mousedown', e=>{
        if(e.button !== 1) return;
        if(entries.length <= 1) return;
        // Prevent browser auto-scroll mode on middle click.
        e.preventDefault();
      });
      chip.addEventListener('mouseup', e=>{
        if(e.button !== 1) return;
        if(entries.length <= 1) return;
        e.preventDefault();
        removeEntry();
      });
      chip.addEventListener('auxclick', e=>{
        if(e.button !== 1) return;
        if(entries.length <= 1) return;
        e.preventDefault();
        removeEntry();
      });
      chip.addEventListener('click', ()=>{
        const entriesNow = getWeatherEntries();
        setWeatherState(entriesNow, entry.id);
        loadWeather(entry.id);
      });
      chip.addEventListener('keydown', e=>{
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          const entriesNow = getWeatherEntries();
          setWeatherState(entriesNow, entry.id);
          loadWeather(entry.id);
        }
      });
      wrap.appendChild(chip);
    });
  }

  function upsertWeatherEntry(city){
    const clean = String(city || '').trim();
    if(!clean) return null;
    const entries = getWeatherEntries();
    const existing = entries.find(entry=> entry.city.toLowerCase() === clean.toLowerCase());
    if(existing){
      setWeatherState(entries, existing.id);
      return existing;
    }
    const next = { id: weatherEntryIdFromCity(clean), city: clean };
    setWeatherState([...entries, next], next.id);
    return next;
  }

  async function loadWeather(entryId){
    ensureWeatherStorage();
    if(entryId){
      const entriesNow = getWeatherEntries();
      if(entriesNow.some(entry=> entry.id === entryId)) setWeatherState(entriesNow, entryId);
    }
    renderWeatherCityList();
    const active = getWeatherActiveEntry();
    const city = active ? active.city : '';
    const cityInput = $('#cityInput');
    if(cityInput) cityInput.value = city;
    const tempEl = $('#tempNow');
    const textEl = $('#weatherText');
    const minmaxEl = $('#minmax');
    const hourlyEl = $('#hourly');
    if(!tempEl || !textEl || !minmaxEl || !hourlyEl) return;
    textEl.textContent = city ? t('weather.loading') : t('weather.prompt');
    tempEl.textContent = t('weather.tempEmpty', null, '\u2014\u00b0C');
    minmaxEl.textContent = t('weather.minmaxEmpty', null, '\u2014 / \u2014 \u00b0C');
    hourlyEl.innerHTML = '';
    updateWeatherIcon(null);
    updateWeatherAppLink(city);
    if(!city) return;

    try {
      const loc = await resolveCity(city);
      updateWeatherAppLink(city, loc);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,weathercode&current_weather=true&timezone=auto&daily=temperature_2m_max,temperature_2m_min&forecast_days=2`;
      const res = await fetch(url);
      if(!res.ok) throw new Error(t('weather.errors.fetchFailed'));
      const data = await res.json();
      const offset = Number(data.utc_offset_seconds) || 0;
      const curr = data.current_weather || {};
      updateWeatherIcon(curr.weathercode);
      const tempNow = Math.round(curr.temperature ?? NaN);
      tempEl.textContent = isFinite(tempNow) ? `${tempNow}\u00b0C` : t('weather.tempEmpty', null, '\u2014\u00b0C');
      textEl.textContent = `${loc.name} \u00b7 ${wmoText(curr.weathercode)}`;
      const dmax = Math.round((data.daily?.temperature_2m_max?.[0]) ?? NaN);
      const dmin = Math.round((data.daily?.temperature_2m_min?.[0]) ?? NaN);
      minmaxEl.textContent = isFinite(dmin)&&isFinite(dmax) ? `${dmin} / ${dmax} \u00b0C` : t('weather.minmaxEmpty', null, '\u2014 / \u2014 \u00b0C');

      const hours = data.hourly?.time || [];
      const temps = data.hourly?.temperature_2m || [];
      const codes = data.hourly?.weathercode || [];
      const container = hourlyEl; container.innerHTML='';
      const now = Date.now();
      const horizon = now + (24 * 60 * 60 * 1000);
      const upcoming = [];
      for(let i=0;i<hours.length;i++){
        const tDate = parseWeatherTime(hours[i], offset);
        if(!tDate) continue;
        const ts = tDate.getTime();
        if(ts < now || ts > horizon) continue;
        upcoming.push({ i, tDate });
      }
      let added = 0;
      for(let n=0;n<upcoming.length;n++){
        if(n % 3 !== 0) continue;
        const i = upcoming[n].i;
        const tDate = upcoming[n].tDate;
        const chip = document.createElement('div');
        chip.className='chip';
        const timeLabel = tDate.toLocaleTimeString([], {hour:'2-digit'});
        const tempVal = Math.round(temps[i]);
        chip.innerHTML = `<div class="chip-top"><span>${timeLabel}</span><span class="chip-temp">${isFinite(tempVal)? tempVal+'\u00b0' : t('weather.tempEmptyShort', null, '\u2014\u00b0')}</span></div><div class="chip-text">${wmoText(codes[i])}</div>`;
        container.appendChild(chip);
        added++;
      }
      if(!added) container.innerHTML = `<div class="muted">${escapeHtml(t('weather.noForecast'))}</div>`;
      // Normalize degree symbols / overwrite any garbled text
      try {
        const t2 = Math.round((data.current_weather||{}).temperature ?? NaN);
        tempEl.textContent = isFinite(t2) ? `${t2}\u00b0C` : '-\u00b0C';
        const dmax2 = Math.round((data.daily?.temperature_2m_max?.[0]) ?? NaN);
        const dmin2 = Math.round((data.daily?.temperature_2m_min?.[0]) ?? NaN);
        minmaxEl.textContent = isFinite(dmin2)&&isFinite(dmax2) ? `${dmin2} / ${dmax2} \u00b0C` : '- / - \u00b0C';
      } catch {}
    } catch(err){
      console.warn(err);
      textEl.textContent = err.message === t('weather.errors.cityMissing') ? t('weather.prompt') : t('weather.errors.loadFailed');
      tempEl.textContent = t('weather.tempEmpty', null, '\u2014\u00b0C');
      minmaxEl.textContent = t('weather.minmaxEmpty', null, '\u2014 / \u2014 \u00b0C');
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
    return d.toLocaleTimeString(localeToIntl(i18nLocale) || undefined, { hour:'2-digit', minute:'2-digit' });
  }
  function formatTransportDelay(raw){
    const n = Number(raw);
    if(!Number.isFinite(n) || n === 0) return '';
    return n > 0 ? `+${n}` : `${n}`;
  }
  function transportTypeLabel(type){
    if(type === 'station') return t('transport.type.station');
    if(type === 'stop') return t('transport.type.stop');
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
      renderFn([], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }));
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
      if(!items.length) renderFn([], t('transport.noMatches'));
      else renderFn(items);
    }catch(e){
      if(seq !== transportSearchSeqs[seqKey]) return;
      const msg = e && /504/.test(String(e.message)) ? t('transport.proxyTimeout') : t('transport.loadError');
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
    return raw.includes('bus') || raw.includes('tram') || raw.includes('street') || raw.includes('strassen') || raw.includes('stra\u00dfe') || raw.includes('strasse') || raw.includes('u-bahn') || raw.includes('ubahn') || raw.includes('subway') || raw.includes('metro') || raw.includes('stadtbahn') || raw.includes('urban') || raw.includes('s-bahn') || raw.includes('sbahn');
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
      ul.innerHTML = `<li class="muted">${escapeHtml(t('transport.noDepartures'))}</li>`;
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
        platform.textContent = t('transport.platform', { platform: platformRaw });
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
        cancelled.textContent = t('transport.cancelled');
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
      ul.innerHTML = `<li class="muted">${escapeHtml(t('transport.selectStation'))}</li>`;
      setTransportSelectedText(t('transport.noneSelected'));
      return;
    }
    const duration = getTransportDuration();
    setTransportSelectedText(station.place ? `${station.name} - ${station.place}` : station.name);
    ul.innerHTML = `<li class="muted">${escapeHtml(t('common.loading'))}</li>`;
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
      ul.innerHTML = `<li class="muted">${escapeHtml(t('common.loadError'))}</li>`;
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
          setTransportSelectedText(t('transport.noneSelected'));
          return;
        }
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggest([], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }));
          return;
        }
        const current = store.get('transport.station', null);
        if(current && q !== current.name){
          store.set('transport.station', null);
          setTransportSelectedText(t('transport.noneSelected'));
        }
        transportSearchTimer = setTimeout(()=> transportSearch(q), 320);
      });
      input.addEventListener('focus', ()=>{
        const q=input.value.trim();
        if(!q) return;
        if(q.length < TRANSPORT_MIN_QUERY){
          renderTransportSuggest([], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }));
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
    'Accessibility isn\'t a feature \u2013 it\'s the default.',
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
    const list = tRaw('quote.list');
    const quotes = Array.isArray(list) && list.length ? list : QUOTES;
    $('#quote').textContent = quotes[day % quotes.length];
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
    refreshUiSelects(select.parentElement || document);
  }
  async function loadNews(){
    const sources = getFeeds();
    const sourceName = store.get('news.source', Object.keys(sources)[0]);
    const feedUrl = normalizeHttpUrl(sources[sourceName]);
    $('#newsList').innerHTML = `<li class="muted">${escapeHtml(t('common.loading'))}</li>`;
    try{
      if(!feedUrl) throw new Error('Invalid feed URL');
      const res = await fetch(`https://api-startpage.julianverse.de/api/rss?url=${encodeURIComponent(feedUrl)}`);
      if(!res.ok) throw new Error(`RSS proxy error: ${res.status}`);
      const data = { contents: await res.text() };
      const parser = new DOMParser();
      const xml = parser.parseFromString(data.contents, 'text/xml');
      const items = Array.from(xml.querySelectorAll('item'));
      const entries = items.length ? [] : Array.from(xml.querySelectorAll('entry'));
      const ul = $('#newsList'); ul.innerHTML='';
      const max = 8;
      const list = items.length ? items : entries;
      list.forEach((it,i)=>{ if(i<max){
        const title = it.querySelector('title')?.textContent?.trim() || '\u2014';
        const linkNode = it.querySelector('link');
        const link = normalizeHttpUrl(linkNode?.getAttribute('href') || linkNode?.textContent || '');
        const li = document.createElement('li');
        if(link){
          const anchor = document.createElement('a');
          anchor.href = link;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.textContent = title;
          li.appendChild(anchor);
        } else {
          li.textContent = title;
        }
        ul.appendChild(li);
      }});
      if(!ul.children.length){ ul.innerHTML = `<li class="muted">${escapeHtml(t('news.noItems'))}</li>`; }
    }catch(e){ $('#newsList').innerHTML = `<li class="muted">${escapeHtml(t('common.loadError'))}</li>`; }
  }
