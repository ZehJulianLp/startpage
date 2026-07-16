// ===== Init
  async function init(){
    await initI18n();
    ensureWeatherStorage();
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
    renderProfileQuickSwitcher();
    const profileQuickSwitch = $('#profileQuickSwitch');
    if(profileQuickSwitch){
      profileQuickSwitch.addEventListener('change', e=>{ void applyProfile(e.target.value); });
    }
    $('#themeToggle').addEventListener('click', ()=>{
      const current = store.get('theme','auto');
      const next = current==='dark' ? 'light' : current==='light' ? 'auto' : 'dark';
      store.set('theme', next); applyTheme(next);
    });
    $('#openSettings').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#settingsModal').addEventListener('click', e=>{ void onSettingsModalClick(e); });
    $('#themeSelect').addEventListener('change', e=>{ store.set('theme', e.target.value); applyTheme(e.target.value); });
    const aiEnabledToggle = $('#aiEnabledToggle');
    if(aiEnabledToggle){
      aiEnabledToggle.addEventListener('change', async ()=>{
        const enabled = !!aiEnabledToggle.checked;
        store.set(AGENT_KEYS.enabled, enabled);
        applyAgentEnabledState();
        if(enabled) await refreshAgentRuntimeAvailability();
        fillSettings();
        syncAgentPanelUiState();
      });
    }
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
    const defaultCitiesInput = $('#defaultCities');
    if(defaultCitiesInput){
      defaultCitiesInput.addEventListener('change', e=>{
        const applied = applyWeatherCitiesFromInput(e.target.value);
        if(!applied){
          fillSettings();
          return;
        }
        if(isWidgetEnabled('weather')) loadWeather();
        fillSettings();
      });
    }
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
    const accentColorInput = $('#accentColor');
    if(accentColorInput) accentColorInput.addEventListener('input', ()=>{ const val = normalizeHex(accentColorInput.value); store.set('ui.accent.color', val); applyAccentPreference(); applyModalColors(); });
    const accentReset = $('#accentColorReset'); if(accentReset) accentReset.addEventListener('click', ()=>{ store.set('ui.accent.color',''); applyAccentPreference(); applyModalColors(); fillSettings(); });
    const modalColorInput = $('#modalColor');
    if(modalColorInput) modalColorInput.addEventListener('input', ()=>{ const val = normalizeHex(modalColorInput.value); store.set('ui.modal.color', val); applyModalColors(); });
    const modalReset = $('#modalColorReset'); if(modalReset) modalReset.addEventListener('click', ()=>{ store.set('ui.modal.color',''); applyModalColors(); fillSettings(); });
    const buttonColorInput = $('#buttonColor');
    if(buttonColorInput) buttonColorInput.addEventListener('input', ()=>{ const val = normalizeHex(buttonColorInput.value); store.set('ui.button.color', val); applyControlColors(); });
    const buttonReset = $('#buttonColorReset'); if(buttonReset) buttonReset.addEventListener('click', ()=>{ store.set('ui.button.color',''); applyControlColors(); fillSettings(); });
    const inputColorInput = $('#inputColor');
    if(inputColorInput) inputColorInput.addEventListener('input', ()=>{ const val = normalizeHex(inputColorInput.value); store.set('ui.input.color', val); applyControlColors(); });
    const inputReset = $('#inputColorReset'); if(inputReset) inputReset.addEventListener('click', ()=>{ store.set('ui.input.color',''); applyControlColors(); fillSettings(); });

    // Engines & Search
    ensureSearxngEngineEnabled();
    renderEngines();
    const engineSelect = $('#engine');
    if(engineSelect) engineSelect.addEventListener('change', ()=> setSelectedSearchEngine(engineSelect.value));
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
    const profilesList = $('#profilesList'); if(profilesList) profilesList.addEventListener('click', e=>{ void onProfileActionClick(e); });
    const profileCreate = $('#profileCreate'); if(profileCreate) profileCreate.addEventListener('click', e=>{ void onProfileActionClick(e); });
    const restartOnb = $('#restartOnboarding'); if(restartOnb) restartOnb.addEventListener('click', ()=>{ store.set('onboarding.done', false); onboardingOpen(true); });
    const widgetLayoutReset = $('#widgetLayoutReset'); if(widgetLayoutReset) widgetLayoutReset.addEventListener('click', resetWidgetLayout);

    // Onboarding modal
    const onbNext = $('#onbNext'); if(onbNext) onbNext.addEventListener('click', onboardingNext);
    const onbPrev = $('#onbPrev'); if(onbPrev) onbPrev.addEventListener('click', onboardingPrev);
    const onbSkip = $('#onbSkip'); if(onbSkip) onbSkip.addEventListener('click', onboardingSkip);
    const onbClose = $('#onbClose'); if(onbClose) onbClose.addEventListener('click', onboardingSkip);
    $$('.onb-nav-btn').forEach(btn=> btn.addEventListener('click', ()=> onboardingGoToStep(btn.getAttribute('data-onb-step'))));
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
    $('#searxngBaseUrl').addEventListener('change', async ()=>{
      const input = $('#searxngBaseUrl');
      if(!input) return;
      const normalized = normalizeSearxngBaseUrl(input.value);
      if(!normalized){
        input.value = getSearxngBaseUrl();
        await uiAlert(t('settings.search.invalidSearxngUrl'));
        return;
      }
      store.set('search.searxng.baseUrl', normalized);
      input.value = normalized;
      uiToast(t('settings.search.searxngSaved', null, 'SearXNG URL saved.'), { type: 'success' });
    });
    const shortcutAdd = $('#shortcutAdd');
    if(shortcutAdd) shortcutAdd.addEventListener('click', addShortcutEntry);
    const shortcutConfig = $('#shortcutConfig');
    if(shortcutConfig) shortcutConfig.addEventListener('change', applyShortcutJsonEditor);
    const feedAdd = $('#feedAdd');
    if(feedAdd) feedAdd.addEventListener('click', addFeedEntry);
    const feedsConfig = $('#feedsConfig');
    if(feedsConfig) feedsConfig.addEventListener('change', applyFeedJsonEditor);
    const wordlistEditor = $('#wordlistEditor');
    const wordlistSave = $('#wordlistSave');
    const wordlistReset = $('#wordlistReset');
    const applyInlineWordlist = ()=>{ if(!wordlistEditor) return; const words = setInlineWordlist(parseWordlistInput(wordlistEditor.value)); wordlistEditor.value = words.join('\n'); updateSearchSuggest(); uiToast(t('settings.search.wordlistSaved', null, 'Wordlist saved.'), { type: 'success' }); };
    if(wordlistSave) wordlistSave.addEventListener('click', applyInlineWordlist);
    if(wordlistEditor) wordlistEditor.addEventListener('change', applyInlineWordlist);
    if(wordlistReset) wordlistReset.addEventListener('click', ()=>{ setInlineWordlist([]); if(wordlistEditor) wordlistEditor.value=''; updateSearchSuggest(); uiToast(t('settings.search.wordlistResetDone', null, 'Wordlist reset.'), { type: 'success' }); });

    // Clock
    tickClock();

    // Todo
    renderTodos();
    initTodoViewportSync();
    $('#todoAdd').addEventListener('click', ()=>{ const v=$('#todoInput').value.trim(); if(v){ addTodo(v); $('#todoInput').value=''; }});
    $('#todoInput').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#todoAdd').click(); } });
    $('#todoClearDone').addEventListener('click', ()=>{ const list=store.get('todos',[]).filter(t=>!t.done); store.set('todos', list); renderTodos(); });

    // Notes
    initNotes();

    // Tiles
    if(!localStorage.getItem('tiles')) store.set('tiles', defaultTiles());
    $('#addTile').addEventListener('click', addTile);
    $('#resetTiles').addEventListener('click', async ()=>{ if(await uiConfirm(t('tiles.resetConfirm'))){ store.set('tiles', defaultTiles()); renderTiles(); uiToast(t('tiles.resetDone', null, 'Tiles reset.'), { type: 'success' }); }});

    // Weather
    $('#setCity').addEventListener('click', ()=>{
      const v = $('#cityInput').value.trim();
      if(!v) return;
      const entry = upsertWeatherEntry(v);
      loadWeather(entry ? entry.id : undefined);
    });
    const cityInput = $('#cityInput');
    if(cityInput){
      cityInput.addEventListener('keydown', e=>{
        if(e.key !== 'Enter') return;
        e.preventDefault();
        $('#setCity').click();
      });
    }
    // Recent
    const recentMaxSetting = $('#recentMaxSetting');
    if(recentMaxSetting){
      const applyMax = ()=>{
        const next = setRecentMax(recentMaxSetting.value);
        recentMaxSetting.value = String(next);
        renderRecent();
      };
      recentMaxSetting.value = String(getRecentMax());
      recentMaxSetting.addEventListener('change', applyMax);
      recentMaxSetting.addEventListener('blur', applyMax);
      recentMaxSetting.addEventListener('keydown', e=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          applyMax();
        }
      });
      const nudgeRecentMax = (delta)=>{
        const current = normalizeRecentMax(recentMaxSetting.value || getRecentMax());
        const next = setRecentMax(current + delta);
        recentMaxSetting.value = String(next);
        renderRecent();
      };
      const recentMaxSettingDec = $('#recentMaxSettingDec');
      if(recentMaxSettingDec){
        recentMaxSettingDec.addEventListener('click', ()=> nudgeRecentMax(-1));
      }
      const recentMaxSettingInc = $('#recentMaxSettingInc');
      if(recentMaxSettingInc){
        recentMaxSettingInc.addEventListener('click', ()=> nudgeRecentMax(1));
      }
    }
    const recentClearSetting = $('#recentClearSetting');
    if(recentClearSetting){
      recentClearSetting.addEventListener('click', async ()=>{
        const ok = await uiConfirm(t('recent.clearConfirm', null, 'Delete recent data?'));
        if(!ok) return;
        clearRecent();
        renderRecent();
        uiToast(t('recent.clearDone', null, 'Recent data deleted.'), { type: 'success' });
      });
    }
    // Background
    await bgInitBackgroundEngine();
    applyBackground();
    const tintBtn = document.getElementById('bgActionTintWidgets');
    if(tintBtn) tintBtn.addEventListener('click', e=>{ e.preventDefault(); tintWidgets(); });

    // System
    if(navigator.connection && 'onchange' in navigator.connection){ navigator.connection.addEventListener('change', renderSystem); }

    // News
    $('#newsSource').addEventListener('change', e=>{ store.set('news.source', e.target.value); loadNews(); });
    $('#refreshNews').addEventListener('click', loadNews);

    // Widgets visibility
    applyWidgets();
    window.addEventListener('online', ()=>{
      if(isWidgetEnabled('weather')) void loadWeather();
      if(isWidgetEnabled('transport')) void loadTransportDepartures();
      if(isWidgetEnabled('news')) void loadNews();
    });
    applyControlColors();
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
    await initStartpageAgent();
  }

  document.addEventListener('DOMContentLoaded', init);
  
