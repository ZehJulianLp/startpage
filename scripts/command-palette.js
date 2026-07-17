  // ===== Command Palette (Ctrl/Cmd+K)
  function openSettingsTab(name){
    openSettings();
    selectSettingsTab(name);
  }
  async function onSettingsModalClick(e){
    const osToggle = e.target.closest('.ollama-os-toggle');
    if(osToggle && $('#settingsModal').contains(osToggle)){
      e.preventDefault();
      const section = osToggle.closest('.ollama-os');
      if(section){
        const next = !section.classList.contains('is-open');
        animateOllamaAccordion(section, next);
        const os = section.getAttribute('data-os');
        if(os) ollamaGuideState.expanded[os] = next;
      }
      return;
    }
    const guideLink = e.target.closest('#openOllamaGuideFromGeneral');
    if(guideLink){
      e.preventDefault();
      openOllamaGuide();
      return;
    }
    const actionEl = e.target.closest('[data-action]');
    if(actionEl && $('#settingsModal').contains(actionEl)){
      const action = actionEl.getAttribute('data-action');
      if(action === 'check-ollama-guide'){
        e.preventDefault();
        actionEl.disabled = true;
        await checkOllamaGuideConnection();
        return;
      }
    }
    const copyEl = e.target.closest('[data-copy]');
    if(copyEl && $('#settingsModal').contains(copyEl)){
      e.preventDefault();
      const text = copyEl.getAttribute('data-copy') || '';
      try {
        await copyText(text);
        const original = copyEl.textContent;
        copyEl.textContent = t('settings.ollamaGuide.actions.copied', null, 'Copied');
        setTimeout(()=>{ copyEl.textContent = original; }, 1200);
      } catch {
        await uiAlert(t('settings.ollamaGuide.actions.copyError', null, 'Could not copy the command to the clipboard.'));
      }
    }
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
    setSelectedSearchEngine(key);
  }

  const PALETTE_GROUP_ORDER = ['command','settings','search','widgets','theme','data','tiles','tile','quick'];

  function paletteGroupLabels(){
    return {
      command: t('palette.groups.command'),
      settings: t('palette.groups.settings'),
      search: t('palette.groups.search'),
      widgets: t('palette.groups.widgets'),
      theme: t('palette.groups.theme'),
      data: t('palette.groups.data'),
      tiles: t('palette.groups.tiles'),
      tile: t('palette.groups.tile'),
      quick: t('palette.groups.quick')
    };
  }

  function paletteCommand(id, title, options={}){
    return {
      id,
      title,
      subtitle: options.subtitle || options.s || '',
      group: options.group || options.g || 'command',
      shortcut: options.shortcut || options.k || '',
      keywords: Array.isArray(options.keywords) ? options.keywords : [],
      run: options.run || options.a || null,
      dynamic: !!options.dynamic
    };
  }

  function getPaletteEngineLabels(){
    return {
      google: t('search.engine.google', null, 'Google'),
      ddg: t('search.engine.ddg', null, 'DuckDuckGo'),
      bing: t('search.engine.bing', null, 'Bing'),
      searxng: t('search.engine.searxng', null, 'SearXNG'),
      yt: t('search.engine.yt', null, 'YouTube'),
      wikipedia: t('search.engine.wikipedia', null, 'Wikipedia'),
      maps: t('search.engine.maps', null, 'Google Maps')
    };
  }

  function runPaletteSearch(query){
    const input = $('#query');
    if(input) input.value = query;
    renderSearchSuggest([]);
    doSearch();
  }

  function normalizePaletteAlias(value){
    return String(value || '').trim().toLowerCase();
  }

  function paletteThemeValue(value){
    const aliases = {
      auto: 'auto',
      system: 'auto',
      systemeinstellung: 'auto',
      dark: 'dark',
      dunkel: 'dark',
      nacht: 'dark',
      light: 'light',
      hell: 'light',
      licht: 'light'
    };
    return aliases[normalizePaletteAlias(value)] || '';
  }

  function paletteSettingsTab(value){
    const aliases = {
      general: 'general',
      allgemein: 'general',
      ai: 'ai',
      agent: 'ai',
      background: 'background',
      hintergrund: 'background',
      appearance: 'background',
      search: 'search',
      suche: 'search',
      feeds: 'search',
      widgets: 'widgets',
      data: 'data',
      daten: 'data',
      guide: 'guide',
      hilfe: 'guide'
    };
    return aliases[normalizePaletteAlias(value)] || '';
  }

  function paletteEngineKey(value){
    const raw = normalizePaletteAlias(value);
    const aliases = {
      duckduckgo: 'ddg',
      duck: 'ddg',
      youtube: 'yt',
      youTube: 'yt',
      wiki: 'wikipedia',
      googlemaps: 'maps',
      map: 'maps',
      maps: 'maps',
      searx: 'searxng',
      sx: 'searxng'
    };
    const key = aliases[raw] || raw;
    return Object.prototype.hasOwnProperty.call(ENGINES, key) ? key : '';
  }

  function commandTextAfterPrefix(raw, prefixes){
    const value = String(raw || '').trim();
    const lower = value.toLowerCase();
    const prefix = prefixes.find(p => lower.startsWith(p + ' '));
    return prefix ? value.slice(prefix.length).trim() : '';
  }

  function buildInlinePaletteItems(raw){
    const q = String(raw || '').trim();
    if(!q) return [];
    const items = [];
    const engineLabels = getPaletteEngineLabels();
    const todoText = commandTextAfterPrefix(q, ['todo', 'task', 'aufgabe']);
    if(todoText){
      items.push(paletteCommand('inline.todo.add', t('palette.inline.addTodo', { text: todoText }, 'Add todo: {text}'), {
        group: 'quick',
        keywords: ['todo', 'task', 'aufgabe'],
        dynamic: true,
        run: ()=> addTodo(todoText)
      }));
    }
    const noteText = commandTextAfterPrefix(q, ['note', 'notiz']);
    if(noteText){
      items.push(paletteCommand('inline.note.append', t('palette.inline.addNote', { text: noteText }, 'Add note: {text}'), {
        group: 'quick',
        keywords: ['note', 'notiz'],
        dynamic: true,
        run: ()=> appendNote(noteText)
      }));
    }
    const searchText = commandTextAfterPrefix(q, ['search', 'suche']);
    if(searchText){
      items.push(paletteCommand('inline.search.run', t('palette.inline.search', { query: searchText }, 'Search: {query}'), {
        group: 'search',
        keywords: ['search', 'suche'],
        dynamic: true,
        run: ()=> runPaletteSearch(searchText)
      }));
    }
    const themeText = commandTextAfterPrefix(q, ['theme', 'thema']);
    const theme = paletteThemeValue(themeText);
    if(theme){
      items.push(paletteCommand('inline.theme.set', t('palette.inline.theme', { theme }, 'Set theme: {theme}'), {
        group: 'theme',
        keywords: ['theme', 'thema', theme],
        dynamic: true,
        run: ()=>{ store.set('theme', theme); applyTheme(theme); }
      }));
    }
    const engineText = commandTextAfterPrefix(q, ['engine', 'suchmaschine']);
    const engine = paletteEngineKey(engineText);
    if(engine){
      const label = engineLabels[engine] || engine;
      items.push(paletteCommand('inline.engine.set', t('palette.inline.engine', { engine: label }, 'Set engine: {engine}'), {
        group: 'search',
        keywords: ['engine', 'suchmaschine', engine, label],
        dynamic: true,
        run: ()=>{ setSearchEngine(engine); const input = $('#query'); if(input) input.focus(); }
      }));
    }
    const settingsText = commandTextAfterPrefix(q, ['settings', 'einstellungen']);
    const tab = paletteSettingsTab(settingsText);
    if(tab){
      items.push(paletteCommand('inline.settings.open', t('palette.inline.settings', { tab }, 'Open settings: {tab}'), {
        group: 'settings',
        keywords: ['settings', 'einstellungen', tab],
        dynamic: true,
        run: ()=> openSettingsTab(tab)
      }));
    }
    return items;
  }

  async function buildPaletteItems(){
      const items = [];
      const add = (id, title, opts)=> items.push(paletteCommand(id, title, opts));
      const widgetNames = { todo:t('widgets.todo'), notes:t('widgets.notes'), tiles:t('widgets.tiles'), weather:t('widgets.weather'), transport:t('widgets.transport'), quote:t('widgets.quote'), recent:t('widgets.recent'), system:t('widgets.system'), news:t('widgets.news') };
      const engineLabels = getPaletteEngineLabels();

      // Commands
      add('search.focus', t('palette.search.focus'), { shortcut:'/', group:'command', keywords:['query', 'focus', 'suche'], run: ()=> $('#query').focus() });
      add('search.start', t('palette.search.start'), { group:'search', keywords:['run', 'submit', 'suche'], run: ()=>{ renderSearchSuggest([]); doSearch(); } });
      add('settings.open', t('palette.settings.open'), { shortcut:'S', group:'settings', keywords:['preferences', 'einstellungen'], run: openSettings });
      add('settings.general', t('palette.settings.general'), { group:'settings', keywords:['general', 'allgemein'], run: ()=> openSettingsTab('general') });
      add('settings.background', t('palette.settings.background'), { group:'settings', keywords:['background', 'appearance', 'hintergrund'], run: ()=> openSettingsTab('background') });
      add('settings.search', t('palette.settings.search'), { group:'settings', keywords:['search', 'feeds', 'suche'], run: ()=> openSettingsTab('search') });
      add('settings.widgets', t('palette.settings.widgets'), { group:'settings', keywords:['widgets'], run: ()=> openSettingsTab('widgets') });
      add('settings.data', t('palette.settings.data'), { group:'settings', keywords:['data', 'backup', 'daten'], run: ()=> openSettingsTab('data') });
      add('settings.guide', t('palette.settings.guide'), { group:'settings', keywords:['guide', 'help', 'hilfe'], run: ()=> openSettingsTab('guide') });
      add('theme.cycle', t('palette.theme.cycle'), { shortcut:'T', group:'theme', keywords:['theme', 'thema'], run: ()=>{ const cur=store.get('theme','auto'); const next = cur==='dark' ? 'light' : cur==='light' ? 'auto' : 'dark'; store.set('theme', next); applyTheme(next); }});
      add('theme.auto', t('palette.theme.auto'), { group:'theme', keywords:['theme', 'system'], run: ()=>{ store.set('theme','auto'); applyTheme('auto'); }});
      add('theme.dark', t('palette.theme.dark'), { group:'theme', keywords:['theme', 'dark', 'dunkel'], run: ()=>{ store.set('theme','dark'); applyTheme('dark'); }});
      add('theme.light', t('palette.theme.light'), { group:'theme', keywords:['theme', 'light', 'hell'], run: ()=>{ store.set('theme','light'); applyTheme('light'); }});
      add('card.glass', t('palette.cardStyle.glass'), { group:'theme', keywords:['card', 'glass'], run: ()=>{ store.set('ui.cardStyle','glass'); applyCardStyle(); }});
      add('card.solid', t('palette.cardStyle.solid'), { group:'theme', keywords:['card', 'solid'], run: ()=>{ store.set('ui.cardStyle','solid'); applyCardStyle(); }});
      add('card.transparent', t('palette.cardStyle.transparent'), { group:'theme', keywords:['card', 'transparent'], run: ()=>{ store.set('ui.cardStyle','transparent'); applyCardStyle(); }});
      add('card.minimal', t('palette.cardStyle.minimal'), { group:'theme', keywords:['card', 'minimal'], run: ()=>{ store.set('ui.cardStyle','minimal'); applyCardStyle(); }});
      add('theme.resetSurfaceColors', t('palette.theme.resetHeader'), { group:'theme', keywords:['reset', 'header', 'search', 'clock'], run: resetSurfaceColors });
      add('theme.recalculateAccent', t('palette.theme.recalcAccent'), { group:'theme', keywords:['accent', 'akzent'], run: applyAccentTint });
      add('background.toggleRotation', t('palette.background.toggleRotation'), { group:'theme', keywords:['background', 'rotation'], run: ()=>{ bgUpdateState(state=>{ state.rotation.enabled = !state.rotation.enabled; return state; }); bgRenderSettings(); }});
      add('background.toggleLock', t('palette.background.toggleLock'), { group:'theme', keywords:['background', 'lock'], run: ()=>{ bgUpdateState(state=>{ state.rotation.locked = !state.rotation.locked; return state; }); bgRenderSettings(); }});

      // Widget actions
      add('widgets.showAll', t('palette.widgets.showAll'), { group:'widgets', keywords:['widgets', 'show', 'anzeigen'], run: ()=>{ const next = {}; Object.keys(widgetNames).forEach(k=> next[k]=true); store.set('widgets', next); applyWidgets(); if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings(); }});
      add('widgets.hideAll', t('palette.widgets.hideAll'), { group:'widgets', keywords:['widgets', 'hide', 'ausblenden'], run: ()=>{ const next = {}; Object.keys(widgetNames).forEach(k=> next[k]=false); store.set('widgets', next); applyWidgets(); if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings(); }});
      Object.keys(widgetNames).forEach(key=>{
        add(`widgets.toggle.${key}`, t('palette.widgets.toggle', { widget: widgetNames[key] }), { group:'widgets', keywords:['widget', key, widgetNames[key]], run: ()=> toggleWidget(key) });
        add(`widgets.focus.${key}`, t('palette.widgets.focus', { widget: widgetNames[key] }), { group:'widgets', keywords:['focus', 'widget', key, widgetNames[key]], run: ()=> focusWidget(key) });
      });

      // Quick add
      add('quick.todo.add', t('palette.quick.addTodo'), { group:'quick', keywords:['todo', 'task', 'aufgabe'], run: async ()=>{ const v = await uiPrompt(t('todo.prompt'), '', t('todo.add')); if(v && v.trim()) addTodo(v.trim()); }});
      add('quick.note.add', t('palette.quick.addNote'), { group:'quick', keywords:['note', 'notiz'], run: async ()=>{ const v = await uiPrompt(t('notes.prompt'), '', t('notes.title')); if(v && v.trim()) appendNote(v.trim()); }});

      // Tiles and widgets refresh
      add('tiles.add', t('palette.tiles.add'), { shortcut:'+', group:'tiles', keywords:['tile', 'favorite', 'favorit'], run: addTile });
      add('tiles.reset', t('palette.tiles.reset'), { group:'tiles', keywords:['tile', 'reset'], run: async ()=>{ if(await uiConfirm(t('tiles.resetConfirm'))){ store.set('tiles', defaultTiles()); renderTiles(); }} });
      add('refresh.weather', t('palette.refresh.weather'), { group:'command', keywords:['refresh', 'reload', 'wetter'], run: loadWeather });
      add('refresh.news', t('palette.refresh.news'), { group:'command', keywords:['refresh', 'reload', 'news'], run: loadNews });
      add('refresh.transport', t('palette.refresh.transport'), { group:'command', keywords:['refresh', 'reload', 'transport'], run: loadActiveTransportView });
      add('refresh.system', t('palette.refresh.system'), { group:'command', keywords:['refresh', 'reload', 'system'], run: renderSystem });
      add('refresh.all', t('palette.refresh.all'), { group:'command', keywords:['refresh', 'reload', 'all', 'alle'], run: ()=>{ loadWeather(); loadNews(); loadActiveTransportView(); renderSystem(); }});

      // Search engines
      Object.keys(ENGINES).forEach(key=>{
        const label = engineLabels[key] || key;
        add(`search.engine.${key}`, t('palette.search.engine', { engine: label }), { group:'search', keywords:['engine', 'suchmaschine', key, label], run: ()=>{ setSearchEngine(key); $('#query').focus(); } });
      });

      // Background presets
      BG_PRESETS.forEach(p=>{
        add(`background.preset.${p.id}`, t('palette.background.preset', { label: p.label }), { group:'theme', keywords:['background', 'hintergrund', p.label, ...(p.tags || [])], run: ()=> bgApply({ type:'preset', id: p.id }) });
      });

      // Data actions + presets
      add('data.export', t('palette.data.export'), { group:'data', keywords:['backup', 'export'], run: exportData });
      add('data.import', t('palette.data.import'), { group:'data', keywords:['backup', 'import'], run: ()=>{ const file = $('#importFile'); if(file) file.click(); }});
      add('profiles.create', t('palette.profiles.create', null, 'Profile: create current'), { group:'data', keywords:['profile', 'profil', 'create'], run: createProfile });
      getProfiles().forEach(profile=>{
        add(`profiles.apply.${profile.id}`, t('palette.profiles.use', { name: profile.name }, 'Profile: {name}'), { group:'data', keywords:['profile', 'profil', profile.name], run: ()=> applyProfile(profile.id) });
      });
      try{
        const presets = await loadDataPresets();
        presets.forEach(p=>{
          const label = p.label || p.id || t('data.presets.label');
          add(`data.preset.${p.id || label}`, t('palette.data.preset', { label }), { group:'data', keywords:['preset', label, p.id || ''], run: ()=> applyPresetFromEntry(p, t('data.presets.label')) });
        });
      }catch{}

      // Tiles
      const tiles = store.get('tiles', defaultTiles());
      tiles.forEach(tile=> items.push(paletteCommand(`tile.open.${tile.key || tile.title}`, `${tile.title}`, { subtitle: tile.url, group:'tile', keywords:['favorite', 'favorit', tile.title], run: ()=> openUrl(tile.url, tile.title) })));
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
  function paletteSearchText(item){
    return [
      item.id,
      item.title,
      item.subtitle,
      item.group,
      ...(item.keywords || [])
    ].filter(Boolean).join(' ');
  }
  function openPalette(){
    const modal = $('#palette'); const input = $('#paletteInput'); const list = $('#paletteList');
    if(modal.classList.contains('open')){
      input.focus();
      return;
    }
    const groupLabels = paletteGroupLabels();
    let isLoading = true;
    let all = [];
    let filtered = [];
    let flat = [];
    let idx = 0;
    function flatten(items){
      const out = [];
      const remaining = items.filter(it => !it.dynamic);
      items.forEach(it=>{ if(it.dynamic) out.push(it); });
      PALETTE_GROUP_ORDER.forEach(g=>{
        remaining.forEach(it=>{ if(it.group===g) out.push(it); });
        for(let i=remaining.length-1;i>=0;i--){ if(remaining[i].group===g) remaining.splice(i,1); }
      });
      remaining.forEach(it=> out.push(it));
      return out;
    }
    function render(){
      list.innerHTML='';
      if(isLoading){
        const loading = document.createElement('li');
        loading.className = 'palette-empty';
        loading.textContent = t('common.loading');
        list.appendChild(loading);
        input.setAttribute('aria-activedescendant','');
        return;
      }
      if(!flat.length){
        const empty = document.createElement('li');
        empty.className = 'palette-empty';
        empty.textContent = t('common.noMatches');
        list.appendChild(empty);
        input.setAttribute('aria-activedescendant','');
        return;
      }
      let previousGroup = '';
      flat.forEach((it, i)=>{
        if(it.group !== previousGroup){
          previousGroup = it.group;
          const header = document.createElement('li');
          header.className = 'palette-section';
          header.textContent = groupLabels[it.group] || it.group;
          list.appendChild(header);
        }
        const li = document.createElement('li');
        li.className = 'palette-item' + (i===idx ? ' active':'');
        li.setAttribute('role','option');
        li.id = `palette-item-${i}`;
        li.innerHTML = `<span>${escapeHtml(it.title)}</span>${it.subtitle?`<span class="muted">${escapeHtml(it.subtitle)}</span>`:''}${it.shortcut?`<span class="k">${it.shortcut}</span>`:''}`;
        li.addEventListener('click', ()=>{ it.run && it.run(); closePalette(); });
        li.addEventListener('mouseenter', ()=>{ idx = i; input.focus({ preventScroll: true }); render(); });
        list.appendChild(li);
      });
      const active = list.querySelector('.palette-item.active');
      if(active) active.scrollIntoView({ block:'nearest' });
      input.setAttribute('aria-activedescendant', `palette-item-${idx}`);
    }
    function applyFilter(){
      if(isLoading) return;
      const q = input.value.trim();
      const searchableItems = [...buildInlinePaletteItems(q), ...all];
      const scored = searchableItems.map((it, i)=> {
        const score = it.dynamic ? 120 : scoreMatch(paletteSearchText(it), q);
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
      else if(e.key==='Enter'){ e.preventDefault(); const it=flat[idx]; if(it){ it.run && it.run(); closePalette(); } }
    }
    function onOverlayClick(e){ if(e.target.id==='palette') closePalette(); }
    function onListMouseDown(e){ e.preventDefault(); input.focus({ preventScroll: true }); }
    async function loadItems(){
      all = await buildPaletteItems();
      isLoading = false;
      applyFilter();
    }
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    syncModalOpenState();
    input.value=''; input.focus(); render();
    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', onKey);
    modal.addEventListener('click', onOverlayClick);
    list.addEventListener('mousedown', onListMouseDown);
    loadItems();
    function closePalette(){
      closeModalAnimated(modal);
      input.removeEventListener('input', applyFilter);
      input.removeEventListener('keydown', onKey);
      modal.removeEventListener('click', onOverlayClick);
      list.removeEventListener('mousedown', onListMouseDown);
      input.setAttribute('aria-activedescendant','');
    }
    // expose for ESC in global handler
    window.__closePalette = closePalette;
  }
