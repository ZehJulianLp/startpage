  // ===== Utilities
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };

  const I18N_DIR = 'assets/i18n/';
  const I18N_LOCALES = I18N_DIR + 'locales.json';
  const I18N_FALLBACK = 'en-us';
  let i18nCurrent = {};
  let i18nFallback = {};
  let i18nLocale = I18N_FALLBACK;
  let i18nAvailable = null;

  function normalizeLocale(value){
    if(!value) return '';
    return String(value).trim().toLowerCase().replace('_','-');
  }

  const I18N_INTL_ALIASES = {
    lolcat: 'en-US',
    pirate: 'en-US',
    yoda: 'en-US',
    leet: 'en-US',
    uwu: 'en-US'
  };

  const UI_FONT_KEY = 'ui.font.family';
  const UI_FONT_STACK = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"';
  const RECENT_MAX_KEY = 'recent.max';
  const RECENT_MAX_DEFAULT = 12;
  const RECENT_MAX_MIN = 0;
  const RECENT_MAX_LIMIT = 50;
  let uiFontListCache = null;
  let uiFontListLoading = null;
  let uiFontListSource = 'none';

  function localeToIntl(locale){
    const norm = normalizeLocale(locale);
    if(!norm) return undefined;
    if(I18N_INTL_ALIASES[norm]) return I18N_INTL_ALIASES[norm];
    const parts = norm.split('-');
    const candidate = (parts.length === 1) ? parts[0] : `${parts[0]}-${parts[1].toUpperCase()}`;
    try{
      const [canonical] = Intl.getCanonicalLocales(candidate);
      return canonical || undefined;
    }catch{
      return undefined;
    }
  }

  function getI18nValue(obj, key){
    if(!obj || !key) return undefined;
    const parts = String(key).split('.');
    let cur = obj;
    for(const part of parts){
      if(!cur || typeof cur !== 'object') return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function interpolate(str, vars){
    if(!vars || typeof str !== 'string') return str;
    return str.replace(/\{(\w+)\}/g, (m, k)=> (k in vars ? String(vars[k]) : m));
  }

  function tRaw(key){
    const primary = getI18nValue(i18nCurrent, key);
    if(primary !== undefined) return primary;
    return getI18nValue(i18nFallback, key);
  }

  function t(key, vars, fallback){
    const value = tRaw(key);
    const base = (typeof value === 'string') ? value : (typeof fallback === 'string' ? fallback : '');
    return interpolate(base, vars);
  }

  function normalizeUiFontFamily(value){
    const raw = String(value || '').trim();
    if(!raw) return '';
    return raw.replace(/[\\"]/g, '').trim();
  }

  function fontCssLiteral(name){
    const safe = normalizeUiFontFamily(name);
    if(!safe) return UI_FONT_STACK;
    return `"${safe.replace(/"/g, '\\"')}", ${UI_FONT_STACK}`;
  }

  function applyUiFont(name){
    const safe = normalizeUiFontFamily(name);
    if(!safe){
      document.documentElement.style.setProperty('--font-ui', UI_FONT_STACK);
      return;
    }
    document.documentElement.style.setProperty('--font-ui', fontCssLiteral(safe));
  }

  function detectInstalledFonts(candidates){
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if(!ctx) return [];
    const probeText = 'mmmmmmmmmmlliWWWW';
    const size = '72px';
    const bases = ['monospace', 'sans-serif', 'serif'];
    const baseWidths = {};
    bases.forEach(base=>{
      ctx.font = `${size} ${base}`;
      baseWidths[base] = ctx.measureText(probeText).width;
    });
    const installed = [];
    candidates.forEach(name=>{
      const test = normalizeUiFontFamily(name);
      if(!test) return;
      const hasFont = bases.some(base=>{
        ctx.font = `${size} "${test}", ${base}`;
        return ctx.measureText(probeText).width !== baseWidths[base];
      });
      if(hasFont) installed.push(test);
    });
    return Array.from(new Set(installed));
  }

  function getFallbackFontFamilies(){
    const bundledCandidates = ['Inter', 'SF Hollywood Hills'];
    const fallbackCandidates = [
      'Arial', 'Arial Nova', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Helvetica', 'Helvetica Neue',
      'Segoe UI', 'Segoe UI Variable', 'Calibri', 'Cambria', 'Candara', 'Corbel', 'Constantia',
      'Georgia', 'Times New Roman', 'Palatino', 'Garamond', 'Baskerville', 'Book Antiqua',
      'Aptos', 'Aptos Display', 'Aptos Narrow', 'Aptos Serif', 'Aptos Mono',
      'San Francisco', 'SF Pro Text', 'SF Pro Display', 'New York', 'Menlo', 'Monaco', 'Geneva',
      'Roboto', 'Noto Sans', 'Noto Serif', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Fira Code',
      'JetBrains Mono', 'Source Sans Pro', 'Source Serif Pro', 'Source Code Pro',
      'Comic Sans MS', 'Impact', 'Lucida Sans Unicode', 'Lucida Console', 'Courier New'
    ];
    return Array.from(new Set([
      ...bundledCandidates,
      ...detectInstalledFonts(fallbackCandidates)
    ]))
      .sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  async function loadLocalFontsInteractive(){
    if(!window.queryLocalFonts){
      await uiAlert(t('settings.font.unsupported'));
      return false;
    }
    try{
      const fonts = await window.queryLocalFonts();
      const families = Array.from(new Set([
        ...getFallbackFontFamilies(),
        ...(fonts || [])
          .map(font=> normalizeUiFontFamily(font && font.family))
          .filter(Boolean)
      ]))
        .sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
      if(!families.length){
        await uiAlert(t('settings.font.empty'));
        return false;
      }
      uiFontListCache = families;
      uiFontListSource = 'queryLocalFonts';
      renderFontSelectOptions(families);
      return true;
    }catch(err){
      const name = String(err && err.name || '');
      if(name === 'NotAllowedError' || name === 'SecurityError'){
        await uiAlert(t('settings.font.permissionDenied'));
      } else {
        await uiAlert(t('settings.font.loadFailed', { error: err && err.message ? err.message : 'unknown error' }, 'Could not load local fonts: {error}'));
      }
      return false;
    }
  }

  async function getSystemFontFamilies(options={}){
    const preferLocal = options.preferLocal !== false;
    const forceRefresh = !!options.forceRefresh;
    if(forceRefresh){
      uiFontListCache = null;
      uiFontListLoading = null;
      uiFontListSource = 'none';
    }
    if(uiFontListLoading) return uiFontListLoading;
    if(uiFontListCache && (!preferLocal || uiFontListSource === 'queryLocalFonts')) return uiFontListCache;
    uiFontListLoading = (async ()=>{
      const families = new Set();
      let loadedFromLocalApi = false;
      if(preferLocal && window.queryLocalFonts){
        try{
          const fonts = await window.queryLocalFonts();
          fonts.forEach(font=>{
            const name = normalizeUiFontFamily(font && font.family);
            if(name) families.add(name);
          });
          loadedFromLocalApi = families.size > 0;
        }catch(err){
          console.info('queryLocalFonts unavailable, fallback detection active', err);
        }
      }
      if(!families.size){
        getFallbackFontFamilies().forEach(name=> families.add(name));
      }
      ['Inter', 'SF Hollywood Hills'].forEach(name=> families.add(name));
      const sorted = Array.from(families).sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
      uiFontListCache = sorted;
      uiFontListSource = loadedFromLocalApi ? 'queryLocalFonts' : 'fallback';
      uiFontListLoading = null;
      return sorted;
    })();
    return uiFontListLoading;
  }

  function renderFontSelectOptions(fonts){
    const select = $('#fontSelect');
    if(!select) return;
    const selected = normalizeUiFontFamily(store.get(UI_FONT_KEY, ''));
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = t('settings.font.systemDefault');
    select.appendChild(defaultOption);
    if(!fonts.length){
      const emptyOption = document.createElement('option');
      emptyOption.value = '__none__';
      emptyOption.disabled = true;
      emptyOption.textContent = t('settings.font.noResults');
      select.appendChild(emptyOption);
    } else {
      fonts.forEach(font=>{
        const option = document.createElement('option');
        option.value = font;
        option.textContent = font;
        option.style.fontFamily = fontCssLiteral(font);
        select.appendChild(option);
      });
    }
    const canSelect = selected && Array.from(select.options).some(opt=> opt.value === selected);
    select.value = canSelect ? selected : '';
    refreshUiSelects(select.parentElement || document);
  }

  async function initFontSettings(options={}){
    const select = $('#fontSelect');
    if(!select) return;
    select.dataset.uiSearchable = '1';
    select.dataset.uiSearchPlaceholder = t('settings.font.searchPlaceholder', null, 'Search fonts...');
    if(!select.dataset.fontSelectBound){
      select.dataset.fontSelectBound = '1';
      select.addEventListener('change', ()=>{
        const family = normalizeUiFontFamily(select.value);
        store.set(UI_FONT_KEY, family);
        applyUiFont(family);
      });
    }
    const families = await getSystemFontFamilies(options);
    renderFontSelectOptions(families);
  }

  let uiActiveSelect = null;
  let uiActiveColor = null;
  let uiDialogResolve = null;
  let uiColorWheelCache = null;
  let settingsSearchQuery = '';
  let settingsSearchRestore = [];
  const UI_MENU_CLOSE_MS = 160;
  const UI_MODAL_CLOSE_MS = 110;

  function syncModalOpenState(){
    const anyOpen = $$('.modal.open, .modal.closing').length > 0;
    document.body.classList.toggle('modal-open', anyOpen);
  }

  function closeModalAnimated(modal, done){
    if(!modal){ if(done) done(); return; }
    if(modal.classList.contains('closing')) return;
    if(!modal.classList.contains('open')){
      modal.setAttribute('aria-hidden', 'true');
      syncModalOpenState();
      if(done) done();
      return;
    }
    modal.classList.remove('open');
    modal.classList.add('closing');
    syncModalOpenState();
    setTimeout(()=>{
      modal.classList.remove('closing');
      modal.setAttribute('aria-hidden', 'true');
      syncModalOpenState();
      if(done) done();
    }, UI_MODAL_CLOSE_MS);
  }

  function initAnimations(){
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.toggle('reduce-motion', !!reduce);
    if(reduce) return;
    const blocks = [
      ...$$('.time'),
      ...$$('.search'),
      ...$$('main.grid .card'),
      ...$$('footer')
    ];
    blocks.forEach((el, idx)=> el.style.setProperty('--anim-index', String(idx)));
    requestAnimationFrame(()=> document.body.classList.add('ui-animate'));
  }

  function initButtonMicroAnimations(){
    document.addEventListener('click', e=>{
      const btn = e.target && e.target.closest ? e.target.closest('.btn, .tile .actions button') : null;
      if(!btn) return;
      btn.classList.remove('btn-pop');
      // Restart animation each click.
      void btn.offsetWidth;
      btn.classList.add('btn-pop');
      setTimeout(()=> btn.classList.remove('btn-pop'), 260);
    });
  }

  function closeUiSelect(force=false){
    if(!uiActiveSelect) return;
    const host = uiActiveSelect;
    const select = host.__uiSelectSelect || null;
    const trigger = $('.ui-select-trigger', host);
    host.classList.remove('open');
    host.classList.add('closing');
    if(trigger) trigger.setAttribute('aria-expanded', 'false');
    if(select && select.__uiSelect) select.__uiSelect.searchQuery = '';
    setTimeout(()=> host.classList.remove('closing'), UI_MENU_CLOSE_MS);
    if(force && trigger) setTimeout(()=> trigger.focus({ preventScroll: true }), UI_MENU_CLOSE_MS);
    uiActiveSelect = null;
  }

  function openUiSelect(host){
    if(!host) return;
    if(uiActiveSelect && uiActiveSelect !== host) closeUiSelect();
    host.classList.add('open');
    const trigger = $('.ui-select-trigger', host);
    if(trigger) trigger.setAttribute('aria-expanded', 'true');
    uiActiveSelect = host;
    const search = $('.ui-select-search', host);
    if(search) setTimeout(()=> search.focus({ preventScroll: true }), 0);
  }

  function updateUiSelect(select){
    if(!select || !select.__uiSelect) return;
    const { host, trigger, valueEl, menu } = select.__uiSelect;
    if(!host || !trigger || !valueEl || !menu) return;
    const options = Array.from(select.options);
    const searchable = select.dataset.uiSearchable === '1';
    const rawQuery = String(select.__uiSelect.searchQuery || '');
    const needle = rawQuery.trim().toLowerCase();
    if(typeof select.__uiSelect.activeIndex !== 'number') select.__uiSelect.activeIndex = -1;
    const selected = options.find(o => o.value === select.value) || options[0] || null;
    valueEl.textContent = selected ? selected.textContent : '';
    trigger.disabled = !!select.disabled;
    menu.innerHTML = '';
    if(searchable){
      const wrap = document.createElement('div');
      wrap.className = 'ui-select-search-wrap';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ui-select-search';
      input.placeholder = select.dataset.uiSearchPlaceholder || t('settings.font.searchPlaceholder', null, 'Search...');
      input.value = rawQuery;
      input.addEventListener('input', ()=>{
        select.__uiSelect.searchQuery = input.value;
        select.__uiSelect.activeIndex = -1;
        updateUiSelect(select);
      });
      input.addEventListener('keydown', e=>{
        if(e.key === 'Escape'){ e.preventDefault(); closeUiSelect(true); return; }
        const navButtons = $$('.ui-select-option', menu).filter(btn=> !btn.disabled);
        if(e.key === 'ArrowDown'){
          e.preventDefault();
          if(!navButtons.length) return;
          const current = Math.max(-1, Number(select.__uiSelect.activeIndex) || -1);
          select.__uiSelect.activeIndex = Math.min(navButtons.length - 1, current + 1);
          navButtons.forEach((btn, i)=> btn.classList.toggle('active', i === select.__uiSelect.activeIndex));
          const active = navButtons[select.__uiSelect.activeIndex];
          if(active) active.scrollIntoView({ block: 'nearest' });
          return;
        }
        if(e.key === 'ArrowUp'){
          e.preventDefault();
          if(!navButtons.length) return;
          const current = Math.max(0, Number(select.__uiSelect.activeIndex) || 0);
          select.__uiSelect.activeIndex = Math.max(0, current - 1);
          navButtons.forEach((btn, i)=> btn.classList.toggle('active', i === select.__uiSelect.activeIndex));
          const active = navButtons[select.__uiSelect.activeIndex];
          if(active) active.scrollIntoView({ block: 'nearest' });
          return;
        }
        if(e.key === 'Enter'){
          if(!navButtons.length) return;
          e.preventDefault();
          const current = Number(select.__uiSelect.activeIndex);
          const idx = Number.isInteger(current) && current >= 0 ? current : 0;
          const active = navButtons[Math.min(idx, navButtons.length - 1)];
          if(active) active.click();
          return;
        }
        e.stopPropagation();
      });
      wrap.appendChild(input);
      menu.appendChild(wrap);
    }
    const list = searchable && needle
      ? options.filter(opt => String(opt.textContent || '').toLowerCase().includes(needle))
      : options;
    if(!list.length){
      const empty = document.createElement('div');
      empty.className = 'ui-select-empty';
      empty.textContent = t('common.noMatches');
      menu.appendChild(empty);
    }
    list.forEach((opt, idx)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-select-option';
      btn.textContent = opt.textContent;
      btn.dataset.value = opt.value;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', opt.value === select.value ? 'true' : 'false');
      if(opt.value === select.value) btn.classList.add('active');
      btn.disabled = !!opt.disabled;
      btn.addEventListener('click', ()=>{
        if(opt.disabled) return;
        if(select.value !== opt.value){
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          updateUiSelect(select);
        }
        closeUiSelect(true);
      });
      btn.addEventListener('mouseenter', ()=>{
        $$('.ui-select-option', menu).forEach(el=> el.classList.remove('active'));
        btn.classList.add('active');
        select.__uiSelect.activeIndex = Number(btn.dataset.index);
      });
      btn.dataset.index = String(idx);
      menu.appendChild(btn);
    });
    const enabledButtons = $$('.ui-select-option', menu).filter(btn=> !btn.disabled);
    if(enabledButtons.length){
      const current = Number(select.__uiSelect.activeIndex);
      const idx = Number.isInteger(current) ? Math.max(0, Math.min(enabledButtons.length - 1, current)) : -1;
      select.__uiSelect.activeIndex = idx;
      if(idx >= 0) enabledButtons.forEach((btn, i)=> btn.classList.toggle('active', i === idx));
    } else {
      select.__uiSelect.activeIndex = -1;
    }
    if(searchable && host.classList.contains('open')){
      const search = $('.ui-select-search', menu);
      if(search){
        const cursor = search.value.length;
        setTimeout(()=>{
          search.focus({ preventScroll: true });
          try{ search.setSelectionRange(cursor, cursor); }catch{}
        }, 0);
      }
    }
  }

  function enhanceUiSelect(select){
    if(!select || select.dataset.uiEnhanced === '1') return;
    select.dataset.uiEnhanced = '1';
    const host = document.createElement('div');
    host.className = 'ui-select';
    if(select.style.width) host.style.width = select.style.width;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ui-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const valueEl = document.createElement('span');
    valueEl.className = 'ui-select-value';
    const caret = document.createElement('span');
    caret.className = 'ui-select-caret';
    trigger.appendChild(valueEl);
    trigger.appendChild(caret);
    const menu = document.createElement('div');
    menu.className = 'ui-select-menu';
    menu.setAttribute('role', 'listbox');

    select.parentNode.insertBefore(host, select);
    host.appendChild(select);
    select.classList.add('native-select');
    select.style.width = '';
    host.appendChild(trigger);
    host.appendChild(menu);
    host.__uiSelectSelect = select;

    select.__uiSelect = { host, trigger, valueEl, menu, searchQuery: '' };
    updateUiSelect(select);

    const nav = (dir)=>{
      const options = Array.from(select.options).filter(o=> !o.disabled);
      if(!options.length) return;
      const current = options.findIndex(o => o.value === select.value);
      const nextIndex = Math.max(0, Math.min(options.length - 1, current + dir));
      const next = options[nextIndex];
      if(!next) return;
      if(select.value !== next.value){
        select.value = next.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        updateUiSelect(select);
      }
    };

    trigger.addEventListener('click', ()=>{
      if(host.classList.contains('open')) closeUiSelect();
      else openUiSelect(host);
    });
    trigger.addEventListener('keydown', e=>{
      if(e.key === 'ArrowDown'){ e.preventDefault(); if(!host.classList.contains('open')) openUiSelect(host); else nav(1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); if(!host.classList.contains('open')) openUiSelect(host); else nav(-1); }
      else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if(host.classList.contains('open')) closeUiSelect(); else openUiSelect(host); }
      else if(e.key === 'Escape'){ e.preventDefault(); closeUiSelect(true); }
    });
    select.addEventListener('change', ()=> updateUiSelect(select));
    select.addEventListener('input', ()=> updateUiSelect(select));
    const observer = new MutationObserver(()=> updateUiSelect(select));
    observer.observe(select, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['disabled','label','selected','value'] });
    select.__uiSelectObserver = observer;
  }

  function enhanceUiSelects(root=document){
    $$('select', root).forEach(select => enhanceUiSelect(select));
  }

  function refreshUiSelects(root=document){
    $$('select', root).forEach(select => updateUiSelect(select));
  }

  function closeUiColor(force=false){
    if(!uiActiveColor) return;
    const host = uiActiveColor;
    const trigger = $('.ui-color-trigger', host);
    host.classList.remove('open');
    host.classList.add('closing');
    setTimeout(()=> host.classList.remove('closing'), UI_MENU_CLOSE_MS);
    if(force && trigger) setTimeout(()=> trigger.focus({ preventScroll: true }), UI_MENU_CLOSE_MS);
    uiActiveColor = null;
  }

  function openUiColor(host){
    if(!host) return;
    if(uiActiveColor && uiActiveColor !== host) closeUiColor();
    host.classList.add('open');
    uiActiveColor = host;
    const input = $('.ui-color-hex', host);
    if(input){
      input.focus({ preventScroll: true });
      input.select();
    }
  }

  function rgbToHsv(r, g, b){
    const rn = Math.max(0, Math.min(255, Number(r || 0))) / 255;
    const gn = Math.max(0, Math.min(255, Number(g || 0))) / 255;
    const bn = Math.max(0, Math.min(255, Number(b || 0))) / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if(d){
      if(max === rn) h = ((gn - bn) / d) % 6;
      else if(max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if(h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }

  function hsvToRgb(h, s, v){
    const hue = ((Number(h || 0) % 360) + 360) % 360;
    const sat = Math.max(0, Math.min(1, Number(s || 0)));
    const val = Math.max(0, Math.min(1, Number(v || 0)));
    const c = val * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = val - c;
    let rp = 0, gp = 0, bp = 0;
    if(hue < 60){ rp = c; gp = x; bp = 0; }
    else if(hue < 120){ rp = x; gp = c; bp = 0; }
    else if(hue < 180){ rp = 0; gp = c; bp = x; }
    else if(hue < 240){ rp = 0; gp = x; bp = c; }
    else if(hue < 300){ rp = x; gp = 0; bp = c; }
    else { rp = c; gp = 0; bp = x; }
    return {
      r: Math.round((rp + m) * 255),
      g: Math.round((gp + m) * 255),
      b: Math.round((bp + m) * 255)
    };
  }

  function hsvToHex(h, s, v){
    const rgb = hsvToRgb(h, s, v);
    const toHex = n => n.toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function hexToHsv(hex){
    const normalized = normalizeHex(hex);
    if(!normalized) return null;
    const value = normalized.slice(1);
    const r = parseInt(value.slice(0,2), 16);
    const g = parseInt(value.slice(2,4), 16);
    const b = parseInt(value.slice(4,6), 16);
    return rgbToHsv(r, g, b);
  }

  function getColorWheelCanvas(size=190){
    const pxSize = Math.max(80, Number(size) || 190);
    if(uiColorWheelCache && uiColorWheelCache.size === pxSize) return uiColorWheelCache.canvas;
    const canvas = document.createElement('canvas');
    canvas.width = pxSize;
    canvas.height = pxSize;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(pxSize, pxSize);
    const data = image.data;
    const center = pxSize / 2;
    const radius = center - 1;
    for(let y=0; y<pxSize; y++){
      for(let x=0; x<pxSize; x++){
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const index = (y * pxSize + x) * 4;
        if(dist > radius){
          data[index+3] = 0;
          continue;
        }
        const sat = dist / radius;
        let hue = Math.atan2(dy, dx) * 180 / Math.PI;
        if(hue < 0) hue += 360;
        const rgb = hsvToRgb(hue, sat, 1);
        data[index] = rgb.r;
        data[index+1] = rgb.g;
        data[index+2] = rgb.b;
        data[index+3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    uiColorWheelCache = { size: pxSize, canvas };
    return canvas;
  }

  function enhanceUiColorInput(input){
    if(!input || input.dataset.uiColorEnhanced === '1') return;
    input.dataset.uiColorEnhanced = '1';
    const fallback = normalizeHex(input.dataset.colorDefault || '') || '#7c5cff';
    const host = document.createElement('div');
    host.className = 'ui-color';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ui-color-trigger';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const label = document.createElement('span');
    label.className = 'ui-color-label';
    trigger.appendChild(swatch);
    trigger.appendChild(label);

    const menu = document.createElement('div');
    menu.className = 'ui-color-menu';
    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'ui-color-wheel-wrap';
    const wheel = document.createElement('canvas');
    wheel.className = 'ui-color-wheel';
    wheel.width = 190;
    wheel.height = 190;
    wheelWrap.appendChild(wheel);
    const valueSlider = document.createElement('input');
    valueSlider.type = 'range';
    valueSlider.min = '0';
    valueSlider.max = '100';
    valueSlider.step = '1';
    valueSlider.className = 'ui-color-slider';
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'ui-color-hex';
    hexInput.placeholder = '#7c5cff';
    const actions = document.createElement('div');
    actions.className = 'ui-color-actions';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = t('settings.widgets.reset', null, 'Reset');
    const done = document.createElement('button');
    done.type = 'button';
    done.textContent = t('common.ok', null, 'OK');
    actions.appendChild(clear);
    actions.appendChild(done);
    menu.appendChild(wheelWrap);
    menu.appendChild(valueSlider);
    menu.appendChild(hexInput);
    menu.appendChild(actions);

    input.parentNode.insertBefore(host, input);
    host.appendChild(input);
    input.classList.add('native-color-input');
    host.appendChild(trigger);
    host.appendChild(menu);

    const state = { h: 0, s: 0, v: 1 };
    const widgetSelectorMap = {
      todo: '#todo',
      notes: '#notes',
      tiles: '#tilesCard',
      weather: '#weather',
      transport: '#transportCard',
      quote: '#quoteCard',
      recent: '#recent',
      system: '#systemCard',
      news: '#newsCard'
    };
    const readCssVar = name=>{
      const root = document.documentElement;
      const body = document.body;
      const bodyStyle = body ? getComputedStyle(body) : null;
      const rootStyle = root ? getComputedStyle(root) : null;
      return (bodyStyle && bodyStyle.getPropertyValue(name).trim()) || (rootStyle && rootStyle.getPropertyValue(name).trim()) || '';
    };
    const getDefaultSwatch = ()=>{
      if(input.id === 'accentColor') return normalizeHex(readCssVar('--accent')) || fallback;
      if(input.id === 'clockColor') return readCssVar('--clock-bg') || readCssVar('--card-bg-current') || fallback;
      if(input.id === 'searchColor') return readCssVar('--search-bg') || readCssVar('--card-bg-current') || fallback;
      if(input.id === 'modalColor') return readCssVar('--modal-bg') || readCssVar('--card') || fallback;
      if(input.id === 'buttonColor') return readCssVar('--button-bg') || readCssVar('--tile-bg-current') || fallback;
      if(input.id === 'inputColor') return readCssVar('--input-bg') || readCssVar('--bg-soft') || fallback;
      if(input.id && input.id.startsWith('widgetColor_')){
        const key = input.id.slice('widgetColor_'.length);
        const selector = widgetSelectorMap[key];
        const el = selector ? $(selector) : null;
        return (el && getComputedStyle(el).background) || readCssVar('--card-bg-current') || fallback;
      }
      return fallback;
    };
    const getDefaultLabel = ()=>{
      if(input.id === 'accentColor') return t('settings.widgets.colorAuto', null, 'Auto');
      return t('settings.widgets.colorStyleDefault', null, 'Style default');
    };

    const drawWheel = ()=>{
      const ctx = wheel.getContext('2d');
      const cache = getColorWheelCanvas(wheel.width);
      ctx.clearRect(0, 0, wheel.width, wheel.height);
      ctx.drawImage(cache, 0, 0, wheel.width, wheel.height);
      if(state.v < 1){
        ctx.fillStyle = `rgba(0,0,0,${1 - state.v})`;
        ctx.beginPath();
        ctx.arc(wheel.width/2, wheel.height/2, wheel.width/2, 0, Math.PI * 2);
        ctx.fill();
      }
      const rad = (wheel.width / 2) - 1;
      const ang = state.h * Math.PI / 180;
      const px = (wheel.width / 2) + Math.cos(ang) * state.s * rad;
      const py = (wheel.height / 2) + Math.sin(ang) * state.s * rad;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const render = ()=>{
      const activeHex = hsvToHex(state.h, state.s, state.v);
      const value = normalizeHex(input.value);
      swatch.style.background = value || getDefaultSwatch();
      label.textContent = value || getDefaultLabel();
      hexInput.value = value || '';
      valueSlider.value = String(Math.round(state.v * 100));
      drawWheel();
      if(value){
        swatch.style.background = activeHex;
      }
    };

    const syncFromInput = ()=>{
      const hsv = hexToHsv(normalizeHex(input.value) || fallback);
      if(hsv){
        state.h = hsv.h;
        state.s = hsv.s;
        state.v = hsv.v;
      }
      render();
    };

    const setValue = (next, emit=false)=>{
      const normalized = normalizeHex(next);
      input.value = normalized;
      const hsv = hexToHsv(normalized || fallback);
      if(hsv){
        state.h = hsv.h;
        state.s = hsv.s;
        state.v = hsv.v;
      }
      render();
      if(emit) input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    trigger.addEventListener('click', ()=>{
      if(host.classList.contains('open')) closeUiColor();
      else openUiColor(host);
    });
    clear.addEventListener('click', ()=>{
      setValue('', true);
      closeUiColor(true);
    });
    done.addEventListener('click', ()=> closeUiColor(true));
    const pickFromWheel = (event)=>{
      const rect = wheel.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const cx = wheel.width / 2;
      const cy = wheel.height / 2;
      const dx = x * (wheel.width / rect.width) - cx;
      const dy = y * (wheel.height / rect.height) - cy;
      const radius = (wheel.width / 2) - 1;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const sat = Math.max(0, Math.min(1, dist / radius));
      let hue = Math.atan2(dy, dx) * 180 / Math.PI;
      if(hue < 0) hue += 360;
      state.h = hue;
      state.s = sat;
      const hex = hsvToHex(state.h, state.s, state.v);
      input.value = normalizeHex(hex);
      render();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    wheel.addEventListener('pointerdown', event=>{
      pickFromWheel(event);
      const onMove = e=> pickFromWheel(e);
      const onUp = ()=>{
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    valueSlider.addEventListener('input', ()=>{
      state.v = Math.max(0, Math.min(1, Number(valueSlider.value) / 100));
      const hex = hsvToHex(state.h, state.s, state.v);
      input.value = normalizeHex(hex);
      render();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    hexInput.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){ e.preventDefault(); setValue(hexInput.value, true); closeUiColor(true); }
      if(e.key === 'Escape'){ e.preventDefault(); closeUiColor(true); }
    });
    hexInput.addEventListener('change', ()=> setValue(hexInput.value, true));
    input.addEventListener('input', syncFromInput);
    input.__uiColorSync = syncFromInput;
    const initial = hexToHsv(normalizeHex(input.value) || fallback) || { h: 0, s: 0, v: 1 };
    state.h = initial.h; state.s = initial.s; state.v = initial.v;
    render();
  }

  function enhanceUiColorInputs(root=document){
    $$('input[data-ui-color]', root).forEach(input => enhanceUiColorInput(input));
  }

  function closeUiDialog(result){
    const modal = $('#uiDialog');
    if(!modal || !modal.classList.contains('open')) return;
    const resolve = uiDialogResolve;
    uiDialogResolve = null;
    closeModalAnimated(modal, ()=>{ if(resolve) resolve(result); });
  }

  function openUiDialog(opts){
    const options = opts || {};
    const modal = $('#uiDialog');
    const title = $('#uiDialogTitle');
    const msg = $('#uiDialogMessage');
    const input = $('#uiDialogInput');
    const btnCancel = $('#uiDialogCancel');
    const btnOk = $('#uiDialogOk');
    if(!modal || !title || !msg || !input || !btnCancel || !btnOk){
      return Promise.resolve(options.kind === 'confirm' ? false : (options.kind === 'prompt' ? null : undefined));
    }
    if(uiDialogResolve) closeUiDialog(null);
    const kind = options.kind || 'alert';
    modal.dataset.kind = kind;
    title.textContent = options.title || t('dialogs.alertTitle', null, 'Hint');
    msg.textContent = String(options.message || '');
    input.value = typeof options.value === 'string' ? options.value : '';
    input.placeholder = options.placeholder || '';
    btnCancel.textContent = options.cancelText || t('common.cancel', null, 'Cancel');
    btnOk.textContent = options.okText || t('common.ok', null, 'OK');
    btnCancel.style.display = (kind === 'alert') ? 'none' : '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    syncModalOpenState();
    setTimeout(()=>{
      if(kind === 'prompt') input.focus();
      else btnOk.focus();
    }, 0);
    const onKey = (e)=>{
      if(!modal.classList.contains('open')) return;
      if(e.key === 'Escape'){
        e.preventDefault();
        e.stopImmediatePropagation();
        closeUiDialog(kind === 'alert' ? undefined : (kind === 'confirm' ? false : null));
      }
      if(e.key === 'Enter' && kind !== 'alert' && document.activeElement === input){
        e.preventDefault();
        e.stopImmediatePropagation();
        closeUiDialog(input.value);
      }
    };
    const onOverlay = (e)=>{
      if(e.target === modal){
        closeUiDialog(kind === 'alert' ? undefined : (kind === 'confirm' ? false : null));
      }
    };
    const cleanup = ()=>{
      modal.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      btnOk.onclick = null;
      btnCancel.onclick = null;
    };
    return new Promise(resolve=>{
      uiDialogResolve = (value)=>{
        cleanup();
        resolve(value);
      };
      btnOk.onclick = ()=>{
        if(kind === 'confirm') closeUiDialog(true);
        else if(kind === 'prompt') closeUiDialog(input.value);
        else closeUiDialog(undefined);
      };
      btnCancel.onclick = ()=> closeUiDialog(kind === 'confirm' ? false : null);
      modal.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);
    });
  }

  function uiAlert(message, title){
    return openUiDialog({ kind:'alert', title: title || t('dialogs.alertTitle', null, 'Hint'), message });
  }

  function uiConfirm(message, title){
    return openUiDialog({ kind:'confirm', title: title || t('dialogs.confirmTitle', null, 'Confirm'), message });
  }

  function uiPrompt(message, value, title){
    return openUiDialog({ kind:'prompt', title: title || t('dialogs.promptTitle', null, 'Input'), message, value: value || '' });
  }

  function uiToast(message, opts){
    const text = String(message || '').trim();
    if(!text) return null;
    const options = opts || {};
    const region = $('#toastRegion');
    if(!region) return null;
    const toast = document.createElement('div');
    const type = ['info','success','warning','error'].includes(options.type) ? options.type : 'info';
    const timeout = Number.isFinite(options.timeout) ? Math.max(1200, options.timeout) : 3600;
    toast.className = 'toast';
    toast.dataset.type = type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const body = document.createElement('div');
    body.className = 'toast-message';
    body.textContent = text;
    const close = document.createElement('button');
    close.className = 'btn icon-only toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', t('common.remove', null, 'Remove'));
    close.textContent = '×';
    toast.append(body, close);
    let timer = null;
    const remove = ()=>{
      if(!toast.isConnected) return;
      if(timer) clearTimeout(timer);
      toast.classList.add('closing');
      setTimeout(()=> toast.remove(), 130);
    };
    const startTimer = ()=>{ timer = setTimeout(remove, timeout); };
    close.addEventListener('click', remove);
    region.appendChild(toast);
    while(region.children.length > 4) region.firstElementChild.remove();
    startTimer();
    toast.addEventListener('mouseenter', ()=>{ if(timer) clearTimeout(timer); });
    toast.addEventListener('mouseleave', startTimer);
    return toast;
  }

  function openTileDialog(initial){
    const modal = $('#tileDialog');
    const title = $('#tileDialogTitle');
    const nameInput = $('#tileDialogName');
    const urlInput = $('#tileDialogUrl');
    const btnCancel = $('#tileDialogCancel');
    const btnSave = $('#tileDialogSave');
    if(!modal || !title || !nameInput || !urlInput || !btnCancel || !btnSave){
      return Promise.resolve(null);
    }
    const data = initial || { title:'', url:'' };
    title.textContent = data.mode === 'edit' ? t('tiles.edit') : t('tiles.add');
    nameInput.value = data.title || '';
    urlInput.value = data.url || '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    syncModalOpenState();
    setTimeout(()=> nameInput.focus(), 0);
    return new Promise(resolve=>{
      const close = (value)=>{
        cleanup();
        closeModalAnimated(modal, ()=> resolve(value));
      };
      const onOverlay = e=>{ if(e.target === modal) close(null); };
      const onKey = e=>{
        if(!modal.classList.contains('open')) return;
        if(e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); close(null); }
        if(e.key === 'Enter' && (document.activeElement === nameInput || document.activeElement === urlInput)){
          e.preventDefault();
          e.stopImmediatePropagation();
          close({ title: nameInput.value.trim(), url: urlInput.value.trim() });
        }
      };
      const cleanup = ()=>{
        modal.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKey);
        btnCancel.onclick = null;
        btnSave.onclick = null;
      };
      btnCancel.onclick = ()=> close(null);
      btnSave.onclick = ()=> close({ title: nameInput.value.trim(), url: urlInput.value.trim() });
      modal.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);
    });
  }

  async function loadLocaleList(){
    if(i18nAvailable) return i18nAvailable;
    try{
      const res = await fetch(I18N_LOCALES);
      if(!res.ok) throw new Error('locales.json missing');
      const data = await res.json();
      if(!Array.isArray(data)) throw new Error('locales.json not array');
      i18nAvailable = data.map(entry => ({
        id: normalizeLocale(entry.id || entry.locale || ''),
        label: entry.label || entry.name || entry.id
      })).filter(entry => entry.id);
    }catch(err){
      i18nAvailable = [
        { id:'en-us', label:'English (US)' },
        { id:'de-de', label:'Deutsch (DE)' }
      ];
    }
    return i18nAvailable;
  }

  function detectLocale(available){
    const list = Array.isArray(available) ? available : [];
    const ids = list.map(l => normalizeLocale(l.id));
    const candidates = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])
      .map(l => normalizeLocale(l));
    for(const cand of candidates){
      if(!cand) continue;
      if(ids.includes(cand)) return cand;
      const base = cand.split('-')[0];
      const match = ids.find(id => id === base || id.startsWith(base + '-'));
      if(match) return match;
    }
    return I18N_FALLBACK;
  }

  async function loadLocaleFile(locale){
    const loc = normalizeLocale(locale);
    if(!loc) return {};
    const res = await fetch(I18N_DIR + loc + '.json');
    if(!res.ok) throw new Error('locale file missing');
    return await res.json();
  }

  function applyI18n(root=document){
    $$('[data-i18n]', root).forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if(value) el.textContent = value;
    });
    $$('[data-i18n-html]', root).forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const value = t(key);
      if(value) el.innerHTML = value;
    });
    $$('[data-i18n-placeholder]', root).forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const value = t(key);
      if(value) el.setAttribute('placeholder', value);
    });
    $$('[data-i18n-title]', root).forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const value = t(key);
      if(value) el.setAttribute('title', value);
    });
    $$('[data-i18n-aria-label]', root).forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      const value = t(key);
      if(value) el.setAttribute('aria-label', value);
    });
    $$('[data-i18n-value]', root).forEach(el => {
      const key = el.getAttribute('data-i18n-value');
      const value = t(key);
      if(value) el.setAttribute('value', value);
    });
  }

  async function setLocale(nextLocale, opts={ persist:true, refresh:true }){
    const normalized = normalizeLocale(nextLocale) || I18N_FALLBACK;
    let data = {};
    try{
      data = await loadLocaleFile(normalized);
    }catch(err){
      if(normalized !== I18N_FALLBACK){
        return setLocale(I18N_FALLBACK, opts);
      }
    }
    i18nCurrent = data || {};
    i18nLocale = normalized;
    const intl = localeToIntl(normalized);
    if(intl) document.documentElement.setAttribute('lang', intl);
    document.title = t('app.title', null, document.title);
    if(opts && opts.persist === false) store.set('ui.locale', 'auto');
    else if(opts && opts.persist !== false) store.set('ui.locale', normalized);
    applyI18n();
    if(opts && opts.refresh !== false) refreshLocalizedUi();
  }

  async function initI18n(){
    i18nFallback = await loadLocaleFile(I18N_FALLBACK).catch(()=> ({}));
    const locales = await loadLocaleList();
    const stored = normalizeLocale(store.get('ui.locale', 'auto'));
    const resolved = stored && stored !== 'auto' ? stored : detectLocale(locales);
    await setLocale(resolved, { persist: stored !== 'auto', refresh: false });
    await renderLocaleSelect();
  }

  function getLocaleLang(){
    const loc = normalizeLocale(i18nLocale || I18N_FALLBACK);
    if(!loc) return 'en';
    return loc.split('-')[0] || 'en';
  }

  async function renderLocaleSelect(){
    const select = $('#localeSelect');
    if(!select) return;
    const locales = await loadLocaleList();
    select.innerHTML = '';
    const autoLabel = t('settings.language.auto', null, 'Auto (System)');
    const optAuto = document.createElement('option');
    optAuto.value = 'auto';
    optAuto.textContent = autoLabel;
    select.appendChild(optAuto);
    locales.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.label || loc.id;
      select.appendChild(opt);
    });
    const stored = normalizeLocale(store.get('ui.locale', 'auto')) || 'auto';
    select.value = stored;
    enhanceUiSelect(select);
    refreshUiSelects(select.parentElement || document);
    select.addEventListener('change', async e=>{
      const val = normalizeLocale(e.target.value);
      if(!val || val === 'auto'){
        store.set('ui.locale', 'auto');
        const resolved = detectLocale(await loadLocaleList());
        await setLocale(resolved, { persist:false });
        return;
      }
      await setLocale(val, { persist:true });
    });
  }

  function refreshLocalizedUi(){
    document.title = t('app.title', null, document.title);
    applyI18n();
    if($('#settingsModal')){
      rebuildSettingsPanels();
      fillSettings();
      selectSettingsTab(store.get('settings.tab','general'));
    }
    renderEngines();
    renderTodos();
    renderTiles();
    renderRecent();
    renderSystem();
    loadQuote();
    fillNewsSources();
    loadNews();
    loadWeather();
    loadTransportDepartures();
    updateAgentHostDisplay();
    renderAgentCapabilities();
    refreshUiSelects();
    const palette = $('#palette');
    if(palette && palette.classList.contains('open') && window.__closePalette){
      window.__closePalette();
      openPalette();
    }
  }

  function normalizeInlineWordlist(list){
    if(!Array.isArray(list)) return [];
    const cleaned = list.map(w => String(w || '').trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }

  const WEATHER_DEFAULT_CITY = 'Hannover';
  const WEATHER_ENTRIES_KEY = 'weather.entries';
  const WEATHER_ACTIVE_ID_KEY = 'weather.activeId';
  const WEATHER_COORDS_CACHE_KEY = 'weather.coordsCache';

  function weatherEntryIdFromCity(city){
    const base = String(city || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || `city-${Date.now().toString(36)}`;
  }

  function normalizeWeatherEntries(entries){
    if(!Array.isArray(entries)) return [];
    const seen = new Set();
    const out = [];
    entries.forEach((entry, idx)=>{
      if(!entry) return;
      const city = String(entry.city || '').trim();
      if(!city) return;
      let id = String(entry.id || '').trim() || weatherEntryIdFromCity(city);
      if(!id) id = `city-${idx + 1}`;
      if(seen.has(id)){
        let n = 2;
        while(seen.has(`${id}-${n}`)) n += 1;
        id = `${id}-${n}`;
      }
      seen.add(id);
      out.push({ id, city });
    });
    return out;
  }

  function getWeatherEntries(){
    const normalized = normalizeWeatherEntries(store.get(WEATHER_ENTRIES_KEY, []));
    if(normalized.length) return normalized;
    const legacyCity = String(store.get('weather.city', WEATHER_DEFAULT_CITY) || '').trim();
    return [{ id: weatherEntryIdFromCity(legacyCity || WEATHER_DEFAULT_CITY), city: legacyCity || WEATHER_DEFAULT_CITY }];
  }

  function getWeatherActiveId(entries=getWeatherEntries()){
    const current = String(store.get(WEATHER_ACTIVE_ID_KEY, '') || '').trim();
    if(current && entries.some(entry=> entry.id === current)) return current;
    return entries[0] ? entries[0].id : '';
  }

  function getWeatherActiveEntry(){
    const entries = getWeatherEntries();
    const activeId = getWeatherActiveId(entries);
    return entries.find(entry=> entry.id === activeId) || entries[0] || null;
  }

  function getWeatherCoordsCache(){
    const cache = store.get(WEATHER_COORDS_CACHE_KEY, {});
    return cache && typeof cache === 'object' ? cache : {};
  }

  function setWeatherState(entries, activeId){
    const normalized = normalizeWeatherEntries(entries);
    const safeEntries = normalized.length ? normalized : [{ id: weatherEntryIdFromCity(WEATHER_DEFAULT_CITY), city: WEATHER_DEFAULT_CITY }];
    const nextActive = safeEntries.some(entry=> entry.id === activeId) ? activeId : safeEntries[0].id;
    store.set(WEATHER_ENTRIES_KEY, safeEntries);
    store.set(WEATHER_ACTIVE_ID_KEY, nextActive);
    const activeEntry = safeEntries.find(entry=> entry.id === nextActive) || safeEntries[0];
    store.set('weather.city', activeEntry ? activeEntry.city : WEATHER_DEFAULT_CITY);
    return { entries: safeEntries, activeId: nextActive };
  }

  function ensureWeatherStorage(){
    const entries = normalizeWeatherEntries(store.get(WEATHER_ENTRIES_KEY, []));
    const activeId = String(store.get(WEATHER_ACTIVE_ID_KEY, '') || '').trim();
    const legacyCity = String(store.get('weather.city', WEATHER_DEFAULT_CITY) || '').trim();
    let nextEntries = entries;
    if(!nextEntries.length){
      nextEntries = [{ id: weatherEntryIdFromCity(legacyCity || WEATHER_DEFAULT_CITY), city: legacyCity || WEATHER_DEFAULT_CITY }];
    }
    let nextActive = activeId;
    if(!nextActive || !nextEntries.some(entry=> entry.id === nextActive)){
      nextActive = nextEntries[0].id;
    }
    const state = setWeatherState(nextEntries, nextActive);

    const legacyCoords = store.get('weather.coords', null);
    const cache = getWeatherCoordsCache();
    if(legacyCoords && typeof legacyCoords === 'object'){
      const key = String(legacyCoords.city || '').trim().toLowerCase();
      if(key){
        cache[key] = legacyCoords;
        store.set(WEATHER_COORDS_CACHE_KEY, cache);
      }
      localStorage.removeItem('weather.coords');
    } else if(!localStorage.getItem(WEATHER_COORDS_CACHE_KEY)){
      store.set(WEATHER_COORDS_CACHE_KEY, cache);
    }
    return state;
  }

  function parseWeatherCitiesInput(raw){
    const lines = String(raw || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    return Array.from(new Set(lines.map(city => city.toLowerCase())))
      .map(lower => lines.find(city => city.toLowerCase() === lower))
      .filter(Boolean);
  }

  function applyWeatherCitiesFromInput(raw){
    const cities = parseWeatherCitiesInput(raw);
    if(!cities.length) return false;
    const existing = getWeatherEntries();
    const active = getWeatherActiveEntry();
    const byCity = new Map(existing.map(entry => [entry.city.toLowerCase(), entry]));
    const entries = cities.map(city => {
      const found = byCity.get(city.toLowerCase());
      return { id: found ? found.id : weatherEntryIdFromCity(city), city };
    });
    const activeNext = active
      ? (entries.find(entry => entry.city.toLowerCase() === active.city.toLowerCase()) || entries[0])
      : entries[0];
    setWeatherState(entries, activeNext ? activeNext.id : '');
    return true;
  }

  const DATA_TRANSFER_SCOPE_ORDER = ['personal', 'appearance', 'configuration', 'agent', 'other'];
  const DATA_EXPORT_SCOPES = {
    personal: {
      labelKey: 'settings.data.exportScopes.personal',
      match: key => ['tiles','todos','notes','recent'].includes(key)
    },
    appearance: {
      labelKey: 'settings.data.exportScopes.appearance',
      match: key => key === 'theme' || key === 'bg.state' || key === 'widget.colors' || key.startsWith('ui.')
    },
    configuration: {
      labelKey: 'settings.data.exportScopes.configuration',
      match: key => (
        key === 'widgets' ||
        key.startsWith('layout.') ||
        key === 'shortcuts' ||
        key === 'wordlist.inline' ||
        key === 'engines.enabled' ||
        key === RECENT_MAX_KEY ||
        key.startsWith('search.') ||
        key.startsWith('weather.') ||
        key.startsWith('transport.') ||
        key.startsWith('news.') ||
        key.startsWith('onboarding.')
      )
    },
    agent: {
      labelKey: 'settings.data.exportScopes.agent',
      match: key => key.startsWith('ai.agent.')
    },
    other: {
      labelKey: 'settings.data.exportScopes.other',
      match: ()=> true
    }
  };

  function getDataScopeForKey(key){
    const known = DATA_TRANSFER_SCOPE_ORDER.filter(scope => scope !== 'other');
    return known.find(scope => DATA_EXPORT_SCOPES[scope].match(key)) || 'other';
  }

  function readLocalStorageData(scopes=DATA_TRANSFER_SCOPE_ORDER){
    const data = {};
    const allowed = new Set(scopes);
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k.startsWith('cache.')) continue;
      if(!allowed.has(getDataScopeForKey(k))) continue;
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); }
    }
    return data;
  }

  const PROFILE_ITEMS_KEY = 'profiles.items';
  const PROFILE_ACTIVE_KEY = 'profiles.activeId';

  function isProfileSystemKey(key){
    return key === PROFILE_ITEMS_KEY || key === PROFILE_ACTIVE_KEY;
  }

  function isProfileSnapshotExcludedKey(key){
    return isProfileSystemKey(key) || key === 'settings.tab' || key.startsWith('onboarding.');
  }

  function profileId(){
    return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeProfile(profile){
    if(!profile || typeof profile !== 'object') return null;
    const id = String(profile.id || '').trim() || profileId();
    const name = String(profile.name || '').trim() || t('profiles.defaultName', null, 'Profile');
    const data = profile.data && typeof profile.data === 'object' && !Array.isArray(profile.data) ? profile.data : {};
    return {
      id,
      name,
      data,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: profile.updatedAt || profile.createdAt || new Date().toISOString()
    };
  }

  function getProfiles(){
    const raw = store.get(PROFILE_ITEMS_KEY, []);
    return Array.isArray(raw) ? raw.map(normalizeProfile).filter(Boolean) : [];
  }

  function setProfiles(profiles){
    store.set(PROFILE_ITEMS_KEY, profiles.map(normalizeProfile).filter(Boolean));
  }

  function getActiveProfileId(){
    return String(store.get(PROFILE_ACTIVE_KEY, '') || '');
  }

  function getProfileSnapshot(){
    const profileScopes = DATA_TRANSFER_SCOPE_ORDER.filter(scope => scope !== 'other');
    const snapshot = readLocalStorageData(profileScopes);
    Object.keys(snapshot).forEach(key=>{
      if(isProfileSnapshotExcludedKey(key)) delete snapshot[key];
    });
    return snapshot;
  }

  function getProfileSummary(profile){
    return groupDataKeys(profile && profile.data ? profile.data : {});
  }

  function setActiveProfile(profileIdValue){
    store.set(PROFILE_ACTIVE_KEY, profileIdValue || '');
  }

  function saveProfile(profile){
    const normalized = normalizeProfile(profile);
    if(!normalized) return null;
    const profiles = getProfiles();
    const index = profiles.findIndex(item => item.id === normalized.id);
    if(index >= 0) profiles[index] = normalized;
    else profiles.push(normalized);
    setProfiles(profiles);
    return normalized;
  }

  async function createProfile(){
    const name = await uiPrompt(t('profiles.promptName', null, 'Profile name'), '', t('profiles.create', null, 'Create profile'));
    const clean = String(name || '').trim();
    if(!clean) return;
    const now = new Date().toISOString();
    const profile = saveProfile({
      id: profileId(),
      name: clean,
      data: getProfileSnapshot(),
      createdAt: now,
      updatedAt: now
    });
    if(profile) setActiveProfile(profile.id);
    renderProfiles();
    uiToast(t('profiles.created', { name: clean }, 'Profile "{name}" created.'), { type: 'success' });
  }

  async function renameProfile(id){
    const profiles = getProfiles();
    const profile = profiles.find(item => item.id === id);
    if(!profile) return;
    const name = await uiPrompt(t('profiles.promptName', null, 'Profile name'), profile.name, t('profiles.rename', null, 'Rename'));
    const clean = String(name || '').trim();
    if(!clean) return;
    profile.name = clean;
    profile.updatedAt = new Date().toISOString();
    saveProfile(profile);
    renderProfiles();
    uiToast(t('profiles.renamed', { name: clean }, 'Profile renamed to "{name}".'), { type: 'success' });
  }

  async function updateProfile(id){
    const profiles = getProfiles();
    const profile = profiles.find(item => item.id === id);
    if(!profile) return;
    if(!(await uiConfirm(t('profiles.confirmUpdate', { name: profile.name }, 'Update "{name}" with the current Startpage state?')))) return;
    profile.data = getProfileSnapshot();
    profile.updatedAt = new Date().toISOString();
    saveProfile(profile);
    renderProfiles();
    uiToast(t('profiles.updated', { name: profile.name }, 'Profile "{name}" updated.'), { type: 'success' });
  }

  async function deleteProfile(id){
    const profiles = getProfiles();
    const profile = profiles.find(item => item.id === id);
    if(!profile) return;
    if(!(await uiConfirm(t('profiles.confirmDelete', { name: profile.name }, 'Delete profile "{name}"?')))) return;
    setProfiles(profiles.filter(item => item.id !== id));
    if(getActiveProfileId() === id) setActiveProfile('');
    renderProfiles();
    uiToast(t('profiles.deleted', { name: profile.name }, 'Profile "{name}" deleted.'), { type: 'success' });
  }

  async function applyProfile(id){
    const profile = getProfiles().find(item => item.id === id);
    if(!profile){
      renderProfileQuickSwitcher();
      return false;
    }
    if(!(await uiConfirm(t('profiles.confirmApply', { name: profile.name }, 'Use profile "{name}"? Current Startpage data will be replaced.')))){
      renderProfileQuickSwitcher();
      return false;
    }
    const data = profile.data || {};
    getImportReplaceRemovalKeys(data, DATA_TRANSFER_SCOPE_ORDER)
      .filter(key => !isProfileSnapshotExcludedKey(key))
      .forEach(key => localStorage.removeItem(key));
    Object.keys(data).forEach(key=>{
      if(!isProfileSnapshotExcludedKey(key)) localStorage.setItem(key, JSON.stringify(data[key]));
    });
    setActiveProfile(profile.id);
    ensureWeatherStorage();
    location.reload();
    return true;
  }

  function formatProfileDate(value){
    if(!value) return '';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return '';
    try{
      return new Intl.DateTimeFormat(localeToIntl(i18nLocale) || undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }catch{
      return date.toLocaleString();
    }
  }

  function renderProfiles(){
    const list = $('#profilesList');
    const status = $('#profilesStatus');
    renderProfileQuickSwitcher();
    if(!list) return;
    const profiles = getProfiles();
    const activeId = getActiveProfileId();
    list.innerHTML = '';
    if(status){
      const active = profiles.find(profile => profile.id === activeId);
      status.textContent = active
        ? t('profiles.activeStatus', { name: active.name }, 'Active: {name}')
        : t('profiles.noneActive', null, 'No active profile');
    }
    if(!profiles.length){
      const empty = document.createElement('div');
      empty.className = 'profile-empty muted';
      empty.textContent = t('profiles.empty', null, 'No profiles yet.');
      list.appendChild(empty);
      return;
    }
    profiles.forEach(profile=>{
      const summary = getProfileSummary(profile);
      const total = Object.values(summary).reduce((sum, count)=> sum + count, 0);
      const card = document.createElement('div');
      card.className = 'profile-card' + (profile.id === activeId ? ' active' : '');
      const updated = formatProfileDate(profile.updatedAt);
      card.innerHTML = `
        <div class="profile-main">
          <div class="profile-title">${escapeHtml(profile.name)}</div>
          <div class="profile-meta">${escapeHtml(t('profiles.meta', { count: total, updated: updated || t('common.emptyDash') }, '{count} entries · {updated}'))}</div>
        </div>
        <div class="profile-actions">
          <button class="btn" type="button" data-profile-action="apply" data-profile-id="${escapeAttr(profile.id)}">${escapeHtml(t('profiles.use', null, 'Use'))}</button>
          <button class="btn" type="button" data-profile-action="update" data-profile-id="${escapeAttr(profile.id)}">${escapeHtml(t('profiles.update', null, 'Update'))}</button>
          <button class="btn" type="button" data-profile-action="rename" data-profile-id="${escapeAttr(profile.id)}">${escapeHtml(t('profiles.rename', null, 'Rename'))}</button>
          <button class="btn" type="button" data-profile-action="delete" data-profile-id="${escapeAttr(profile.id)}">${escapeHtml(t('common.delete', null, 'Delete'))}</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  function renderProfileQuickSwitcher(){
    const wrap = $('#profileSwitcher');
    const select = $('#profileQuickSwitch');
    if(!wrap || !select) return;
    const profiles = getProfiles();
    select.innerHTML = '';
    if(!profiles.length){
      wrap.hidden = true;
      refreshUiSelects(wrap);
      return;
    }
    const activeId = getActiveProfileId();
    const selectedId = profiles.some(profile => profile.id === activeId) ? activeId : profiles[0].id;
    profiles.forEach(profile=>{
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      select.appendChild(option);
    });
    select.value = selectedId;
    wrap.hidden = false;
    refreshUiSelects(wrap);
  }

  async function onProfileActionClick(event){
    const actionEl = event.target.closest('[data-profile-action]');
    if(!actionEl) return;
    const action = actionEl.getAttribute('data-profile-action');
    const id = actionEl.getAttribute('data-profile-id') || '';
    if(action === 'create') await createProfile();
    else if(action === 'apply') await applyProfile(id);
    else if(action === 'update') await updateProfile(id);
    else if(action === 'rename') await renameProfile(id);
    else if(action === 'delete') await deleteProfile(id);
  }

  function groupDataKeys(obj){
    const counts = {};
    DATA_TRANSFER_SCOPE_ORDER.forEach(scope => { counts[scope] = 0; });
    Object.keys(obj || {}).forEach(key => {
      const scope = getDataScopeForKey(key);
      counts[scope] = (counts[scope] || 0) + 1;
    });
    return counts;
  }

  function getSelectedDataTransferScopes(container){
    return $$('input[type="checkbox"][data-scope]', container)
      .filter(input => input.checked && !input.disabled)
      .map(input => input.getAttribute('data-scope'))
      .filter(scope => DATA_TRANSFER_SCOPE_ORDER.includes(scope));
  }

  function setDataTransferDialogMode(mode){
    const modeWrap = $('#dataTransferMode');
    const apply = $('#dataTransferApply');
    if(modeWrap) modeWrap.classList.toggle('hidden', mode !== 'import');
    if(apply) apply.textContent = mode === 'export' ? t('settings.data.exportAction', null, 'Export') : t('settings.data.importAction', null, 'Import');
  }

  function renderDataTransferOptions(counts, selectedScopes){
    const wrap = $('#dataTransferOptions');
    if(!wrap) return;
    wrap.innerHTML = '';
    const selected = new Set(selectedScopes || DATA_TRANSFER_SCOPE_ORDER);
    DATA_TRANSFER_SCOPE_ORDER.forEach(scope=>{
      const count = counts[scope] || 0;
      const label = document.createElement('label');
      label.className = 'data-transfer-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.scope = scope;
      input.checked = selected.has(scope) && count > 0;
      input.disabled = count === 0;
      const text = document.createElement('span');
      text.textContent = t(DATA_EXPORT_SCOPES[scope].labelKey);
      const meta = document.createElement('span');
      meta.className = 'muted';
      meta.textContent = t('settings.data.scopeCount', { count }, '{count} entries');
      label.append(input, text, meta);
      wrap.appendChild(label);
    });
  }

  function openDataTransferDialog(options){
    const modal = $('#dataTransferDialog');
    const title = $('#dataTransferTitle');
    const message = $('#dataTransferMessage');
    const optionsWrap = $('#dataTransferOptions');
    const modeSelect = $('#dataTransferImportMode');
    const cancel = $('#dataTransferCancel');
    const apply = $('#dataTransferApply');
    if(!modal || !title || !message || !optionsWrap || !cancel || !apply){
      return Promise.resolve(null);
    }
    const mode = options && options.mode === 'import' ? 'import' : 'export';
    title.textContent = options.title || '';
    message.textContent = options.message || '';
    if(modeSelect) modeSelect.value = 'merge';
    renderDataTransferOptions(options.counts || {}, options.selectedScopes);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    syncModalOpenState();
    applyI18n(modal);
    setDataTransferDialogMode(mode);
    refreshUiSelects(modal);
    return new Promise(resolve=>{
      const cleanup = result=>{
        cancel.removeEventListener('click', onCancel);
        apply.removeEventListener('click', onApply);
        modal.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKey);
        closeModalAnimated(modal, ()=> resolve(result));
      };
      const onCancel = ()=> cleanup(null);
      const onApply = async ()=>{
        const scopes = getSelectedDataTransferScopes(optionsWrap);
        if(!scopes.length){
          await uiAlert(t('data.transfer.noneSelected', null, 'Select at least one category.'));
          return;
        }
        cleanup({
          scopes,
          importMode: modeSelect && modeSelect.value === 'replace' ? 'replace' : 'merge'
        });
      };
      const onOverlay = e=>{ if(e.target === modal) cleanup(null); };
      const onKey = e=>{
        if(!modal.classList.contains('open')) return;
        if(e.key === 'Escape'){
          e.preventDefault();
          cleanup(null);
        }
      };
      cancel.addEventListener('click', onCancel);
      apply.addEventListener('click', onApply);
      modal.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);
    });
  }

  async function exportData(){
    const allData = readLocalStorageData(DATA_TRANSFER_SCOPE_ORDER);
    const choice = await openDataTransferDialog({
      mode: 'export',
      title: t('data.export.title', null, 'Export data'),
      message: t('data.export.message', null, 'Choose what should be included in the JSON export.'),
      counts: groupDataKeys(allData)
    });
    if(!choice) return;
    const data = readLocalStorageData(choice.scopes);
    const keys = Object.keys(data);
    if(!keys.length){
      void uiAlert(t('data.export.empty', null, 'Nothing to export for this scope.'));
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    const d = new Date();
    const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    a.href = URL.createObjectURL(blob);
    const scopeSlug = choice.scopes.length === DATA_TRANSFER_SCOPE_ORDER.length ? 'all' : choice.scopes.join('-');
    a.download = `startpage-backup-${scopeSlug}-${ts}.json`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
    const preview = $('#dataImportPreview');
    if(preview) preview.textContent = t('data.export.done', { count: keys.length }, 'Exported {count} entries.');
    uiToast(t('data.export.done', { count: keys.length }, 'Exported {count} entries.'), { type: 'success' });
  }

  function normalizeImportedDataPayload(raw){
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid JSON');
    if(raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data;
    return raw;
  }

  function normalizeImportedDataObject(obj){
    const out = {};
    Object.keys(obj).forEach(k=>{
      if(!k || k === '__startpageBackup') return;
      out[k] = obj[k];
    });
    if(!('wordlist.inline' in out)) out['wordlist.inline'] = [];
    out['wordlist.inline'] = normalizeInlineWordlist(out['wordlist.inline']);
    return out;
  }

  function isStartpageDataKey(key){
    if(!key) return false;
    if(key === 'settings.tab' || key === UI_FONT_KEY || key === 'bg.url' || key === 'weather.coords') return true;
    if(key === 'search.searxng.enabledMigration.v1') return true;
    return Object.keys(DATA_EXPORT_SCOPES)
      .filter(scope => scope !== 'other')
      .some(scope => DATA_EXPORT_SCOPES[scope].match(key));
  }

  function getImportReplaceRemovalKeys(obj, scopes){
    const importKeys = new Set(Object.keys(obj));
    const allowed = new Set(scopes || DATA_TRANSFER_SCOPE_ORDER);
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      const scope = getDataScopeForKey(key);
      if(importKeys.has(key) || (allowed.has(scope) && isStartpageDataKey(key))) keys.push(key);
    }
    return keys;
  }

  function filterDataByScopes(obj, scopes){
    const allowed = new Set(scopes || DATA_TRANSFER_SCOPE_ORDER);
    const out = {};
    Object.keys(obj || {}).forEach(key=>{
      if(allowed.has(getDataScopeForKey(key))) out[key] = obj[key];
    });
    return out;
  }

  function summarizeImportData(obj, mode, scopes){
    const keys = Object.keys(obj);
    const existing = keys.filter(k => localStorage.getItem(k) !== null).length;
    const added = keys.length - existing;
    const removeKeys = mode === 'replace' ? getImportReplaceRemovalKeys(obj, scopes) : [];
    const removed = removeKeys.filter(k => !Object.prototype.hasOwnProperty.call(obj, k)).length;
    return { keys: keys.length, existing, added, removed };
  }
  function importDataFromFile(ev){
    const file = ev.target.files && ev.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importData = normalizeImportedDataObject(normalizeImportedDataPayload(parsed));
        const choice = await openDataTransferDialog({
          mode: 'import',
          title: t('data.import.title', null, 'Import data'),
          message: t('data.import.message', { file: file.name }, 'Choose what should be imported from {file}.'),
          counts: groupDataKeys(importData)
        });
        if(!choice) return;
        const obj = filterDataByScopes(importData, choice.scopes);
        const mode = choice.importMode;
        const summary = summarizeImportData(obj, mode, choice.scopes);
        const preview = $('#dataImportPreview');
        if(preview){
          preview.textContent = t('data.import.preview', summary, '{keys} entries: {existing} existing, {added} new.');
        }
        const confirmKey = mode === 'replace' ? 'data.import.confirmReplace' : 'data.import.confirmMerge';
        if(!(await uiConfirm(t(confirmKey, summary, t('data.import.confirm'))))) return;
        if(mode === 'replace') getImportReplaceRemovalKeys(obj, choice.scopes).forEach(k => localStorage.removeItem(k));
        Object.keys(obj).forEach(k=> localStorage.setItem(k, JSON.stringify(obj[k])));
        ensureWeatherStorage();
        location.reload();
      } catch(err){ await uiAlert(t('data.import.failed', { error: err.message }, 'Import failed: {error}')); }
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

  function getPresetDescription(preset){
    if(!preset) return '';
    const fallback = preset.description || (preset.source === 'user' ? t('data.presets.userApply') : t('data.presets.apply'));
    return preset.descriptionKey ? t(preset.descriptionKey, null, fallback) : fallback;
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
          name: human || t('data.presets.userDefault', { index: idx+1 }),
          description: t('data.presets.userDescription', null, 'Local preset from assets/user-presets/'),
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
    if(!current){ await uiAlert(t('data.presets.none')); return; }
    if(!current.file){ await uiAlert(t('data.presets.missingFile')); return; }
    try{
      const res = await fetch(current.file);
      if(!res.ok) throw new Error(t('data.presets.fileMissing'));
      const obj = await res.json();
      if(!obj || typeof obj !== 'object') throw new Error(t('data.presets.invalid'));
      if(!('wordlist.inline' in obj)) obj['wordlist.inline'] = [];
      obj['wordlist.inline'] = normalizeInlineWordlist(obj['wordlist.inline']);
      const name = current.name || current.id || t('data.presets.label');
      const context = contextLabel || t('data.presets.label');
      if(!(await uiConfirm(t('data.presets.confirmApply', { context, name })))) return;
      Object.keys(obj).forEach(k=> localStorage.setItem(k, JSON.stringify(obj[k])));
      ensureWeatherStorage();
      if(opts.markDone) store.set('onboarding.done', true);
      if(opts.reload !== false) location.reload();
    }catch(err){
      await uiAlert(t('data.presets.loadFailed', { error: err.message }, 'Preset load failed: {error}'));
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
    meta.textContent = t('data.presets.loading');
    const presets = await loadDataPresets();
    if(!presets.length){
      const opt = document.createElement('option'); opt.value=''; opt.textContent=t('data.presets.noneFound');
      select.appendChild(opt);
      meta.textContent = t('data.presets.hint');
      refreshUiSelects(select.parentElement || document);
      return;
    }
    presets.forEach((p,i)=>{
      const opt = document.createElement('option');
      opt.value = p.id || 'preset-' + i;
      const label = p.name || p.id || t('data.presets.defaultLabel', { index: i+1 });
      const prefix = p.source === 'user' && !/^user:/i.test(String(label).trim()) ? t('data.presets.userPrefix') : '';
      opt.textContent = prefix + label;
      select.appendChild(opt);
    });
    select.disabled = false;
    if(btn) btn.disabled = false;
    refreshUiSelects(select.parentElement || document);
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
      const tagText = tags.length ? t('data.presets.tags', { tags: tags.join(', ') }) : '';
      const description = getPresetDescription(current);
      meta.textContent = description + tagText;
      select.value = current.id || select.value;
    } else {
      meta.textContent = t('data.presets.noneSelected');
    }
  }

  async function applyDataPreset(){
    const select = $('#dataPresetSelect');
    if(!select) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    await applyPresetFromEntry(current, t('data.presets.label'));
  }

  function prettyDate(d=new Date()) {
    const fmt = new Intl.DateTimeFormat(localeToIntl(i18nLocale) || undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    return fmt.format(d);
  }

  function openUrl(url, title){
    const safeUrl = normalizeHttpUrl(url);
    if(!safeUrl) return;
    const label = title || t('common.link', null, 'Link');
    addRecent({ title: label, url: safeUrl });
    window.location.href = safeUrl;
  }
