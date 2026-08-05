const API = {
  modules: '/api/modules',
  analyze: '/api/analyze',
  pipeline: '/api/pipeline',
  highlight: '/api/highlight',
  highlights: '/api/highlights',
  memo: '/api/memo',
  memos: '/api/memos',
  export: '/api/export'
};

let activeModule = null;
let corpusText = '';
window._firstCycle = [];
window._secondCycle = [];

// Safe JSON parser for fetch responses (returns {} on empty/non-JSON responses)
async function safeJson(res){
  if(!res) return {};
  try{
    // if empty body, res.json() will throw — guard with text()
    const txt = await res.text();
    if(!txt) return {};
    try{ return JSON.parse(txt); }catch(e){ return {} }
  }catch(e){ return {}; }
}

function setModuleDropdown(modules){
  const sel = document.getElementById('moduleSelect');
  if(!sel) return; // moduleSelect removed from UI
  sel.innerHTML = '';
  modules.forEach(m => {
    const opt = document.createElement('option'); opt.value = m; opt.textContent = m; sel.appendChild(opt);
  });
  sel.onchange = () => { activeModule = sel.value; renderPanels(); renderHighlights(); };
  activeModule = modules[0] || null;
  // ensure panels initialize for the selected module
  try{ renderPanels(); renderHighlights(); }catch(e){ /* ignore if not yet defined */ }
}

async function fetchModules() {
  const res = await fetch(API.modules);
  const data = await safeJson(res);
  setModuleDropdown(data.modules || []);
}

function renderCorpus(text) {
  corpusText = text;
  // when a corpus is rendered, run analysis to segment and produce chunks/clusters
  analyzeAndRender(text);
}

