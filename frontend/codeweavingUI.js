// Helpers for codeweaving UI (kept minimal and deterministic)
(function(){
  window.CodeweavingUI = {
    renderCodePill: function(code, opts){
      const span = document.createElement('span');
      span.className = 'badge bg-info text-dark me-1 mb-1';
      span.textContent = code;
      if(opts){
        if(opts.chunk) span.dataset.chunk = opts.chunk;
        if(opts.speaker) span.dataset.speaker = opts.speaker;
      }
      span.dataset.code = code;
      return span;
    }
  };
})();

// Core Codeweaving logic (display-only, rule-based)
(function(){
  function calculateChunkOverlap(a, b){
    const ca = new Set(a.chunks || []);
    const cb = new Set(b.chunks || []);
    const shared = [...ca].filter(x=> cb.has(x)).length;
    const totalUnique = new Set([...ca, ...cb]).size || 1;
    return shared / totalUnique;
  }
  function calculateIndicatorSimilarity(a,b){
    const ia = new Set(a.indicators || []);
    const ib = new Set(b.indicators || []);
    if(ia.size === 0 && ib.size === 0) return 0;
    const shared = [...ia].filter(x=> ib.has(x)).length;
    const totalUnique = new Set([...ia, ...ib]).size || 1;
    return shared / totalUnique;
  }
  function calculateRelationship(a,b){
    const chunkOverlap = calculateChunkOverlap(a,b);
    const indicatorSimilarity = calculateIndicatorSimilarity(a,b);
    const semanticSimilarity = 0.5; // placeholder
    const score = (0.4 * chunkOverlap) + (0.3 * indicatorSimilarity) + (0.3 * semanticSimilarity);
    return score;
  }

  function generateClusters(codeMap){
    const codes = Object.values(codeMap).map(c=> ({ id: c.name, label: c.name, chunks: c.chunks||[], indicators: c.indicators||[], entries: c.entries||[] }));
    // build graph: nodes = codes, edges when they share a chunk or have strong relationship
    const n = codes.length;
    const adj = Array.from({length: n}, ()=> []);
    for(let i=0;i<n;i++){
      for(let j=i+1;j<n;j++){
        const a = codes[i], b = codes[j];
        const shareChunk = calculateChunkOverlap(a,b) > 0; // ensure same-chunk codes connect
        const strongRel = calculateRelationship(a,b) > 0.60;
        if(shareChunk || strongRel){ adj[i].push(j); adj[j].push(i); }
      }
    }
    // connected components
    const seen = new Array(n).fill(false);
    const clusters = [];
    for(let i=0;i<n;i++){
      if(seen[i]) continue;
      const stack = [i]; const comp = [];
      while(stack.length){ const u = stack.pop(); if(seen[u]) continue; seen[u]=true; comp.push(codes[u]); for(const v of adj[u]) if(!seen[v]) stack.push(v); }
      clusters.push({ id: 'cluster_'+(clusters.length+1), codes: comp });
    }
    // score clusters by average pairwise relationship
    clusters.forEach(cl=>{
      const cs = cl.codes || [];
      if(cs.length < 2){ cl.score = 0; return; }
      let sum = 0; let pairs = 0;
      for(let i=0;i<cs.length;i++) for(let j=i+1;j<cs.length;j++){ sum += calculateRelationship(cs[i], cs[j]); pairs++; }
      cl.score = pairs ? (sum / pairs) : 0;
    });
    clusters.sort((a,b)=> b.score - a.score);
    return clusters;
  }

  function generateNarrative(cluster){
    const codes = (cluster.codes||[]).slice();
    if(codes.length === 0) return '';
    codes.sort((a,b)=> (b.chunks.length||0) - (a.chunks.length||0));
    const anchor = codes[0].label;
    if(codes.length >= 3){ const a = codes[0].label; const b = codes[1].label; const c = codes[2].label; return `${a} mendorong ${b} dan menghasilkan ${c}.`; }
    if(codes.length === 2){ return `${anchor} berkaitan dengan ${codes[1].label}.`; }
    return `Tema sementara terkait ${anchor}.`;
  }

  function render(container, clusters){
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    const header = document.createElement('h5'); header.textContent = 'SECOND CYCLE CODEWEAVING'; header.style.marginBottom = '8px';
    wrapper.appendChild(header);
    if(!clusters || clusters.length === 0){ const p = document.createElement('div'); p.className='small text-muted'; p.textContent = 'No clusters generated.'; wrapper.appendChild(p); container.appendChild(wrapper); return; }

    clusters.forEach((cl, idx)=>{
      const card = document.createElement('div'); card.className='cw-card mb-2 border rounded p-2'; card.style.borderColor='#e6e6e6';
      const titleRow = document.createElement('div'); titleRow.style.display='flex'; titleRow.style.justifyContent='space-between'; titleRow.style.alignItems='center';
      const titleLeft = document.createElement('div'); titleLeft.innerHTML = `<strong>Cluster ${idx+1}</strong>`;
      const arrow = document.createElement('button'); arrow.className='btn btn-sm btn-light'; arrow.textContent='▼';
      titleRow.appendChild(titleLeft); titleRow.appendChild(arrow);

      const body = document.createElement('div'); body.style.marginTop='8px';
      const codesH = document.createElement('div'); codesH.innerHTML = '<strong>Codes:</strong>';
      const codesList = document.createElement('ul'); codesList.style.paddingLeft='18px';
      cl.codes.forEach(c=>{ const li = document.createElement('li'); li.style.cursor='pointer'; li.textContent = c.label; li.addEventListener('click', (ev)=>{ ev.stopPropagation(); highlightFirstCycleCode(c.label); }); codesList.appendChild(li); });
      const rel = document.createElement('div'); rel.className='mt-2'; rel.innerHTML = `<strong>Relationship Strength:</strong> ${ (cl.score||0).toFixed(2) }`;
      const narr = document.createElement('div'); narr.className='mt-2'; narr.innerHTML = `<strong>Narrative:</strong> <div class="mt-1">${ generateNarrative(cl) }</div>`;

      body.appendChild(codesH); body.appendChild(codesList); body.appendChild(rel); body.appendChild(narr);
      card.appendChild(titleRow); card.appendChild(body);
      let expanded = true;
      arrow.addEventListener('click', (ev)=>{ ev.stopPropagation(); expanded = !expanded; body.style.display = expanded ? '' : 'none'; arrow.textContent = expanded ? '▼' : '►'; });
      titleRow.addEventListener('click', ()=>{ expanded = !expanded; body.style.display = expanded ? '' : 'none'; arrow.textContent = expanded ? '▼' : '►'; });

      wrapper.appendChild(card);
    });

    container.appendChild(wrapper);
  }

  function highlightFirstCycleCode(code){
    const pool = document.querySelectorAll('#poolList .code-pool-item');
    let found = null;
    pool.forEach(n=>{ if(n.dataset && n.dataset.code === code){ found = n; } });
    if(found){ _pulse(found); found.scrollIntoView({behavior:'smooth', block:'center'}); return; }
    const firstEls = Array.from(document.querySelectorAll('#firstCycle *'));
    const match = firstEls.find(el=> (el.textContent||'').trim() === code || (el.textContent||'').includes(code));
    if(match){ _pulse(match); match.scrollIntoView({behavior:'smooth', block:'center'}); return; }
  }
  function _pulse(el){
    const prev = el.style.transition;
    const orig = el.style.backgroundColor;
    el.style.transition = 'background-color 0.3s ease';
    el.style.backgroundColor = '#fff59d';
    setTimeout(()=>{ el.style.backgroundColor = orig || ''; setTimeout(()=> el.style.transition = prev || '',300); }, 1400);
  }

  window.Codeweaving = { calculateChunkOverlap, calculateIndicatorSimilarity, calculateRelationship, generateClusters, generateNarrative, render };
})();

