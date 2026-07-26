// Lightweight wrapper to expose First-Cycle manager APIs
(function(){
  function render(){ if(window && window.renderFirstCycleList) window.renderFirstCycleList(); }
  function add(payload){ if(window && window.addFirstCycleCode) return window.addFirstCycleCode(payload); }
  window.FirstCycle = { render: render, add: add };
})();