function renderHighlights(){
    const el = document.getElementById('corpus');
    if(!el) return;
    fetch(API.highlights + '?doc_id=default').then(r=> safeJson(r)).then(raw=>{
      const highlights = Array.isArray(raw) ? raw : (raw && raw.value ? raw.value : []);
      if (!highlights || highlights.length === 0) { el.innerText = corpusText; return; }
    if(!highlights || highlights.length===0){ el.innerText = corpusText; return; }
    // create boundary points from highlight starts/ends
    const points = new Set([0, corpusText.length]);
    highlights.forEach(h=>{ if(h.start!=null) points.add(h.start); if(h.end!=null) points.add(h.end); });
    const sorted = Array.from(points).sort((a,b)=>a-b);
    let out = '';
    // compute numbering by start offset (earliest first)
    const numbered = highlights.slice().filter(h=>h.start!=null).sort((a,b)=> (a.start - b.start));
    const idToNumber = {};
    numbered.forEach((h,i)=>{ idToNumber[h.id] = i+1; });
    for(let i=0;i<sorted.length-1;i++){
      const s = sorted[i], e = sorted[i+1];
      if(s>=e) continue;
      const segText = corpusText.slice(s,e);
        const activeHighlights = highlights.filter(h=> (h.start!=null && h.end!=null) && h.start < e && h.end > s );
        // sort active highlights by length desc for outer->inner nesting
        activeHighlights.sort((a,b)=> ( (b.end-b.start) - (a.end-a.start) ));
        // build nested spans for this segment
        let inner = escapeHtml(segText);
        activeHighlights.forEach(h=>{
          const cls = categoryToClass(h.category || '') || '';
            const number = idToNumber[h.id] || '';
            const attrs = ` data-id="${h.id}" data-number="${number}" data-code="${escapeAttr(h.code||'')}" data-cycle="${escapeAttr(h.cycle||'')}" data-category="${escapeAttr(h.category||'')}" data-semantic="${escapeAttr(h.semantic||'')}" data-color="${escapeAttr(h.color||'')}"`;
            // include superscript number inside span
            inner = `<span class="highlight ${cls}"${attrs}>${inner}${number ? ('<sup class="anno-num">'+number+'</sup>') : ''}</span>`;
        });
        out += `<span class="segment" data-start="${s}" data-end="${e}">${inner}</span>`;
    }
    el.innerHTML = out;
  });
}

  function categoryToClass(cat){
    if(!cat) return '';
    const map = {aktor: 'highlight-yellow', tindakan: 'highlight-green', evaluasi: 'highlight-blue', modalitas: 'highlight-orange', kausalitas: 'highlight-cyan'};
    return map[cat] || '';
  }

  function categoryToColor(cat){
    if(!cat) return '#fffdf0';
    const map = {
      aktor: '#cfe8ff',
      tindakan: '#dff7e0',
      evaluasi: '#fff4c7',
      modalitas: '#dff7fa',
      kausalitas: '#ffd6d6',
      emosi: '#f1d9ff',
      hambatan: '#ececec',
      solusi: '#d7f7f1',
      motivasi: '#ffe7d2'
    };
    return map[cat] || '#f7f7fb';
  }

  function escapeAttr(s){ return (s||'').replace(/"/g,'&quot;'); }

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const fileInputEl = document.getElementById('fileInput');
if (fileInputEl) {
  fileInputEl.addEventListener('change', async (e) => {
    try {
      const f = e.target.files[0];
      if (!f) return;
      const name = (f.name || '').toLowerCase();
      if(name.endsWith('.docx')){
    // debug: log first-cycle state and project before upload
    try{ console.log('[Upload] Before upload — First Cycle count:', (window._firstCycle||[]).length, 'project_id: default'); }catch(e){}
    const fd = new FormData(); fd.append('file', f);
    const res = await fetch('/api/upload_docx', {method:'POST', body: fd});
    let data = {};
    try{ data = await safeJson(res); }catch(e){ data = {}; }
    if(data.text){
      // ensure transcript text is visible immediately as a fallback
      try{ const corpusEl = document.getElementById('corpus'); if(corpusEl) corpusEl.textContent = data.text; }catch(e){}
      renderCorpus(data.text);
      // show corpus now that content is available
      try{ const corpusEl = document.getElementById('corpus'); if(corpusEl) corpusEl.style.display = ''; }catch(e){}
      // reset highlights on server and re-render
      try{ await fetch('/api/clear_highlights', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default'})}); }catch(e){}
      renderHighlights();
      showToast('Upload sukses — highlights direset', 'success');
      try{ const intro = document.getElementById('introPanel'); if(intro) intro.style.display = 'none'; }catch(e){}
      // debug: after render, show counts and ensure First Cycle reloaded from DB
      setTimeout(async ()=>{
        try{
          console.log('[Upload] After upload — First Cycle client count:', (window._firstCycle||[]).length, 'project_id: default');
          // force reload authoritative data (guard functions)
          if(typeof loadFirstCycle === 'function') await loadFirstCycle();
          if(typeof loadSecondCycle === 'function') await loadSecondCycle();
          if(typeof loadMemosRich === 'function') await loadMemosRich();
          console.log('[Upload] After upload — First Cycle rendered items:', document.querySelectorAll('.first-code-item').length);
              // initialize panels only after upload and data reload
              try{ if(window.SecondCycle && typeof window.SecondCycle.init === 'function') window.SecondCycle.init(); }catch(e){ console.warn('SecondCycle.init failed', e); }
              try{ if(window.FirstCycle && typeof window.FirstCycle.render === 'function') window.FirstCycle.render(); }catch(e){ console.warn('FirstCycle.render failed', e); }
              // reveal analysis panels now that data is loaded
              try{ showAnalysisPanels(); }catch(e){ }
        }catch(e){ console.error('post-upload debug', e); }
      }, 500);
    } else {
      showToast('Gagal membaca .docx', 'error');
    }
      } else {
        // robust text reading: use File.text() when available, otherwise FileReader fallback
        let t = '';
        try{
          if(typeof f.text === 'function'){
            t = await f.text();
          } else {
            t = await new Promise((resolve, reject)=>{
              const reader = new FileReader();
              reader.onload = ()=> resolve(reader.result);
              reader.onerror = ()=> reject(reader.error);
              reader.readAsText(f);
            });
          }
        }catch(err){
          console.error('Failed to read file text', err);
          try{ showToast('Gagal membaca file. Coba format .txt atau periksa browser.', 'error'); }catch(e){}
          return;
        }
        try{ const corpusEl = document.getElementById('corpus'); if(corpusEl) corpusEl.textContent = t; }catch(e){}
        renderCorpus(t);
        // reveal corpus when plain text loaded
        try{ const corpusEl = document.getElementById('corpus'); if(corpusEl) corpusEl.style.display = ''; }catch(e){}
        try{ const intro = document.getElementById('introPanel'); if(intro) intro.style.display = 'none'; }catch(e){}
      }
    } catch (err) {
      console.error('Upload handler error', err);
      try{ showToast('Kesalahan saat mengunggah file. Periksa konsol.', 'error'); }catch(e){}
    }
  });
} else {
  console.warn('fileInput element not found; upload handler not attached');
}

// Hide First and Second Cycle tabs/panes until an upload occurs
function hideAnalysisPanels(){
  try{
    const tabMentor = document.getElementById('tab-mentor'); if(tabMentor) tabMentor.style.display = 'none';
    const tabFirst = document.getElementById('tab-first'); if(tabFirst) tabFirst.style.display = 'none';
    const tabSecond = document.getElementById('tab-second'); if(tabSecond) tabSecond.style.display = 'none';
    const paneMentor = document.getElementById('pane-mentor'); if(paneMentor) paneMentor.style.display = 'none';
    const paneFirst = document.getElementById('pane-first'); if(paneFirst) paneFirst.style.display = 'none';
    const paneSecond = document.getElementById('pane-second'); if(paneSecond) paneSecond.style.display = 'none';
    const rightPanel = document.getElementById('rightPanel'); if(rightPanel) rightPanel.style.display = 'none';
    try{ document.body.classList.add('no-right'); }catch(e){}
  }catch(e){}
}
function showAnalysisPanels(){
  try{
    const tabMentor = document.getElementById('tab-mentor'); if(tabMentor) tabMentor.style.display = '';
    const tabFirst = document.getElementById('tab-first'); if(tabFirst) tabFirst.style.display = '';
    const tabSecond = document.getElementById('tab-second'); if(tabSecond) tabSecond.style.display = '';
    const paneMentor = document.getElementById('pane-mentor'); if(paneMentor) paneMentor.style.display = '';
    const paneFirst = document.getElementById('pane-first'); if(paneFirst) paneFirst.style.display = '';
    const paneSecond = document.getElementById('pane-second'); if(paneSecond) paneSecond.style.display = '';
    const rightPanel = document.getElementById('rightPanel'); if(rightPanel) rightPanel.style.display = '';
    try{ document.body.classList.remove('no-right'); }catch(e){}
  }catch(e){}
}

// hide by default until upload
hideAnalysisPanels();

const GUIDE_STEPS = [
  {
    selector: '#heroUploadBtn',
    title: 'Unggah Dokumen',
    description: 'Mulailah dengan mengunggah dokumen penelitian yang akan dianalisis. Sistem akan mengekstrak isi dokumen sebelum proses koding dilakukan.'
  },
  {
    selector: '#docViewerScroll',
    title: 'Transkrip Penelitian',
    description: 'Seluruh isi dokumen akan ditampilkan di area ini. Anda dapat membaca, menyeleksi, dan melakukan proses koding pada setiap kutipan.'
  },
  {
    selector: '#tab-first',
    title: 'First Cycle Coding',
    description: 'Tahap ini digunakan untuk membuat kode awal berdasarkan makna setiap kutipan. Anda dapat menambah, mengubah, atau menghapus kode sesuai kebutuhan.',
    placement: 'left-screen'
  },
  {
    selector: '#tab-second',
    title: 'Second Cycle Coding',
    description: 'Gabungkan beberapa kode awal menjadi kategori atau tema yang lebih luas agar analisis lebih terstruktur.',
    placement: 'left-screen'
  },
  {
    selector: '#pane-mentor',
    title: 'Riwayat Analisis',
    description: 'Semua proses analisis AI akan tersimpan di sini sehingga dapat ditinjau kembali.',
    placement: 'left-screen'
  },
  {
    selector: '#exportDocx',
    title: 'Export Hasil',
    description: 'Setelah analisis selesai, ekspor hasil ke PDF atau Word untuk dokumentasi maupun pelaporan penelitian.',
    placement: 'left-screen'
  },
  {
    selector: '#mainPanel',
    title: 'Selesai',
    description: 'Anda telah mengenal seluruh fitur utama Asisten Koding. Sekarang Anda dapat mulai melakukan analisis data kualitatif.',
    placement: 'left-screen'
  }
];

const GUIDE_STORAGE_KEY = 'asistenKodingGuideAutoSkip';
const GUIDE_AUTO_SHOWN_KEY = 'asistenKodingGuideAutoShown';
let guideState = { current: 0, active: false, manualOpen: false };

function resetGuideHighlight(){
  document.querySelectorAll('.guide-target-highlight').forEach(el => el.classList.remove('guide-target-highlight'));
}

function setGuideTargetHighlight(selector){
  resetGuideHighlight();
  const target = document.querySelector(selector);
  if(!target) return null;
  target.classList.add('guide-target-highlight');
  return target;
}

function getGuidePosition(target, placement = 'right'){
  if(!target) return { left: 24, top: 24 };
  const rect = target.getBoundingClientRect();
  const card = document.getElementById('guideCard');
  const cardWidth = card ? card.offsetWidth : 320;
  const cardHeight = card ? card.offsetHeight : 280;
  const gap = 18;
  const top = Math.min(window.innerHeight - cardHeight - 16, Math.max(16, rect.top + (rect.height / 2) - (cardHeight / 2)));

  if(placement === 'left-screen'){
    const left = Math.max(16, Math.min(360, Math.round(window.innerWidth * 0.18)));
    return { left, top };
  }

  if(placement === 'left'){
    const left = Math.max(16, rect.left - cardWidth - gap - 120);
    return { left, top };
  }

  const left = Math.min(window.innerWidth - cardWidth - 16, Math.max(16, rect.right + gap));
  return { left, top };
}

function prepareGuideTarget(stepIndex){
  const step = GUIDE_STEPS[stepIndex];
  if(!step) return;
  const target = setGuideTargetHighlight(step.selector);

  if(step.selector === '#tab-first' || step.selector === '#tab-second' || step.selector === '#pane-mentor'){
    showAnalysisPanels();
    if(step.selector === '#tab-first'){
      const tab = document.getElementById('tab-first'); if(tab) tab.click();
    }
    if(step.selector === '#tab-second'){
      const tab = document.getElementById('tab-second'); if(tab) tab.click();
    }
    if(step.selector === '#pane-mentor'){
      const tab = document.getElementById('tab-mentor'); if(tab) tab.click();
    }
  }
  if(step.selector === '#mainPanel'){
    hideAnalysisPanels();
  }
  if(target){
    const pos = getGuidePosition(target, step.placement || 'right');
    const card = document.getElementById('guideCard');
    if(card){
      card.style.left = pos.left + 'px';
      card.style.top = pos.top + 'px';
    }
  }
}

function renderGuideStep(){
  const step = GUIDE_STEPS[guideState.current];
  if(!step) return;
  const overlay = document.getElementById('interactiveGuideOverlay');
  const stepBadge = document.getElementById('guideStepBadge');
  const title = document.getElementById('guideCardTitle');
  const description = document.getElementById('guideCardDescription');
  const prevBtn = document.getElementById('guidePrevBtn');
  const nextBtn = document.getElementById('guideNextBtn');
  const finishBtn = document.getElementById('guideFinishBtn');
  const checkbox = document.getElementById('guideNeverShowAgain');

  if(checkbox){ checkbox.checked = localStorage.getItem(GUIDE_STORAGE_KEY) === '1'; }
  if(stepBadge) stepBadge.textContent = `${guideState.current + 1} dari ${GUIDE_STEPS.length}`;
  if(title) title.textContent = step.title;
  if(description) description.textContent = step.description;

  if(prevBtn) prevBtn.disabled = guideState.current === 0;
  if(nextBtn) nextBtn.style.display = guideState.current === GUIDE_STEPS.length - 1 ? 'none' : '';
  if(finishBtn) finishBtn.style.display = guideState.current === GUIDE_STEPS.length - 1 ? '' : 'none';

  if(overlay) overlay.setAttribute('aria-hidden', 'false');
  prepareGuideTarget(guideState.current);
}

function openGuideOverlay(manual = false){
  guideState.current = 0;
  guideState.manualOpen = manual;
  guideState.active = true;
  hideAnalysisPanels();
  const overlay = document.getElementById('interactiveGuideOverlay');
  if(overlay){
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  renderGuideStep();
}

function closeGuideOverlay(isSkip = false){
  guideState.active = false;
  const overlay = document.getElementById('interactiveGuideOverlay');
  if(overlay){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true'); }
  resetGuideHighlight();
  hideAnalysisPanels();
  document.body.style.overflow = '';
  if(isSkip && !guideState.manualOpen){
    localStorage.setItem(GUIDE_STORAGE_KEY, '1');
    localStorage.setItem(GUIDE_AUTO_SHOWN_KEY, '1');
  }
  if(!guideState.manualOpen){
    localStorage.setItem(GUIDE_AUTO_SHOWN_KEY, '1');
  }
}

function handleGuideNext(){
  if(guideState.current < GUIDE_STEPS.length - 1){
    guideState.current += 1;
    renderGuideStep();
  }
}

function handleGuidePrev(){
  if(guideState.current > 0){
    guideState.current -= 1;
    renderGuideStep();
  }
}

function handleGuideFinish(){
  const checkbox = document.getElementById('guideNeverShowAgain');
  if(checkbox && checkbox.checked){
    localStorage.setItem(GUIDE_STORAGE_KEY, '1');
  }
  closeGuideOverlay(false);
}

function attachGuideControls(){
  const guideBtn = document.getElementById('guideBtn');
  const overlay = document.getElementById('interactiveGuideOverlay');
  const closeBtn = document.getElementById('guideCloseBtn');
  const prevBtn = document.getElementById('guidePrevBtn');
  const nextBtn = document.getElementById('guideNextBtn');
  const skipBtn = document.getElementById('guideSkipBtn');
  const finishBtn = document.getElementById('guideFinishBtn');
  const checkbox = document.getElementById('guideNeverShowAgain');

  if(guideBtn){ guideBtn.addEventListener('click', ()=> openGuideOverlay(true)); }
  if(closeBtn){ closeBtn.addEventListener('click', ()=> closeGuideOverlay(false)); }
  if(prevBtn){ prevBtn.addEventListener('click', handleGuidePrev); }
  if(nextBtn){ nextBtn.addEventListener('click', handleGuideNext); }
  if(finishBtn){ finishBtn.addEventListener('click', handleGuideFinish); }
  if(skipBtn){ skipBtn.addEventListener('click', ()=> closeGuideOverlay(true)); }
  if(checkbox){ checkbox.addEventListener('change', ()=>{ if(checkbox.checked) localStorage.setItem(GUIDE_STORAGE_KEY, '1'); }); }
  if(overlay){ overlay.addEventListener('click', (ev)=>{ if(ev.target === overlay) closeGuideOverlay(false); }); }
  window.addEventListener('resize', ()=>{ if(guideState.active) renderGuideStep(); });
}

function autoShowGuideOnce(){
  const autoSkip = localStorage.getItem(GUIDE_STORAGE_KEY);
  const autoShown = localStorage.getItem(GUIDE_AUTO_SHOWN_KEY);
  if(autoSkip === '1' || autoShown === '1') return;
  setTimeout(()=>{
    if(!guideState.active){
      openGuideOverlay(false);
      localStorage.setItem(GUIDE_AUTO_SHOWN_KEY, '1');
    }
  }, 400);
}

attachGuideControls();
if(document.readyState === 'complete' || document.readyState === 'interactive'){
  autoShowGuideOnce();
} else {
  document.addEventListener('DOMContentLoaded', autoShowGuideOnce);
}

// New: analyze transcript via backend and render UI components
async function analyzeAndRender(text){
  corpusText = text || '';
  // call backend analyze endpoint which should return pipeline JSON
  try{
    // prefer pipeline endpoint which returns chunks/clusters; fall back to module analyze
    let data = null;
    try{
      const pres = await fetch(API.pipeline, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: corpusText})});
      data = await safeJson(pres);
    }catch(e){ data = null; }
    if(!data || !data.chunks){
      const res = await fetch(API.analyze, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({module: activeModule, text: corpusText})});
      const moddata = await safeJson(res);
      // if module returned analysis, try to map to pipeline-like shape if possible
      data = moddata.analysis || moddata;
    }
    // expected data: {chunks:[], clusters:[], global_themes:[], speaker_summary:...}
    renderWorkspace(data);
    try{ storeLastAnalysis(data); }catch(e){}
    // load persisted first/second cycle data
    try{ await loadFirstCycle(); }catch(e){}
    try{ await loadSecondCycle(); }catch(e){}
    // also render low-level highlights if backend stores them
    try{ renderHighlights(); }catch(e){}
  }catch(e){
    console.error('analyze failed', e);
    // fallback: show raw text in chunks container
    document.getElementById('chunksContainer').innerHTML = '<pre class="text-muted">Failed to analyze transcript. Showing raw text.</pre><div class="chunk-card"><div class="chunk-body">'+escapeHtml(corpusText)+'</div></div>';
  }
}

function renderWorkspace(data){
  // left: document structure, clusters (structure UI removed from DOM)
  // renderLeftSidebar(data); // removed: left sidebar not present
  // main: chunk cards
  renderMainChunks(data);
  // right: first-cycle, second-cycle, memos
  renderRightPanels(data);
}

// --- Inline assistant and chunk code markers ---
let _openInlineAssistantId = null;
function closeInlineAssistant(){ if(_openInlineAssistantId){ const prev = document.getElementById('inline-assistant-'+_openInlineAssistantId); if(prev) prev.remove(); _openInlineAssistantId = null; } _assistantState.open = false; console.log('[Assistant] closeInlineAssistant invoked'); }
// wrap close to log
const _origCloseInline = closeInlineAssistant;
function _closeAssistantLogged(){ console.log('[Assistant] closing (user click-away)'); _origCloseInline(); _assistantState.open = false; }
// replace usages: global click handler earlier calls closeInlineAssistant() directly; update it now

// debug wrapper
const _assistantState = {open: false};

async function renderInlineAssistant(chunkId, detection){
  try{ if(_openInlineAssistantId===chunkId && document.getElementById('inline-assistant-'+chunkId)) { console.log('[Assistant] already open for', chunkId); return; } closeInlineAssistant(); }catch(e){}
  const chunkEl = document.getElementById('chunk-'+chunkId);
  if(!chunkEl) return;
  // try to get chunk object
  const chunk = (window._lastAnalysis && window._lastAnalysis.chunks||[]).find(x=>x.chunk_id===chunkId) || {};
  // if detection not provided, call detection API for chunk text
  if(!detection){ try{ const resp = await fetch('/api/detect', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: chunk.text||''})}); detection = await safeJson(resp); }catch(e){ detection = {}; } }
  const suggestions = (detection && detection.suggestions) ? detection.suggestions : (chunk.codes||[]).slice(0,6).map(s=> (s.code||s));
  const sem = (detection && (detection.semantic_relationship && (detection.semantic_relationship.explanation || detection.semantic_relationship))) || (chunk.semantic_relation && (chunk.semantic_relation.explanation || chunk.semantic_relation)) || '';

  const wrap = document.createElement('div'); wrap.className = 'inline-assistant'; wrap.id = 'inline-assistant-'+chunkId;
  const chips = document.createElement('div'); chips.className = 'suggested-chips';
  // custom input row: moved above suggested chips
  const customRow = document.createElement('div'); customRow.className='custom-row';
  customRow.style.marginBottom = '20px';
  const input = document.createElement('input'); input.className='form-control form-control-sm'; input.placeholder = '+ Add custom code...'; input.autocomplete='off';
  const addBtn = document.createElement('button'); addBtn.className='btn btn-sm btn-primary add-btn'; addBtn.textContent='Add Code';
  input.addEventListener('focus', ()=>{ console.log('[Assistant] custom input focus for chunk', chunkId); });
  input.addEventListener('blur', (ev)=>{ console.log('[Assistant] custom input blur for chunk', chunkId); });
  addBtn.onclick = async ()=>{ const val = input.value.trim(); if(!val) return; const payload = {chunk_id: chunkId, code: val, label: val, category:'', indicator:'', speaker: chunk.speaker||'', semantic: sem, selected_by_user: true}; await addFirstCycleCode(payload); input.value=''; renderChunkCodeMarkers(); renderFirstCycleList(); };
  customRow.appendChild(input); customRow.appendChild(addBtn);
  wrap.appendChild(customRow);
  // ensure input retains focus after mount
  setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 50);
  suggestions.forEach(s=>{ const codeText = (typeof s==='string')? s : (s.code||s); const chip = document.createElement('div'); chip.className='chip'; chip.textContent = codeText; try{ chip.style.background = (s.color || (s.category ? categoryToColor(s.category) : '')) || '#f3f3f3'; }catch(e){}; chip.onclick = async (ev)=>{ ev.stopPropagation(); // add code to first-cycle preserving color/category
      const category = (s && s.category) ? s.category : (chunk && chunk.indicators && Object.keys(chunk.indicators||{})[0]) || ''; const payload = {chunk_id: chunkId, code: codeText, label: codeText, category: category, indicator: s && s.indicator || '', speaker: chunk.speaker || '', semantic: sem, selected_by_user: true, color: s && s.color};
      await addFirstCycleCode(payload);
      renderChunkCodeMarkers();
      renderFirstCycleList();
    }; chips.appendChild(chip); });
  wrap.appendChild(chips);
  const semanticWrap = document.createElement('div'); semanticWrap.className = 'semantic-wrap';
  const semanticLabel = document.createElement('div'); semanticLabel.className = 'semantic-label small text-muted'; semanticLabel.textContent = 'AI Suggestion:';
  const semanticText = document.createElement('div'); semanticText.className = 'semantic'; semanticText.textContent = sem || '';
  semanticWrap.appendChild(semanticLabel);
  semanticWrap.appendChild(semanticText);
  wrap.appendChild(semanticWrap);
  // AI Summaries per paragraph
  try{
    const summariesWrap = document.createElement('div'); summariesWrap.className='summaries-wrap';
    summariesWrap.style.marginBottom = '15px';
    const sumLabel = document.createElement('div'); sumLabel.className='semantic-label small text-muted'; sumLabel.textContent = 'Ide Pokok:';
    summariesWrap.appendChild(sumLabel);
    const paras = (chunk.text || '').split(/\n\s*\n/).map(p=>p.trim()).filter(p=>p);
    if(paras.length===0){ const none = document.createElement('div'); none.className='small text-muted'; none.textContent='No paragraph text available'; summariesWrap.appendChild(none); }
    paras.forEach((p, idx)=>{
      const item = document.createElement('div'); item.className='summary-item small';
      const out = document.createElement('div'); out.className='summary-out'; out.textContent = 'Loading summary...';
      item.appendChild(out); summariesWrap.appendChild(item);
      // async fetch summary for this paragraph
      (async ()=>{
        try{
          const resp = await fetch('/api/summarize', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: p, sentences: 1})});
          const jd = await safeJson(resp);
          if(jd && Array.isArray(jd.summary) && jd.summary.length){ out.textContent = jd.summary.join(' '); }
          else if(jd && jd.summary && typeof jd.summary === 'string'){ out.textContent = jd.summary; }
          else { out.textContent = '-'; }
        }catch(err){ out.textContent = '-'; }
      })();
    });
    wrap.appendChild(summariesWrap);
  }catch(e){ console.warn('Summaries rendering failed', e); }
  
  // insert assistant after chunk element
  chunkEl.appendChild(wrap);
  _openInlineAssistantId = chunkId;
  _assistantState.open = true;
  console.log('[Assistant] opened for chunk', chunkId);
}

