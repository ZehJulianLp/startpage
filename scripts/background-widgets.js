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
    const override = normalizeHex(store.get('ui.accent.color',''));
    const p = override || normalizeHex(primary) || fallback.primary;
    let s = normalizeHex(secondary);
    if(override) s = bgAdjustHex(p, 0.18);
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
    applyAccentPreference();
    applyModalColors();
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
      info.push(t('system.network', { downlink: c.downlink ?? t('common.dash', null, '\u2013'), type: c.effectiveType ?? t('common.dash', null, '\u2013'), saveData: c.saveData ? t('system.saveData') : '' }));
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

  function applyControlColor(prefix, raw, options={}){
    const root = document.documentElement; if(!root) return;
    const body = document.body;
    const bodyStyle = body ? getComputedStyle(body) : null;
    const rootStyle = getComputedStyle(root);
    const baseBg = (bodyStyle && bodyStyle.getPropertyValue(options.baseBgVar).trim()) || rootStyle.getPropertyValue(options.baseBgVar).trim() || 'transparent';
    const baseBorder = (bodyStyle && bodyStyle.getPropertyValue(options.baseBorderVar).trim()) || rootStyle.getPropertyValue(options.baseBorderVar).trim() || 'transparent';
    const baseShadow = options.baseShadowVar
      ? ((bodyStyle && bodyStyle.getPropertyValue(options.baseShadowVar).trim()) || rootStyle.getPropertyValue(options.baseShadowVar).trim() || 'none')
      : '';
    const baseBackdrop = options.baseBackdropVar
      ? ((bodyStyle && bodyStyle.getPropertyValue(options.baseBackdropVar).trim()) || rootStyle.getPropertyValue(options.baseBackdropVar).trim() || 'none')
      : '';
    const hex = normalizeHex(raw);
    if(hex){
      const tint = hexToRgba(hex, options.tintAlpha ?? 0.18);
      const border = hexToRgba(hex, options.borderAlpha ?? 0.28) || baseBorder;
      const bgLayer = tint ? `linear-gradient(0deg, ${tint}, ${tint}), ${baseBg}` : baseBg;
      root.style.setProperty(`--${prefix}-bg`, bgLayer);
      root.style.setProperty(`--${prefix}-border`, border || baseBorder);
    } else {
      root.style.setProperty(`--${prefix}-bg`, baseBg);
      root.style.setProperty(`--${prefix}-border`, baseBorder);
    }
    if(options.baseShadowVar) root.style.setProperty(`--${prefix}-shadow`, baseShadow);
    if(options.baseBackdropVar) root.style.setProperty(`--${prefix}-backdrop`, baseBackdrop);
  }

  function applyControlColors(){
    applyControlColor('button', store.get('ui.button.color',''), {
      baseBgVar: '--tile-bg-current',
      baseBorderVar: '--tile-border-current',
      baseShadowVar: '--tile-shadow-current',
      baseBackdropVar: '--tile-backdrop-current',
      tintAlpha: 0.24,
      borderAlpha: 0.36
    });
    applyControlColor('input', store.get('ui.input.color',''), {
      baseBgVar: '--bg-soft',
      baseBorderVar: '--input-border-default',
      tintAlpha: 0.18,
      borderAlpha: 0.30
    });
  }

  function applyModalColors(){
    const root = document.documentElement; if(!root) return;
    const body = document.body;
    const bodyStyle = body ? getComputedStyle(body) : null;
    const rootStyle = getComputedStyle(root);
    const baseCard = (bodyStyle && bodyStyle.getPropertyValue('--card').trim()) || rootStyle.getPropertyValue('--card').trim() || 'transparent';
    const baseSoft = (bodyStyle && bodyStyle.getPropertyValue('--bg-soft').trim()) || rootStyle.getPropertyValue('--bg-soft').trim() || baseCard;
    const modalHex = normalizeHex(store.get('ui.modal.color',''));
    if(modalHex){
      const modalTint = hexToRgba(modalHex, 0.28);
      const panelTint = hexToRgba(modalHex, 0.20);
      root.style.setProperty('--modal-bg', `linear-gradient(0deg, ${modalTint}, ${modalTint}), ${baseCard}`);
      root.style.setProperty('--modal-panel-bg',
        `radial-gradient(900px 300px at 0% -20%, color-mix(in srgb, ${modalHex} 18%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, ${panelTint} 72%, ${baseCard}), color-mix(in srgb, ${panelTint} 58%, ${baseSoft}))`);
    } else {
      root.style.setProperty('--modal-bg', baseCard);
      root.style.setProperty('--modal-panel-bg',
        `radial-gradient(900px 300px at 0% -20%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, ${baseCard} 88%, transparent), color-mix(in srgb, ${baseSoft} 82%, transparent))`);
    }
  }

  function applyAccentPreference(){
    const override = normalizeHex(store.get('ui.accent.color',''));
    if(override){
      bgApplyAccentVars(override, bgAdjustHex(override, 0.18));
      return;
    }
    if(bgCurrentAccent) bgApplyAccentVars(bgCurrentAccent.primary, bgCurrentAccent.secondary);
    else bgApplyAccentVars();
  }

  function applyCardStyle(){
    const body = document.body; if(!body) return;
    const current = store.get('ui.cardStyle','glass');
    const allowed = ['glass','solid','transparent','minimal'];
    const value = allowed.includes(current) ? current : 'glass';
    body.setAttribute('data-card-style', value);
    applySurfaceColors();
    applyControlColors();
    applyModalColors();
    applyWidgetColors();
    applyAccentPreference();
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

