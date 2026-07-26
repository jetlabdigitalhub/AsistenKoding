// AI Mentor — rule-based, lightweight educational support
(function(){
  function mk(tag, cls, txt){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt!=null) e.textContent = txt; return e; }

  function renderPanel(){
    const mount = document.getElementById('aiMentorPanel'); if(!mount) return;
    mount.innerHTML = '';
    const card = mk('div','mb-2 p-2 bg-white border rounded mentor-card');
    // Indicators row
    const indicators = mk('div','d-flex justify-content-between align-items-start mb-3');
    const codesWrap = mk('div','text-center'); codesWrap.innerHTML = `<div class="small text-muted">Kode</div><div id="mentorCodes" class="h4 mb-0">0</div>`;
    const styleWrap = mk('div','text-center'); styleWrap.innerHTML = `<div class="small text-muted">Gaya</div><div id="mentorStyle" class="h6 mb-0">-</div>`;
    const covWrap = mk('div','text-center'); covWrap.innerHTML = `<div class="small text-muted">Cakupan</div><div id="mentorCoverage" class="h4 mb-0">0%</div>`;
    indicators.appendChild(codesWrap); indicators.appendChild(styleWrap); indicators.appendChild(covWrap);
    card.appendChild(indicators);
    // Message
    const msg = mk('div','mb-2 p-2 border rounded mentor-message'); msg.id = 'mentorMessage';
    // vertical padding as requested
    msg.style.paddingTop = '30px'; msg.style.paddingBottom = '30px';
    card.appendChild(msg);
    // Feedback
    const fbWrap = mk('div','mt-2'); fbWrap.innerHTML = `<div class="small text-muted mb-1">Umpan Balik</div><div id="mentorFeedback"></div>`;
    card.appendChild(fbWrap);
    mount.appendChild(card);
  }

  function detectStyle(uniqueCodes, firstCycleEntries, chunks){
    const labels = uniqueCodes.slice();
    if(labels.length===0) return 'Mixed Coding Style';
    let process = 0, invivo = 0;
    const verbHints = ['ing','do','make','use','used','analyz','observe','implement','manage','help','solve','report','learn','improv','reduce','increase','apply','test','work'];
    labels.forEach(lbl=>{
      const l = (lbl||'').toLowerCase();
      if(l.match(/\b\w+ing\b/) || verbHints.some(v=> l.indexOf(v) !== -1)) process++;
      if(l.length>3 && Array.isArray(chunks)){
        for(const c of chunks){ if(c && c.text && c.text.toLowerCase().indexOf(l) !== -1){ invivo++; break; } }
      }
    });
    const total = Math.max(1, labels.length);
    if(process / total > 0.5) return 'Mostly Process';
    if(invivo / total > 0.5) return 'Mostly In Vivo';
    if(process>0 && invivo>0) return 'Mixed Coding Style';
    return 'Mostly Descriptive';
  }

  function computeCoverage(firstCycleEntries, chunks){
    const total = (chunks && chunks.length) ? chunks.length : 0;
    if(total===0) return 0;
    const coded = new Set((firstCycleEntries||[]).map(f=> f.chunk_id || f.chunk ).filter(Boolean));
    return Math.round((coded.size / total) * 100);
  }

  function chooseMessage(stats){
    if(stats.coverage >= 90) return 'Sebagian besar segmen transkrip telah ditinjau.';
    if(stats.patternDetected) return 'Beberapa kode tampak membentuk pola yang lebih luas. Anda mungkin siap mengembangkan tema.';
    if(stats.reuseHigh) return 'Anda sering menggunakan kembali kode yang sama. Pertimbangkan untuk memeriksa apakah konsep baru muncul.';
    if(stats.style && stats.style.indexOf('Descript')!==-1) return 'Pengodean Anda saat ini lebih berfokus pada label deskriptif.';
    return 'Terus refleksikan kode dan memo saat Anda melanjutkan.';
  }

  function gatherFeedback(stats){
    const out = [];
    if(stats.uniqueCodes >= 12) out.push('✓ Keanekaragaman kode kuat');
    if(stats.memos>0) out.push('✓ Memo aktif terdeteksi');
    if(stats.patternDetected) out.push('✓ Beberapa kode terkait mulai muncul');
    if(stats.memos===0) out.push('⚠ Belum ada memo yang dibuat');
    if(stats.coverage < 50) out.push('⚠ Beberapa potongan masih belum dikodekan');
    return out.slice(0,3);
  }

  window.updateAIMentor = function(){
    try{
      const first = window._firstCycle || [];
      const memos = window._memosRich || [];
      const analysis = window._lastAnalysis || {};
      const chunks = analysis.chunks || [];
      const seen = {};
      (first||[]).forEach(fc=>{ const label = (fc.code_name || fc.code || fc.label || fc.name || '').toString(); if(!label) return; seen[label] = (seen[label]||0) + 1; });
      const uniqueCodes = Object.keys(seen);
      const uniqueCount = uniqueCodes.length;
      const style = detectStyle(uniqueCodes, first, chunks);
      const coverage = computeCoverage(first, chunks);
      const reuseHigh = (first.length > 0) && (uniqueCount / first.length < 0.4);
      const pairCounts = {};
      const chunkToCodes = {};
      (first||[]).forEach(fc=>{ const cid = fc.chunk_id || fc.chunk; const label = (fc.code_name || fc.code || fc.label || fc.name || '').toString(); if(!cid || !label) return; chunkToCodes[cid] = chunkToCodes[cid] || new Set(); chunkToCodes[cid].add(label); });
      Object.values(chunkToCodes).forEach(s=>{ const arr = Array.from(s); for(let i=0;i<arr.length;i++){ for(let j=i+1;j<arr.length;j++){ const key = arr[i] + '||' + arr[j]; pairCounts[key] = (pairCounts[key]||0) + 1; } }});
      let patternDetected = false;
      Object.values(pairCounts).forEach(c=>{ if(c >= 3) patternDetected = true; });
      const stats = { uniqueCodes: uniqueCount, unique: uniqueCount, memos: (memos||[]).length, coverage: coverage, reuseHigh: reuseHigh, patternDetected: patternDetected, style: style };
      const codesEl = document.getElementById('mentorCodes'); if(codesEl) codesEl.textContent = stats.uniqueCodes;
      const styleEl = document.getElementById('mentorStyle'); if(styleEl) styleEl.textContent = stats.style;
      const covEl = document.getElementById('mentorCoverage'); if(covEl) covEl.textContent = stats.coverage + '%';
      const msg = document.getElementById('mentorMessage'); if(msg) msg.innerHTML = `<div class="small text-muted">Wawasan Pembelajaran</div><div>${chooseMessage(stats)}</div>`;
      const fb = document.getElementById('mentorFeedback'); if(fb){ fb.innerHTML = ''; const items = gatherFeedback(stats); if(items.length===0) fb.innerHTML = '<div class="small text-muted">Belum ada umpan balik</div>'; else items.forEach(t=>{ const d = mk('div','small mb-1'); d.textContent = t; fb.appendChild(d); }); }
    }catch(e){ console.error('updateAIMentor failed', e); }
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    renderPanel();
    setInterval(()=>{ try{ window.updateAIMentor(); }catch(e){} }, 1500);
    setTimeout(()=>{ try{ window.updateAIMentor(); }catch(e){} }, 300);
  });
})();