function renderChunkCodeMarkers(){
  // remove existing markers
  document.querySelectorAll('.chunk-code-refs').forEach(el=>el.remove());
  const map = {};
  (window._firstCycle || []).forEach(fc=>{ const cid = fc.chunk_id || fc.chunk; if(!cid) return; map[cid] = map[cid] || []; map[cid].push(fc); });
  Object.keys(map).forEach(k=>{ const cid = parseInt(k); const arr = map[k]; const el = document.getElementById('chunk-'+cid); if(!el) return; const ref = document.createElement('div'); ref.className='chunk-code-refs d-none'; arr.forEach((fc,i)=>{ const sup = document.createElement('sup'); sup.textContent = (i+1); sup.title = (fc.code_name || fc.code || fc.label || ''); ref.appendChild(sup); }); el.querySelector('.chunk-header') && el.querySelector('.chunk-header').appendChild(ref); });
}

// --- First/Second cycle and memo management ---
async function loadFirstCycle(){
  try{
    console.log('[FirstCycle] loadFirstCycle: fetching from server');
    const res = await fetch('/api/first_cycle?doc_id=default');
    const data = await safeJson(res);
    window._firstCycle = data || [];
    renderFirstCycleList();
    console.log('[FirstCycle] loadFirstCycle: fetched', (window._firstCycle||[]).length);
    try{ renderChunkMarkers(); updateMarkerPositions(); }catch(e){}
    try{ if(window.updateAIMentor) window.updateAIMentor(); }catch(e){}
  }catch(e){ console.error('loadFirstCycle', e); }
}

function renderFirstCycleList(){
  const container = document.getElementById('firstCycle'); if(!container) return;
  const listContainer = document.getElementById('firstListContainer'); if(!listContainer) return;
  listContainer.innerHTML = '';
  if(!window._firstCycle || window._firstCycle.length===0){ listContainer.innerHTML = '<div class="small text-muted">No first-cycle codes</div>'; return; }
  // group identical codes and show occurrence counts and related chunks
  const map = {};
  window._firstCycle.forEach(fc=>{
    const label = (fc.code_name || fc.label || fc.code || fc.name || '').toString(); if(!label) return;
    if(!map[label]) map[label] = {label: label, count:0, chunks: new Set(), ids: new Set(), category: fc.category || '', color: fc.code_color || fc.color || categoryToColor(fc.category)};
    map[label].count += (fc.occurrences || fc.count || 1);
    if(fc.chunk_id) map[label].chunks.add(fc.chunk_id);
    if(fc.id) map[label].ids.add(fc.id);
  });
  Object.keys(map).sort((a,b)=> map[b].count - map[a].count).forEach(k=>{
    const item = map[k];
    const row = document.createElement('div'); row.className='mb-2 p-2 border rounded first-code-item d-flex justify-content-between align-items-start';
    row.style.cursor='pointer'; const rowColor = item.color || colorFromLabel(item.label); row.style.borderLeft = '4px solid ' + rowColor;
    const left = document.createElement('div');
    const title = document.createElement('div'); title.innerHTML = `<strong>${escapeHtml(item.label)}</strong> <span class="small text-muted">(x${item.count})</span>`;
    left.appendChild(title);
    const meta = document.createElement('div'); meta.className='small text-muted'; meta.textContent = 'Chunks: ' + Array.from(item.chunks).join(', ');
    left.appendChild(meta);
    // action buttons
    const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='6px';
    const renameBtn = document.createElement('button'); renameBtn.className='btn btn-sm btn-outline-secondary'; renameBtn.textContent='✎';
    const mergeBtn = document.createElement('button'); mergeBtn.className='btn btn-sm btn-outline-primary'; mergeBtn.textContent='♾';
    const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-outline-danger'; delBtn.textContent='🗑';
    actions.appendChild(renameBtn); actions.appendChild(mergeBtn); actions.appendChild(delBtn);
    // drag support
    row.setAttribute('draggable','true');
    row.addEventListener('dragstart', (ev)=>{ ev.dataTransfer.setData('text/plain', JSON.stringify({code: item.label})); });
    // change: click opens edit/delete dialog for a single occurrence
    left.title = 'Click to Edit / Delete occurrence';
    left.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      // open edit modal for the first matching occurrence id (user can edit or delete there)
      const ids = Array.from(item.ids);
      if(ids.length){ const idToEdit = ids[0]; openEditCodeModal(idToEdit, item.label); }
    });
    // rename handler: update all entries with these ids
    renameBtn.onclick = async (ev)=>{ ev.stopPropagation(); const newLabel = prompt('Rename code', item.label); if(!newLabel || newLabel===item.label) return; const ids = Array.from(item.ids); await Promise.all(ids.map(id=> fetch('/api/first_cycle/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', code_name:newLabel})}))); await loadFirstCycle(); await loadSecondCycle(); };
    // merge handler: ask for target name
    mergeBtn.onclick = async (ev)=>{ ev.stopPropagation(); const target = prompt('Merge into (target code label)'); if(!target) return; const sources = [item.label]; const res = await fetch('/api/first_cycle/merge', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', target: target, sources: sources})}); await safeJson(res); await loadFirstCycle(); await loadSecondCycle(); };
    // delete handler: delete a single occurrence (first matching id) by default
    delBtn.onclick = async (ev)=>{ ev.stopPropagation(); const ids = Array.from(item.ids); if(ids.length===0) return; const idToDel = ids[0]; if(!confirm('Delete this occurrence of ' + item.label + '?')) return; await fetch('/api/first_cycle/'+idToDel + '?doc_id=default', {method:'DELETE'}); await loadFirstCycle(); await loadSecondCycle(); };
    row.appendChild(left);
    row.appendChild(actions);
    listContainer.appendChild(row);
  });
  console.log('[FirstCycle] renderFirstCycleList: rendered items', listContainer.querySelectorAll('.first-code-item').length);
  try{ if(window.updateAIMentor) window.updateAIMentor(); }catch(e){}
}

async function addFirstCycleCode(payload){
  // payload: {chunk_id, code, indicator, speaker, semantic}
  try{
    console.log('[FirstCycle] Sending add request', payload);
    const res = await fetch('/api/first_cycle', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({doc_id:'default'}, payload))});
    const data = await safeJson(res);
    if(res.ok){
      console.log('[FirstCycle] Add response', data);
      showToast('Code saved to First Cycle', 'success');
      // reload authoritative data from server
        await loadFirstCycle();
        try{ await loadSecondCycle(); }catch(e){}
        renderChunkCodeMarkers();
        try{ renderChunkMarkers(); updateMarkerPositions(); }catch(e){}
      try{ if(window.updateAIMentor) window.updateAIMentor(); }catch(e){}
      if(window.SecondCycle && window.SecondCycle.renderSelected) window.SecondCycle.renderSelected();
      console.log('[FirstCycle] First Cycle refreshed from server');
    } else {
      console.error('[FirstCycle] Add failed', data);
      showToast('Failed to save code', 'error');
    }
  }catch(e){ console.error('addFirstCycle', e); }
}

