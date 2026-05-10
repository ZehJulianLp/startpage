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
  async function buildPaletteItems(){
      const items = [];
      const add = (t, opts)=> items.push({ t, ...opts });
      const widgetNames = { todo:t('widgets.todo'), notes:t('widgets.notes'), tiles:t('widgets.tiles'), weather:t('widgets.weather'), transport:t('widgets.transport'), quote:t('widgets.quote'), recent:t('widgets.recent'), system:t('widgets.system'), news:t('widgets.news') };
      const engineLabels = { google:t('search.engine.google', null, 'Google'), ddg:t('search.engine.ddg', null, 'DuckDuckGo'), bing:t('search.engine.bing', null, 'Bing'), searxng:t('search.engine.searxng', null, 'SearXNG'), yt:t('search.engine.yt', null, 'YouTube'), wikipedia:t('search.engine.wikipedia', null, 'Wikipedia'), maps:t('search.engine.maps', null, 'Google Maps') };

      // Commands
      add(t('palette.search.focus'), { k:'/', g:'command', a: ()=> $('#query').focus() });
      add(t('palette.search.start'), { g:'search', a: ()=>{ renderSearchSuggest([]); doSearch(); } });
      add(t('palette.settings.open'), { k:'S', g:'settings', a: openSettings });
      add(t('palette.settings.general'), { g:'settings', a: ()=> openSettingsTab('general') });
      add(t('palette.settings.background'), { g:'settings', a: ()=> openSettingsTab('background') });
      add(t('palette.settings.search'), { g:'settings', a: ()=> openSettingsTab('search') });
      add(t('palette.settings.widgets'), { g:'settings', a: ()=> openSettingsTab('widgets') });
      add(t('palette.settings.data'), { g:'settings', a: ()=> openSettingsTab('data') });
      add(t('palette.settings.guide'), { g:'settings', a: ()=> openSettingsTab('guide') });
      add(t('palette.theme.cycle'), { k:'T', g:'theme', a: ()=>{ const cur=store.get('theme','auto'); const next = cur==='dark' ? 'light' : cur==='light' ? 'auto' : 'dark'; store.set('theme', next); applyTheme(next); }});
      add(t('palette.theme.auto'), { g:'theme', a: ()=>{ store.set('theme','auto'); applyTheme('auto'); }});
      add(t('palette.theme.dark'), { g:'theme', a: ()=>{ store.set('theme','dark'); applyTheme('dark'); }});
      add(t('palette.theme.light'), { g:'theme', a: ()=>{ store.set('theme','light'); applyTheme('light'); }});
      add(t('palette.cardStyle.glass'), { g:'theme', a: ()=>{ store.set('ui.cardStyle','glass'); applyCardStyle(); }});
      add(t('palette.cardStyle.solid'), { g:'theme', a: ()=>{ store.set('ui.cardStyle','solid'); applyCardStyle(); }});
      add(t('palette.cardStyle.transparent'), { g:'theme', a: ()=>{ store.set('ui.cardStyle','transparent'); applyCardStyle(); }});
      add(t('palette.cardStyle.minimal'), { g:'theme', a: ()=>{ store.set('ui.cardStyle','minimal'); applyCardStyle(); }});
      add(t('palette.theme.resetHeader'), { g:'theme', a: resetSurfaceColors });
      add(t('palette.theme.recalcAccent'), { g:'theme', a: applyAccentTint });
      add(t('palette.background.toggleRotation'), { g:'theme', a: ()=>{ bgUpdateState(state=>{ state.rotation.enabled = !state.rotation.enabled; return state; }); bgRenderSettings(); }});
      add(t('palette.background.toggleLock'), { g:'theme', a: ()=>{ bgUpdateState(state=>{ state.rotation.locked = !state.rotation.locked; return state; }); bgRenderSettings(); }});

      // Widget actions
      add(t('palette.widgets.showAll'), { g:'widgets', a: ()=>{ const next = {}; Object.keys(widgetNames).forEach(k=> next[k]=true); store.set('widgets', next); applyWidgets(); if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings(); }});
      add(t('palette.widgets.hideAll'), { g:'widgets', a: ()=>{ const next = {}; Object.keys(widgetNames).forEach(k=> next[k]=false); store.set('widgets', next); applyWidgets(); if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings(); }});
      Object.keys(widgetNames).forEach(key=>{
        add(t('palette.widgets.toggle', { widget: widgetNames[key] }), { g:'widgets', a: ()=> toggleWidget(key) });
        add(t('palette.widgets.focus', { widget: widgetNames[key] }), { g:'widgets', a: ()=> focusWidget(key) });
      });

      // Quick add
      add(t('palette.quick.addTodo'), { g:'quick', a: async ()=>{ const v = await uiPrompt(t('todo.prompt'), '', t('todo.add')); if(v && v.trim()) addTodo(v.trim()); }});
      add(t('palette.quick.addNote'), { g:'quick', a: async ()=>{ const v = await uiPrompt(t('notes.prompt'), '', t('notes.title')); if(v && v.trim()) appendNote(v.trim()); }});

      // Tiles and widgets refresh
      add(t('palette.tiles.add'), { k:'+', g:'tiles', a: addTile });
      add(t('palette.tiles.reset'), { g:'tiles', a: async ()=>{ if(await uiConfirm(t('tiles.resetConfirm'))){ store.set('tiles', defaultTiles()); renderTiles(); }} });
      add(t('palette.refresh.weather'), { g:'command', a: loadWeather });
      add(t('palette.refresh.news'), { g:'command', a: loadNews });
      add(t('palette.refresh.transport'), { g:'command', a: loadTransportDepartures });
      add(t('palette.refresh.system'), { g:'command', a: renderSystem });
      add(t('palette.refresh.all'), { g:'command', a: ()=>{ loadWeather(); loadNews(); loadTransportDepartures(); renderSystem(); }});

      // Search engines
      Object.keys(ENGINES).forEach(key=>{
        const label = engineLabels[key] || key;
        add(t('palette.search.engine', { engine: label }), { g:'search', a: ()=>{ setSearchEngine(key); $('#query').focus(); } });
      });

      // Background presets
      BG_PRESETS.forEach(p=>{
        add(t('palette.background.preset', { label: p.label }), { g:'theme', a: ()=> bgApply({ type:'preset', id: p.id }) });
      });

      // Data actions + presets
      add(t('palette.data.export'), { g:'data', a: exportData });
      add(t('palette.data.import'), { g:'data', a: ()=>{ const file = $('#importFile'); if(file) file.click(); }});
      try{
        const presets = await loadDataPresets();
        presets.forEach(p=>{
          const label = p.label || p.id || t('data.presets.label');
          add(t('palette.data.preset', { label }), { g:'data', a: ()=> applyPresetFromEntry(p, t('data.presets.label')) });
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

