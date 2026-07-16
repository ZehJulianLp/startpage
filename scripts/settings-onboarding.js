  // ===== Settings UI
  function buildGuideExternalSourcesHtml(){
    const label = t('settings.externalSources.label', null, 'External Sources');
    const title = t('settings.externalSources.title', null, 'External Services and Purpose');
    const note = t('settings.externalSources.note', null, 'Calls happen only when the related widget/feature is used.');
    const sources = [
      {
        key: 'openMeteoForecast',
        name: 'Open-Meteo Forecast API',
        url: 'https://api.open-meteo.com/v1/forecast'
      },
      {
        key: 'openMeteoGeocoding',
        name: 'Open-Meteo Geocoding API',
        url: 'https://geocoding-api.open-meteo.com/v1/search'
      },
      {
        key: 'julianverseWeather',
        name: 'Julianverse Weather',
        url: 'https://julianverse.de/weather/'
      },
      {
        key: 'startpageProxy',
        name: 'Startpage Proxy API',
        url: 'https://api-startpage.julianverse.de/api'
      },
      {
        key: 'transportRest',
        name: 'transport.rest',
        url: 'https://transport.rest/'
      },
      {
        key: 'googleFavicons',
        name: 'Google Favicon Service',
        url: 'https://www.google.com/s2/favicons'
      },
      {
        key: 'unsplashImages',
        name: 'Unsplash Images',
        url: 'https://images.unsplash.com/'
      },
      {
        key: 'searchEngines',
        name: 'Configured Search Engines',
        url: 'https://duckduckgo.com/'
      },
      {
        key: 'ollamaLocal',
        name: 'Ollama (local)',
        url: 'http://localhost:11434'
      }
    ];
    const items = sources.map(src=>{
      const desc = t(`settings.externalSources.items.${src.key}`, null, '');
      return `<li><a href="${src.url}" target="_blank" rel="noopener">${escapeHtml(src.name)}</a>: ${escapeHtml(desc)}</li>`;
    }).join('');
    return `<section class="settings-guide-card"><div class="row"><label>${escapeHtml(label)}</label><div><h5>${escapeHtml(title)}</h5><ul>${items}</ul><div class="muted">${escapeHtml(note)}</div></div></div></section>`;
  }
  function openSettings(){
    const modal = $('#settingsModal');
    settingsSearchQuery = '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    syncModalOpenState();
    rebuildSettingsPanels();
    fillSettings();
    bgRenderSettings();
    initSettingsTabs();
    initSettingsSearch();
    const last = store.get('settings.tab','general');
    selectSettingsTab(last);
    enhanceUiSelects(modal);
    enhanceUiColorInputs(modal);
    refreshUiSelects(modal);
    applySettingsSearch();
  }
  function closeSettings(){
    const modal = $('#settingsModal');
    closeModalAnimated(modal);
  }
  function fillSettings(){
    const theme = store.get('theme','auto');
    $('#themeSelect').value = theme;
    const aiToggle = $('#aiEnabledToggle');
    if(aiToggle) aiToggle.checked = isAgentEnabled();
    renderSettingsGuide();
    syncAgentSettingsTabVisibility();
    const hostInput = $('#startpageAgentHost');
    if(hostInput) hostInput.value = getAgentHost();
    const confirmSelect = $('#startpageAgentConfirmMode');
    if(confirmSelect){
      const mode = String(getAgentConfirmMode());
      confirmSelect.value = ['0','1','2'].includes(mode) ? mode : '2';
    }
    const maxIterationsInput = $('#startpageAgentMaxIterations');
    if(maxIterationsInput){
      maxIterationsInput.value = String(getAgentMaxToolIterations());
    }
    const customPromptEl = $('#startpageAgentCustomPrompt');
    if(customPromptEl) customPromptEl.value = getAgentCustomPrompt();
    const memoryEl = $('#startpageAgentMemory');
    if(memoryEl) memoryEl.value = getAgentMemoryText();
    void initFontSettings({ preferLocal: false });
    const weatherEntries = getWeatherEntries();
    const defaultCities = $('#defaultCities');
    if(defaultCities) defaultCities.value = weatherEntries.map(entry => entry.city).join('\n');
    const defaultTransport = store.get('transport.default', null);
    const transportDefaultInput = $('#transportDefaultInput');
    if(transportDefaultInput){
      transportDefaultInput.value = defaultTransport && defaultTransport.name ? defaultTransport.name : '';
    }
    const recentMaxSetting = $('#recentMaxSetting');
    if(recentMaxSetting) recentMaxSetting.value = String(getRecentMax());
    renderProfiles();

    renderEngineSettings();

    // Shortcuts
    const searxngBaseUrl = $('#searxngBaseUrl');
    if(searxngBaseUrl) searxngBaseUrl.value = getSearxngBaseUrl();
    syncShortcutSettingsUi();

    // Wordlist
    const inlineWords = getInlineWordlist();
    const wordlistEditor = $('#wordlistEditor'); if(wordlistEditor) wordlistEditor.value = inlineWords.join('\n');

    // Feeds
    syncFeedSettingsUi();

    // Widgets toggle list
    const defaults = widgetDefaults();
    const conf = store.get('widgets', defaults);
    const wrap = $('#widgetToggles'); wrap.innerHTML='';
    wrap.className = 'settings-check-grid';
      Object.keys(defaults).forEach(k=>{
        const id = `w_${k}`;
        const label = document.createElement('label'); label.className = 'settings-check-card';
        const cb = document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.checked = conf[k];
        cb.addEventListener('change', ()=>{ const cur=store.get('widgets', defaults); cur[k]=cb.checked; store.set('widgets', cur); applyWidgets(); });
        label.appendChild(cb); label.appendChild(document.createTextNode(t(`widgets.${k}`, null, k)));
        wrap.appendChild(label);
      });

    const colors = store.get('widget.colors', widgetColorDefaults());
    ensureWidgetColorRows().forEach(row=>{
      const key = row.getAttribute('data-widget-color-row');
      const input = row.querySelector('input');
      if(!input || !key) return;
      const value = colors[key];
      input.value = (value && /^#([0-9a-f]{6})$/i.test(value)) ? value : '';
      if(input.__uiColorSync) input.__uiColorSync();
    });

    const cardStyle = store.get('ui.cardStyle', 'glass');
    const styleSelect = $('#cardStyle'); if(styleSelect) styleSelect.value = ['glass','solid','transparent','minimal'].includes(cardStyle) ? cardStyle : 'glass';

    const clockInput = $('#clockColor'); if(clockInput){
      const value = store.get('ui.clock.color','');
      clockInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '';
      if(clockInput.__uiColorSync) clockInput.__uiColorSync();
    }
    const searchInput = $('#searchColor'); if(searchInput){
      const value = store.get('ui.search.color','');
      searchInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '';
      if(searchInput.__uiColorSync) searchInput.__uiColorSync();
    }
    const accentInput = $('#accentColor'); if(accentInput){
      const value = store.get('ui.accent.color','');
      accentInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '';
      if(accentInput.__uiColorSync) accentInput.__uiColorSync();
    }
    const modalInput = $('#modalColor'); if(modalInput){
      const value = store.get('ui.modal.color','');
      modalInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '';
      if(modalInput.__uiColorSync) modalInput.__uiColorSync();
    }
    const buttonInput = $('#buttonColor'); if(buttonInput){
      const value = store.get('ui.button.color','');
      buttonInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '';
      if(buttonInput.__uiColorSync) buttonInput.__uiColorSync();
    }
    const inputColorInput = $('#inputColor'); if(inputColorInput){
      const value = store.get('ui.input.color','');
      inputColorInput.value = value && /^#([0-9a-f]{6})$/i.test(value) ? value : '';
      if(inputColorInput.__uiColorSync) inputColorInput.__uiColorSync();
    }
    const settingsSearchInput = $('#settingsSearch');
    if(settingsSearchInput && settingsSearchInput.value !== settingsSearchQuery) settingsSearchInput.value = settingsSearchQuery;
    enhanceUiColorInputs($('#settingsModal'));
    enhanceUiSelects($('#settingsModal'));
    refreshUiSelects($('#settingsModal'));
    applySettingsSearch();
  }

  function syncAgentSettingsTabVisibility(){
    const enabled = isAgentEnabled();
    const tabBtn = $('#settingsTabAi');
    const panel = $('#tab-ai');
    if(tabBtn) tabBtn.style.display = enabled ? '' : 'none';
    if(panel) panel.style.display = enabled ? '' : 'none';
    if(!enabled){
      const current = store.get('settings.tab', 'general');
      if(current === 'ai') store.set('settings.tab', 'general');
    }
  }

  function getEnabledEngines(){
    const stored = store.get('engines.enabled', Object.keys(ENGINES));
    const enabled = Array.isArray(stored) ? stored.filter(key=> key in ENGINES) : Object.keys(ENGINES);
    return enabled.length ? enabled : Object.keys(ENGINES);
  }

  function setEnabledEngines(enabled){
    const clean = Array.from(new Set((enabled || []).filter(key=> key in ENGINES)));
    store.set('engines.enabled', clean.length ? clean : Object.keys(ENGINES));
    renderEngines();
    renderEngineSettings();
  }

  function renderEngineSettings(){
    const wrap = $('#enginePills');
    if(!wrap) return;
    const enabled = getEnabledEngines();
    wrap.innerHTML = '';
    Object.keys(ENGINES).forEach(key=>{
      const on = enabled.includes(key);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-toggle-row';
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      const label = t(`search.engine.${key}`, null, key);
      button.innerHTML =
        `<span class="settings-toggle-name">${escapeHtml(label)}</span>` +
        `<span class="settings-toggle-state" aria-hidden="true">${on ? iconSvg('check') : iconSvg('x')}</span>`;
      button.addEventListener('click', ()=>{
        const current = getEnabledEngines();
        const next = current.includes(key)
          ? current.filter(item=> item !== key)
          : [...current, key];
        setEnabledEngines(next);
      });
      wrap.appendChild(button);
    });
  }

  function normalizeSettingsObject(value){
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  }

  function syncJsonTextarea(id, value){
    const textarea = $(id);
    if(textarea) textarea.value = JSON.stringify(normalizeSettingsObject(value), null, 2);
  }

  function buildKvEditorRow(key, value, options){
    const row = document.createElement('div');
    row.className = 'settings-kv-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = key;
    keyInput.autocomplete = 'off';
    keyInput.placeholder = options.keyPlaceholder;

    const valueInput = document.createElement('input');
    valueInput.type = 'url';
    valueInput.value = value;
    valueInput.autocomplete = 'off';
    valueInput.placeholder = options.valuePlaceholder;

    const remove = document.createElement('button');
    remove.className = 'btn icon-only';
    remove.type = 'button';
    remove.title = t('common.remove', null, 'Remove');
    remove.setAttribute('aria-label', t('common.remove', null, 'Remove'));
    remove.innerHTML = iconSvg('x');

    const save = ()=>{
      const nextKey = keyInput.value.trim();
      const nextValue = valueInput.value.trim();
      void options.update(key, nextKey, nextValue);
    };
    keyInput.addEventListener('change', save);
    valueInput.addEventListener('change', save);
    remove.addEventListener('click', ()=> options.remove(key));

    row.appendChild(keyInput);
    row.appendChild(valueInput);
    row.appendChild(remove);
    return row;
  }

  function syncShortcutSettingsUi(){
    const shortcuts = normalizeSettingsObject(getShortcuts());
    syncJsonTextarea('#shortcutConfig', shortcuts);
    const editor = $('#shortcutEditor');
    if(!editor) return;
    const entries = Object.entries(shortcuts);
    editor.innerHTML = '';
    if(!entries.length){
      const empty = document.createElement('div');
      empty.className = 'settings-kv-empty muted';
      empty.textContent = t('settings.search.shortcutsEmpty', null, 'No custom shortcuts configured.');
      editor.appendChild(empty);
      return;
    }
    entries.forEach(([key, value])=>{
      editor.appendChild(buildKvEditorRow(key, String(value || ''), {
        keyPlaceholder: '!git',
        valuePlaceholder: 'https://github.com/{q}',
        update: updateShortcutEntry,
        remove: removeShortcutEntry
      }));
    });
  }

  function syncFeedSettingsUi(){
    const feeds = normalizeSettingsObject(store.get('news.custom', {}));
    syncJsonTextarea('#feedsConfig', feeds);
    const editor = $('#feedsEditor');
    if(!editor) return;
    const entries = Object.entries(feeds);
    editor.innerHTML = '';
    if(!entries.length){
      const empty = document.createElement('div');
      empty.className = 'settings-kv-empty muted';
      empty.textContent = t('settings.search.feedsEmpty', null, 'No custom feeds configured.');
      editor.appendChild(empty);
      return;
    }
    entries.forEach(([key, value])=>{
      editor.appendChild(buildKvEditorRow(key, String(value || ''), {
        keyPlaceholder: 'Heise',
        valuePlaceholder: 'https://www.heise.de/rss/heise-atom.xml',
        update: updateFeedEntry,
        remove: removeFeedEntry
      }));
    });
  }

  async function parseSettingsJsonTextarea(id, errorKey, fallback){
    try{
      const value = JSON.parse($(id).value || '{}');
      if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
      return value;
    }catch{
      await uiAlert(t(errorKey, null, fallback));
      return null;
    }
  }

  function updateShortcutEntry(oldKey, newKey, url){
    const key = String(newKey || '').trim();
    const value = normalizeHttpUrlTemplate(url);
    if(!key || !value) return syncShortcutSettingsUi();
    const shortcuts = normalizeSettingsObject(getShortcuts());
    if(oldKey !== key) delete shortcuts[oldKey];
    shortcuts[key.startsWith('!') ? key : `!${key}`] = value;
    store.set('shortcuts', shortcuts);
    syncShortcutSettingsUi();
    updateSearchSuggest();
  }

  function removeShortcutEntry(key){
    const shortcuts = normalizeSettingsObject(getShortcuts());
    delete shortcuts[key];
    store.set('shortcuts', shortcuts);
    syncShortcutSettingsUi();
    updateSearchSuggest();
  }

  function addShortcutEntry(){
    const keyInput = $('#shortcutKeyInput');
    const urlInput = $('#shortcutUrlInput');
    if(!keyInput || !urlInput) return;
    updateShortcutEntry('', keyInput.value, urlInput.value);
    keyInput.value = '';
    urlInput.value = '';
  }

  async function applyShortcutJsonEditor(){
    const value = await parseSettingsJsonTextarea('#shortcutConfig', 'settings.search.invalidShortcuts', 'Invalid shortcuts JSON');
    if(!value) return;
    const safeShortcuts = {};
    Object.entries(value).forEach(([key, url])=>{
      const safeUrl = normalizeHttpUrlTemplate(url);
      const safeKey = String(key || '').trim();
      if(safeKey && safeUrl) safeShortcuts[safeKey.startsWith('!') ? safeKey : `!${safeKey}`] = safeUrl;
    });
    store.set('shortcuts', safeShortcuts);
    syncShortcutSettingsUi();
    updateSearchSuggest();
  }

  async function updateFeedEntry(oldKey, newKey, url){
    const key = String(newKey || '').trim();
    const value = normalizeHttpUrl(url);
    if(!key || !value){
      syncFeedSettingsUi();
      if(key || String(url || '').trim()) await uiAlert(t('settings.search.invalidFeeds', null, 'Invalid feed URL'));
      return;
    }
    const feeds = normalizeSettingsObject(store.get('news.custom', {}));
    if(oldKey !== key) delete feeds[oldKey];
    feeds[key] = value;
    store.set('news.custom', feeds);
    syncFeedSettingsUi();
    fillNewsSources();
    loadNews();
  }

  function removeFeedEntry(key){
    const feeds = normalizeSettingsObject(store.get('news.custom', {}));
    delete feeds[key];
    store.set('news.custom', feeds);
    syncFeedSettingsUi();
    fillNewsSources();
    loadNews();
  }

  function addFeedEntry(){
    const nameInput = $('#feedNameInput');
    const urlInput = $('#feedUrlInput');
    if(!nameInput || !urlInput) return;
    void updateFeedEntry('', nameInput.value, urlInput.value);
    nameInput.value = '';
    urlInput.value = '';
  }

  async function applyFeedJsonEditor(){
    const value = await parseSettingsJsonTextarea('#feedsConfig', 'settings.search.invalidFeeds', 'Invalid feeds JSON');
    if(!value) return;
    const safeFeeds = {};
    Object.entries(value).forEach(([name, url])=>{
      const safeUrl = normalizeHttpUrl(url);
      if(String(name || '').trim() && safeUrl) safeFeeds[String(name).trim()] = safeUrl;
    });
    store.set('news.custom', safeFeeds);
    syncFeedSettingsUi();
    fillNewsSources();
    loadNews();
  }

  function selectSettingsTab(name){
    const valid = ['general','ai','background','search','widgets','data','guide'];
    if(name === 'ai' && !isAgentEnabled()) name = 'general';
    if(!valid.includes(name)) name = 'general';
    const buttons = $$('.tab-btn', $('#settingsModal'));
    const panels = [
      {n:'general', el: $('#tab-general')},
      {n:'ai', el: $('#tab-ai')},
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

  function panelRowsForSearch(panel){
    return panel ? Array.from(panel.querySelectorAll(':scope > .row')) : [];
  }

  function widgetColorSettingKeys(){
    return ['todo', 'notes', 'tiles', 'weather', 'transport', 'quote', 'recent', 'system', 'news'];
  }

  function ensureWidgetColorRows(){
    const heading = $('#widgetColorHeading');
    if(!heading || !heading.parentNode) return [];
    const parent = heading.parentNode;
    const orderedRows = [];
    const knownKeys = widgetColorSettingKeys();
    const existingRows = new Map($$('[data-widget-color-row]').map(row=> [row.getAttribute('data-widget-color-row'), row]));
    let insertAfter = heading;

    knownKeys.forEach(key=>{
      let row = existingRows.get(key);
      if(!row){
        row = document.createElement('div');
        row.className = 'row';
        row.setAttribute('data-widget-color-row', key);
        row.setAttribute('data-settings-panel', 'background');

        const label = document.createElement('label');
        label.setAttribute('for', `widgetColor_${key}`);

        const content = document.createElement('div');
        const controls = document.createElement('div');
        controls.className = 'settings-inline-actions';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `widgetColor_${key}`;
        input.setAttribute('data-ui-color', '');
        input.setAttribute('data-color-default', '#7c5cff');
        input.setAttribute('autocomplete', 'off');
        input.addEventListener('input', ()=>{
          const cur = store.get('widget.colors', widgetColorDefaults());
          cur[key] = normalizeHex(input.value);
          store.set('widget.colors', cur);
          applyWidgetColors();
        });

        const clear = document.createElement('button');
        clear.className = 'btn';
        clear.type = 'button';
        clear.setAttribute('data-widget-color-reset', key);
        clear.addEventListener('click', ()=>{
          const cur = store.get('widget.colors', widgetColorDefaults());
          cur[key] = '';
          store.set('widget.colors', cur);
          applyWidgetColors();
          fillSettings();
        });

        const note = document.createElement('div');
        note.className = 'muted';
        note.style.marginTop = '6px';

        controls.appendChild(input);
        controls.appendChild(clear);
        content.appendChild(controls);
        content.appendChild(note);
        row.appendChild(label);
        row.appendChild(content);
      }

      const label = row.querySelector(':scope > label');
      if(label) label.textContent = t(`widgets.${key}`, null, key);
      const note = row.querySelector('.muted');
      if(note) note.textContent = t('settings.widgets.widgetColorNote', null, 'Farbe fuer dieses Widget (leer = Stil-Vorgabe).');
      const clear = row.querySelector('[data-widget-color-reset]');
      if(clear) clear.textContent = t('settings.widgets.reset', null, 'Reset');

      if(insertAfter.nextSibling !== row){
        parent.insertBefore(row, insertAfter.nextSibling);
      }
      insertAfter = row;
      orderedRows.push(row);
    });

    existingRows.forEach((row, key)=>{
      if(knownKeys.includes(key)) return;
      row.remove();
    });

    return orderedRows;
  }

  function normalizeSearchText(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function getSettingsSearchSubItems(row){
    if(!row) return [];
    if(row.querySelector('#startpageAgentCapabilities')) return $$('.startpage-agent-cap-item', row);
    if(row.querySelector('#widgetToggles')) return $$('#widgetToggles > label', row);
    if(row.querySelector('#enginePills')) return $$('#enginePills > button', row);
    return [];
  }

  function getSettingsSearchLabelText(row){
    if(!row) return '';
    const label = row.querySelector(':scope > label, :scope > .settings-row-heading');
    return label ? normalizeSearchText(label.textContent) : '';
  }

  function getSettingsSearchText(row){
    if(!row) return '';
    const parts = [];
    const labelText = getSettingsSearchLabelText(row);
    if(labelText) parts.push(labelText);
    $$('.muted', row).forEach(el=>{
      const text = normalizeSearchText(el.textContent);
      if(text) parts.push(text);
    });
    $$('input, textarea, select, button', row).forEach(el=>{
      if(el.closest('#widgetToggles, #enginePills, #startpageAgentCapabilities')) return;
      const placeholder = normalizeSearchText(el.getAttribute('placeholder') || el.getAttribute('data-i18n-placeholder') || '');
      if(placeholder) parts.push(placeholder);
      if(el.tagName === 'SELECT'){
        Array.from(el.options || []).forEach(opt=>{
          const text = normalizeSearchText(opt.textContent);
          if(text) parts.push(text);
        });
      } else if(el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'){
        const value = normalizeSearchText(el.value || '');
        if(value) parts.push(value);
      } else if(el.tagName === 'BUTTON'){
        const text = normalizeSearchText(el.textContent);
        if(text) parts.push(text);
      }
    });
    return parts.join(' ');
  }

  function resetSettingsSearchSubItems(row){
    getSettingsSearchSubItems(row).forEach(item=> item.hidden = false);
  }

  function filterSettingsSearchSubItems(row, query){
    const items = getSettingsSearchSubItems(row);
    if(!items.length) return null;
    const labelMatches = getSettingsSearchLabelText(row).includes(query);
    let matches = 0;
    items.forEach(item=>{
      const itemMatches = normalizeSearchText(item.textContent).includes(query);
      item.hidden = !itemMatches;
      if(itemMatches) matches += 1;
    });
    if(matches === 0 && labelMatches){
      items.forEach(item=> item.hidden = false);
    return items.length;
    }
    return matches;
  }

  function restoreSettingsSearchRows(){
    settingsSearchRestore.forEach(entry=>{
      if(!entry || !entry.row || !entry.parent) return;
      resetSettingsSearchSubItems(entry.row);
      entry.row.hidden = false;
      if(entry.placeholder && entry.placeholder.parentNode){
        entry.placeholder.parentNode.insertBefore(entry.row, entry.placeholder);
        entry.placeholder.remove();
      } else {
        entry.parent.appendChild(entry.row);
      }
    });
    settingsSearchRestore = [];
  }

  function applySettingsSearch(){
    const modal = $('#settingsModal');
    if(!modal) return;
    const query = normalizeSearchText(settingsSearchQuery);
    const status = $('#settingsSearchStatus');
    const resultsEl = $('#settingsSearchResults');
    const panels = [
      $('#tab-general'),
      $('#tab-ai'),
      $('#tab-background'),
      $('#tab-search'),
      $('#tab-widgets'),
      $('#tab-data'),
      $('#tab-guide')
    ].filter(Boolean);
    restoreSettingsSearchRows();
    if(!query){
      modal.classList.remove('searching');
      if(resultsEl) resultsEl.innerHTML = '';
      if(status) status.textContent = t('settings.searchSettingsHint', null, 'Filtert Einträge über alle Tabs.');
      return;
    }

    modal.classList.add('searching');
    let totalMatches = 0;
    let matchedSections = 0;
    if(resultsEl) resultsEl.innerHTML = '';
    panels.forEach(panel=>{
      const rows = panelRowsForSearch(panel);
      let panelMatched = false;
      rows.forEach(row=>{
        if(row.classList.contains('row-heading')) return;
        const subItemMatches = filterSettingsSearchSubItems(row, query);
        const text = getSettingsSearchText(row);
        const match = typeof subItemMatches === 'number' ? subItemMatches > 0 : text.includes(query);
        if(!match) return;
        panelMatched = true;
        totalMatches += typeof subItemMatches === 'number' ? subItemMatches : 1;
        if(resultsEl){
          const placeholder = document.createComment('settings-search-placeholder');
          const parent = row.parentNode;
          if(parent){
            parent.insertBefore(placeholder, row);
            settingsSearchRestore.push({ row, parent, placeholder });
          }
          resultsEl.appendChild(row);
          row.hidden = false;
        }
      });
      if(panelMatched) matchedSections += 1;
    });
    if(status){
      status.textContent = totalMatches
        ? t('settings.searchSettingsResults', { count: totalMatches, sections: matchedSections }, '{count} Treffer in {sections} Bereichen.')
        : t('settings.searchSettingsNoResults', null, 'Keine Treffer in den Einstellungen.');
    }
  }

  function initSettingsSearch(){
    const input = $('#settingsSearch');
    if(!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.value = settingsSearchQuery;
    input.addEventListener('input', ()=>{
      settingsSearchQuery = input.value;
      applySettingsSearch();
    });
  }

  function initSettingsTabs(){
    const root = $('#settingsModal'); if(!root) return;
    $$('.tab-btn', root).forEach(btn=>{
      if(btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', ()=>{
        selectSettingsTab(btn.getAttribute('data-tab'));
        if(settingsSearchQuery) applySettingsSearch();
      });
    });
  }

  // Make sure tabs contain the right rows regardless of initial HTML structure
  function rebuildSettingsPanels(){
    const sheet = $('#settingsModal .sheet'); if(!sheet) return;
    const tabs = sheet.querySelector('.tabs'); if(!tabs) return;
    const searchResults = sheet.querySelector('#settingsSearchResults');
    // Collect rows from root and any pre-existing panels BEFORE removing them
    const rows = Array.from(sheet.querySelectorAll(':scope > .row, :scope > .tab-panel > .row'))
      .filter(row=> !row.closest('#tab-guide'));
    // Remove old panels
    sheet.querySelectorAll(':scope > .tab-panel').forEach(p=>{
      if(searchResults && p === searchResults) return;
      p.remove();
    });

    const panelGeneral = document.createElement('div'); panelGeneral.id='tab-general'; panelGeneral.className='tab-panel';
    const panelAi = document.createElement('div'); panelAi.id='tab-ai'; panelAi.className='tab-panel';
    const panelBackground = document.createElement('div'); panelBackground.id='tab-background'; panelBackground.className='tab-panel';
    const panelSearch = document.createElement('div'); panelSearch.id='tab-search'; panelSearch.className='tab-panel';
    const panelWidgets = document.createElement('div'); panelWidgets.id='tab-widgets'; panelWidgets.className='tab-panel';
    const panelData = document.createElement('div'); panelData.id='tab-data'; panelData.className='tab-panel';
    const panelGuide = document.createElement('div'); panelGuide.id='tab-guide'; panelGuide.className='tab-panel';

    const assign = (row, target)=>{ if(!row) return; if(row.parentElement) row.parentElement.removeChild(row); target.appendChild(row); };
    rows.forEach(row=>{
      const explicitPanel = row.getAttribute('data-settings-panel');
      if(explicitPanel === 'background'){ assign(row, panelBackground); return; }
      if(explicitPanel === 'general'){ assign(row, panelGeneral); return; }
      if(explicitPanel === 'ai'){ assign(row, panelAi); return; }
      if(explicitPanel === 'search'){ assign(row, panelSearch); return; }
      if(explicitPanel === 'widgets'){ assign(row, panelWidgets); return; }
      if(explicitPanel === 'data'){ assign(row, panelData); return; }
      if(explicitPanel === 'guide'){ assign(row, panelGuide); return; }
      if(row.classList.contains('row-heading')){ assign(row, panelGeneral); return; }
      const has = sel => row.querySelector(sel);
      if(has('#themeSelect')) assign(row, panelGeneral);
      else if(has('#aiEnabledToggle')) assign(row, panelGeneral);
      else if(has('#startpageAgentModel') || has('#startpageAgentLoadModels') || has('#startpageAgentHost') || has('#startpageAgentConfirmMode') || has('#startpageAgentMaxIterations') || has('#startpageAgentCustomPrompt') || has('#startpageAgentMemory') || has('#startpageAgentClearMemory') || has('#startpageAgentSaveSettings') || has('#startpageAgentClearChat') || has('#startpageAgentCapabilities')) assign(row, panelAi);
      else if(has('#bgEngine') || has('#cardStyle') || has('#accentColor') || has('#modalColor') || has('#buttonColor') || has('#inputColor') || has('#clockColor') || has('#searchColor')) assign(row, panelBackground);
      else if(has('#enginePills') || has('#searxngBaseUrl') || has('#shortcutConfig') || has('#feedsConfig') || has('#wordlistEditor')) assign(row, panelSearch);
      else if(has('#widgetToggles') || has('#defaultCities') || has('#transportDefaultInput') || has('#recentMaxSetting') || has('#recentClearSetting')) assign(row, panelWidgets);
      else if(has('#exportData') || has('#importData') || has('#dataNote') || has('#dataPresetSelect') || has('#applyPreset') || has('#profilesList') || has('#profileCreate') || has('#restartOnboarding')) assign(row, panelData);
      else assign(row, panelGeneral);
    });

    // Build guide content
    panelGuide.innerHTML = buildSettingsGuideHtml();

    tabs.insertAdjacentElement('afterend', panelGeneral);
    panelGeneral.insertAdjacentElement('afterend', panelAi);
    panelAi.insertAdjacentElement('afterend', panelBackground);
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
    const preferred = getSelectedSearchEngine();
    select.innerHTML = '';
    enabled.forEach(k=>{
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = t(`search.engine.${k}`, null, ({google:'Google',ddg:'DuckDuckGo',bing:'Bing',searxng:'SearXNG',yt:'YouTube',wikipedia:'Wikipedia',maps:'Google Maps'})[k]||k);
      select.appendChild(opt);
    });
    if(enabled.includes(current)) select.value = current;
    else if(enabled.includes(preferred)) select.value = preferred;
    else select.value = enabled[0];
    setSelectedSearchEngine(select.value);
    refreshUiSelects(select.parentElement || document);
  }

  // ===== Onboarding
  async function onboardingRenderPresets(){
    const select = $('#onbPresetSelect');
    const meta = $('#onbPresetMeta');
    const cards = $('#onbPresetCards');
    if(!select || !meta) return;
    select.innerHTML = '';
    if(cards) cards.innerHTML = '';
    meta.textContent = t('data.presets.loading');
    const presets = await loadDataPresets();
    if(!presets.length){
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('data.presets.noneFound');
      select.appendChild(opt);
      if(cards){
        const empty = document.createElement('div');
        empty.className = 'onb-preset-empty muted';
        empty.textContent = t('data.presets.noneFound');
        cards.appendChild(empty);
      }
      meta.textContent = t('data.presets.hintShort');
      return;
    }
    presets.forEach((p,i)=>{
      const opt = document.createElement('option');
      opt.value = p.id || 'preset-' + i;
      const label = p.name || p.id || t('data.presets.defaultLabel', { index: i+1 });
      const prefix = p.source === 'user' && !/^user:/i.test(String(label).trim()) ? 'User: ' : '';
      opt.textContent = prefix + label;
      select.appendChild(opt);
      if(cards){
        const card = document.createElement('button');
        card.className = 'onb-preset-card';
        card.type = 'button';
        card.dataset.presetId = p.id || 'preset-' + i;
        const tags = Array.isArray(p.tags) && p.tags.length ? p.tags.join(', ') : (p.source || '');
        card.innerHTML = `
          <span class="onb-preset-name">${escapeHtml(prefix + label)}</span>
          <span class="onb-preset-description">${escapeHtml(getPresetDescription(p) || t('onboarding.preset.meta'))}</span>
          ${tags ? `<span class="onb-preset-tags">${escapeHtml(tags)}</span>` : ''}
        `;
        card.addEventListener('click', ()=>{
          select.value = card.dataset.presetId;
          updateUiSelect(select);
          onboardingUpdatePresetMeta();
          onboardingApplyPreset();
        });
        cards.appendChild(card);
      }
    });
    const storedPreset = String(store.get('onboarding.preset.id', '') || '');
    const current = presets.find(p => String(p.id || '') === storedPreset) || presets[0];
    select.value = current ? current.id : select.value;
    refreshUiSelects(select.parentElement || document);
    onboardingUpdatePresetMeta();
  }

  function onboardingRenderBgPresets(){
    const select = $('#onbBgPreset');
    if(!select) return;
    select.innerHTML = '';
    const optNone = document.createElement('option'); optNone.value=''; optNone.textContent = t('onboarding.appearance.keepCurrent');
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
    refreshUiSelects(select.parentElement || document);
  }

  async function onboardingUpdatePresetMeta(){
    const select = $('#onbPresetSelect');
    const meta = $('#onbPresetMeta');
    if(!select || !meta) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    if(current){
      meta.textContent = getPresetDescription(current) || t('onboarding.preset.meta');
    } else {
      meta.textContent = t('onboarding.preset.optional');
    }
    $$('.onb-preset-card').forEach(card=>{
      card.classList.toggle('active', !!current && card.dataset.presetId === String(current.id || ''));
    });
  }

  async function onboardingApplyPreset(){
    const select = $('#onbPresetSelect');
    if(!select) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    if(!current || !current.file){ await uiAlert(t('data.presets.missingFile')); return; }
    try{
      const res = await fetch(current.file);
      if(!res.ok) throw new Error(t('data.presets.fileMissing'));
      const obj = await res.json();
      if(!obj || typeof obj !== 'object') throw new Error(t('data.presets.invalid'));
      if(!('wordlist.inline' in obj)) obj['wordlist.inline'] = [];
      obj['wordlist.inline'] = normalizeInlineWordlist(obj['wordlist.inline']);
      Object.keys(obj).forEach(k=> localStorage.setItem(k, JSON.stringify(obj[k])));
      ensureWeatherStorage();
      store.set('onboarding.preset.id', current.id || select.value || '');
      store.set('onboarding.done', false);
      store.set('onboarding.resume', true);
      store.set('onboarding.step', onboardingState.step);
      onboardingState.pendingReload = true;
      onboardingUpdatePresetMeta();
      location.reload();
    }catch(err){
      await uiAlert(t('data.presets.loadFailed', { error: err.message }, 'Preset load failed: {error}'));
    }
  }

  function onboardingUpdateUi(){
    const modal = $('#onboarding');
    if(!modal) return;
    const steps = $$('.onb-step', modal);
    const total = steps.length || 1;
    steps.forEach((stepEl, idx)=> stepEl.classList.toggle('active', idx === onboardingState.step));
    $$('.onb-nav-btn', modal).forEach(btn=>{
      const idx = Number(btn.getAttribute('data-onb-step'));
      btn.classList.toggle('active', idx === onboardingState.step);
    });
    const prev = $('#onbPrev'); if(prev) prev.disabled = onboardingState.step === 0;
    const next = $('#onbNext'); if(next) next.textContent = onboardingState.step >= total-1 ? t('onboarding.finish') : t('onboarding.next');
    const label = $('#onbProgressLabel'); if(label) label.textContent = t('onboarding.progress', { current: Math.min(onboardingState.step+1,total), total });
    const dots = $('#onbDots');
    if(dots){
      dots.innerHTML = '';
      for(let i=0;i<total;i++){
        const dot = document.createElement('span');
        dot.className = 'onb-dot' + (i === onboardingState.step ? ' active' : '');
        dots.appendChild(dot);
      }
    }
    const current = steps[onboardingState.step];
    if(current && current.getAttribute('data-step') === 'summary') onboardingRenderSummary();
  }

  function onboardingGoToStep(index){
    onboardingCommitStep();
    const modal = $('#onboarding');
    if(!modal) return;
    const steps = $$('.onb-step', modal);
    const total = steps.length || 1;
    onboardingState.step = Math.max(0, Math.min(total - 1, Number(index) || 0));
    onboardingUpdateUi();
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
        if(val){
          const entry = upsertWeatherEntry(val);
          loadWeather(entry ? entry.id : undefined);
        }
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

  function onboardingRenderSummary(){
    const wrap = $('#onbSummary');
    if(!wrap) return;
    const engine = $('#onbEngine');
    const theme = $('#onbTheme');
    const cardStyle = $('#onbCardStyle');
    const bg = $('#onbBgPreset');
    const city = $('#onbCity');
    const transport = $('#onbTransportInput');
    const widgets = $$('.onb-widget-toggle')
      .filter(cb => cb.checked)
      .map(cb => {
        const key = cb.getAttribute('data-widget');
        return t(`widgets.${key}`, null, key);
      });
    const bgLabel = bg && bg.value
      ? (BG_PRESETS.find(p => p.id === bg.value) || {}).label || bg.value
      : t('onboarding.appearance.keepCurrent');
    const items = [
      [t('onboarding.summary.theme'), theme ? theme.options[theme.selectedIndex].textContent : ''],
      [t('onboarding.summary.cardStyle'), cardStyle ? cardStyle.options[cardStyle.selectedIndex].textContent : ''],
      [t('onboarding.summary.background'), bgLabel],
      [t('onboarding.summary.search'), engine ? engine.options[engine.selectedIndex].textContent : ''],
      [t('onboarding.summary.widgets'), widgets.length ? widgets.join(', ') : t('common.emptyDash')],
      [t('onboarding.summary.weather'), city && city.value.trim() ? city.value.trim() : t('common.emptyDash')],
      [t('onboarding.summary.transport'), transport && transport.value.trim() ? transport.value.trim() : t('common.emptyDash')]
    ];
    wrap.innerHTML = '';
    items.forEach(([label, value])=>{
      const row = document.createElement('div');
      row.className = 'onb-summary-row';
      row.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value || t('common.emptyDash'))}</strong>`;
      wrap.appendChild(row);
    });
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
    closeModalAnimated(modal);
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
    const activeWeather = getWeatherActiveEntry();
    const city = activeWeather ? activeWeather.city : '';
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
    syncModalOpenState();
  }