async function removeFirstCycle(entry){
  try{
    // find matching entries from server and delete by id
    const res = await fetch('/api/first_cycle?doc_id=default');
    const data = await safeJson(res);
    const toDelete = (data||[]).filter(e=> (e.chunk_id == entry.chunk_id) && ((e.code_name || e.code || e.label) == (entry.code || entry.label || entry.code_name)) );
    await Promise.all(toDelete.map(d=> fetch('/api/first_cycle/' + d.id + '?doc_id=default', {method:'DELETE'})));
    await loadFirstCycle();
    renderChunkCodeMarkers();
    try{ renderChunkMarkers(); updateMarkerPositions(); }catch(e){}
  }catch(e){ console.error('removeFirstCycle', e); }
}

async function loadSecondCycle(){
  try{
    const res = await fetch('/api/second_cycle?doc_id=default');
    const data = await safeJson(res);
    window._secondCycle = data || [];
    // delegate rendering to SecondCycle manager (new UI)
    try{ if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') await window.SecondCycle.refresh(); }catch(e){ console.warn('SecondCycle.refresh failed', e); }
  }catch(e){ console.error('loadSecondCycle', e); }
}

function renderSecondCycleList(){
  // old UI removed. Rendering is delegated to SecondCycle manager.
  try{ if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') window.SecondCycle.refresh(); }catch(e){ console.warn('renderSecondCycleList delegate failed', e); }
}

async function promoteToSecondCycleFromFirst(fc){
  const defaultLabel = fc.code_name || fc.code || fc.label || '';
  // delegate promotion to server and refresh SecondCycle UI
  try{
    await fetch('/api/second_cycle/promote', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', theme: defaultLabel, codes:[defaultLabel], chunks:[fc.chunk_id], created: new Date().toISOString()})});
    if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') await window.SecondCycle.refresh();
    showToast('Promoted to second-cycle', 'success');
  }catch(e){ console.error('promote', e); showToast('Promotion failed', 'error'); }
}

// --- Memo rich ---
async function addRichMemo(payload){
  try{
    const res = await fetch('/api/memos_rich', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({doc_id:'default'}, payload))});
    const data = await safeJson(res);
    showToast('Memo saved', 'success');
    loadMemos();
  }catch(e){ console.error('addRichMemo', e); }
}

function renderLeftSidebar(data){
  const docStructure = document.getElementById('docStructure'); docStructure.innerHTML = '';
  const chunks = data.chunks || [];
  // simple grouping by paragraph header if available (use chunk ids)
  chunks.forEach(c=>{
    const li = document.createElement('li'); li.className='doc-struct-item'; li.style.cursor='pointer'; li.textContent = `${c.chunk_id} — ${c.speaker || 'unknown'}`;
    li.onclick = ()=>{ const el = document.querySelector(`#chunk-${c.chunk_id}`); if(el) el.scrollIntoView({behavior:'smooth', block:'center'}); document.querySelectorAll('.chunk-card').forEach(x=>x.classList.remove('chunk-active')); if(el) el.classList.add('chunk-active'); }; docStructure.appendChild(li);
  });

  // ensure the absolute structure toggle button is wired to show/hide the structure UI
  try{
    const showBtn = document.getElementById('showStructureBtn');
    if(showBtn){
      showBtn.onclick = ()=>{
        const body = document.body;
        const isShown = body.classList.toggle('show-left-sidebar');
        if(isShown){ showBtn.classList.add('close'); showBtn.textContent = 'Close Structure'; }
        else { showBtn.classList.remove('close'); showBtn.textContent = 'Structure'; }
      };
    }
  }catch(e){ console.warn('structure toggle wiring failed', e); }

  // clusters list (only if present)
  const clusterList = document.getElementById('clusterList'); if(clusterList) clusterList.innerHTML = '';
  (data.clusters||[]).forEach(cl=>{
    const card = document.createElement('div'); card.className='mb-2 p-2 border rounded cluster-card';
    const title = document.createElement('div'); title.innerHTML = `<strong>${escapeHtml(cl.theme||cl.theme_label||('Cluster '+cl.cluster_id))}</strong>`;
    const meta = document.createElement('div'); meta.className='small text-muted'; meta.textContent = `${(cl.chunks||[]).length} chunks • ${ (cl.dominant_indicators||[]).length } indicators`;
    // color by top dominant indicator if available (soft pastels)
    const topInd = (cl.dominant_indicators||[])[0];
    if(topInd){ const leftColor = (topInd === 'aktor') ? '#eaf6ff' : (topInd === 'tindakan') ? '#eaf9ec' : '#f0f0f0'; card.style.borderLeft = '4px solid ' + leftColor; }
    card.appendChild(title); card.appendChild(meta);
    card.onclick = ()=>{ // highlight chunks
      // clear states
      document.querySelectorAll('.chunk-card').forEach(x=>{ x.classList.remove('chunk-active'); x.classList.remove('chunk-dim'); });
      // activate related chunks and scroll to first
      const related = (cl.chunks||[]).slice();
      related.forEach((cid,i)=>{ const el = document.getElementById('chunk-'+cid); if(el){ el.classList.add('chunk-active'); if(i===0) el.scrollIntoView({behavior:'smooth', block:'center'}); } });
      // dim unrelated
      document.querySelectorAll('.chunk-card').forEach(x=>{ const id = parseInt(x.id.replace('chunk-','')); if(!related.includes(id)) x.classList.add('chunk-dim'); });
      // delegate cluster detail rendering to SecondCycle manager if available
      try{
        if(window.SecondCycle && typeof window.SecondCycle.showClusterDetail === 'function'){
          window.SecondCycle.showClusterDetail(cl);
        } else if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function'){
          window.SecondCycle.refresh();
        }
      }catch(e){ console.warn('SecondCycle detail delegation failed', e); }
    };
    if(clusterList) clusterList.appendChild(card);
  });

  
}

async function renderMainChunks(data){
  const container = document.getElementById('chunksContainer'); container.innerHTML = '';
  const chunks = data.chunks || [];
  // fetch existing rich memos once and map by chunk
  let memosByChunk = {};
  try{
    const res = await fetch('/api/memos_rich?doc_id=default');
    const mdata = await safeJson(res) || [];
    (mdata||[]).forEach(m=>{ if(m.chunk_id){ memosByChunk[m.chunk_id] = memosByChunk[m.chunk_id] || []; memosByChunk[m.chunk_id].push(m); } });
  }catch(e){ /* ignore memos fetch error */ }
  // helper: color map for categories
  const categoryColorMap = {
    aktor: '#cfe8ff', // pastel blue
    tindakan: '#dff7e0', // pastel green
    evaluasi: '#fff4c7', // pastel yellow
    modalitas: '#dff7fa', // pastel cyan
    kausalitas: '#ffd6d6', // pastel red
    emosi: '#f1d9ff', // pastel purple
    hambatan: '#f0f0f0', // light gray
    solusi: '#d7f7f1', // pastel teal
    motivasi: '#ffe7d2' // pastel orange
  };

  function highlightIndicatorsInText(text, indicators){
    // Do not render inline indicator spans — return plain escaped text
    return escapeHtml(text);
  }
  chunks.forEach(c=>{
    const card = document.createElement('div'); card.className='chunk-card'; card.id = 'chunk-'+c.chunk_id; card.dataset.codes = (c.codes||[]).map(x=>x.code).join('|');
    const header = document.createElement('div'); header.className='chunk-header';
    const meta = document.createElement('div'); meta.className='chunk-meta';
    const sp = document.createElement('span'); sp.className = 'speaker-badge ' + (c.speaker ? ('speaker-'+c.speaker) : 'speaker-unknown'); sp.textContent = c.speaker || 'unknown';
    const cid = document.createElement('span'); cid.className='badge bg-light text-dark'; cid.textContent = 'Chunk ' + c.chunk_id;
    const clusterBadge = document.createElement('span'); clusterBadge.className='cluster-badge d-none'; clusterBadge.textContent = (c.cluster_id ? ('Cluster '+c.cluster_id) : (c.cluster || '-'));
    // Replace confidence badge with a memo button
    const conf = document.createElement('button'); conf.className='btn btn-sm btn-outline-secondary confidence-badge memo-btn'; conf.textContent = 'Memo';
    // wire memo button to open modal for memo entry
    conf.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      openMemoModal(c.chunk_id);
    });
    meta.appendChild(sp); meta.appendChild(cid); meta.appendChild(clusterBadge);
    header.appendChild(meta); header.appendChild(conf);
    const body = document.createElement('div'); body.className='chunk-body';
    // render text with inline indicator highlights
      body.innerHTML = highlightIndicatorsInText(c.text || '', c.indicators || {}); 
      // make suggested code chips clickable to add to First-Cycle with metadata and duplicate prevention
      // suggested codes hidden by default to reduce visual clutter (displayed only in inline assistant)
    // omit indicator summary per user request
    const footer = document.createElement('div'); footer.className='chunk-footer mt-2';
    // do not render semantic relation text in footer per request
    // render existing memos for this chunk (show only memo text)
    const existing = memosByChunk[c.chunk_id] || [];
    existing.forEach(m=>{
      const md = document.createElement('div'); md.className = 'memo-entry memo-entry-dark';
      const left = document.createElement('div'); left.className = 'memo-content';
      const label = document.createElement('div'); label.className = 'memo-label small text-muted'; label.textContent = 'Memo:';
      const txt = document.createElement('div'); txt.className = 'memo-text'; txt.textContent = (m.memo_text || m.text || '');
      left.appendChild(label);
      left.appendChild(txt);
      const actions = document.createElement('div'); actions.className = 'memo-actions';
      if(m.id){
        const del = document.createElement('button'); del.className = 'memo-delete-btn'; del.textContent = 'Delete';
        del.onclick = async (ev)=>{ ev.stopPropagation(); try{ await fetch('/api/memos_rich/'+m.id + '?doc_id=default', {method:'DELETE'}); await loadMemosRich(); await renderMainChunks(window._lastAnalysis || {}); showToast('Memo deleted', 'success'); }catch(e){ console.error(e); showToast('Failed to delete memo', 'error'); } };
        actions.appendChild(del);
      }
      md.appendChild(left);
      md.appendChild(actions);
      footer.appendChild(md);
    });
    // set border color by dominant indicator if available
    const domInd = (c.indicators && Object.keys(c.indicators||{}).find(k=> (c.indicators[k]||[]).length )) || null;
    if(domInd && categoryColorMap[domInd]){ card.style.borderLeft = '4px solid ' + categoryColorMap[domInd]; }
    card.appendChild(header); card.appendChild(body); card.appendChild(footer);
    card.onclick = ()=>{ selectChunk(c.chunk_id); renderInlineAssistant(c.chunk_id); };
    container.appendChild(card);
  });
  // initialize document viewer markers and interactions after chunks render
  try{ initDocumentViewer(); }catch(e){ console.warn('initDocumentViewer failed', e); }
  try{ if(window.updateAIMentor) window.updateAIMentor(); }catch(e){}
}

