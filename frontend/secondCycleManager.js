// Second-cycle manager: handles selection and calls to backend
(function(){
  function byId(id){ return document.getElementById(id); }

  // local safe JSON parser for fetch responses
  async function safeJson(res){ if(!res) return {}; try{ const txt = await res.text(); if(!txt) return {}; try{ return JSON.parse(txt); }catch(e){ return {}; } }catch(e){ return {}; } }

  // Helper: fetch first and second cycle, memos
  async function loadData(){
    const [firstRes, secondRes, memosRes] = await Promise.all([
      fetch('/api/first_cycle?doc_id=default'),
      fetch('/api/second_cycle?doc_id=default'),
      fetch('/api/memos_rich?doc_id=default')
    ]);
    const first = await safeJson(firstRes); window._firstCycle = first || [];
    const second = await safeJson(secondRes); window._secondCycle = second || [];
    window._memosRich = await safeJson(memosRes) || [];
    return { first: window._firstCycle, second: window._secondCycle, memos: window._memosRich };
  }

  function uniqueCodesFromFirst(first){
    const map = {};
    (first||[]).forEach(f=>{
      const name = (f.code_name || f.code || f.label || '').toString();
      if(!name) return;
      map[name] = map[name] || { name, entries: [], chunks: new Set(), indicators: new Set() };
      map[name].entries.push(f);
      if(f.chunk_id) map[name].chunks.add(f.chunk_id);
      // collect indicators if present (array or comma-separated)
      const inds = f.indicators || f.indicator || f.indicator_tags || f.tags;
      if(inds){ if(Array.isArray(inds)) inds.forEach(i=> i && map[name].indicators.add(String(i))); else String(inds).split(/,|;/).map(s=>s.trim()).filter(Boolean).forEach(i=> map[name].indicators.add(i)); }
    });
    // convert set to array
    Object.values(map).forEach(v=> v.chunks = Array.from(v.chunks));
    Object.values(map).forEach(v=> v.indicators = Array.from(v.indicators));
    return map;
  }

  function buildUI(arg){
    const skipRefresh = (typeof arg === 'boolean') ? arg : false;
    const container = byId('secondCycle'); if(!container) return;
    container.innerHTML = `
      <div>
        <div id="codeweavingArea" class="mb-3"></div>
      </div>
    `;

    // wire events (none for create/suggest in Theme Builder)

    // initial load (optional)
    if(!skipRefresh) refresh();
  }

  async function refresh(){
    const {first, second, memos} = await loadData();
    console.log('[SecondCycle] refresh called — first:', (first||[]).length, 'second:', (second||[]).length);
    const codeMap = uniqueCodesFromFirst(first);
    // generate and render codeweaving clusters (display-only)
    try{
      let cwArea = byId('codeweavingArea');
      // ensure container exists: try themesArea, then secondCycle container
      if(!cwArea){ const themesArea = byId('themesArea'); if(themesArea){ cwArea = document.createElement('div'); cwArea.id = 'codeweavingArea'; cwArea.className = 'mb-3'; themesArea.insertBefore(cwArea, themesArea.firstChild); } else { const sc = byId('secondCycle'); if(sc){ cwArea = document.createElement('div'); cwArea.id = 'codeweavingArea'; cwArea.className = 'mb-3'; sc.appendChild(cwArea); } } }
      if(!cwArea){ console.warn('[SecondCycle] codeweavingArea not found and could not be created'); }
      if(!window.Codeweaving || typeof window.Codeweaving.generateClusters !== 'function' || typeof window.Codeweaving.renderCodeweavingWorkspace !== 'function'){
        if(cwArea) cwArea.innerHTML = '<div class="small text-muted">Codeweaving module not loaded yet.</div>';
        console.warn('[SecondCycle] Codeweaving module missing or incomplete');
      } else {
        const clusters = window.Codeweaving.generateClusters(codeMap || {});
        if(cwArea) window.Codeweaving.renderCodeweavingWorkspace(cwArea, clusters || [], codeMap || {});
      }
    }catch(e){ console.error('Codeweaving render failed', e); const cwArea = byId('codeweavingArea'); if(cwArea) cwArea.innerHTML = '<div class="text-danger small">Codeweaving failed: '+ (e && e.message ? e.message : 'unknown error') +'</div>';} 
    // ensure second cycle UI components are updated
    if(window.SecondCycle && window.SecondCycle.onRefreshed) try{ window.SecondCycle.onRefreshed(); }catch(e){ console.warn('SecondCycle onRefreshed handler failed', e); }
  }

  

  // expose refresh hook
  window.SecondCycle = { init: buildUI, refresh: refresh, onRefreshed: null };
  // Do not auto-build UI on load. Panels initialize after a successful upload.
  // Consumer should call `window.SecondCycle.init()` when ready.
})();
