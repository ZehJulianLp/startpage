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
  let uiFontListCache = null;
  let uiFontListLoading = null;
  let uiFontListSource = 'none';

  function localeToIntl(locale){
    const norm = normalizeLocale(locale);
    if(!norm) return undefined;
    if(I18N_INTL_ALIASES[norm]) return I18N_INTL_ALIASES[norm];
    const parts = norm.split('-');
    if(parts.length === 1) return parts[0];
    return `${parts[0]}-${parts[1].toUpperCase()}`;
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
    return detectInstalledFonts(fallbackCandidates)
      .sort((a,b)=> a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  async function loadLocalFontsInteractive(){
    if(!window.queryLocalFonts){
      await uiAlert(t('settings.font.unsupported'));
      return false;
    }
    try{
      const fonts = await window.queryLocalFonts();
      const families = Array.from(new Set((fonts || [])
        .map(font=> normalizeUiFontFamily(font && font.family))
        .filter(Boolean)))
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
      swatch.style.background = value || fallback;
      label.textContent = value || t('common.default', null, 'Default');
      hexInput.value = value || '';
      valueSlider.value = String(Math.round(state.v * 100));
      drawWheel();
      if(!value){
        swatch.style.background = fallback;
      } else {
        swatch.style.background = activeHex;
      }
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
    input.addEventListener('input', render);
    input.__uiColorSync = render;
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
    reader.onload = async () => {
      try {
        const obj = JSON.parse(reader.result);
        if(!obj || typeof obj !== 'object') throw new Error('Invalid JSON');
        if(!(await uiConfirm(t('data.import.confirm')))) return;
        if(!('wordlist.inline' in obj)) obj['wordlist.inline'] = [];
        obj['wordlist.inline'] = normalizeInlineWordlist(obj['wordlist.inline']);
        Object.keys(obj).forEach(k=> localStorage.setItem(k, JSON.stringify(obj[k])));
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
      const description = current.description || (current.source === 'user' ? t('data.presets.userApply') : t('data.presets.apply'));
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
    const label = title || t('common.link', null, 'Link');
    addRecent({ title: label, url });
    window.location.href = url;
  }

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
    bgOnThemeChange();
  }

  // ===== Search with engines + bangs + custom shortcuts
  const ENGINES = {
    google: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    ddg: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    bing: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    yt: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    wikipedia: q => `https://${getLocaleLang()}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
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
      const el = document.createElement('div');
      el.className='tile';
      el.draggable = true;
      const host = (new URL(tile.url)).hostname;
      const firstLetter = host.split('.')[0][0]?.toUpperCase() || '·';
      el.innerHTML = `
        <div class="favicon"><img alt="favicon" src="https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(tile.url)}"></div>
        <div class="meta">
          <a href="#" class="title">${escapeHtml(tile.title)}</a>
          <div class="url">${escapeHtml(host)}</div>
        </div>
        <div class="actions">
          <button class="icon-only" title="${escapeHtml(t('tiles.edit'))}" aria-label="${escapeHtml(t('tiles.edit'))}">${iconSvg('edit')}</button>
          <button class="icon-only" title="${escapeHtml(t('common.delete'))}" aria-label="${escapeHtml(t('common.delete'))}">${iconSvg('trash')}</button>
        </div>`;

      // Fallback, wenn Favicon nicht lädt → Buchstabe zeigen
      const img = el.querySelector('.favicon img');
      img.addEventListener('error', ()=>{ const fv=el.querySelector('.favicon'); fv.textContent=firstLetter; img.remove(); });

      el.querySelector('.title').addEventListener('click', (e)=>{ e.preventDefault(); openUrl(tile.url, tile.title); });
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
    try { new URL(next.url) } catch { await uiAlert(t('tiles.invalidUrl')); return; }
    data[index] = { ...tile, title: next.title, url: next.url };
    store.set('tiles', data); renderTiles();
  }

  async function addTile(){
    const next = await openTileDialog({ mode:'add', title:'', url:'' });
    if(!next) return;
    if(!next.title || !next.url) return;
    try { new URL(next.url) } catch { await uiAlert(t('tiles.invalidUrl')); return; }
    const data = store.get('tiles', defaultTiles());
    data.unshift({ title: next.title, url: next.url });
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
    const cached = store.get('weather.coords', null);
    const fresh = 1000*60*60*12; // 12h cache
    if(cached && cached.city === name && (Date.now() - cached.ts) < fresh) return cached;
    const loc = await lookupCity(name);
    const payload = { ...loc, city: name, ts: Date.now() };
    store.set('weather.coords', payload);
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
    textEl.textContent = city ? t('weather.loading') : t('weather.prompt');
    tempEl.textContent = t('weather.tempEmpty', null, '—°C');
    minmaxEl.textContent = t('weather.minmaxEmpty', null, '— / — °C');
    hourlyEl.innerHTML = '';
    updateWeatherIcon(null);
    if(!city) return;

    try {
      const loc = await resolveCity(city);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,weathercode&current_weather=true&timezone=auto&daily=temperature_2m_max,temperature_2m_min&forecast_days=1`;
      const res = await fetch(url);
      if(!res.ok) throw new Error(t('weather.errors.fetchFailed'));
      const data = await res.json();
      const offset = Number(data.utc_offset_seconds) || 0;
      const curr = data.current_weather || {};
      updateWeatherIcon(curr.weathercode);
      const t = Math.round(curr.temperature ?? NaN);
      tempEl.textContent = isFinite(t) ? `${t}°C` : t('weather.tempEmpty', null, '—°C');
      textEl.textContent = `${loc.name} · ${wmoText(curr.weathercode)}`;
      const dmax = Math.round((data.daily?.temperature_2m_max?.[0]) ?? NaN);
      const dmin = Math.round((data.daily?.temperature_2m_min?.[0]) ?? NaN);
      minmaxEl.textContent = isFinite(dmin)&&isFinite(dmax) ? `${dmin} / ${dmax} °C` : t('weather.minmaxEmpty', null, '— / — °C');

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
        chip.innerHTML = `<div class="chip-top"><span>${timeLabel}</span><span class="chip-temp">${isFinite(tempVal)? tempVal+'°' : t('weather.tempEmptyShort', null, '—°')}</span></div><div class="chip-text">${wmoText(codes[i])}</div>`;
        container.appendChild(chip);
        added++;
        if(added>=8) break;
      }
      if(!added) container.innerHTML = `<div class="muted">${escapeHtml(t('weather.noForecast'))}</div>`;
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
      textEl.textContent = err.message === t('weather.errors.cityMissing') ? t('weather.prompt') : t('weather.errors.loadFailed');
      tempEl.textContent = t('weather.tempEmpty', null, '—°C');
      minmaxEl.textContent = t('weather.minmaxEmpty', null, '— / — °C');
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
    const feedUrl = sources[sourceName];
    $('#newsList').innerHTML = `<li class="muted">${escapeHtml(t('common.loading'))}</li>`;
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
      if(!ul.children.length){ ul.innerHTML = `<li class="muted">${escapeHtml(t('news.noItems'))}</li>`; }
    }catch(e){ $('#newsList').innerHTML = `<li class="muted">${escapeHtml(t('common.loadError'))}</li>`; }
  }

  // ===== Settings UI
  function openSettings(){
    const modal = $('#settingsModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    syncModalOpenState();
    rebuildSettingsPanels();
    fillSettings();
    bgRenderSettings();
    initSettingsTabs();
    const last = store.get('settings.tab','general');
    selectSettingsTab(last);
    enhanceUiSelects(modal);
    enhanceUiColorInputs(modal);
    refreshUiSelects(modal);
  }
  function closeSettings(){
    const modal = $('#settingsModal');
    closeModalAnimated(modal);
  }
  function fillSettings(){
    const theme = store.get('theme','auto');
    $('#themeSelect').value = theme;
    void initFontSettings({ preferLocal: false });
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
        const label = t(`search.engine.${key}`, null, key);
        pill.className='btn';
        pill.innerHTML = `${escapeHtml(label)} <span aria-hidden="true">${on ? iconSvg('check') : iconSvg('x')}</span>`;
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
        label.appendChild(cb); label.appendChild(document.createTextNode(t(`widgets.${k}`, null, k)));
        wrap.appendChild(label);
      });

    // Widget colors editor
    const editor = $('#widgetColorEditor'); editor.innerHTML='';
      const names = { todo:t('widgets.todo'), notes:t('widgets.notes'), tiles:t('widgets.tiles'), weather:t('widgets.weather'), transport:t('widgets.transport'), quote:t('widgets.quote'), recent:t('widgets.recent'), system:t('widgets.system'), news:t('widgets.news') };
      const colors = store.get('widget.colors', widgetColorDefaults());
      Object.keys(names).forEach(k=>{
        const box = document.createElement('div'); box.style.display='inline-flex'; box.style.alignItems='center'; box.style.gap='6px'; box.style.padding='6px 8px'; box.style.background='var(--glass)'; box.style.border='1px solid rgba(255,255,255,.08)'; box.style.borderRadius='10px';
        const label = document.createElement('span'); label.textContent = names[k];
        const input = document.createElement('input');
        input.type = 'text';
        input.value = (colors[k] && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colors[k])) ? colors[k] : '';
        input.setAttribute('data-ui-color', '');
        input.setAttribute('data-color-default', '#7c5cff');
        input.addEventListener('input', ()=>{ const cur = store.get('widget.colors', widgetColorDefaults()); cur[k]=normalizeHex(input.value); store.set('widget.colors', cur); applyWidgetColors(); });
        const clear = document.createElement('button'); clear.className='btn'; clear.textContent = t('settings.widgets.reset');
        clear.addEventListener('click', ()=>{ const cur = store.get('widget.colors', widgetColorDefaults()); cur[k]=''; store.set('widget.colors', cur); applyWidgetColors(); fillSettings(); });
        box.appendChild(label); box.appendChild(input); box.appendChild(clear);
        editor.appendChild(box);
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
    enhanceUiColorInputs(editor);
    enhanceUiSelects($('#settingsModal'));
    refreshUiSelects($('#settingsModal'));
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
    panelGuide.innerHTML = t('settings.guideHtml');

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
      opt.value = k; opt.textContent = t(`search.engine.${k}`, null, ({google:'Google',ddg:'DuckDuckGo',bing:'Bing',yt:'YouTube',wikipedia:'Wikipedia',maps:'Google Maps'})[k]||k);
      select.appendChild(opt);
    });
    if(enabled.includes(current)) select.value = current; else select.value = enabled[0];
    refreshUiSelects(select.parentElement || document);
  }

  // ===== Onboarding
  async function onboardingRenderPresets(){
    const select = $('#onbPresetSelect');
    const meta = $('#onbPresetMeta');
    if(!select || !meta) return;
    select.innerHTML = '';
    meta.textContent = t('data.presets.loading');
    const presets = await loadDataPresets();
    if(!presets.length){
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('data.presets.noneFound');
      select.appendChild(opt);
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
    });
    const current = presets[0];
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
      meta.textContent = current.description || t('onboarding.preset.meta');
    } else {
      meta.textContent = t('onboarding.preset.optional');
    }
  }

  async function onboardingApplyPreset(){
    const select = $('#onbPresetSelect');
    if(!select) return;
    const presets = await loadDataPresets();
    const current = presets.find(p => String(p.id||'') === select.value) || presets[0];
    await applyPresetFromEntry(current, t('onboarding.preset.context'), { reload:false, markDone:false });
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
    syncModalOpenState();
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
        subtitle: t('background.subtitle.preset'),
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
        title: t('background.custom.title'),
        subtitle: t('background.custom.subtitle'),
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
    if(title) title.textContent = resolved ? resolved.title : t('background.none');
    const meta = document.getElementById('bgCurrentMeta');
    if(meta){
      const parts = [];
      if(resolved){
        if(resolved.subtitle) parts.push(resolved.subtitle);
        if(resolved.meta) parts.push(resolved.meta);
        if(resolved.credit) parts.push(resolved.credit);
      }
      meta.textContent = parts.length ? parts.join(' | ') : t('background.noImageSelected');
    }
    const undoBtn = document.getElementById('bgActionUndo');
    if(undoBtn) undoBtn.disabled = !(state.history && state.history.length);
    const lockBtn = document.getElementById('bgActionLock');
    if(lockBtn){
      lockBtn.textContent = state.rotation && state.rotation.locked ? t('background.rotationResume') : t('background.rotationLock');
      lockBtn.dataset.locked = state.rotation && state.rotation.locked ? 'true' : 'false';
    }
  }

  function bgRenderPresets(state){
    const panel = document.getElementById('bgPanel-presets');
    if(!panel) return;
      if(!BG_PRESETS.length){
        panel.innerHTML = `<div class="bg-empty">${escapeHtml(t('background.presets.empty'))}</div>`;
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
        if(p.tone) metaParts.push(t('background.tone', { tone: p.tone }));
        const meta = metaParts.join(' | ');
        return '<div class="bg-card' + (isActive ? ' highlight' : '') + '" data-ref="' + key + '">' +
          '<div class="bg-thumb" style="' + bgCssBg(p.url) + '"></div>' +
          '<div class="bg-card-title">' + escapeHtml(p.label) + '</div>' +
          '<div class="bg-card-meta">' + (meta ? escapeHtml(meta) : '') + '</div>' +
          '<div class="bg-card-actions">' +
            '<button type="button" data-action="bg-apply" data-ref="' + key + '"' + (isActive ? ' data-active="true"' : '') + '>' + escapeHtml(t('background.actions.apply')) + '</button>' +
            '<button type="button" data-action="bg-favorite" data-ref="' + key + '">' + escapeHtml(isFav ? t('background.actions.favorited') : t('background.actions.favorite')) + '</button>' +
          '</div>' +
        '</div>';
      }).join('');
    panel.innerHTML = '<div class="bg-grid">' + cards + '</div>';
  }

  function bgRenderFavorites(state){
    const panel = document.getElementById('bgPanel-favorites');
    if(!panel) return;
      if(!state.favorites.length){
        panel.innerHTML = `<div class="bg-empty">${escapeHtml(t('background.favorites.empty'))}</div>`;
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
            '<button type="button" data-action="bg-apply" data-ref="' + key + '"' + (isActive ? ' data-active="true"' : '') + '>' + escapeHtml(t('background.actions.apply')) + '</button>' +
            '<button type="button" data-action="bg-favorite-remove" data-ref="' + key + '">' + escapeHtml(t('common.remove')) + '</button>' +
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
          '<div class="bg-card-title">' + escapeHtml(upload.name || t('background.upload')) + '</div>' +
          '<div class="bg-card-meta">' + escapeHtml(size) + '</div>' +
          '<div class="bg-card-actions">' +
            '<button type="button" data-action="bg-apply" data-ref="' + key + '"' + (isActive ? ' data-active="true"' : '') + '>' + escapeHtml(t('background.actions.apply')) + '</button>' +
            '<button type="button" data-action="bg-favorite" data-ref="' + key + '">' + escapeHtml(t('background.actions.favorite')) + '</button>' +
            '<button type="button" data-action="bg-delete-upload" data-upload="' + upload.id + '">' + escapeHtml(t('common.remove')) + '</button>' +
          '</div>' +
        '</div>';
      }).join('');
      panel.innerHTML =
        '<div class="bg-upload-drop" id="bgUploadDrop">' +
          '<div>' + escapeHtml(t('background.uploadDrop')) + '</div>' +
          '<button type="button" data-action="bg-upload-browse">' + escapeHtml(t('background.uploadBrowse')) + '</button>' +
          '<input type="file" id="bgUploadInput" multiple accept="image/*" hidden>' +
          '<div class="bg-upload-note">' + escapeHtml(t('background.uploadNote', { max: BG_MAX_UPLOADS })) + '</div>' +
        '</div>' +
        (state.uploads && state.uploads.length ? '<div class="bg-grid">' + list + '</div>' : '<div class="bg-empty">' + escapeHtml(t('background.uploads.empty')) + '</div>');
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
              '<div class="bg-collection-count">' + escapeHtml(t('background.collections.count', { count })) + '</div>' +
            '</div>' +
            '<div class="bg-collection-actions">' +
              '<button type="button" data-action="bg-collection-apply" data-collection="' + col.id + '">' + escapeHtml(t('background.collections.random')) + '</button>' +
              '<button type="button" data-action="bg-collection-cache" data-collection="' + col.id + '">' + escapeHtml(t('background.collections.cache')) + '</button>' +
              '<button type="button" data-action="bg-collection-remove" data-collection="' + col.id + '">' + escapeHtml(t('common.remove')) + '</button>' +
            '</div>' +
          '</div>' +
          (previewUrl ? '<div class="bg-thumb" style="' + bgCssBg(previewUrl) + '"></div>' : '') +
          '<details>' +
            '<summary>' + escapeHtml(t('background.collections.viewSources')) + '</summary>' +
            '<ul>' + col.urls.map(u => '<li><code>' + escapeHtml(u) + '</code></li>').join('') + '</ul>' +
            '<label style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;">' +
              '<input type="checkbox" data-action="bg-collection-rotation" data-collection="' + col.id + '"' + (col.allowRotation !== false ? ' checked' : '') + '> ' + escapeHtml(t('background.collections.useRotation')) +
            '</label>' +
          '</details>' +
        '</div>';
    }).join('');
    panel.innerHTML =
      '<div class="bg-selector">' +
        '<label for="bgCollectionName">' + escapeHtml(t('background.collections.newLabel')) + '</label>' +
        '<input id="bgCollectionName" type="text" placeholder="' + escapeHtml(t('background.collections.namePlaceholder')) + '">' +
        '<textarea id="bgCollectionUrls" rows="4" placeholder="' + escapeHtml(t('background.collections.urlsPlaceholder')) + '"></textarea>' +
        '<div class="bg-inline-actions">' +
          '<button type="button" data-action="bg-collection-save">' + escapeHtml(t('common.save')) + '</button>' +
          '<button type="button" data-action="bg-collection-clear">' + escapeHtml(t('background.collections.clear')) + '</button>' +
        '</div>' +
        '<p class="bg-mini-text">' + escapeHtml(t('background.collections.note')) + '</p>' +
      '</div>' +
      (cards ? '<div class="bg-collection-list">' + cards + '</div>' : '<div class="bg-empty">' + escapeHtml(t('background.collections.empty')) + '</div>');
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
    BG_PRESETS.forEach(p => add(t('background.rotation.optionPreset', { label: p.label }), { type: 'preset', id: p.id }));
    (state.uploads || []).forEach(u => add(t('background.rotation.optionUpload', { label: (u.name || u.id) }), { type: 'upload', id: u.id }));
    (state.favorites || []).forEach(f => {
      const resolved = bgResolveRef(state, f);
      add(t('background.rotation.optionFavorite', { label: (resolved ? resolved.title : bgRefKey(f)) }), f);
    });
    if(state.customUrl) add(t('background.rotation.optionCustom'), { type: 'custom', url: state.customUrl });
    return options;
  }

  function bgRenderRotation(state){
      const panel = document.getElementById('bgPanel-rotation');
      if(!panel) return;
      const options = bgBuildRotationOptions(state);
      const schedule = state.rotation.schedule || {};
      const buildSelect = slot => {
        const selected = schedule[slot] ? bgRefKey(schedule[slot]) : '';
        const opts = ['<option value="">' + escapeHtml(t('background.rotation.noFixed')) + '</option>']
          .concat(options.map(opt => '<option value="' + opt.value + '"' + (opt.value === selected ? ' selected' : '') + '>' + escapeHtml(opt.label) + '</option>'))
          .join('');
        return '<select data-action="bg-rotation-slot" data-slot="' + slot + '">' + opts + '</select>';
      };
      const sources = state.rotation.sources || {};
      const sourceControls = [
        { key: 'presets', label: t('background.tabs.presets') },
        { key: 'favorites', label: t('background.tabs.favorites') },
        { key: 'uploads', label: t('background.tabs.uploads') },
        { key: 'collections', label: t('background.tabs.collections') },
        { key: 'custom', label: t('background.tabs.custom') }
      ].map(item => '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" data-action="bg-rotation-source" data-source="' + item.key + '"' + (sources[item.key] ? ' checked' : '') + '> ' + escapeHtml(item.label) + '</label>').join('');
      panel.innerHTML =
        '<div class="bg-rotation-grid">' +
          '<div class="bg-rotation-card">' +
            '<label><input type="checkbox" id="bgRotationEnabled"' + (state.rotation.enabled ? ' checked' : '') + '> ' + escapeHtml(t('background.rotation.enabled')) + '</label>' +
            '<div class="bg-mini-text">' + escapeHtml(state.rotation.locked ? t('background.rotation.locked') : t('background.rotation.active')) + '</div>' +
            '<div class="bg-selector">' +
              '<label for="bgRotationStrategy">' + escapeHtml(t('background.rotation.mode')) + '</label>' +
              '<select id="bgRotationStrategy">' +
                '<option value="time"' + (state.rotation.strategy === 'time' ? ' selected' : '') + '>' + escapeHtml(t('background.rotation.modeTime')) + '</option>' +
                '<option value="interval"' + (state.rotation.strategy === 'interval' ? ' selected' : '') + '>' + escapeHtml(t('background.rotation.modeInterval')) + '</option>' +
                '<option value="theme"' + (state.rotation.strategy === 'theme' ? ' selected' : '') + '>' + escapeHtml(t('background.rotation.modeTheme')) + '</option>' +
              '</select>' +
            '</div>' +
            '<div class="bg-selector">' +
              '<label for="bgRotationInterval">' + escapeHtml(t('background.rotation.intervalLabel')) + '</label>' +
              '<input id="bgRotationInterval" type="number" min="5" step="5" value="' + (Number(state.rotation.intervalMinutes) || 60) + '">' +
              '<div class="bg-mini-text">' + escapeHtml(t('background.rotation.intervalNote')) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bg-rotation-card">' +
            '<label>' + escapeHtml(t('background.rotation.sourcesLabel')) + '</label>' +
            '<div class="bg-selector">' + sourceControls + '</div>' +
          '</div>' +
          '<div class="bg-rotation-card">' +
            '<label>' + escapeHtml(t('background.rotation.scheduleLabel')) + '</label>' +
            BG_TIME_SLOTS.map(slot => '<div class="bg-selector"><span>' + escapeHtml(t('background.rotation.slot.' + slot.id, null, slot.label)) + '</span>' + buildSelect(slot.id) + '</div>').join('') +
          '</div>' +
          '<div class="bg-rotation-card">' +
            '<label>' + escapeHtml(t('background.rotation.themePlan')) + '</label>' +
            '<div class="bg-selector"><span>' + escapeHtml(t('background.rotation.themeLight')) + '</span>' + buildSelect('light') + '</div>' +
            '<div class="bg-selector"><span>' + escapeHtml(t('background.rotation.themeDark')) + '</span>' + buildSelect('dark') + '</div>' +
            '<div class="bg-mini-text">' + escapeHtml(t('background.rotation.themeNote')) + '</div>' +
          '</div>' +
        '</div>';
    }

  function bgRenderCustom(state){
    const panel = document.getElementById('bgPanel-custom');
    if(!panel) return;
    panel.innerHTML =
      '<div class="bg-selector">' +
        '<label for="bgCustomUrl">' + escapeHtml(t('background.custom.label')) + '</label>' +
        '<input id="bgCustomUrl" type="url" placeholder="' + escapeHtml(t('background.custom.placeholder')) + '" value="' + escapeHtml(state.customUrl || '') + '">' +
        '<div class="bg-inline-actions">' +
          '<button type="button" data-action="bg-custom-apply">' + escapeHtml(t('background.actions.apply')) + '</button>' +
          '<button type="button" data-action="bg-custom-save">' + escapeHtml(t('common.save')) + '</button>' +
          (state.customUrl ? '<button type="button" data-action="bg-custom-clear">' + escapeHtml(t('common.delete')) + '</button>' : '') +
        '</div>' +
        '<p class="bg-mini-text">' + escapeHtml(t('background.custom.note')) + '</p>' +
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
    enhanceUiSelects(engine);
    refreshUiSelects(engine);
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

  async function bgSaveCollection(){
    const nameInput = document.getElementById('bgCollectionName');
    const urlsInput = document.getElementById('bgCollectionUrls');
    if(!urlsInput) return;
    const name = nameInput ? nameInput.value.trim() : '';
    const urls = urlsInput.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    if(!urls.length){
      await uiAlert(t('background.collections.minOneUrl'));
      return;
    }
    bgUpdateState(state => {
      const collection = {
        id: 'col-' + Date.now().toString(36),
        name: name || t('background.collections.defaultName', { index: state.collections.length + 1 }),
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

  async function bgApplyCollection(id){
    const state = bgLoadState();
    const collection = state.collections.find(c => c.id === id);
    if(!collection || !collection.urls.length){
      await uiAlert(t('background.collections.emptyCollection'));
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
      await uiAlert(t('background.collections.emptyCollection'));
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
      await uiAlert(t('background.collections.saved'));
    } catch (err) {
      console.error(err);
      await uiAlert(t('background.loadError'));
    } finally {
      if(button) button.disabled = false;
    }
    bgRenderSettings();
  }

  async function bgHandleCustom(action){
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
        await uiAlert(t('background.custom.enterUrl'));
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

  async function bgHandleClick(event){
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
      await bgRandomPick();
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
      await bgSaveCollection();
      return;
    }
    if(action === 'bg-collection-clear'){
      bgClearCollectionForm();
      return;
    }
    if(action === 'bg-collection-apply'){
      await bgApplyCollection(target.dataset.collection);
      return;
    }
    if(action === 'bg-collection-cache'){
      await bgCacheCollection(target.dataset.collection);
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
      await bgHandleCustom('apply');
      return;
    }
    if(action === 'bg-custom-save'){
      await bgHandleCustom('save');
      return;
    }
    if(action === 'bg-custom-clear'){
      await bgHandleCustom('clear');
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
      img.onerror = () => reject(new Error(t('background.imageLoadError')));
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

  async function bgRandomPick(){
    const state = bgLoadState();
    const candidates = bgCollectCandidates(state, false);
    if(!candidates.length){
      await uiAlert(t('background.noneAvailable'));
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
    if('deviceMemory' in navigator) info.push(t('system.ram', { value: navigator.deviceMemory }));
    if('hardwareConcurrency' in navigator) info.push(t('system.cpu', { value: navigator.hardwareConcurrency }));
    if('connection' in navigator && navigator.connection){
      const c = navigator.connection;
      info.push(t('system.network', { downlink: c.downlink ?? t('common.dash', null, '–'), type: c.effectiveType ?? t('common.dash', null, '–'), saveData: c.saveData ? t('system.saveData') : '' }));
    }
    $('#systemInfo').innerHTML = info.length? info.join('<br>') : t('system.noData');
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
      const widgetNames = { todo:t('widgets.todo'), notes:t('widgets.notes'), tiles:t('widgets.tiles'), weather:t('widgets.weather'), transport:t('widgets.transport'), quote:t('widgets.quote'), recent:t('widgets.recent'), system:t('widgets.system'), news:t('widgets.news') };
      const engineLabels = { google:t('search.engine.google', null, 'Google'), ddg:t('search.engine.ddg', null, 'DuckDuckGo'), bing:t('search.engine.bing', null, 'Bing'), yt:t('search.engine.yt', null, 'YouTube'), wikipedia:t('search.engine.wikipedia', null, 'Wikipedia'), maps:t('search.engine.maps', null, 'Google Maps') };

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

// ===== Init
  async function init(){
    await initI18n();
    initAnimations();
    initButtonMicroAnimations();
    applyUiFont(store.get(UI_FONT_KEY, ''));
    enhanceUiSelects();
    enhanceUiColorInputs();
    refreshUiSelects();
    document.addEventListener('click', e=>{
      if(uiActiveSelect && !uiActiveSelect.contains(e.target)) closeUiSelect();
      if(uiActiveColor && !uiActiveColor.contains(e.target)) closeUiColor();
    });
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
    const fontLoadLocal = $('#fontLoadLocal');
    if(fontLoadLocal){
      fontLoadLocal.addEventListener('click', ()=>{ void loadLocalFontsInteractive(); });
    }
    void initFontSettings({ preferLocal: false });
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
          renderTransportSuggestTo(transportDefaultSuggest, [], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }), null);
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
          renderTransportSuggestTo(transportDefaultSuggest, [], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }), null);
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
    const dataNote = $('#dataNote'); if(dataNote) dataNote.textContent = t('settings.data.noteText');
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
          renderTransportSuggestTo(onbTransportSuggest, [], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }), null);
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
          renderTransportSuggestTo(onbTransportSuggest, [], t('transport.minQuery', { count: TRANSPORT_MIN_QUERY }), null);
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
    $('#shortcutConfig').addEventListener('change', async ()=>{ try{ const j=JSON.parse($('#shortcutConfig').value); store.set('shortcuts', j);}catch{ await uiAlert(t('settings.search.invalidShortcuts')); } });
    $('#feedsConfig').addEventListener('change', async ()=>{ try{ const j=JSON.parse($('#feedsConfig').value); store.set('news.custom', j); fillNewsSources(); loadNews(); }catch{ await uiAlert(t('settings.search.invalidFeeds')); } });
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
    $('#resetTiles').addEventListener('click', async ()=>{ if(await uiConfirm(t('tiles.resetConfirm'))){ store.set('tiles', defaultTiles()); renderTiles(); }});

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
        if($('#uiDialog') && $('#uiDialog').classList.contains('open')){ closeUiDialog(undefined); return; }
        if($('#tileDialog') && $('#tileDialog').classList.contains('open')){
          closeModalAnimated($('#tileDialog'));
          return;
        }
        if(uiActiveColor){ closeUiColor(true); return; }
        if(uiActiveSelect){ closeUiSelect(true); return; }
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
  