// ---------------- Document viewer + Marker gutter ----------------
let _markerState = { observers: [], resizeObs: null, debouncedUpdate: null };
function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, arguments), wait); }; }
function abbreviateLabel(label){ if(!label) return ''; const parts = label.split(/\s+/).map(p=> p.replace(/[^A-Za-z0-9]/g,'').toUpperCase()).filter(Boolean); if(parts.length===0) return label.slice(0,3).toUpperCase(); if(parts.length===1) return parts[0].slice(0,3); // use first two words only
  return parts.slice(0,2).map(p=> p.slice(0,3)).join(''); }

function colorFromLabel(label){ if(!label) return '#d0d0d0'; let h = 0; for(let i=0;i<label.length;i++){ h = (h*31 + label.charCodeAt(i)) | 0; } h = Math.abs(h) % 360; return `hsl(${h} 60% 80%)`; }

function initDocumentViewer(){
  const gutter = document.getElementById('markerGutter');
  const scroll = document.getElementById('docViewerScroll');
  const page = document.getElementById('docPage');
  if(!gutter || !scroll || !page) return;
  // render markers initially
  renderChunkMarkers();
  // attach observers: resize + mutation for firstCycle changes
  if(_markerState.resizeObs) _markerState.resizeObs.disconnect();
  _markerState.resizeObs = new ResizeObserver(debounce(()=> updateMarkerPositions(), 80));
  _markerState.resizeObs.observe(page);
  // observe chunk size changes
  document.querySelectorAll('.chunk-card').forEach(ch=>{ try{ _markerState.resizeObs.observe(ch); }catch(e){} });
  // watch window resize and scroll: recalc positions on events
  window.addEventListener('resize', debounce(()=> updateMarkerPositions(), 120));
  // ensure gutter height matches page so absolute tops align
  try{ gutter.style.height = page.scrollHeight + 'px'; }catch(e){}
  scroll.addEventListener('scroll', debounce(()=> updateMarkerPositions(), 16));
  // watch firstCycle changes via MutationObserver on firstListContainer to enable two-way sync pulses
  const firstList = document.getElementById('firstListContainer');
  if(firstList){ const mo = new MutationObserver(debounce(()=>{ bindFirstCycleClicks(); renderChunkMarkers(); }, 120)); mo.observe(firstList, {childList:true, subtree:true}); _markerState.observers.push(mo); }
}

function renderChunkMarkers(){
  const gutter = document.getElementById('markerGutter'); if(!gutter) return;
  gutter.innerHTML = '';
  // build mapping: chunkId -> list of codes
  const map = {};
  (window._firstCycle || []).forEach(fc=>{ const cid = fc.chunk_id || fc.chunk; if(!cid) return; map[cid] = map[cid] || []; map[cid].push(fc); });
  // for each chunk that has codes, create stacked markers
  Object.keys(map).forEach(k=>{
    const cid = parseInt(k);
    const arr = map[k];
    // compute vertical position relative to the page: find chunk element
    const ch = document.getElementById('chunk-'+cid);
    if(!ch) return;
    // create a container to host stacked markers. use offsetTop relative to docPage
    const top = ch.offsetTop || 0;
    // for each code, create pill
    arr.forEach((fc, idx)=>{
      const pill = document.createElement('div'); pill.className = 'marker-pill stack';
      pill.dataset.chunk = cid; pill.dataset.code = (fc.code_name || fc.code || fc.label || fc.name || '').toString();
      const label = abbreviateLabel(pill.dataset.code || ''); pill.textContent = label || (idx+1);
      // color
      const color = fc.code_color || fc.color || (fc.category ? categoryToColor(fc.category) : '') || colorFromLabel(pill.dataset.code || '');
      pill.style.background = color;
      // position (absolute inside docPage)
      pill.style.top = (top + (idx * 26)) + 'px';
      // hover tooltip
      pill.addEventListener('mouseenter', (ev)=> showMarkerTooltip(ev, fc));
      pill.addEventListener('mouseleave', (ev)=> hideMarkerTooltip());
      // click behavior
      pill.addEventListener('click', (ev)=>{ ev.stopPropagation(); onMarkerClick(pill.dataset.chunk, pill.dataset.code); });
      gutter.appendChild(pill);
    });
  });
  // schedule position update
  updateMarkerPositions();
}

function updateMarkerPositions(){
  const gutter = document.getElementById('markerGutter'); if(!gutter) return;
  const pageRect = document.getElementById('docPage').getBoundingClientRect();
  const scrollEl = document.getElementById('docViewerScroll');
  const scrollTop = scrollEl.scrollTop;
  const pills = Array.from(gutter.querySelectorAll('.marker-pill'));
  pills.forEach(pill=>{
    const cid = parseInt(pill.dataset.chunk);
    const ch = document.getElementById('chunk-'+cid);
    if(!ch) return;
    // compute top relative to docPage
    const top = ch.offsetTop || 0;
    // if stacked, adjust by index order
    const idx = Array.from(gutter.querySelectorAll(`.marker-pill[data-chunk="${cid}"]`)).indexOf(pill);
    pill.style.top = (top + (idx * 26)) + 'px';
    // hide pills that are out of viewport to improve performance
    const visibleTop = scrollEl.scrollTop; const visibleBottom = visibleTop + scrollEl.clientHeight;
    if((ch.offsetTop + (idx*26)) < visibleTop - 20 || ch.offsetTop > visibleBottom + 20) pill.style.opacity = '0.35'; else pill.style.opacity = '1';
  });
}

function showMarkerTooltip(ev, fc){
  hideMarkerTooltip();
  const tip = document.createElement('div'); tip.className = 'marker-tooltip';
  const name = fc.code_name || fc.code || fc.label || fc.name || '';
  const freq = (window._firstCycle || []).filter(x=> (x.code_name||x.code||x.label) === name).length;
  tip.innerHTML = `<strong>${escapeHtml(name)}</strong><div class="small text-muted">Frequency: ${freq}</div>${fc.memo ? ('<div class="mt-1">'+ escapeHtml(fc.memo) +'</div>') : ''}`;
  document.body.appendChild(tip);
  const r = ev.target.getBoundingClientRect(); tip.style.left = (r.right + 8) + 'px'; tip.style.top = (r.top) + 'px';
  _markerState._tooltip = tip;
}
function hideMarkerTooltip(){ if(_markerState._tooltip){ _markerState._tooltip.remove(); _markerState._tooltip = null; } }

function onMarkerClick(chunkId, codeLabel){
  // scroll to chunk and highlight
  const el = document.getElementById('chunk-'+chunkId);
  if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('chunk-active'); setTimeout(()=> el.classList.remove('chunk-active'), 1600); }
  // open corresponding code in First Cycle panel by finding matching item and triggering its left click
  try{
    const nodes = Array.from(document.querySelectorAll('#firstListContainer .first-code-item'));
    for(const n of nodes){ if((n.textContent||'').includes(codeLabel)){ const left = n.querySelector('div'); if(left){ left.click(); break; } } }
  }catch(e){ console.warn('onMarkerClick sync to first cycle failed', e); }
  // highlight chunk and open assistant if possible
  try{ renderInlineAssistant(parseInt(chunkId)); }catch(e){}
  // pulse marker
  try{ const gutter = document.getElementById('markerGutter'); const pill = gutter.querySelector(`.marker-pill[data-chunk="${chunkId}"][data-code="${codeLabel}"]`); if(pill){ pill.classList.add('pulse'); setTimeout(()=> pill.classList.remove('pulse'), 1000); } }catch(e){}
}

function bindFirstCycleClicks(){
  const list = document.getElementById('firstListContainer'); if(!list) return;
  Array.from(list.querySelectorAll('.first-code-item')).forEach(item=>{
    const left = item.querySelector('div'); if(!left) return;
    if(left.dataset._bound) return; left.dataset._bound = '1';
    // clicking a code item deletes it (handled in renderFirstCycleList); here we only provide hover affordance
    left.style.cursor = 'pointer';
    left.title = left.title || 'Click to Delete';
  });
}

function renderRightPanels(data){
  // first-cycle: preserve existing first-cycle panel DOM (do not wipe)
  const first = document.getElementById('firstCycle');
  if(!first || first.querySelector('#firstListContainer')==null){
    // ensure panel structure exists
    try{ renderPanels(); }catch(e){ console.warn('renderPanels failed during renderRightPanels', e); }
  }
  // delegate second-cycle rendering to SecondCycle manager
  try{ if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') window.SecondCycle.refresh(); }catch(e){ console.warn('SecondCycle.refresh failed', e); }
  const memo = document.getElementById('memoPanel'); if(memo) memo.innerHTML = '';
  // memos: use existing loadMemos to fill memo panel below (guard if function missing)
  try{ if(typeof loadMemos === 'function') loadMemos(); }catch(e){ console.warn('loadMemos missing or errored', e); }
  // ensure authoritative First/Second/Memo data is loaded after workspace render (guard calls)
  (async ()=>{ try{ if(typeof loadFirstCycle === 'function') await loadFirstCycle(); if(typeof loadSecondCycle === 'function') await loadSecondCycle(); if(typeof loadMemosRich === 'function') await loadMemosRich(); }catch(e){ console.warn('failed to reload cycles after renderRightPanels', e); } })();
}

// handle clicks on inline indicator pills inside chunk cards
const _chunksContainerEl = document.getElementById('chunksContainer');
if(_chunksContainerEl){ _chunksContainerEl.addEventListener('click', async (ev)=>{
  const pill = ev.target.closest && ev.target.closest('.indicator-pill');
  if(!pill) return;
  ev.stopPropagation();
  const indicator = pill.getAttribute('data-indicator');
  const category = pill.getAttribute('data-category');
  const chunkEl = pill.closest && pill.closest('.chunk-card');
  if(!chunkEl) return;
  const chunkId = parseInt(chunkEl.id.replace('chunk-',''));
  // find chunk object from last analysis
  const chunk = (window._lastAnalysis && window._lastAnalysis.chunks||[]).find(x=>x.chunk_id===chunkId) || {};
  // suggested codes: prefer chunk.codes filtered by category
  // Show suggestions but do NOT auto-add; researcher must click chips to add
  const suggestions = (chunk.codes||[]).filter(s=> (s.category||'').toLowerCase() === (category||'').toLowerCase()).slice(0,5);
  // fallback: take top codes
  const chosen = suggestions.length ? suggestions.map(s=>s.code) : (chunk.codes||[]).slice(0,3).map(s=>s.code);
  // show chunk and suggestions in right panel for researcher to click
  selectChunk(chunkId);
  showToast(`Suggestions shown for chunk ${chunkId} — click a code to add`, 'info');
}); }

// click outside any chunk or assistant closes the inline assistant
// click outside any chunk, assistant, or right-panel controls closes the inline assistant
document.addEventListener('click', (ev)=>{
  try{
    const tgt = ev.target;
    if(!tgt) return;
    // allow clicks inside chunk cards, inline assistant, first/second/memo panels
    if(tgt.closest && (tgt.closest('.chunk-card') || tgt.closest('.inline-assistant') || tgt.closest('#firstCycle') || tgt.closest('#secondCycle') || tgt.closest('#memoPanel'))) return;
    _closeAssistantLogged();
  }catch(e){ console.error('click handler error', e); }
});

function selectChunk(chunkId){
  document.querySelectorAll('.chunk-card').forEach(x=>x.classList.remove('chunk-active'));
  const el = document.getElementById('chunk-'+chunkId); if(el) el.classList.add('chunk-active');
  // show chunk details (do NOT populate First-Cycle automatically)
  const chunk = (window._lastAnalysis && window._lastAnalysis.chunks||[]).find(x=>x.chunk_id===chunkId);
  if(!chunk){ return; }
  // populate memo panel with memos related to this chunk
  (async ()=>{
    try{
      const res = await fetch('/api/memos_rich?doc_id=default');
      const mems = await safeJson(res);
      const memoPanel = document.getElementById('memoPanel'); if(!memoPanel) return; memoPanel.innerHTML = '';
      const attachLabel = document.createElement('div'); attachLabel.className='small text-muted'; attachLabel.textContent = `Memo context: Chunk ${chunkId}`;
      const ta = document.createElement('textarea'); ta.className='form-control'; ta.placeholder = 'Add memo for this chunk...';
      const saveBtn = document.createElement('button'); saveBtn.className='btn btn-sm btn-primary mt-2'; saveBtn.textContent='Save memo';
      saveBtn.onclick = async ()=>{ await addRichMemo({author:'me', memo_text: ta.value, chunk_id: chunkId}); ta.value=''; loadMemos(); };
      memoPanel.appendChild(attachLabel); memoPanel.appendChild(ta); memoPanel.appendChild(saveBtn);
      const related = mems.filter(m=> m.chunk_id == chunkId);
      if(related.length){ const list = document.createElement('div'); list.className='mt-2'; related.forEach(m=>{ const d = document.createElement('div'); d.className='small border rounded p-1 mb-1'; d.textContent = `${m.created||''} ${m.author||''}: ${m.memo_text||m.text||''}`; list.appendChild(d); }); memoPanel.appendChild(list); }
    }catch(e){ console.error(e); }
  })();
  // update second-cycle panel to show themes including this chunk
  try{
    try{
      const related = (window._secondCycle||[]).filter(th=> (th.chunks||[]).includes(chunkId));
      if(window.SecondCycle && typeof window.SecondCycle.showRelatedForChunk === 'function'){
        window.SecondCycle.showRelatedForChunk(chunkId, related);
      } else if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function'){
        window.SecondCycle.refresh();
      }
    }catch(e){ console.warn('SecondCycle related-for-chunk delegation failed', e); }
  }catch(e){ }
}

