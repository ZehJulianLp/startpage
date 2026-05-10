  // ===== Startpage Agent (Ollama + tools)
  const AGENT_KEYS = {
    enabled: 'ai.agent.enabled',
    host: 'ai.agent.host',
    model: 'ai.agent.model',
    models: 'ai.agent.models',
    panelOpen: 'ai.agent.ui.open',
    history: 'ai.agent.history',
    confirmMode: 'ai.agent.tools.confirmMode',
    maxIterations: 'ai.agent.tools.maxIterations',
    accent: 'ai.agent.themeAccent',
    customPrompt: 'ai.agent.customPrompt',
    memory: 'ai.agent.memory'
  };

  const AGENT_DEFAULT_HOST = 'http://localhost:11434';
  const AGENT_REQUIRED_ORIGIN = 'https://julianverse.de';
  const AGENT_DEFAULT_MAX_TOOL_ITERATIONS = 3;
  const AGENT_MIN_TOOL_ITERATIONS = 1;
  const AGENT_MAX_TOOL_ITERATIONS = 10;
  const AGENT_MAX_HISTORY = 120;
  const AGENT_TOOL_NAMES = [
    'open_url',
    'search_web',
    'set_theme_accent',
    'set_theme_mode',
    'set_card_style',
    'load_preset',
    'set_background_preset',
    'toggle_background_rotation',
    'toggle_widget',
    'show_all_widgets',
    'hide_all_widgets',
    'add_quicklink',
    'remove_quicklink',
    'add_todo',
    'toggle_todo',
    'remove_todo',
    'clear_done_todos',
    'append_note',
    'set_notes',
    'clear_notes',
    'set_search_engine',
    'set_locale',
    'set_ui_font',
    'set_engine_enabled',
    'set_shortcuts',
    'set_custom_feeds',
    'set_wordlist_inline',
    'set_widget_color',
    'set_surface_color',
    'set_weather_cities',
    'set_transport_duration',
    'set_transport_default_name',
    'set_agent_enabled',
    'set_agent_host',
    'set_agent_confirm_mode',
    'set_agent_model',
    'set_agent_custom_prompt',
    'set_agent_memory',
    'append_agent_memory',
    'clear_agent_memory',
    'read_agent_memory',
    'set_news_source',
    'refresh_data',
    'read_widget_data',
    'read_all_widgets',
    'read_weather_data',
    'read_transport_data',
    'read_todo_data',
    'read_notes_data',
    'read_tiles_data',
    'read_news_data',
    'read_quote_data',
    'read_recent_data',
    'read_system_data',
    'set_weather_station_active',
    'add_weather_station',
    'remove_weather_station',
    'set_weather_city'
  ];
  const AGENT_TOOL_DESCRIPTIONS = {
    open_url: 'Open a URL',
    search_web: 'Search with engine',
    set_theme_accent: 'Set accent color',
    set_theme_mode: 'auto/dark/light',
    set_card_style: 'glass/solid/transparent/minimal',
    load_preset: 'Load data preset',
    set_background_preset: 'Set background preset',
    toggle_background_rotation: 'Toggle rotation',
    toggle_widget: 'Enable/disable widget',
    show_all_widgets: 'Enable all widgets',
    hide_all_widgets: 'Disable all widgets',
    add_quicklink: 'Add quicklink',
    remove_quicklink: 'Remove quicklink',
    add_todo: 'Create todo',
    toggle_todo: 'Mark todo done/undone',
    remove_todo: 'Delete todo',
    clear_done_todos: 'Delete completed todos',
    append_note: 'Append notes text',
    set_notes: 'Replace notes',
    clear_notes: 'Clear notes',
    set_search_engine: 'Set default engine',
    set_locale: 'Set language',
    set_ui_font: 'Set UI font',
    set_engine_enabled: 'Enable/disable engine',
    set_shortcuts: 'Set shortcuts',
    set_custom_feeds: 'Set custom feeds',
    set_wordlist_inline: 'Set inline wordlist',
    set_widget_color: 'Set widget color',
    set_surface_color: 'Set header/search color',
    set_weather_cities: 'Set weather cities',
    set_transport_duration: 'Set transport duration',
    set_transport_default_name: 'Set transport default stop',
    set_agent_enabled: 'Enable/disable Startpage Agent',
    set_agent_host: 'Set Startpage Agent host',
    set_agent_confirm_mode: 'Set Startpage Agent confirm mode',
    set_agent_model: 'Set Startpage Agent model',
    set_agent_custom_prompt: 'Set custom prompt',
    set_agent_memory: 'Replace memory',
    append_agent_memory: 'Append memory',
    clear_agent_memory: 'Clear memory',
    read_agent_memory: 'Read memory',
    set_news_source: 'Set news source',
    refresh_data: 'Refresh widgets',
    read_widget_data: 'Read one widget',
    read_all_widgets: 'Read all widgets',
    read_weather_data: 'Read weather data',
    read_transport_data: 'Read transport data',
    read_todo_data: 'Read todos',
    read_notes_data: 'Read notes',
    read_tiles_data: 'Read favorites',
    read_news_data: 'Read news',
    read_quote_data: 'Read quote',
    read_recent_data: 'Read recent actions',
    read_system_data: 'Read system status',
    set_weather_station_active: 'Activate weather station',
    add_weather_station: 'Add weather station',
    remove_weather_station: 'Remove weather station',
    set_weather_city: 'Set/activate city'
  };

  function buildAgentSystemPromptBase(){
    return [
      t('agent.systemPrompt.name', null, 'Name: Startpage Agent'),
      t('agent.systemPrompt.embedded', null, 'You are embedded in a local Startpage instance.'),
      t('agent.systemPrompt.jsonOnly', null, 'If you must take an action, reply ONLY with exactly one JSON line in the format {"tool":"<name>","args":{...}}.'),
      t('agent.systemPrompt.noExtra', null, 'No extra words, no Markdown, no code block for tool calls.'),
      t('agent.systemPrompt.allowedTools', { tools: AGENT_TOOL_NAMES.join(', ') }, `Use only these tools: ${AGENT_TOOL_NAMES.join(', ')}.`),
      t('agent.systemPrompt.normalReply', null, 'If no action is needed, respond normally.'),
      t('agent.systemPrompt.askMissing', null, 'If information is missing or a tool call would be invalid, ask follow-up questions as normal text.')
    ].join('\n');
  }

  function getAgentCustomPrompt(){
    return String(store.get(AGENT_KEYS.customPrompt, '') || '').trim();
  }

  function normalizeAgentMemoryObject(raw){
    const out = {};
    if(raw && typeof raw === 'object' && !Array.isArray(raw)){
      Object.entries(raw).forEach(([k, v])=>{
        const key = String(k || '').trim();
        const value = String(v || '').trim();
        if(key && value) out[key] = value;
      });
      return out;
    }
    const text = String(raw || '').trim();
    if(!text) return out;
    try{
      const parsed = JSON.parse(text);
      if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)){
        Object.entries(parsed).forEach(([k, v])=>{
          const key = String(k || '').trim();
          const value = String(v || '').trim();
          if(key && value) out[key] = value;
        });
        return out;
      }
    }catch{}
    let notes = [];
    text.split(/\r?\n/).forEach(line=>{
      const rawLine = String(line || '').trim();
      if(!rawLine) return;
      const idx = rawLine.indexOf(':');
      if(idx > 0){
        const key = rawLine.slice(0, idx).trim();
        const value = rawLine.slice(idx + 1).trim();
        if(key && value){
          out[key] = value;
          return;
        }
      }
      notes.push(rawLine);
    });
    if(notes.length){
      out._notes = notes.join('\n');
    }
    return out;
  }

  function getAgentMemoryObject(){
    const raw = store.get(AGENT_KEYS.memory, {});
    const normalized = normalizeAgentMemoryObject(raw);
    if(raw && typeof raw === 'object' && !Array.isArray(raw)) return normalized;
    store.set(AGENT_KEYS.memory, normalized);
    return normalized;
  }

  function setAgentMemoryObject(value){
    const normalized = normalizeAgentMemoryObject(value);
    store.set(AGENT_KEYS.memory, normalized);
    return normalized;
  }

  function parseAgentMemoryInput(raw){
    const text = String(raw || '').trim();
    if(!text) return {};
    try{
      const parsed = JSON.parse(text);
      if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)){
        return normalizeAgentMemoryObject(parsed);
      }
    }catch{}
    return normalizeAgentMemoryObject(text);
  }

  function getAgentMemoryText(){
    const obj = getAgentMemoryObject();
    const keys = Object.keys(obj);
    if(!keys.length) return '';
    return JSON.stringify(obj, null, 2);
  }

  function buildAgentSystemPrompt(){
    const parts = [buildAgentSystemPromptBase()];
    const custom = getAgentCustomPrompt();
    const memory = getAgentMemoryText();
    if(custom){
      parts.push(`${t('agent.systemPrompt.customPromptSection', null, 'CUSTOM_PROMPT')}:\n${custom}`);
    }
    if(memory){
      parts.push(`${t('agent.systemPrompt.memorySection', null, 'PERSISTENT_MEMORY')}:\n${memory}`);
    }
    return parts.join('\n\n');
  }

  const agentState = {
    busy: false,
    abortController: null,
    streamingMessageEl: null,
    streamingBuffer: '',
    lastScrollWasNearBottom: true,
    available: true,
    pointerStartedInside: false
  };

  function getAgentElements(){
    return {
      fab: $('#startpageAgentFab'),
      panel: $('#startpageAgentPanel'),
      close: $('#startpageAgentClose'),
      model: $('#startpageAgentModel'),
      loadModels: $('#startpageAgentLoadModels'),
      settingsToggle: $('#startpageAgentSettingsToggle'),
      hostInput: $('#startpageAgentHost'),
      hostDisplay: $('#startpageAgentHostDisplay'),
      confirmMode: $('#startpageAgentConfirmMode'),
      maxIterations: $('#startpageAgentMaxIterations'),
      maxIterationsDec: $('#startpageAgentMaxIterationsDec'),
      maxIterationsInc: $('#startpageAgentMaxIterationsInc'),
      saveSettings: $('#startpageAgentSaveSettings'),
      clearChat: $('#startpageAgentClearChat'),
      customPrompt: $('#startpageAgentCustomPrompt'),
      memory: $('#startpageAgentMemory'),
      clearMemory: $('#startpageAgentClearMemory'),
      messages: $('#startpageAgentMessages'),
      input: $('#startpageAgentInput'),
      send: $('#startpageAgentSend'),
      stop: $('#startpageAgentStop'),
      status: $('#startpageAgentStatus')
    };
  }

  function isAgentEnabled(){
    return !!store.get(AGENT_KEYS.enabled, true);
  }

  function getAgentHost(){
    return String(store.get(AGENT_KEYS.host, AGENT_DEFAULT_HOST) || AGENT_DEFAULT_HOST).trim() || AGENT_DEFAULT_HOST;
  }

  function normalizeAgentHost(raw){
    const value = String(raw || '').trim();
    if(!value) return AGENT_DEFAULT_HOST;
    try {
      const u = new URL(value);
      if(!/^https?:$/i.test(u.protocol)) return null;
      u.pathname = '';
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  function getAgentCorsHint(){
    return `Setze OLLAMA_ORIGINS=${AGENT_REQUIRED_ORIGIN} und starte Ollama neu.`;
  }

  function withAgentCorsHint(message){
    const base = String(message || '').trim();
    return `${base} ${getAgentCorsHint()}`.trim();
  }

  function getAgentHistory(){
    const raw = store.get(AGENT_KEYS.history, []);
    if(!Array.isArray(raw)) return [];
    return raw
      .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .slice(-AGENT_MAX_HISTORY);
  }

  function setAgentHistory(list){
    const safe = (Array.isArray(list) ? list : [])
      .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .slice(-AGENT_MAX_HISTORY);
    store.set(AGENT_KEYS.history, safe);
  }

  function appendAgentHistory(msg){
    const list = getAgentHistory();
    list.push(msg);
    setAgentHistory(list);
  }

  function isAgentToolFeedbackMessage(msg){
    return msg && msg.role === 'user' && typeof msg.content === 'string' && msg.content.startsWith('TOOL_RESULT ');
  }

  function setAgentStatus(text){
    const el = $('#startpageAgentStatus');
    if(el) el.textContent = text;
    const settingsEl = $('#startpageAgentSettingsStatus');
    if(settingsEl) settingsEl.textContent = text;
  }

  function setAgentBusy(busy){
    agentState.busy = !!busy;
    const send = $('#startpageAgentSend');
    const stop = $('#startpageAgentStop');
    const input = $('#startpageAgentInput');
    if(send) send.classList.toggle('hidden', agentState.busy);
    if(stop) stop.classList.toggle('hidden', !agentState.busy);
    if(input) input.disabled = agentState.busy;
  }

  function parseAgentToolCall(text){
    const trimmed = String(text || '').trim();
    if(!trimmed) return null;
    if(!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
    if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if(!Object.prototype.hasOwnProperty.call(parsed, 'tool')) return null;
    if(!Object.prototype.hasOwnProperty.call(parsed, 'args')) return null;
    if(typeof parsed.tool !== 'string' || !parsed.tool.trim()) return null;
    if(!parsed.args || typeof parsed.args !== 'object' || Array.isArray(parsed.args)) return null;
    return { tool: parsed.tool.trim(), args: parsed.args };
  }

  function validateHttpUrl(url){
    try {
      const parsed = new URL(String(url || '').trim());
      if(!/^https?:$/i.test(parsed.protocol)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  function validateHex6(value){
    const s = String(value || '').trim();
    if(!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
    return s.toLowerCase();
  }

  function agentToolValidationError(message){
    return { ok: false, error: message };
  }

  async function setAgentThemeAccent(accent){
    const root = document.documentElement;
    if(!root) return;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--ring', `color-mix(in srgb, ${accent} 55%, transparent)`);
    applyAccentTint();
    store.set(AGENT_KEYS.accent, accent);
  }

  function applyPersistedAgentAccent(){
    const accent = validateHex6(store.get(AGENT_KEYS.accent, ''));
    if(accent) void setAgentThemeAccent(accent);
  }

  async function applyPresetDirectById(presetId){
    const id = String(presetId || '').trim();
    if(!id) throw new Error('presetId fehlt');
    const presets = await loadDataPresets();
    const found = presets.find(p => String(p && p.id || '') === id);
    if(!found) throw new Error('Preset nicht gefunden');
    if(!found.file) throw new Error('Preset-Datei fehlt');
    const res = await fetch(found.file);
    if(!res.ok) throw new Error('Preset-Datei konnte nicht geladen werden');
    const obj = await res.json();
    if(!obj || typeof obj !== 'object') throw new Error('Preset-Format ist ungueltig');
    if(!('wordlist.inline' in obj)) obj['wordlist.inline'] = [];
    obj['wordlist.inline'] = normalizeInlineWordlist(obj['wordlist.inline']);
    Object.keys(obj).forEach(k => localStorage.setItem(k, JSON.stringify(obj[k])));
    ensureWeatherStorage();
    applyUiFont(store.get(UI_FONT_KEY, ''));
    applyTheme(store.get('theme', 'auto'));
    applyCardStyle();
    renderEngines();
    renderTiles();
    renderTodos();
    initNotes();
    renderRecent();
    applyWidgets();
    applyWidgetColors();
    fillNewsSources();
    loadNews();
    await loadWeather();
    renderSystem();
    fillSettings();
  }

  function addQuicklinkToTiles(title, url, group){
    const data = store.get('tiles', defaultTiles());
    const cleanTitle = String(title || '').trim();
    const cleanGroup = String(group || '').trim();
    const finalTitle = cleanGroup ? `${cleanTitle} [${cleanGroup}]` : cleanTitle;
    data.unshift({ title: finalTitle, url: url });
    store.set('tiles', data);
    renderTiles();
    return { title: finalTitle, url };
  }

  function removeQuicklinkFromTiles(title){
    const clean = String(title || '').trim().toLowerCase();
    if(!clean) return false;
    const data = store.get('tiles', defaultTiles());
    const idx = data.findIndex(item => String(item && item.title || '').trim().toLowerCase() === clean);
    if(idx < 0) return false;
    data.splice(idx, 1);
    store.set('tiles', data);
    renderTiles();
    return true;
  }

  function updateAgentHostDisplay(){
    const el = $('#startpageAgentHostDisplay');
    if(el) el.textContent = `${t('agent.ui.hostLabel', null, 'Host')}: ${getAgentHost()}`;
    const modelEl = $('#startpageAgentModelDisplay');
    const model = String(store.get(AGENT_KEYS.model, '') || '').trim();
    if(modelEl) modelEl.textContent = `${t('agent.ui.modelLabel', null, 'Model')}: ${model || t('agent.ui.emptyModel', null, '-')}`;
  }

  function renderAgentCapabilities(){
    const wrap = $('#startpageAgentCapabilities');
    if(!wrap) return;
    wrap.innerHTML = AGENT_TOOL_NAMES
      .map(name => {
        const fallback = AGENT_TOOL_DESCRIPTIONS[name] || '';
        const desc = t(`agent.tools.descriptions.${name}`, null, fallback);
        return `<div class="startpage-agent-cap-item"><code>${escapeHtml(name)}</code>${escapeHtml(desc)}</div>`;
      })
      .join('');
  }

  function readWeatherSnapshot(){
    const entries = getWeatherEntries();
    const active = getWeatherActiveEntry();
    const text = ($('#weatherText') && $('#weatherText').textContent) ? $('#weatherText').textContent.trim() : '';
    const temp = ($('#tempNow') && $('#tempNow').textContent) ? $('#tempNow').textContent.trim() : '';
    const minmax = ($('#minmax') && $('#minmax').textContent) ? $('#minmax').textContent.trim() : '';
    const hourly = $$('#hourly .chip').slice(0, 12).map(chip=>{
      const time = $('.chip-top span', chip);
      const chipTemp = $('.chip-temp', chip);
      const desc = $('.chip-text', chip);
      return {
        time: time ? time.textContent.trim() : '',
        temp: chipTemp ? chipTemp.textContent.trim() : '',
        text: desc ? desc.textContent.trim() : ''
      };
    });
    return {
      activeId: active ? active.id : '',
      activeCity: active ? active.city : '',
      stations: entries,
      current: { text, temp, minmax },
      hourly
    };
  }

  function readTransportSnapshot(){
    const station = store.get('transport.station', null);
    const duration = getTransportDuration();
    const selectedText = ($('#transportSelected') && $('#transportSelected').textContent) ? $('#transportSelected').textContent.trim() : '';
    const departures = $$('#transportList .transport-item').map(item=>{
      const line = $('.transport-line', item);
      const dir = $('.transport-dir', item);
      const time = $('.transport-time', item);
      const platform = $('.transport-platform', item);
      const delay = $('.transport-delay', item);
      const cancelled = $('.transport-cancelled', item);
      return {
        line: line ? line.textContent.trim() : '',
        direction: dir ? dir.textContent.trim() : '',
        time: time ? time.textContent.trim() : '',
        platform: platform ? platform.textContent.trim() : '',
        delay: delay ? delay.textContent.trim() : '',
        cancelled: !!cancelled
      };
    });
    const fallbackHint = ($('#transportList') && $('#transportList').textContent) ? $('#transportList').textContent.trim() : '';
    return {
      station,
      selectedText,
      durationMinutes: duration,
      departures,
      listText: fallbackHint
    };
  }

  function readTodoSnapshot(){
    const todos = store.get('todos', []);
    const done = todos.filter(item => item && item.done).length;
    return { total: todos.length, done, open: Math.max(0, todos.length - done), items: todos };
  }

  function readNotesSnapshot(){
    const text = String(store.get('notes', '') || '');
    return { text, length: text.length };
  }

  function readTilesSnapshot(){
    const items = store.get('tiles', defaultTiles());
    return { total: items.length, items };
  }

  function readNewsSnapshot(){
    const source = store.get('news.source', '');
    const feeds = getFeeds();
    const items = $$('#newsList li a').map(link=>({
      title: link.textContent ? link.textContent.trim() : '',
      url: link.getAttribute('href') || ''
    }));
    const listText = ($('#newsList') && $('#newsList').textContent) ? $('#newsList').textContent.trim() : '';
    return { source, feedUrl: feeds[source] || '', total: items.length, items, listText };
  }

  function readQuoteSnapshot(){
    const text = ($('#quote') && $('#quote').textContent) ? $('#quote').textContent.trim() : '';
    return { text };
  }

  function readRecentSnapshot(){
    const items = getRecentEntries();
    return { total: items.length, max: getRecentMax(), items };
  }

  function readSystemSnapshot(){
    const raw = ($('#systemInfo') && $('#systemInfo').textContent) ? $('#systemInfo').textContent.trim() : '';
    const lines = raw ? raw.split(/\n+/).map(line => line.trim()).filter(Boolean) : [];
    return { text: raw, lines };
  }

  function readWidgetSnapshot(widgetId){
    const key = String(widgetId || '').trim().toLowerCase();
    const readers = {
      todo: readTodoSnapshot,
      notes: readNotesSnapshot,
      tiles: readTilesSnapshot,
      weather: readWeatherSnapshot,
      transport: readTransportSnapshot,
      quote: readQuoteSnapshot,
      recent: readRecentSnapshot,
      system: readSystemSnapshot,
      news: readNewsSnapshot
    };
    const reader = readers[key];
    if(!reader) return null;
    return { widgetId: key, data: reader() };
  }

  function readAllWidgetSnapshots(){
    const ids = ['todo', 'notes', 'tiles', 'weather', 'transport', 'quote', 'recent', 'system', 'news'];
    const out = {};
    ids.forEach(id => { out[id] = readWidgetSnapshot(id).data; });
    return out;
  }

  function renderAgentModels(models){
    const modelSelect = $('#startpageAgentModel');
    if(!modelSelect) return;
    const list = Array.isArray(models) ? models.filter(Boolean) : [];
    const unique = Array.from(new Set(list.map(m => String(m).trim()).filter(Boolean)));
    modelSelect.innerHTML = '';
    if(!unique.length){
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('agent.settings.noModels', null, 'No models');
      modelSelect.appendChild(opt);
      modelSelect.value = '';
      store.set(AGENT_KEYS.models, []);
      store.set(AGENT_KEYS.model, '');
      return;
    }
    unique.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      modelSelect.appendChild(opt);
    });
    const saved = String(store.get(AGENT_KEYS.model, '') || '').trim();
    const selected = unique.includes(saved) ? saved : unique[0];
    modelSelect.value = selected;
    store.set(AGENT_KEYS.models, unique);
    store.set(AGENT_KEYS.model, selected);
  }

  async function loadAgentModels(){
    if(!isAgentEnabled()) throw new Error(t('agent.status.disabled', null, 'Agent is disabled'));
    const host = getAgentHost();
    setAgentStatus(t('agent.status.loadingModels', null, 'Loading models...'));
    try {
      const res = await fetch(`${host}/api/tags`);
      if(!res.ok){
        const isCorsLike = res.status === 403;
        const msg = isCorsLike
          ? withAgentCorsHint(`HTTP ${res.status}`)
          : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const payload = await res.json();
      const models = Array.isArray(payload && payload.models) ? payload.models : [];
      const names = models.map(m => String((m && (m.name || m.model)) || '').trim()).filter(Boolean);
      renderAgentModels(names);
      setAgentStatus(names.length
        ? t('agent.status.modelsLoaded', null, 'Models loaded')
        : t('agent.status.noModelsFound', null, 'No models found'));
      return names;
    } catch (err){
      const errMsg = String(err && err.message || 'Unknown error');
      const hinted = /failed to fetch|cors|http 403/i.test(errMsg)
        ? withAgentCorsHint(errMsg)
        : errMsg;
      setAgentStatus(t('agent.status.loadModelsError', { error: hinted }, `Error loading models: ${hinted}`));
      throw err;
    }
  }

  async function checkOllamaAvailable(timeoutMs=2800){
    const controller = new AbortController();
    const timer = setTimeout(()=> controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${getAgentHost()}/api/tags`, { signal: controller.signal });
      return !!(res && res.ok);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  function setAgentAvailability(available){
    agentState.available = !!available;
    const fab = $('#startpageAgentFab');
    const panel = $('#startpageAgentPanel');
    if(fab) fab.style.display = agentState.available ? '' : 'none';
    if(panel){
      if(!agentState.available){
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
      }
      panel.style.display = agentState.available ? '' : 'none';
    }
  }

  function applyAgentEnabledState(){
    const enabled = isAgentEnabled();
    if(!enabled){
      stopAgentStreaming();
      store.set(AGENT_KEYS.panelOpen, false);
      setAgentAvailability(false);
      syncAgentSettingsTabVisibility();
      return;
    }
    syncAgentSettingsTabVisibility();
  }

  async function refreshAgentRuntimeAvailability(){
    if(!isAgentEnabled()){
      applyAgentEnabledState();
      setAgentStatus(t('agent.status.disabledNamed', null, 'Startpage Agent disabled'));
      return false;
    }
    const available = await checkOllamaAvailable();
    if(!available){
      store.set(AGENT_KEYS.enabled, false);
      applyAgentEnabledState();
      const aiToggle = $('#aiEnabledToggle');
      if(aiToggle) aiToggle.checked = false;
      setAgentStatus(withAgentCorsHint(t('agent.status.ollamaUnavailableDisabled', null, 'Ollama unavailable - Startpage Agent disabled')));
      if($('#settingsModal') && $('#settingsModal').classList.contains('open')) fillSettings();
      return false;
    }
    setAgentAvailability(available);
    setAgentStatus(t('agent.status.ready', null, 'Ready'));
    return true;
  }

  function agentShouldAutoscroll(container){
    if(!container) return true;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distance < 64;
  }

  function agentScrollToBottom(force){
    const wrap = $('#startpageAgentMessages');
    if(!wrap) return;
    if(force || agentState.lastScrollWasNearBottom){
      wrap.scrollTop = wrap.scrollHeight;
    }
  }

  function agentFormatInlineMarkdown(text){
    let out = text;
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return out;
  }

  function agentMarkdownToHtml(raw){
    const input = escapeHtml(String(raw || ''));
    const codeBlocks = [];
    const withPlaceholders = input.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      const label = String(lang || '').trim();
      const body = `<pre><code class="${label ? `language-${label}` : ''}">${code}</code></pre>`;
      codeBlocks.push(body);
      return `@@CODEBLOCK_${idx}@@`;
    });
    const lines = withPlaceholders.split(/\r?\n/);
    const out = [];
    let listMode = '';
    const closeList = ()=>{
      if(listMode){
        out.push(listMode === 'ol' ? '</ol>' : '</ul>');
        listMode = '';
      }
    };
    lines.forEach(line => {
      const trimmed = line.trim();
      if(!trimmed){
        closeList();
        return;
      }
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if(headingMatch){
        closeList();
        const level = headingMatch[1].length;
        out.push(`<h${level}>${agentFormatInlineMarkdown(headingMatch[2])}</h${level}>`);
        return;
      }
      const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if(olMatch){
        if(listMode !== 'ol'){
          closeList();
          out.push('<ol>');
          listMode = 'ol';
        }
        out.push(`<li>${agentFormatInlineMarkdown(olMatch[2])}</li>`);
        return;
      }
      const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if(ulMatch){
        if(listMode !== 'ul'){
          closeList();
          out.push('<ul>');
          listMode = 'ul';
        }
        out.push(`<li>${agentFormatInlineMarkdown(ulMatch[1])}</li>`);
        return;
      }
      closeList();
      out.push(`<p>${agentFormatInlineMarkdown(trimmed)}</p>`);
    });
    closeList();
    let html = out.join('');
    codeBlocks.forEach((code, idx) => {
      html = html.replace(`@@CODEBLOCK_${idx}@@`, code);
    });
    return html;
  }

  function renderAgentMessages(forceBottom){
    const wrap = $('#startpageAgentMessages');
    if(!wrap) return;
    const prevTop = wrap.scrollTop;
    const shouldScrollBottom = !!forceBottom || agentShouldAutoscroll(wrap);
    wrap.innerHTML = '';
    const history = getAgentHistory();
    history.forEach(msg => {
      if(isAgentToolFeedbackMessage(msg)) return;
      const row = document.createElement('div');
      row.className = `startpage-agent-msg ${msg.role}`;
      row.innerHTML = agentMarkdownToHtml(msg.content);
      wrap.appendChild(row);
    });
    if(shouldScrollBottom){
      wrap.scrollTop = wrap.scrollHeight;
    } else {
      wrap.scrollTop = prevTop;
    }
    agentState.lastScrollWasNearBottom = agentShouldAutoscroll(wrap);
  }

  function createAgentStreamingMessage(){
    const wrap = $('#startpageAgentMessages');
    if(!wrap) return null;
    agentState.lastScrollWasNearBottom = agentShouldAutoscroll(wrap);
    const row = document.createElement('div');
    row.className = 'startpage-agent-msg assistant';
    row.innerHTML = '<p></p>';
    wrap.appendChild(row);
    agentScrollToBottom(false);
    return row;
  }

  function updateAgentStreamingMessage(text){
    if(!agentState.streamingMessageEl) return;
    agentState.streamingMessageEl.innerHTML = agentMarkdownToHtml(text);
    agentScrollToBottom(false);
  }

  function syncAgentPanelUiState(){
    const panel = $('#startpageAgentPanel');
    const open = !!store.get(AGENT_KEYS.panelOpen, false);
    if(panel){
      panel.classList.toggle('open', open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    const host = getAgentHost();
    const hostInput = $('#startpageAgentHost');
    if(hostInput) hostInput.value = host;
    const confirm = String(store.get(AGENT_KEYS.confirmMode, 2));
    const confirmSelect = $('#startpageAgentConfirmMode');
    if(confirmSelect){
      const allowed = ['0', '1', '2'];
      confirmSelect.value = allowed.includes(confirm) ? confirm : '2';
    }
    updateAgentHostDisplay();
  }

  function getAgentModel(){
    const modelSelect = $('#startpageAgentModel');
    const selected = modelSelect ? String(modelSelect.value || '').trim() : '';
    if(selected){
      store.set(AGENT_KEYS.model, selected);
      return selected;
    }
    return String(store.get(AGENT_KEYS.model, '') || '').trim();
  }

  function getAgentConfirmMode(){
    const raw = store.get(AGENT_KEYS.confirmMode, 2);
    const n = Number(raw);
    if(n === 0 || n === 1 || n === 2) return n;
    return 2;
  }

  function clampAgentMaxIterations(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return AGENT_DEFAULT_MAX_TOOL_ITERATIONS;
    return Math.max(AGENT_MIN_TOOL_ITERATIONS, Math.min(AGENT_MAX_TOOL_ITERATIONS, Math.round(n)));
  }

  function getAgentMaxToolIterations(){
    return clampAgentMaxIterations(store.get(AGENT_KEYS.maxIterations, AGENT_DEFAULT_MAX_TOOL_ITERATIONS));
  }

  async function ollamaChatStream(model, messages, onToken, signal){
    const host = getAgentHost();
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    if(!res.body) throw new Error('Leerer Stream');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIndex = buffer.indexOf('\n');
      while(nlIndex >= 0){
        const line = buffer.slice(0, nlIndex).trim();
        buffer = buffer.slice(nlIndex + 1);
        if(line){
          let obj;
          try {
            obj = JSON.parse(line);
          } catch {
            obj = null;
          }
          if(obj && obj.error) throw new Error(String(obj.error));
          const token = String((obj && obj.message && obj.message.content) || (obj && obj.response) || '');
          if(token){
            full += token;
            if(onToken) onToken(token, full);
          }
        }
        nlIndex = buffer.indexOf('\n');
      }
    }
    const tail = buffer.trim();
    if(tail){
      const obj = JSON.parse(tail);
      if(obj && obj.error) throw new Error(String(obj.error));
      const token = String((obj && obj.message && obj.message.content) || (obj && obj.response) || '');
      if(token){
        full += token;
        if(onToken) onToken(token, full);
      }
    }
    return full;
  }

  async function runAgentTool(toolName, args){
    const safeTool = String(toolName || '').trim();
    if(!safeTool) return agentToolValidationError('Tool fehlt');
    if(!args || typeof args !== 'object' || Array.isArray(args)) return agentToolValidationError('args muss ein Objekt sein');
    const asText = value => String(value || '').trim();
    const findTodoIndex = ()=>{
      const list = store.get('todos', []);
      const indexRaw = args.index;
      if(Number.isInteger(indexRaw) || (typeof indexRaw === 'string' && /^-?\d+$/.test(indexRaw.trim()))){
        const idx = Number(indexRaw);
        if(idx >= 0 && idx < list.length) return idx;
        return -2;
      }
      const text = asText(args.text).toLowerCase();
      if(!text) return -3;
      return list.findIndex(item => String(item && item.text || '').trim().toLowerCase() === text);
    };

    switch(safeTool){
      case 'open_url': {
        const url = validateHttpUrl(args.url);
        if(!url) return agentToolValidationError('url muss http/https sein');
        openUrl(url, url);
        return { ok: true, url };
      }
      case 'search_web': {
        const query = asText(args.query);
        if(!query) return agentToolValidationError('query fehlt');
        const requestedEngine = asText(args.engine) || $('#engine')?.value || 'google';
        if(!(requestedEngine in ENGINES)) return agentToolValidationError('engine ungueltig');
        const url = ENGINES[requestedEngine](query);
        addRecent({ title: `Search (${requestedEngine}): ${query}`, url, query, type: 'search' });
        window.location.href = url;
        return { ok: true, query, engine: requestedEngine, url };
      }
      case 'set_theme_accent': {
        const accent = validateHex6(args.accent);
        if(!accent) return agentToolValidationError('accent muss #RRGGBB sein');
        await setAgentThemeAccent(accent);
        return { ok: true, accent };
      }
      case 'set_theme_mode': {
        const mode = asText(args.mode).toLowerCase();
        if(!['auto', 'dark', 'light'].includes(mode)) return agentToolValidationError('mode muss auto/dark/light sein');
        store.set('theme', mode);
        applyTheme(mode);
        fillSettings();
        return { ok: true, mode };
      }
      case 'set_card_style': {
        const style = asText(args.style).toLowerCase();
        if(!['glass', 'solid', 'transparent', 'minimal'].includes(style)) return agentToolValidationError('style muss glass/solid/transparent/minimal sein');
        store.set('ui.cardStyle', style);
        applyCardStyle();
        fillSettings();
        return { ok: true, style };
      }
      case 'load_preset': {
        const presetId = asText(args.presetId);
        if(!presetId) return agentToolValidationError('presetId fehlt');
        await applyPresetDirectById(presetId);
        return { ok: true, presetId };
      }
      case 'set_background_preset': {
        const presetId = asText(args.presetId);
        if(!presetId) return agentToolValidationError('presetId fehlt');
        if(!BG_PRESETS.some(p => p.id === presetId)) return agentToolValidationError('background presetId ungueltig');
        bgApply({ type: 'preset', id: presetId });
        return { ok: true, presetId };
      }
      case 'toggle_background_rotation': {
        if(typeof args.enabled !== 'boolean') return agentToolValidationError('enabled muss boolean sein');
        bgUpdateState(state=>{ state.rotation.enabled = args.enabled; return state; });
        return { ok: true, enabled: !!args.enabled };
      }
      case 'toggle_widget': {
        const widgetId = asText(args.widgetId);
        if(!widgetId || !(widgetId in widgetDefaults())) return agentToolValidationError('widgetId ungueltig');
        if(typeof args.enabled !== 'boolean') return agentToolValidationError('enabled muss boolean sein');
        const enabled = toggleWidget(widgetId, args.enabled);
        return { ok: true, widgetId, enabled };
      }
      case 'show_all_widgets': {
        const all = {};
        Object.keys(widgetDefaults()).forEach(k => all[k] = true);
        store.set('widgets', all);
        applyWidgets();
        fillSettings();
        return { ok: true };
      }
      case 'hide_all_widgets': {
        const all = {};
        Object.keys(widgetDefaults()).forEach(k => all[k] = false);
        store.set('widgets', all);
        applyWidgets();
        fillSettings();
        return { ok: true };
      }
      case 'add_quicklink': {
        const title = asText(args.title);
        const group = asText(args.group);
        const url = validateHttpUrl(args.url);
        if(!title) return agentToolValidationError('title fehlt');
        if(!url) return agentToolValidationError('url muss http/https sein');
        const added = addQuicklinkToTiles(title, url, group);
        return { ok: true, item: added };
      }
      case 'remove_quicklink': {
        const title = asText(args.title);
        if(!title) return agentToolValidationError('title fehlt');
        const removed = removeQuicklinkFromTiles(title);
        if(!removed) return { ok: false, error: 'Kein passender Quicklink gefunden' };
        return { ok: true, title };
      }
      case 'add_todo': {
        const text = asText(args.text);
        if(!text) return agentToolValidationError('text fehlt');
        addTodo(text);
        return { ok: true, text };
      }
      case 'toggle_todo': {
        if(typeof args.done !== 'boolean') return agentToolValidationError('done muss boolean sein');
        const idx = findTodoIndex();
        if(idx === -2) return agentToolValidationError('index ausserhalb des Bereichs');
        if(idx === -3) return agentToolValidationError('index oder text fehlt');
        if(idx < 0) return { ok: false, error: 'Todo nicht gefunden' };
        const list = store.get('todos', []);
        list[idx].done = args.done;
        store.set('todos', list);
        renderTodos();
        return { ok: true, index: idx, done: args.done, text: list[idx].text };
      }
      case 'remove_todo': {
        const idx = findTodoIndex();
        if(idx === -2) return agentToolValidationError('index ausserhalb des Bereichs');
        if(idx === -3) return agentToolValidationError('index oder text fehlt');
        if(idx < 0) return { ok: false, error: 'Todo nicht gefunden' };
        const list = store.get('todos', []);
        const removed = list.splice(idx, 1)[0];
        store.set('todos', list);
        renderTodos();
        return { ok: true, index: idx, removed: removed ? removed.text : '' };
      }
      case 'clear_done_todos': {
        const before = store.get('todos', []);
        const next = before.filter(item => !item.done);
        store.set('todos', next);
        renderTodos();
        return { ok: true, removed: before.length - next.length };
      }
      case 'append_note': {
        const text = asText(args.text);
        if(!text) return agentToolValidationError('text fehlt');
        appendNote(text);
        return { ok: true, text };
      }
      case 'set_notes': {
        if(typeof args.text !== 'string') return agentToolValidationError('text muss string sein');
        store.set('notes', args.text);
        const area = $('#notesArea');
        if(area) area.value = args.text;
        return { ok: true, length: args.text.length };
      }
      case 'clear_notes': {
        store.set('notes', '');
        const area = $('#notesArea');
        if(area) area.value = '';
        return { ok: true };
      }
      case 'set_search_engine': {
        const engine = asText(args.engine);
        if(!(engine in ENGINES)) return agentToolValidationError('engine ungueltig');
        setSearchEngine(engine);
        return { ok: true, engine };
      }
      case 'set_locale': {
        const locale = asText(args.locale).toLowerCase();
        if(!locale) return agentToolValidationError('locale fehlt');
        if(locale === 'auto'){
          store.set('ui.locale', 'auto');
          const resolved = detectLocale(await loadLocaleList());
          await setLocale(resolved, { persist:false });
          fillSettings();
          return { ok: true, locale: 'auto', resolved };
        }
        await setLocale(locale, { persist:true });
        fillSettings();
        return { ok: true, locale };
      }
      case 'set_ui_font': {
        const font = normalizeUiFontFamily(args.font);
        if(!font) return agentToolValidationError('font fehlt');
        store.set(UI_FONT_KEY, font);
        applyUiFont(font);
        fillSettings();
        return { ok: true, font };
      }
      case 'set_engine_enabled': {
        const engine = asText(args.engine);
        if(!(engine in ENGINES)) return agentToolValidationError('engine ungueltig');
        if(typeof args.enabled !== 'boolean') return agentToolValidationError('enabled muss boolean sein');
        let enabled = store.get('engines.enabled', Object.keys(ENGINES));
        if(args.enabled){
          enabled = Array.from(new Set([engine, ...enabled]));
        } else {
          enabled = enabled.filter(key => key !== engine);
          if(!enabled.length) enabled = [engine];
        }
        store.set('engines.enabled', enabled);
        renderEngines();
        fillSettings();
        return { ok: true, engine, enabled: args.enabled, list: enabled };
      }
      case 'set_shortcuts': {
        const shortcuts = args.shortcuts;
        if(!shortcuts || typeof shortcuts !== 'object' || Array.isArray(shortcuts)) return agentToolValidationError('shortcuts muss Objekt sein');
        const out = {};
        for(const [k, v] of Object.entries(shortcuts)){
          const key = asText(k);
          const value = asText(v);
          if(!key.startsWith('!')) return agentToolValidationError('shortcut key muss mit ! beginnen');
          if(!value) return agentToolValidationError('shortcut value darf nicht leer sein');
          if(!/^https?:\/\//i.test(value)) return agentToolValidationError('shortcut value muss http/https sein');
          out[key] = value;
        }
        store.set('shortcuts', out);
        fillSettings();
        return { ok: true, count: Object.keys(out).length };
      }
      case 'set_custom_feeds': {
        const feeds = args.feeds;
        if(!feeds || typeof feeds !== 'object' || Array.isArray(feeds)) return agentToolValidationError('feeds muss Objekt sein');
        const out = {};
        for(const [nameRaw, urlRaw] of Object.entries(feeds)){
          const name = asText(nameRaw);
          const url = validateHttpUrl(urlRaw);
          if(!name) return agentToolValidationError('feed name fehlt');
          if(!url) return agentToolValidationError('feed url muss http/https sein');
          out[name] = url;
        }
        store.set('news.custom', out);
        fillNewsSources();
        await loadNews();
        fillSettings();
        return { ok: true, count: Object.keys(out).length };
      }
      case 'set_wordlist_inline': {
        const words = args.words;
        if(!Array.isArray(words)) return agentToolValidationError('words muss Array sein');
        const normalized = setInlineWordlist(words.map(w => asText(w)).filter(Boolean));
        updateSearchSuggest();
        fillSettings();
        return { ok: true, count: normalized.length };
      }
      case 'set_widget_color': {
        const widgetId = asText(args.widgetId);
        if(!widgetId || !(widgetId in widgetColorDefaults())) return agentToolValidationError('widgetId ungueltig');
        const colorRaw = asText(args.color);
        const color = colorRaw ? normalizeHex(colorRaw) : '';
        if(colorRaw && !color) return agentToolValidationError('color muss #RRGGBB oder leer sein');
        const colors = store.get('widget.colors', widgetColorDefaults());
        colors[widgetId] = color;
        store.set('widget.colors', colors);
        applyWidgetColors();
        fillSettings();
        return { ok: true, widgetId, color };
      }
      case 'set_surface_color': {
        const target = asText(args.target).toLowerCase();
        if(!['clock', 'search'].includes(target)) return agentToolValidationError('target muss clock/search sein');
        const colorRaw = asText(args.color);
        const color = colorRaw ? normalizeHex(colorRaw) : '';
        if(colorRaw && !color) return agentToolValidationError('color muss #RRGGBB oder leer sein');
        const key = target === 'clock' ? 'ui.clock.color' : 'ui.search.color';
        store.set(key, color);
        applySurfaceColors();
        fillSettings();
        return { ok: true, target, color };
      }
      case 'set_weather_cities': {
        const cities = Array.isArray(args.cities) ? args.cities.map(v => asText(v)).filter(Boolean) : [];
        if(!cities.length) return agentToolValidationError('cities muss nicht-leeres Array sein');
        const applied = applyWeatherCitiesFromInput(cities.join('\n'));
        if(!applied) return { ok: false, error: 'Wetter-Staedte konnten nicht gesetzt werden' };
        await loadWeather();
        fillSettings();
        return { ok: true, cities };
      }
      case 'set_transport_duration': {
        const minutes = Number(args.minutes);
        if(!Number.isFinite(minutes)) return agentToolValidationError('minutes muss Zahl sein');
        const duration = setTransportDuration(minutes);
        const select = $('#transportDuration');
        if(select) select.value = String(duration);
        await loadTransportDepartures();
        fillSettings();
        return { ok: true, duration };
      }
      case 'set_transport_default_name': {
        const name = asText(args.name);
        if(!name) return agentToolValidationError('name fehlt');
        store.set('transport.default', { name });
        store.set('transport.query', name);
        const input = $('#transportQuery'); if(input) input.value = name;
        fillSettings();
        return { ok: true, name };
      }
      case 'set_agent_enabled': {
        if(typeof args.enabled !== 'boolean') return agentToolValidationError('enabled muss boolean sein');
        store.set(AGENT_KEYS.enabled, args.enabled);
        applyAgentEnabledState();
        if(args.enabled) await refreshAgentRuntimeAvailability();
        fillSettings();
        syncAgentPanelUiState();
        return { ok: true, enabled: args.enabled };
      }
      case 'set_agent_host': {
        const host = normalizeAgentHost(args.host);
        if(!host) return agentToolValidationError('host ungueltig');
        store.set(AGENT_KEYS.host, host);
        const available = await refreshAgentRuntimeAvailability();
        fillSettings();
        syncAgentPanelUiState();
        return { ok: true, host, available };
      }
      case 'set_agent_confirm_mode': {
        const mode = Number(args.mode);
        if(!(mode === 0 || mode === 1 || mode === 2)) return agentToolValidationError('mode muss 0/1/2 sein');
        store.set(AGENT_KEYS.confirmMode, mode);
        fillSettings();
        syncAgentPanelUiState();
        return { ok: true, mode };
      }
      case 'set_agent_model': {
        const model = asText(args.model);
        if(!model) return agentToolValidationError('model fehlt');
        const list = Array.isArray(store.get(AGENT_KEYS.models, [])) ? store.get(AGENT_KEYS.models, []) : [];
        if(list.length && !list.includes(model)) return { ok: false, error: 'Modell nicht in geladener Liste' };
        store.set(AGENT_KEYS.model, model);
        const sel = $('#startpageAgentModel');
        if(sel) sel.value = model;
        updateAgentHostDisplay();
        fillSettings();
        return { ok: true, model };
      }
      case 'set_agent_custom_prompt': {
        if(typeof args.prompt !== 'string') return agentToolValidationError('prompt muss string sein');
        const prompt = String(args.prompt || '').trim();
        store.set(AGENT_KEYS.customPrompt, prompt);
        fillSettings();
        return { ok: true, length: prompt.length };
      }
      case 'set_agent_memory': {
        let nextObj = null;
        if(typeof args.text === 'string'){
          nextObj = parseAgentMemoryInput(args.text);
        } else if(args && typeof args.entries === 'object' && !Array.isArray(args.entries)){
          nextObj = normalizeAgentMemoryObject(args.entries);
        } else {
          return agentToolValidationError('text (string) oder entries (object) erforderlich');
        }
        const saved = setAgentMemoryObject(nextObj);
        fillSettings();
        return { ok: true, keys: Object.keys(saved).length, memory: saved };
      }
      case 'append_agent_memory': {
        const current = getAgentMemoryObject();
        const key = asText(args.key);
        const value = asText(args.value);
        if(key && value){
          current[key] = value;
        } else {
          const text = asText(args.text);
          if(!text) return agentToolValidationError('text oder key+value fehlt');
          const lineParsed = parseAgentMemoryInput(text);
          if(Object.keys(lineParsed).length){
            Object.assign(current, lineParsed);
          } else {
            const prevNotes = String(current._notes || '').trim();
            current._notes = prevNotes ? `${prevNotes}\n${text}` : text;
          }
        }
        const saved = setAgentMemoryObject(current);
        fillSettings();
        return { ok: true, keys: Object.keys(saved).length, memory: saved };
      }
      case 'clear_agent_memory': {
        setAgentMemoryObject({});
        fillSettings();
        return { ok: true };
      }
      case 'read_agent_memory': {
        const memory = getAgentMemoryObject();
        const customPrompt = getAgentCustomPrompt();
        return { ok: true, memory, memoryText: JSON.stringify(memory, null, 2), customPrompt };
      }
      case 'set_news_source': {
        const source = asText(args.source);
        const feeds = getFeeds();
        if(!source || !(source in feeds)) return agentToolValidationError('source ungueltig');
        store.set('news.source', source);
        fillNewsSources();
        await loadNews();
        return { ok: true, source };
      }
      case 'refresh_data': {
        const target = asText(args.target).toLowerCase() || 'all';
        if(!['weather', 'news', 'transport', 'system', 'quote', 'all'].includes(target)){
          return agentToolValidationError('target muss weather/news/transport/system/quote/all sein');
        }
        if(target === 'weather' || target === 'all') await loadWeather();
        if(target === 'news' || target === 'all') await loadNews();
        if(target === 'transport' || target === 'all') await loadTransportDepartures();
        if(target === 'system' || target === 'all') renderSystem();
        if(target === 'quote' || target === 'all') loadQuote();
        return { ok: true, target };
      }
      case 'read_widget_data': {
        const widgetId = asText(args.widgetId).toLowerCase();
        if(!widgetId) return agentToolValidationError('widgetId fehlt');
        const allowRefresh = !!args.refresh;
        if(allowRefresh){
          if(widgetId === 'weather') await loadWeather();
          if(widgetId === 'transport') await loadTransportDepartures();
          if(widgetId === 'news') await loadNews();
          if(widgetId === 'system') renderSystem();
          if(widgetId === 'quote') loadQuote();
        }
        const snapshot = readWidgetSnapshot(widgetId);
        if(!snapshot) return agentToolValidationError('widgetId ungueltig');
        return { ok: true, ...snapshot };
      }
      case 'read_all_widgets': {
        const allowRefresh = !!args.refresh;
        if(allowRefresh){
          await loadWeather();
          await loadTransportDepartures();
          await loadNews();
          renderSystem();
          loadQuote();
        }
        return { ok: true, widgets: readAllWidgetSnapshots() };
      }
      case 'read_weather_data': {
        if(args.refresh) await loadWeather();
        return { ok: true, widgetId: 'weather', data: readWeatherSnapshot() };
      }
      case 'read_transport_data': {
        if(args.refresh) await loadTransportDepartures();
        return { ok: true, widgetId: 'transport', data: readTransportSnapshot() };
      }
      case 'read_todo_data': {
        return { ok: true, widgetId: 'todo', data: readTodoSnapshot() };
      }
      case 'read_notes_data': {
        return { ok: true, widgetId: 'notes', data: readNotesSnapshot() };
      }
      case 'read_tiles_data': {
        return { ok: true, widgetId: 'tiles', data: readTilesSnapshot() };
      }
      case 'read_news_data': {
        if(args.refresh) await loadNews();
        return { ok: true, widgetId: 'news', data: readNewsSnapshot() };
      }
      case 'read_quote_data': {
        if(args.refresh) loadQuote();
        return { ok: true, widgetId: 'quote', data: readQuoteSnapshot() };
      }
      case 'read_recent_data': {
        return { ok: true, widgetId: 'recent', data: readRecentSnapshot() };
      }
      case 'read_system_data': {
        if(args.refresh) renderSystem();
        return { ok: true, widgetId: 'system', data: readSystemSnapshot() };
      }
      case 'set_weather_station_active': {
        const id = asText(args.id);
        const name = asText(args.name).toLowerCase();
        const entries = getWeatherEntries();
        const found = id
          ? entries.find(entry => entry.id === id)
          : entries.find(entry => String(entry.city || '').trim().toLowerCase() === name);
        if(!found) return { ok: false, error: 'Station nicht gefunden' };
        setWeatherState(entries, found.id);
        await loadWeather(found.id);
        return { ok: true, id: found.id, name: found.city };
      }
      case 'add_weather_station': {
        const name = asText(args.name);
        const lat = Number(args.lat);
        const lon = Number(args.lon);
        if(!name) return agentToolValidationError('name fehlt');
        if(!Number.isFinite(lat) || lat < -90 || lat > 90) return agentToolValidationError('lat muss zwischen -90 und 90 liegen');
        if(!Number.isFinite(lon) || lon < -180 || lon > 180) return agentToolValidationError('lon muss zwischen -180 und 180 liegen');
        const existing = getWeatherEntries();
        const found = existing.find(entry => entry.city.toLowerCase() === name.toLowerCase());
        const id = found ? found.id : weatherEntryIdFromCity(name);
        const entries = found ? existing : [...existing, { id, city: name }];
        const cache = getWeatherCoordsCache();
        cache[name.toLowerCase()] = { city: name, name: name, lat: lat, lon: lon, ts: Date.now() };
        store.set(WEATHER_COORDS_CACHE_KEY, cache);
        setWeatherState(entries, id);
        await loadWeather(id);
        fillSettings();
        return { ok: true, id, name, lat, lon };
      }
      case 'remove_weather_station': {
        const id = asText(args.id);
        const name = asText(args.name).toLowerCase();
        if(!id && !name) return agentToolValidationError('id oder name fehlt');
        const entries = getWeatherEntries();
        const next = entries.filter(entry => id ? entry.id !== id : String(entry.city || '').trim().toLowerCase() !== name);
        if(next.length === entries.length) return { ok: false, error: 'Station nicht gefunden' };
        const active = getWeatherActiveId(entries);
        const nextActive = next.some(entry => entry.id === active) ? active : (next[0] ? next[0].id : '');
        setWeatherState(next, nextActive);
        await loadWeather(nextActive);
        fillSettings();
        return { ok: true, removed: entries.length - next.length };
      }
      case 'set_weather_city': {
        const city = asText(args.city);
        if(!city) return agentToolValidationError('city fehlt');
        const entry = upsertWeatherEntry(city);
        await loadWeather(entry ? entry.id : undefined);
        fillSettings();
        return { ok: true, city, id: entry ? entry.id : '' };
      }
      default:
        return { ok: false, error: `Unbekanntes Tool: ${safeTool}` };
    }
  }

  async function agentMaybeConfirmTool(tool, args){
    const mode = getAgentConfirmMode();
    const risky = tool === 'open_url';
    const needsConfirm = mode === 1 || (mode === 2 && risky);
    if(!needsConfirm) return true;
    const pretty = JSON.stringify(args, null, 2);
    const message = t('agent.confirm.execute', { tool, args: pretty }, `Run tool?\n${tool}\n\n${pretty}`);
    return !!(await uiConfirm(message, t('agent.ui.title', null, 'Startpage Agent')));
  }

  function buildAgentModelMessages(){
    return [
      { role: 'system', content: buildAgentSystemPrompt() },
      ...getAgentHistory().map(msg => ({ role: msg.role, content: msg.content }))
    ];
  }

  async function sendAgentMessage(){
    if(!isAgentEnabled()){
      setAgentStatus(t('agent.status.disabled', null, 'Agent is disabled'));
      return;
    }
    if(agentState.busy) return;
    const input = $('#startpageAgentInput');
    if(!input) return;
    const text = String(input.value || '').trim();
    if(!text) return;
    const model = getAgentModel();
    if(!model){
      setAgentStatus(t('agent.status.chooseModel', null, 'Please select a model'));
      return;
    }
    appendAgentHistory({ role: 'user', content: text });
    renderAgentMessages(true);
    input.value = '';
    setAgentBusy(true);
    setAgentStatus(t('agent.status.streaming', null, 'Streaming...'));
    const maxIterations = getAgentMaxToolIterations();
    let iteration = 0;
    try {
      while(iteration < maxIterations){
        iteration += 1;
        const modelMessages = buildAgentModelMessages();
        agentState.abortController = new AbortController();
        agentState.streamingBuffer = '';
        agentState.streamingMessageEl = createAgentStreamingMessage();
        const answer = await ollamaChatStream(
          model,
          modelMessages,
          (_, fullText)=>{
            agentState.streamingBuffer = fullText;
            updateAgentStreamingMessage(fullText);
          },
          agentState.abortController.signal
        );
        const finalText = String(answer || agentState.streamingBuffer || '').trim();
        const toolCall = parseAgentToolCall(finalText);
        if(!toolCall){
          appendAgentHistory({ role: 'assistant', content: finalText || '...' });
          renderAgentMessages(false);
          setAgentStatus(t('agent.status.ready', null, 'Ready'));
          return;
        }
        appendAgentHistory({ role: 'assistant', content: finalText });
        const confirm = await agentMaybeConfirmTool(toolCall.tool, toolCall.args);
        if(!confirm){
          const denied = { ok: false, error: t('agent.errors.toolDeniedByUser', null, 'Tool execution denied by user') };
          appendAgentHistory({ role: 'user', content: `TOOL_RESULT ${toolCall.tool}: ${JSON.stringify(denied)}` });
          setAgentStatus(t('agent.status.toolDenied', null, 'Tool denied'));
          continue;
        }
        let result;
        try {
          setAgentStatus(t('agent.status.toolRunning', { tool: toolCall.tool }, `Tool: ${toolCall.tool}`));
          result = await runAgentTool(toolCall.tool, toolCall.args);
        } catch (err){
          result = { ok: false, error: err && err.message ? err.message : t('agent.errors.unknownToolError', null, 'Unknown tool error') };
        }
        appendAgentHistory({ role: 'user', content: `TOOL_RESULT ${toolCall.tool}: ${JSON.stringify(result)}` });
        setAgentStatus(result && result.ok
          ? t('agent.status.toolDone', { tool: toolCall.tool }, `Tool done: ${toolCall.tool}`)
          : t('agent.status.toolError', { tool: toolCall.tool }, `Tool error: ${toolCall.tool}`));
      }
      appendAgentHistory({ role: 'assistant', content: t('agent.messages.toolLimitReached', { max: maxIterations }, `I reached the tool limit for this message (max. ${maxIterations} steps).`) });
      renderAgentMessages(false);
      setAgentStatus(t('agent.status.toolLimitReached', null, 'Tool limit reached'));
    } catch (err){
      if(err && err.name === 'AbortError'){
        setAgentStatus(t('agent.status.aborted', null, 'Aborted'));
      } else {
        const msg = err && err.message ? err.message : t('agent.errors.unknown', null, 'Unknown');
        setAgentStatus(t('agent.status.error', { error: msg }, `Error: ${msg}`));
      }
      renderAgentMessages(false);
    } finally {
      agentState.abortController = null;
      agentState.streamingMessageEl = null;
      agentState.streamingBuffer = '';
      setAgentBusy(false);
    }
  }

  function stopAgentStreaming(){
    if(agentState.abortController){
      agentState.abortController.abort();
      agentState.abortController = null;
      setAgentStatus(t('agent.status.aborted', null, 'Aborted'));
    }
  }

  async function initStartpageAgent(){
    const els = getAgentElements();
    if(!els.fab || !els.panel) return;
    applyAgentEnabledState();
    await refreshAgentRuntimeAvailability();
    applyPersistedAgentAccent();
    syncAgentPanelUiState();
    renderAgentCapabilities();
    renderAgentMessages(true);
    setAgentBusy(false);
    if(!isAgentEnabled()){
      setAgentStatus(t('agent.status.disabled', null, 'Agent is disabled'));
    }
    const existingModels = store.get(AGENT_KEYS.models, []);
    renderAgentModels(existingModels);
    if(isAgentEnabled() && agentState.available && !getAgentModel()){
      try { await loadAgentModels(); } catch {}
    }
    els.fab.addEventListener('click', ()=>{
      const next = !store.get(AGENT_KEYS.panelOpen, false);
      store.set(AGENT_KEYS.panelOpen, next);
      syncAgentPanelUiState();
      if(next && els.input) els.input.focus();
    });
    if(els.close){
      els.close.addEventListener('click', ()=>{
        store.set(AGENT_KEYS.panelOpen, false);
        syncAgentPanelUiState();
      });
    }
    if(els.loadModels){
      els.loadModels.addEventListener('click', ()=>{ void loadAgentModels(); });
    }
    if(els.model){
      els.model.addEventListener('change', ()=>{
        store.set(AGENT_KEYS.model, String(els.model.value || '').trim());
      });
    }
    if(els.settingsToggle){
      els.settingsToggle.addEventListener('click', ()=>{
        openSettingsTab('ai');
      });
    }
    if(els.saveSettings){
      els.saveSettings.addEventListener('click', async ()=>{
        const hostRaw = els.hostInput ? els.hostInput.value : '';
        const host = normalizeAgentHost(hostRaw);
        if(!host){
          await uiAlert(
            t('agent.errors.invalidHost', null, 'Invalid host. Only http/https URLs are allowed.'),
            t('agent.ui.title', null, 'Startpage Agent')
          );
          return;
        }
        const mode = els.confirmMode ? String(els.confirmMode.value || '2') : '2';
        const safeMode = ['0', '1', '2'].includes(mode) ? Number(mode) : 2;
        const maxIterations = clampAgentMaxIterations(els.maxIterations ? els.maxIterations.value : AGENT_DEFAULT_MAX_TOOL_ITERATIONS);
        const customPrompt = els.customPrompt ? String(els.customPrompt.value || '').trim() : '';
        let memoryObj = {};
        if(els.memory){
          try{
            memoryObj = parseAgentMemoryInput(els.memory.value || '');
          }catch{
            await uiAlert(
              t('agent.errors.invalidMemory', null, 'Memory is invalid. Use JSON or "key: value" lines.'),
              t('agent.ui.title', null, 'Startpage Agent')
            );
            return;
          }
        }
        store.set(AGENT_KEYS.host, host);
        store.set(AGENT_KEYS.confirmMode, safeMode);
        store.set(AGENT_KEYS.maxIterations, maxIterations);
        store.set(AGENT_KEYS.customPrompt, customPrompt);
        setAgentMemoryObject(memoryObj);
        if(els.maxIterations) els.maxIterations.value = String(maxIterations);
        updateAgentHostDisplay();
        await refreshAgentRuntimeAvailability();
        if(els.memory) els.memory.value = getAgentMemoryText();
        setAgentStatus(t('agent.status.settingsSaved', null, 'Settings saved'));
      });
    }
    if(els.clearChat){
      els.clearChat.addEventListener('click', async ()=>{
        const ok = await uiConfirm(
          t('agent.confirm.clearChat', null, 'Clear chat history?'),
          t('agent.ui.title', null, 'Startpage Agent')
        );
        if(!ok) return;
        setAgentHistory([]);
        renderAgentMessages(true);
        setAgentStatus(t('agent.status.chatCleared', null, 'Chat cleared'));
      });
    }
    if(els.clearMemory){
      els.clearMemory.addEventListener('click', async ()=>{
        const ok = await uiConfirm(
          t('agent.confirm.clearMemory', null, 'Clear memory?'),
          t('agent.ui.title', null, 'Startpage Agent')
        );
        if(!ok) return;
        setAgentMemoryObject({});
        if(els.memory) els.memory.value = '';
        setAgentStatus(t('agent.status.memoryCleared', null, 'Memory cleared'));
      });
    }
    if(els.confirmMode){
      els.confirmMode.addEventListener('change', ()=>{
        const mode = Number(els.confirmMode.value);
        const safeMode = mode === 0 || mode === 1 || mode === 2 ? mode : 2;
        store.set(AGENT_KEYS.confirmMode, safeMode);
        setAgentStatus(t('agent.status.confirmSaved', null, 'Tool confirm saved'));
      });
    }
    if(els.maxIterations){
      els.maxIterations.addEventListener('change', ()=>{
        const next = clampAgentMaxIterations(els.maxIterations.value);
        els.maxIterations.value = String(next);
        store.set(AGENT_KEYS.maxIterations, next);
        setAgentStatus(t('agent.status.maxIterationsSaved', null, 'Loop limit saved'));
      });
    }
    const adjustIterations = delta=>{
      if(!els.maxIterations) return;
      const current = clampAgentMaxIterations(els.maxIterations.value || getAgentMaxToolIterations());
      const next = clampAgentMaxIterations(current + delta);
      els.maxIterations.value = String(next);
      store.set(AGENT_KEYS.maxIterations, next);
      setAgentStatus(t('agent.status.maxIterationsSaved', null, 'Loop limit saved'));
    };
    if(els.maxIterationsDec){
      els.maxIterationsDec.addEventListener('click', ()=> adjustIterations(-1));
    }
    if(els.maxIterationsInc){
      els.maxIterationsInc.addEventListener('click', ()=> adjustIterations(1));
    }
    if(els.send){
      els.send.addEventListener('click', ()=>{ void sendAgentMessage(); });
    }
    if(els.stop){
      els.stop.addEventListener('click', stopAgentStreaming);
    }
    if(els.input){
      els.input.addEventListener('keydown', e=>{
        if(e.key === 'Enter' && !e.shiftKey){
          e.preventDefault();
          void sendAgentMessage();
        }
      });
    }
    if(els.messages){
      els.messages.addEventListener('scroll', ()=>{
        agentState.lastScrollWasNearBottom = agentShouldAutoscroll(els.messages);
      });
    }
    document.addEventListener('pointerdown', e=>{
      const panel = $('#startpageAgentPanel');
      const fab = $('#startpageAgentFab');
      const target = e.target;
      agentState.pointerStartedInside = !!(
        (panel && panel.contains(target)) ||
        (fab && fab.contains(target)) ||
        (target && target.closest && target.closest('.ui-select-menu, .ui-color-menu, .ui-select, .ui-color'))
      );
    }, true);
    document.addEventListener('click', e=>{
      if(!store.get(AGENT_KEYS.panelOpen, false)) return;
      const panel = $('#startpageAgentPanel');
      const fab = $('#startpageAgentFab');
      if(!panel || !fab) return;
      const target = e.target;
      const active = document.activeElement;
      if(agentState.pointerStartedInside){
        agentState.pointerStartedInside = false;
        return;
      }
      if(panel.contains(target)) return;
      if(fab.contains(target)) return;
      if(active && panel.contains(active)) return;
      if(target && target.closest && target.closest('.ui-select-menu, .ui-color-menu, .ui-select, .ui-color')) return;
      store.set(AGENT_KEYS.panelOpen, false);
      syncAgentPanelUiState();
    });
    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape' && agentState.busy){
        e.preventDefault();
        e.stopPropagation();
        stopAgentStreaming();
      }
    }, true);
  }

