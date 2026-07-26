// panels helper (kept minimal) — loaded after workspace_ui
console.log('panels loaded');

// quick helper to reset layout or support future enhancements
function collapseLeftSidebar(){ const el = document.getElementById('leftSidebar'); if(!el) return; el.classList.toggle('d-none'); }

function toggleClusters(){ const els = document.querySelectorAll('.cluster-badge'); els.forEach(e=> e.classList.toggle('d-none')); }