// Theme Builder renderer: renders compact theme cards from clusters and maps to persisted themes
(function(){
  async function safeJsonRes(res){ try{ if(!res) return {}; const txt = await res.text(); return txt ? JSON.parse(txt) : {}; }catch(e){ return {}; } }

  function mapClustersToThemes(clusters, themes){
    const used = new Set();
    return clusters.map(cl=>{
      const clusterCodes = new Set((cl.codes||[]).map(c=> c.label));
      let match = null;
      for(const t of themes||[]){
        if(used.has(t.id)) continue;
        const tCodes = new Set((t.codes||[]));
        const shared = [...clusterCodes].filter(x=> tCodes.has(x)).length;
        const ratio = clusterCodes.size ? (shared / clusterCodes.size) : 0;
        if(ratio >= 0.6){ match = t; used.add(t.id); break; }
      }
      return { cluster: cl, matchedTheme: match };
    });
  }

  function renderThemeCard(themeContainer, mapped, idx){
    const cl = mapped.cluster;
    const matched = mapped.matchedTheme;
    const isPersisted = !!matched;
    const titleText = isPersisted ? (matched.theme || ('Theme '+matched.id)) : (window.Codeweaving.generateNarrative(cl) || ('Theme '+(idx+1)));

    const card = document.createElement('div'); card.className='card p-2'; card.style.border='1px solid #e6e6e6'; card.style.borderRadius='8px'; card.style.marginBottom='8px';
    const top = document.createElement('div'); top.className='d-flex justify-content-between align-items-center';
    const title = document.createElement('strong'); title.textContent = titleText; title.style.flex = '1';
    const stats = document.createElement('div'); stats.className='small text-muted'; stats.textContent = `${(cl.codes||[]).length} codes • ${(() => { const chunks = new Set(); (cl.codes||[]).forEach(c=> (c.chunks||[]).forEach(ch=> chunks.add(ch))); return chunks.size; })()} chunks`;
    top.appendChild(title); top.appendChild(stats);

    const codesWrap = document.createElement('div'); codesWrap.className='mt-2'; (cl.codes||[]).forEach(c=>{ const pill = document.createElement('span'); pill.className='badge bg-light text-dark me-1 mb-1'; pill.textContent = c.label; codesWrap.appendChild(pill); });

    const actions = document.createElement('div'); actions.className='mt-2 d-flex gap-2';
    const renameBtn = document.createElement('button'); renameBtn.className='btn btn-sm btn-outline-secondary'; renameBtn.textContent='Rename';
    const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-outline-danger'; delBtn.textContent='Delete';
    actions.appendChild(renameBtn); actions.appendChild(delBtn);

    // inline rename (no modal, no alert)
    renameBtn.addEventListener('click', async ()=>{
      const input = document.createElement('input'); input.type='text'; input.className='form-control form-control-sm'; input.value = title.textContent || '';
      const saveBtn = document.createElement('button'); saveBtn.className='btn btn-sm btn-primary ms-2'; saveBtn.textContent='Save';
      const holder = document.createElement('div'); holder.className='d-flex'; holder.appendChild(input); holder.appendChild(saveBtn);
      top.replaceChild(holder, title);
      saveBtn.addEventListener('click', async ()=>{
        const newTitle = input.value.trim();
        if(!newTitle) return;
        if(isPersisted){
          // update existing theme
          await fetch('/api/second_cycle/'+ matched.id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ doc_id: 'default', theme: newTitle }) });
        } else {
          // create new persisted theme with codes and chunks
          const codes = (cl.codes||[]).map(c=> c.label);
          const chunks = [];
          (cl.codes||[]).forEach(c=> (c.chunks||[]).forEach(ch=> { if(!chunks.includes(ch)) chunks.push(ch); }));
          const resp = await fetch('/api/second_cycle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ doc_id: 'default', theme: newTitle, codes: codes, chunks: chunks }) });
          const created = await safeJsonRes(resp);
        }
        // refresh UI
        if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') window.SecondCycle.refresh();
      });
    });

    delBtn.addEventListener('click', async ()=>{
      if(isPersisted){ await fetch('/api/second_cycle/'+ matched.id + '?doc_id=default', { method: 'DELETE' }); if(window.SecondCycle && typeof window.SecondCycle.refresh === 'function') window.SecondCycle.refresh(); }
      else { themeContainer.removeChild(card); }
    });

    card.appendChild(top); card.appendChild(codesWrap); card.appendChild(actions);
    themeContainer.appendChild(card);
  }

  async function renderThemeBuilder(container, clusters, existingThemes, codeMap){
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    const mapped = mapClustersToThemes(clusters||[], existingThemes||[]);
    mapped.forEach((m, i)=> renderThemeCard(wrapper, m, i));
    container.appendChild(wrapper);
  }

  window.Codeweaving.renderThemeBuilder = renderThemeBuilder;
})();