function selectSuggestedCode(chunk, sc){
  // populate right panel first-cycle with code detail
  selectChunk(chunk.chunk_id);
  // open a small modal or toast with explanation
  showToast(`Selected code ${sc.code} for chunk ${chunk.chunk_id}`, 'success');
}

function promoteToSecondCycle(chunk, sc){
  // promote: call backend or update UI to link code to theme; for now show toast
  showToast(`Promoted ${sc.code} to second-cycle theme`, 'success');
}

// store last analysis for selection lookup
function storeLastAnalysis(data){ window._lastAnalysis = data || {}; }

// Notification helper using Bootstrap toasts
function showToast(message, type='info'){
  const container = document.getElementById('toastContainer');
  if(!container) return alert(message);
  const colorClass = type === 'success' ? 'success' : (type === 'error' ? 'danger' : 'primary');
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${colorClass} border-0`;
  toastEl.setAttribute('role','alert'); toastEl.setAttribute('aria-live','assertive'); toastEl.setAttribute('aria-atomic','true');
  toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  container.appendChild(toastEl);
  const bsToast = new bootstrap.Toast(toastEl, {delay:4000});
  bsToast.show();
  toastEl.addEventListener('hidden.bs.toast', ()=> toastEl.remove());
}

// single delegated click handler for highlight spans and tooltip/selection handlers (if corpus exists)
const _corpusEl = document.getElementById('corpus');
let tooltipTimer = null;
const tooltip = document.createElement('div'); tooltip.className='popup'; tooltip.style.position='fixed'; tooltip.style.display='none'; document.body.appendChild(tooltip);
if(_corpusEl){
  _corpusEl.addEventListener('click', (ev)=>{
    const target = ev.target;
    const span = target.closest && target.closest('span[data-id]');
    if(!span) return;
    ev.stopPropagation();
    // find containing chunk by walking up to .chunk-card
    const chunkEl = span.closest && span.closest('.chunk-card');
    if(chunkEl){ const cid = parseInt(chunkEl.id.replace('chunk-','')); renderInlineAssistant(cid); }
  });

  _corpusEl.addEventListener('mouseover', (ev)=>{
    const span = ev.target.closest && ev.target.closest('span[data-id]');
    if(!span) return;
    tooltipTimer = setTimeout(()=>{
      const code = span.getAttribute('data-code') || '';
      const cat = span.getAttribute('data-category') || '';
      const sem = span.getAttribute('data-semantic') || '';
      tooltip.innerHTML = `<strong>Code:</strong> ${escapeHtml(code)}<br/><strong>Category:</strong> ${escapeHtml(cat)}<br/><strong>AI Suggestion:</strong><div>${escapeHtml(sem)}</div>`;
      const r = span.getBoundingClientRect(); tooltip.style.left = (r.right+4)+'px'; tooltip.style.top = (r.top)+'px'; tooltip.style.display='block';
    }, 250);
  });
  _corpusEl.addEventListener('mouseout', (ev)=>{ if(tooltipTimer) clearTimeout(tooltipTimer); tooltip.style.display='none'; });

  // reloadModules button removed from toolbar; use module dropdown to change active module
  _corpusEl.addEventListener('mouseup', async (e) => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  if(!activeModule){ alert('Select a module first'); sel.removeAllRanges(); return; }
  // compute start/end offsets relative to corpusText
  const range = sel.getRangeAt(0);
  const {start, end} = getRangeCharOffsets(range, document.getElementById('corpus'));
  if(start==null){ sel.removeAllRanges(); return; }
  const text = corpusText.slice(start,end);
  // run detection to get suggestions and semantic relationship
  let detection = null;
  try{
    const resp = await fetch('/api/detect', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text})});
    detection = await safeJson(resp);
  }catch(e){ detection = null; }

  const rect = range.getBoundingClientRect();
  const initial = {start, end, text, suggestions: detection ? detection.suggestions : [], indicators: detection ? detection.indicators : {}, semantic_relationship: detection ? detection.semantic_relationship : {}};
  // determine containing chunk and show inline assistant with detection
  const containerNode = range.commonAncestorContainer;
  let node = containerNode.nodeType === 3 ? containerNode.parentNode : containerNode;
  const chunkEl = node.closest && node.closest('.chunk-card');
  const chunkId = chunkEl ? parseInt(chunkEl.id.replace('chunk-','')) : null;
  if(chunkId){ renderInlineAssistant(chunkId, detection); }
  sel.removeAllRanges();
});
}

async function openEditorForHighlight(id, rect){
  // Instead of opening a popup, open inline assistant for the chunk that contains this highlight (if known)
  const res = await fetch(API.highlights + '?doc_id=default');
  const raw = await safeJson(res);
  const all = Array.isArray(raw) ? raw : (raw && raw.value ? raw.value : []);
  const h = all.find(x=>x.id===id);
  if(!h) return;
  // try to infer containing chunk from highlight text
  let chunkId = h.chunk_id || null;
  if(!chunkId && window._lastAnalysis && window._lastAnalysis.chunks){ const found = window._lastAnalysis.chunks.find(ch=> ch.text && h.text && ch.text.includes( (h.text||'').slice(0,40) )); if(found) chunkId = found.chunk_id; }
  if(chunkId) renderInlineAssistant(chunkId);
}

function getRangeCharOffsets(range, container){
  // walk text nodes to compute offsets
  let charIndex = 0;
  let start = null; let end = null;
  const nodeIterator = document.createNodeIterator(container, NodeFilter.SHOW_TEXT, null);
  let node;
  while(node = nodeIterator.nextNode()){
    if(range.startContainer === node){ start = charIndex + range.startOffset; }
    if(range.endContainer === node){ end = charIndex + range.endOffset; }
    charIndex += node.textContent.length;
  }
  // Fallback: if start or end null, try searching by selected text in corpusText
  if(start==null || end==null){
    const selText = range.toString();
    const idx = corpusText.indexOf(selText);
    if(idx>=0){ start = idx; end = idx + selText.length; }
  }
  return {start, end};
}

function renderPanels(){
  // avoid rebuilding panels while assistant is open and user is typing
  try{ if(_assistantState.open && document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')){ console.log('[Panels] render suppressed while assistant input active'); return; } }catch(e){}
  // First-Cycle panel: researcher-driven list and add-custom UI
  const firstEl = document.getElementById('firstCycle');
  if(!firstEl) return; // nothing to render if panels not present
  firstEl.innerHTML = '';
  const addBtn = document.createElement('button'); addBtn.className='btn btn-sm btn-outline-primary mb-2'; addBtn.textContent = '+ Add Custom Code';
  addBtn.onclick = async ()=>{ const label = prompt('Custom code label'); if(!label) return; const category = prompt('Category (e.g. hambatan, solusi)') || ''; const payload = {chunk_id: null, code: label, indicator: '', speaker: '', semantic: '', category: category, selected_by_user: true}; await addFirstCycleCode(payload); showToast('Custom code added', 'success'); };
  firstEl.appendChild(addBtn);
  // placeholder containers for list and map
  const list = document.createElement('div'); list.id = 'firstListContainer'; firstEl.appendChild(list);
  const map = document.createElement('div'); map.id = 'firstMap'; map.className='first-map'; firstEl.appendChild(map);
  const secondPanelEl = document.getElementById('secondCycle'); if(secondPanelEl){ try{ if(window.SecondCycle && typeof window.SecondCycle.init === 'function') window.SecondCycle.init(); else if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') window.SecondCycle.refresh(); }catch(e){ console.warn('SecondCycle init/refresh failed', e); } }
  // Memo panel starts hidden; populate when memo tab opened
  const memoPanelEl = document.getElementById('memoPanel'); if(memoPanelEl) memoPanelEl.innerHTML = `<h3>Memos</h3><textarea id="memoText" style="width:100%;height:100px"></textarea><button id="saveMemo">Save</button><div id="memosList"></div>`;
  const analyzeFirstBtn = document.getElementById('analyzeFirst');
  if(analyzeFirstBtn){ analyzeFirstBtn.onclick = async ()=>{
    const text = corpusText || '';
    const res = await fetch(API.analyze, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({module: activeModule, text})});
    const data = await safeJson(res);
    const firstResultEl = document.getElementById('firstResult'); if(firstResultEl) firstResultEl.textContent = JSON.stringify(data, null, 2);
  }; }
  const saveMemoBtn = document.getElementById('saveMemo'); if(saveMemoBtn) saveMemoBtn.onclick = async ()=>{ const text = document.getElementById('memoText').value; await fetch(API.memo, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', author:'me', text})}); loadMemos(); };
  // memo tab removed from UI; memoPanel remains hidden and can be populated programmatically

}
// --- Rich memo management using memos_rich ---
async function loadMemosRich(){
  try{
    const res = await fetch('/api/memos_rich?doc_id=default');
    const data = await safeJson(res);
    window._memosRich = data || [];
    renderMemosRich();
    try{ if(window.updateAIMentor) window.updateAIMentor(); }catch(e){}
  }catch(e){ console.error('loadMemosRich', e); }
}

function renderMemosRich(){
  const panel = document.getElementById('memoPanel'); if(!panel) return;
  panel.innerHTML = '';
  const header = document.createElement('div'); header.className='mb-2'; header.innerHTML = '<h5>Memos</h5>';
  const form = document.createElement('div'); form.className='mb-2';
  const ta = document.createElement('textarea'); ta.id='memoTextRich'; ta.className='form-control'; ta.style.height='80px';
  const linkLabel = document.createElement('div'); linkLabel.className='mt-2 small text-muted'; linkLabel.textContent='Link memo to code/theme/chunk (optional)';
  const linkSelect = document.createElement('select'); linkSelect.id='memoLinkSelect'; linkSelect.className='form-select form-select-sm'; const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent='— no link —'; linkSelect.appendChild(opt0);
  // populate options with codes and themes
  (window._firstCycle||[]).forEach(fc=>{ const name = fc.code_name || fc.code || fc.label; const o = document.createElement('option'); o.value = 'code::'+name; o.textContent = 'Code: ' + name; linkSelect.appendChild(o); });
  (window._secondCycle||[]).forEach(th=>{ const o = document.createElement('option'); o.value = 'theme::'+th.theme; o.textContent = 'Theme: ' + th.theme; linkSelect.appendChild(o); });
  const chunkInput = document.createElement('input'); chunkInput.placeholder='Chunk id (optional)'; chunkInput.className='form-control form-control-sm mt-2';
  const saveBtn = document.createElement('button'); saveBtn.className='btn btn-sm btn-primary mt-2'; saveBtn.textContent='Save Memo';
  saveBtn.onclick = async ()=>{ const text = ta.value.trim(); if(!text) return; const link = linkSelect.value; const chunk = chunkInput.value || null; const payload = {author:'me', memo_text: text, chunk_id: chunk || null}; if(link){ if(link.startsWith('code::')) payload.code = link.replace('code::',''); if(link.startsWith('theme::')) payload.cluster_id = link.replace('theme::',''); }
    await fetch('/api/memos_rich', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({doc_id:'default'}, payload))}); ta.value=''; chunkInput.value=''; await loadMemosRich(); };
  form.appendChild(ta); form.appendChild(linkLabel); form.appendChild(linkSelect); form.appendChild(chunkInput); form.appendChild(saveBtn);
  header.appendChild(form); panel.appendChild(header);
  const list = document.createElement('div'); list.id='memosRichList';
  (window._memosRich||[]).forEach(m=>{ const item = document.createElement('div'); item.className='mb-2 p-2 border rounded'; const top = document.createElement('div'); top.innerHTML = `<strong>${escapeHtml(m.author||'')}</strong> <span class='small text-muted'>${m.created||''}</span>`; const body = document.createElement('div'); body.className='small'; body.textContent = m.memo_text || m.text || ''; const meta = document.createElement('div'); meta.className='small text-muted'; meta.textContent = `Chunk: ${m.chunk_id||''} • Code: ${m.code||''} • Theme: ${m.cluster_id||''}`;
    const actions = document.createElement('div'); actions.className='mt-2'; const edit = document.createElement('button'); edit.className='btn btn-sm btn-outline-secondary me-2'; edit.textContent='Edit'; const del = document.createElement('button'); del.className='btn btn-sm btn-outline-danger'; del.textContent='Delete';
    edit.onclick = ()=>{ const newText = prompt('Edit memo', m.memo_text||m.text||''); if(newText==null) return; fetch('/api/memos_rich/'+m.id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', memo_text:newText})}).then(()=> loadMemosRich()); };
    del.onclick = ()=>{ if(!confirm('Delete memo?')) return; fetch('/api/memos_rich/'+m.id + '?doc_id=default', {method:'DELETE'}).then(()=> loadMemosRich()); };
    actions.appendChild(edit); actions.appendChild(del);
    item.appendChild(top); item.appendChild(body); item.appendChild(meta); item.appendChild(actions); list.appendChild(item); });
  panel.appendChild(list);
}

// --- Layout controls: expand / restore / fullscreen / resizer / persistence ---
const PROJECT_KEY = (window.PROJECT_ID || (location && location.pathname) || 'default_project').replace(/\//g,'_');
function layoutStorageKey(key){ return `qcw_layout_${PROJECT_KEY}_${key}`; }

function saveLayoutState(state){ try{ localStorage.setItem(layoutStorageKey('state'), JSON.stringify(state)); }catch(e){} }
function loadLayoutState(){ try{ const v = localStorage.getItem(layoutStorageKey('state')); return v ? JSON.parse(v) : null; }catch(e){ return null; } }

function applyLayoutState(state){ if(!state) return; try{ if(state.mode === 'fullscreen') document.documentElement.classList.add('fullscreen-analysis'); else document.documentElement.classList.remove('fullscreen-analysis'); if(state.expanded){ document.documentElement.classList.add('analysis-expanded'); document.documentElement.setAttribute('data-expanded', state.expanded); const eb = document.getElementById('expandFirstBtn'); if(eb){ eb.textContent = 'Restore'; eb.dataset.expanded = state.expanded; } } else { document.documentElement.classList.remove('analysis-expanded'); document.documentElement.removeAttribute('data-expanded'); const eb = document.getElementById('expandFirstBtn'); if(eb){ eb.textContent = 'Expand'; delete eb.dataset.expanded; } }
    // apply saved widths if provided
    if(state.rightWidthPercent){ try{ document.getElementById('rightPanel').style.flex = `0 0 ${state.rightWidthPercent}%`; document.getElementById('rightPanel').style.maxWidth = `${state.rightWidthPercent}%`; const left = Math.max(8, 100 - state.rightWidthPercent - 2); document.getElementById('mainPanel').style.flex = `0 0 ${left}%`; document.getElementById('mainPanel').style.maxWidth = `${left}%`; // position resizer
      positionResizer(); }catch(e){} }
  }catch(e){ console.error('applyLayoutState', e); } }

function expandPanel(which){ // which: 'first' | 'second' | 'memo'
  console.log('Expand button clicked', which);
  document.documentElement.classList.add('analysis-expanded');
  document.documentElement.setAttribute('data-expanded', which);
  // collapse left sidebar visually
  const left = document.getElementById('leftSidebar'); if(left) left.style.display = 'none';
  // swap sizes: make right panel large (~72%) and main small (~25%)
  const rightPct = 72; const mainPct = 100 - rightPct -  (left && left.offsetWidth?0:0);
  const right = document.getElementById('rightPanel'); const main = document.getElementById('mainPanel');
  if(right && main){ right.style.flex = `0 0 ${rightPct}%`; right.style.maxWidth = `${rightPct}%`; main.style.flex = `0 0 ${mainPct}%`; main.style.maxWidth = `${mainPct}%`; }
  // position resizer
  positionResizer();
  const eb = document.getElementById('expandFirstBtn'); if(eb){ eb.textContent = 'Restore'; eb.dataset.expanded = which; }
  const state = { expanded: which, mode: document.documentElement.classList.contains('fullscreen-analysis') ? 'fullscreen' : 'analysis', rightWidthPercent: rightPct };
  saveLayoutState(state);
  console.log('Expanded mode activated', which, 'rightPct=', rightPct);
}

function restoreLayout(){ document.documentElement.classList.remove('analysis-expanded'); document.documentElement.removeAttribute('data-expanded'); const ls = document.getElementById('leftSidebar'); if(ls) ls.style.display = ''; // reset inline styles
  const right = document.getElementById('rightPanel'); const main = document.getElementById('mainPanel'); if(right){ right.style.flex = ''; right.style.maxWidth = ''; } if(main){ main.style.flex = ''; main.style.maxWidth = ''; }
  const eb = document.getElementById('expandFirstBtn'); if(eb){ eb.textContent = 'Expand'; delete eb.dataset.expanded; }
  saveLayoutState({ expanded: null, mode: 'normal', rightWidthPercent: null });
  positionResizer();
  console.log('Expanded mode closed');
}

function toggleFullscreenAnalysis(on){ if(on===undefined) on = !document.documentElement.classList.contains('fullscreen-analysis'); if(on){ document.documentElement.classList.add('fullscreen-analysis'); saveLayoutState({ expanded: document.documentElement.getAttribute('data-expanded') || null, mode: 'fullscreen', rightWidthPercent: null }); } else { document.documentElement.classList.remove('fullscreen-analysis'); saveLayoutState({ expanded: document.documentElement.getAttribute('data-expanded') || null, mode: 'analysis', rightWidthPercent: null }); } }

function initLayoutControls(){
  try{
    const eFirst = document.getElementById('expandFirstBtn'); if(eFirst) eFirst.addEventListener('click', ()=> {
      try{
        const isExpanded = document.documentElement.classList.contains('analysis-expanded');
        if(isExpanded){ console.log('Toggle clicked - currently expanded, restoring'); restoreLayout(); return; }
        // not expanded -> expand the panel corresponding to the active analysis tab (first or second). fallback to first
        const activeTab = document.querySelector('#analysisTabs .nav-link.active');
        const tabId = activeTab ? activeTab.id : null;
        if(tabId === 'tab-second') { console.log('Toggle clicked - expanding second'); expandPanel('second'); }
        else { console.log('Toggle clicked - expanding first'); expandPanel('first'); }
      }catch(e){ console.error('expandFirstBtn handler', e); expandPanel('first'); }
    });
    // double-click on resizer toggles fullscreen
    const resizer = document.getElementById('resizer');
    if(resizer){
      let dragging = false; let startX=0; let startRightPct=25;
      function onPointerDown(ev){ dragging = true; startX = ev.clientX; const rightRect = document.getElementById('rightPanel').getBoundingClientRect(); const winW = window.innerWidth; startRightPct = Math.round((winW - rightRect.left)/winW*100); document.body.classList.add('resizing'); document.body.style.userSelect = 'none'; console.log('Resize start', {startRightPct}); ev.preventDefault(); }
      function onPointerMove(ev){ if(!dragging) return; const winW = window.innerWidth; // compute right width based on pointer x
        const newRight = Math.max(15, Math.min(85, Math.round((winW - ev.clientX)/winW * 100))); const right = document.getElementById('rightPanel'); const main = document.getElementById('mainPanel'); if(right && main){ right.style.flex = `0 0 ${newRight}%`; right.style.maxWidth = `${newRight}%`; const left = document.getElementById('leftSidebar'); const leftOffset = (left && left.style.display === 'none') ? 0 : (left ? left.offsetWidth : 0); const mainPct = Math.max(10, 100 - newRight - (leftOffset?0:0)); main.style.flex = `0 0 ${mainPct}%`; main.style.maxWidth = `${mainPct}%`; }
        positionResizer(); console.log('Resize move', {newRight}); }
      function onPointerUp(ev){ if(!dragging) return; dragging = false; document.body.classList.remove('resizing'); document.body.style.userSelect = ''; // save width
        const rightRect = document.getElementById('rightPanel').getBoundingClientRect(); const winW = window.innerWidth; const rightPct = Math.round((winW - rightRect.left)/winW*100); saveLayoutState({ expanded: document.documentElement.getAttribute('data-expanded') || null, mode: document.documentElement.classList.contains('fullscreen-analysis') ? 'fullscreen' : 'analysis', rightWidthPercent: rightPct }); console.log('Resize end', {rightPct}); }
      resizer.addEventListener('mousedown', onPointerDown);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      resizer.addEventListener('dblclick', ()=>{ console.log('Resizer double-click toggling fullscreen'); toggleFullscreenAnalysis(); });
    }
    // load persisted layout
    const prev = loadLayoutState(); if(prev) applyLayoutState(prev);
  }catch(e){ console.error('initLayoutControls error', e); }
}

function positionResizer(){
  const res = document.getElementById('resizer'); if(!res) return;
  const right = document.getElementById('rightPanel'); const container = document.querySelector('.container-fluid');
  if(!right || !container) return;
  const rightRect = right.getBoundingClientRect(); const contRect = container.getBoundingClientRect();
  const leftPx = Math.max(contRect.left, rightRect.left - (res.offsetWidth/2));
  res.style.left = leftPx + 'px'; res.style.top = contRect.top + 'px'; res.style.height = (contRect.height) + 'px'; res.style.display = '';
  res.style.zIndex = 10000;
}

// initialize after DOM ready
if(document.readyState === 'complete' || document.readyState === 'interactive'){
  try{ initLayoutControls(); positionResizer(); }catch(e){ console.error(e); }
} else {
  document.addEventListener('DOMContentLoaded', ()=>{ try{ initLayoutControls(); positionResizer(); }catch(e){ console.error(e); } });
}

// Memo modal handling (add-only)
let _currentMemoChunk = null;
function openMemoModal(chunkId){ _currentMemoChunk = chunkId; const ta = document.getElementById('memoModalText'); if(ta) ta.value = ''; const modalEl = document.getElementById('memoModal'); if(!modalEl) return; const modal = new bootstrap.Modal(modalEl); modal.show(); }

// Edit Code modal handling (separate)
let _currentEditEntryId = null;
function openEditCodeModal(entryId, currentLabel){ _currentEditEntryId = entryId; const input = document.getElementById('editCodeInput'); if(input) input.value = currentLabel || ''; const modalEl = document.getElementById('editCodeModal'); if(!modalEl) return; const modal = new bootstrap.Modal(modalEl); modal.show(); }

document.addEventListener('DOMContentLoaded', ()=>{
  // memo save
  const memoSave = document.getElementById('memoModalSave'); if(memoSave && !memoSave.dataset._bound){ memoSave.dataset._bound = '1'; memoSave.addEventListener('click', async ()=>{ const ta = document.getElementById('memoModalText'); const chunk = _currentMemoChunk; if(!ta) return; const text = ta.value.trim(); if(!text) return; try{ await addRichMemo({ memo_text: text, chunk_id: chunk }); const modalEl = document.getElementById('memoModal'); const bm = bootstrap.Modal.getInstance(modalEl); if(bm) bm.hide(); await loadMemosRich(); await renderMainChunks(window._lastAnalysis || {}); showToast('Memo saved', 'success'); }catch(err){ console.error(err); showToast('Failed to save memo', 'error'); } }); }
  // edit code save
  const editSave = document.getElementById('editCodeSave'); if(editSave && !editSave.dataset._bound){ editSave.dataset._bound = '1'; editSave.addEventListener('click', async ()=>{ if(!_currentEditEntryId) return; const input = document.getElementById('editCodeInput'); if(!input) return; const newLabel = input.value.trim(); if(!newLabel) return; try{ await fetch('/api/first_cycle/' + _currentEditEntryId, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', code_name: newLabel})}); const modalEl = document.getElementById('editCodeModal'); const bm = bootstrap.Modal.getInstance(modalEl); if(bm) bm.hide(); await loadFirstCycle(); renderChunkCodeMarkers(); renderFirstCycleList(); try{ renderChunkMarkers(); updateMarkerPositions(); }catch(e){} showToast('Code updated', 'success'); }catch(err){ console.error(err); showToast('Failed to update code', 'error'); } }); }
  // edit code delete occurrence (immediate)
  const editDel = document.getElementById('editCodeDelete'); if(editDel && !editDel.dataset._bound){ editDel.dataset._bound = '1'; editDel.addEventListener('click', async ()=>{ if(!_currentEditEntryId) return; try{ await fetch('/api/first_cycle/' + _currentEditEntryId + '?doc_id=default', {method:'DELETE'}); const modalEl = document.getElementById('editCodeModal'); const bm = bootstrap.Modal.getInstance(modalEl); if(bm) bm.hide(); await loadFirstCycle(); renderChunkCodeMarkers(); renderFirstCycleList(); try{ renderChunkMarkers(); updateMarkerPositions(); }catch(e){} showToast('Occurrence deleted', 'success'); }catch(err){ console.error(err); showToast('Failed to delete occurrence', 'error'); } }); }
});

// refresh annotations and map right away
setTimeout(()=>{ updateAnnotationsList(); renderFirstCycleMap(); }, 200);

// update annotations list in first cycle panel so numbers link to highlights
async function updateAnnotationsList(){
  const res = await fetch(API.highlights + '?doc_id=default');
  const raw = await safeJson(res);
  const data = Array.isArray(raw) ? raw : (raw && raw.value ? raw.value : []);
  const container = document.getElementById('annotationsList');
  if(!container) return;
  container.innerHTML = '';
  if(!data || data.length===0) return;
  // sort by start
  data.sort((a,b)=> ( (a.start||0) - (b.start||0) ));
  data.forEach((h, idx)=>{
    const d = document.createElement('div'); d.className='annotation-item'; d.style.margin='4px 0';
    const labelBtn = document.createElement('button'); labelBtn.style.cursor='pointer'; labelBtn.onclick = ()=>{
      // scroll to highlight and open inline assistant for containing chunk
      const el = document.querySelector(`span.highlight[data-id='${h.id}']`);
      if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); const chunkEl = el.closest && el.closest('.chunk-card'); const cid = chunkEl ? parseInt(chunkEl.id.replace('chunk-','')) : null; if(cid) renderInlineAssistant(cid); }
    };
    const labelText = document.createElement('span'); labelText.textContent = (idx+1) + ' — '; labelBtn.appendChild(labelText);
    // gather codes list
    const codesList = (h.codes && h.codes.length) ? h.codes : (h.code ? [h.code] : (h.selected_codes && h.selected_codes.length ? h.selected_codes : []));
    if(codesList.length===0 && h.text) codesList.push(h.text.slice(0,40));
    codesList.forEach(codeStr=>{
      const cs = document.createElement('span'); cs.className = 'chosen-code';
      const color = h.color || categoryToColor(h.category);
      cs.style.background = color;
      cs.textContent = codeStr;
      labelBtn.appendChild(cs);
    });
    d.appendChild(labelBtn);
    container.appendChild(d);
  });
  // also populate a simple textual summary in firstResult for visibility
  const firstResult = document.getElementById('firstResult');
  if(firstResult){ firstResult.innerHTML = ''; const summary = document.createElement('div'); summary.style.marginTop='8px'; summary.style.fontSize='13px'; data.forEach((h,i)=>{ const line = document.createElement('div'); const codes = (h.codes && h.codes.length) ? h.codes.join(', ') : (h.code||''); line.textContent = `${i+1}. ${codes}`; summary.appendChild(line); }); firstResult.appendChild(summary); }
}

// refresh annotations list after highlights render
const origRenderHighlights = renderHighlights;
renderHighlights = function(){ origRenderHighlights(); setTimeout(()=>{ updateAnnotationsList(); renderFirstCycleMap(); }, 300); };

// render a horizontal map of codes in first-cycle panel with spacing matching highlight positions
async function renderFirstCycleMap(){
  const container = document.getElementById('firstMap');
  if(!container) return;
  container.innerHTML = '';
  const res = await fetch(API.highlights + '?doc_id=default');
  const raw = await safeJson(res);
  const data = Array.isArray(raw) ? raw : (raw && raw.value ? raw.value : []);
  if(!data || data.length===0 || !corpusText) return;
  const track = document.createElement('div'); track.className = 'map-track';
  const total = Math.max(1, corpusText.length);
  data.forEach(h=>{
    if(h.start==null || h.end==null) return;
    const leftPct = (h.start / total) * 100;
    const widthPct = Math.max(2, ((h.end - h.start) / total) * 100); // min width
    const item = document.createElement('div'); item.className = 'map-item';
    item.style.left = leftPct + '%'; item.style.width = widthPct + '%';
    const color = h.color || categoryToColor(h.category);
    item.style.background = color;
    item.textContent = (h.code || (h.codes && h.codes[0]) || '').toString();
    item.title = (h.text && h.text.slice(0,200)) || item.textContent;
    item.onclick = ()=>{ const el = document.querySelector(`span.highlight[data-id='${h.id}']`); if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); const r = el.getBoundingClientRect(); openEditorForHighlight(h.id, r); } };
    track.appendChild(item);
  });
  container.appendChild(track);
}

async function loadMemos(){
  const res = await fetch(API.memos + '?doc_id=default');
  const data = await safeJson(res);
  const el = document.getElementById('memosList'); if(!el) return; el.innerHTML = '';
  data.forEach(m=>{ const d=document.createElement('div'); d.textContent = `${m.created||''} ${m.text||m}`; el.appendChild(d); });
}

fetchModules();
// Ensure panels exist on load in case modules list is empty or fetchModules completed earlier
try{ renderPanels(); }catch(e){ }
// load authoritative data from server
try{ loadFirstCycle(); loadSecondCycle(); loadMemosRich(); }catch(e){ console.warn('initial loads failed', e); }

// toggle document structure visibility
const toggleDocBtn = document.getElementById('toggleDocStructure'); if(toggleDocBtn){ toggleDocBtn.addEventListener('click', ()=>{ const wrap = document.getElementById('docStructureWrap'); if(wrap) wrap.classList.toggle('d-none'); }); }

// speaker filter buttons
const speakerFilterEl = document.getElementById('speakerFilter');
if(speakerFilterEl){ speakerFilterEl.addEventListener('click', (ev)=>{
  const btn = ev.target.closest && ev.target.closest('button[data-speaker]');
  if(!btn) return;
  const sp = btn.getAttribute('data-speaker');
  // active state
  document.querySelectorAll('#speakerFilter button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // filter chunk cards
  document.querySelectorAll('.chunk-card').forEach(card=>{
    const cs = card.querySelector('.speaker-badge');
    const speaker = cs ? cs.textContent.trim().toLowerCase() : 'unknown';
    if(sp === 'all') { card.style.display = ''; return; }
    card.style.display = (speaker === sp) ? '' : 'none';
  });
  });
  }

// toolbar behaviors
const exportDocxBtn = document.getElementById('exportDocx'); if(exportDocxBtn){ exportDocxBtn.onclick = async ()=>{
  try{
    const res = await fetch(API.export, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', text:corpusText, format:'docx'})});
    if(!res.ok){
      const err = await safeJson(res);
      console.error('DOCX export failed', err);
      showToast('Export gagal', 'error');
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    let filename = 'export.docx';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if(match && match[1]){
      filename = decodeURIComponent(match[1]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Word berhasil diunduh', 'success');
  }catch(e){
    console.error('DOCX export error', e);
    showToast('Export error', 'error');
  }
}; }
const exportPdfBtn = document.getElementById('exportPdf'); if(exportPdfBtn){ exportPdfBtn.onclick = async ()=>{
  try{
    const res = await fetch(API.export, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default', text:corpusText, format:'pdf'})});
    if(!res.ok){
      const err = await safeJson(res);
      console.error('PDF export failed', err);
      showToast('Export gagal', 'error');
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    let filename = 'export.pdf';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if(match && match[1]){
      filename = decodeURIComponent(match[1]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('PDF berhasil diunduh', 'success');
  }catch(e){
    console.error('PDF export error', e);
    showToast('Export error', 'error');
  }
}; }

// search input/button removed from UI; search handler intentionally disabled

const clearEl = document.getElementById('clearHighlights');
if(clearEl){
  clearEl.onclick = async ()=>{
    await fetch('/api/clear_highlights', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({doc_id:'default'})});
    renderHighlights();
    showToast('Highlights cleared', 'success');
  };
}