// Codeweaving Workspace renderer: Generated suggestions + Accepted narratives
(function(){
  async function safeJsonRes(res){ try{ if(!res) return {}; const txt = await res.text(); return txt ? JSON.parse(txt) : {}; }catch(e){ return {}; } }

  async function fetchItems(){ const res = await fetch('/api/codeweaving_items?doc_id=default'); return await safeJsonRes(res) || []; }
  async function createItem(narrative, codes, status='suggested'){ const res = await fetch('/api/codeweaving_items', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ doc_id:'default', narrative: narrative, codes: codes, status: status, created: new Date().toISOString() }) }); return await safeJsonRes(res); }
  async function updateItem(id, body){ const res = await fetch('/api/codeweaving_items/'+id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({ doc_id:'default' }, body)) }); return await safeJsonRes(res); }
  async function deleteItem(id){ const res = await fetch('/api/codeweaving_items/'+id + '?doc_id=default', { method: 'DELETE' }); return await safeJsonRes(res); }

  async function generateForCluster(cluster){
    const selected_codes = (cluster.codes||[]).map(c=> ({ code: c.label, chunk_id: (c.chunks||[])[0] }));
    const resp = await fetch('/api/codeweaving/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ selected_codes: selected_codes, doc_id: 'default' }) });
    const j = await safeJsonRes(resp);
    const assertion = j && j.assertion;
    if(!assertion) return null;
    const narrative = assertion.assertion_text || assertion.assertion || '';
    const codes = assertion.codes_used || assertion.codes || [];
    const created = await createItem(narrative, codes, 'suggested');
    return created;
  }

  // in-memory selected codes (not persisted until user generates)
  const _selectedCodes = [];

  function addSelectedCode(code){
    if(!_selectedCodes.includes(code)) _selectedCodes.push(code);
  }

  function clearSelectedCodes(){ _selectedCodes.length = 0; }

  function getSelectedCodes(){ return Array.from(_selectedCodes); }
  
  function removeSelectedCodes(codes){
    if(!codes || !codes.length) return;
    for(const c of codes){ const idx = _selectedCodes.indexOf(c); if(idx>=0) _selectedCodes.splice(idx,1); }
  }

  async function generateForItem(item){
    // call generate using the item's codes
    const selected_codes = (item.codes||[]).map(c=> ({ code: c }));
    const resp = await fetch('/api/codeweaving/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ selected_codes: selected_codes, doc_id: 'default' }) });
    const j = await safeJsonRes(resp);
    const assertion = j && j.assertion;
    if(!assertion) return null;
    const narrative = assertion.assertion_text || assertion.assertion || '';
    const updated = await updateItem(item.id, { narrative: narrative, status: 'accepted' });
    return updated;
  }

  function createCardForItem(item, onChange){
    const card = document.createElement('div'); card.className='card p-2 mb-2';
    const top = document.createElement('div'); top.className='d-flex justify-content-between align-items-start';
    const left = document.createElement('div'); left.style.flex='1';
    const meta = document.createElement('div'); meta.className='small text-muted'; meta.textContent = `${(item.codes||[]).length} codes • ${item.created||''}`;
    const text = document.createElement('div'); text.className='cw-narrative mt-1'; text.textContent = item.narrative || '';
    left.appendChild(text); left.appendChild(meta);
    const actions = document.createElement('div'); actions.className='d-flex flex-column gap-1 ms-2';
    const acceptBtn = document.createElement('button'); acceptBtn.className='btn btn-sm btn-success'; acceptBtn.textContent = 'Accept';
    const generateBtn = document.createElement('button'); generateBtn.className='btn btn-sm btn-primary'; generateBtn.textContent = 'Generate';
    const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-outline-secondary'; editBtn.textContent = 'Edit';
    const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-outline-danger'; delBtn.textContent = 'Delete';
    actions.appendChild(acceptBtn);
    // show generate for accepted items (or show anyway)
    actions.appendChild(generateBtn);
    actions.appendChild(editBtn); actions.appendChild(delBtn);
    card.appendChild(left); card.appendChild(actions);

    // render codes
    if(item.codes && item.codes.length){ const codesWrap = document.createElement('div'); codesWrap.className='mt-2'; item.codes.forEach(c=>{ const pill = document.createElement('span'); pill.className='badge bg-light text-dark me-1 mb-1'; pill.textContent = c; codesWrap.appendChild(pill); }); card.appendChild(codesWrap); }

    // handlers
    acceptBtn.addEventListener('click', async ()=>{ if(item.status === 'accepted') return; const updated = await updateItem(item.id, { status: 'accepted' }); if(updated){ item.status = updated.status; // remove any matching selected codes
      try{ removeSelectedCodes(item.codes || []); }catch(e){}
      if(typeof onChange === 'function') onChange(); } });
    generateBtn.addEventListener('click', async ()=>{ generateBtn.disabled = true; generateBtn.textContent = 'Generating...'; try{ const updated = await generateForItem(item); if(updated){ item.narrative = updated.narrative || updated.assertion_text || item.narrative; item.status = updated.status || item.status; try{ removeSelectedCodes(item.codes || []); }catch(e){}
          if(typeof onChange === 'function') onChange(); } }catch(e){ console.error(e); } finally{ generateBtn.disabled = false; generateBtn.textContent = 'Generate'; } });
    editBtn.addEventListener('click', ()=>{
      // inline edit
      const ta = document.createElement('textarea'); ta.className='form-control mb-2'; ta.value = item.narrative || '';
      const save = document.createElement('button'); save.className='btn btn-sm btn-primary me-2'; save.textContent='Save';
      const cancel = document.createElement('button'); cancel.className='btn btn-sm btn-secondary'; cancel.textContent='Cancel';
      const holder = document.createElement('div'); holder.className='mt-2 d-flex'; holder.style.gap='6px'; holder.appendChild(save); holder.appendChild(cancel);
      left.replaceChild(ta, text); left.insertBefore(holder, meta);
      save.addEventListener('click', async ()=>{ const val = ta.value.trim(); if(!val) return; const updated = await updateItem(item.id, { narrative: val, status: (item.status === 'accepted' ? 'accepted' : 'edited') }); if(updated){ item.narrative = updated.narrative; item.status = updated.status; if(typeof onChange === 'function') onChange(); } });
      cancel.addEventListener('click', ()=>{ if(typeof onChange === 'function') onChange(); });
    });
    delBtn.addEventListener('click', async ()=>{ await deleteItem(item.id); if(typeof onChange === 'function') onChange(); });

    return card;
  }

  async function renderCodeweavingWorkspace(container, clusters, codeMap){
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    const header = document.createElement('h5'); header.textContent = 'Codeweaving Workspace'; header.style.marginBottom = '8px'; wrapper.appendChild(header);

    const list = document.createElement('div'); list.className = 'cw-cluster-list';
    // single-column: each cluster is a simple card with codes grouped and a Codeweaving button
    (clusters||[]).forEach((cl, idx)=>{
      const card = document.createElement('div'); card.className = 'mb-2 p-2 border rounded cw-cluster-card';
      const top = document.createElement('div'); top.className = 'd-flex justify-content-between align-items-center';
      const title = document.createElement('strong'); title.textContent = `Cluster ${idx+1}`;
      const stats = document.createElement('div'); stats.className = 'small text-muted'; stats.textContent = `${(cl.codes||[]).length} codes`;
      top.appendChild(title); top.appendChild(stats);

      const codesLine = document.createElement('div'); codesLine.className = 'mt-2'; codesLine.textContent = (cl.codes||[]).map(c=> c.label).join(', ');

      const actions = document.createElement('div'); actions.className = 'mt-2 d-flex justify-content-end';
      const cwBtn = document.createElement('button'); cwBtn.className = 'btn btn-sm btn-primary'; cwBtn.textContent = 'Codeweaving ▶';
      cwBtn.addEventListener('click', async ()=>{ cwBtn.disabled = true; cwBtn.textContent = 'Loading...'; try{ await showCodeweavingDialog(cl); }catch(e){ console.error(e); } finally{ cwBtn.disabled = false; cwBtn.textContent = 'Codeweaving ▶'; } });
      actions.appendChild(cwBtn);

      card.appendChild(top); card.appendChild(codesLine); card.appendChild(actions);
      list.appendChild(card);
    });

    wrapper.appendChild(list);
    container.appendChild(wrapper);
  }

  async function showCodeweavingDialog(cluster){
    // prepare payload: list of codes
    const selected_codes = (cluster.codes||[]).map(c=> ({ code: c.label, chunk_id: (c.chunks||[])[0] }));
    // call backend generator
    let j = null; try{ const resp = await fetch('/api/codeweaving/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ selected_codes: selected_codes, doc_id: 'default' }) }); j = await safeJsonRes(resp); }catch(e){ j = null; }
    const assertion = j && j.assertion;
    const narrative = assertion ? (assertion.assertion_text || assertion.assertion || '') : '';
    const codes = assertion ? (assertion.codes_used || assertion.codes || selected_codes.map(s=>s.code)) : selected_codes.map(s=>s.code);

    // populate modal fields
    const modalEl = document.getElementById('codeweavingModal'); if(!modalEl){ alert('Codeweaving modal not found'); return; }
    const ta = modalEl.querySelector('#codeweavingModalText'); const codesListEl = modalEl.querySelector('#codeweavingModalCodes');
    if(ta) ta.value = narrative || '';
    if(codesListEl) { codesListEl.innerHTML = ''; (codes||[]).forEach(c=>{ const s = document.createElement('span'); s.className='badge bg-light text-dark me-1 mb-1'; s.textContent = c; codesListEl.appendChild(s); }); }

    // bind buttons
    const acceptBtn = modalEl.querySelector('#codeweavingAccept');
    const saveBtn = modalEl.querySelector('#codeweavingSaveSuggested');
    const modal = new bootstrap.Modal(modalEl);

    const cleanup = ()=>{ acceptBtn.onclick = null; saveBtn.onclick = null; };

    acceptBtn.onclick = async ()=>{
      const val = ta.value.trim(); if(!val) return;
      await createItem(val, codes, 'accepted'); cleanup(); modal.hide(); if(window.Codeweaving && typeof window.Codeweaving.render === 'function'){}; // optional refresh
    };
    saveBtn.onclick = async ()=>{
      const val = ta.value.trim(); if(!val) return;
      await createItem(val, codes, 'suggested'); cleanup(); modal.hide();
    };

    modal.show();
  }

  window.Codeweaving.renderCodeweavingWorkspace = renderCodeweavingWorkspace;
})();
