// /branches/js/chat-helpers.js
(function () {
  const cfg = window.APP_CONFIG || {};

  // ===== DOM =====
  const area    = document.getElementById('area');
  const backBtn = document.getElementById('backBtn');

  // ===== State + History =====
  const State = { history: [], data: {}, token: 0, autoScroll: true };
  const last  = () => State.history[State.history.length - 1];
  const push  = (fn) => { State.history.push(fn); updateBack(); };
  const goBack = () => {
    if (State.history.length > 1) {
      State.history.pop();
      updateBack();
      State.token++;
      last()();
    }
  };
  function updateBack(){ if (backBtn) backBtn.disabled = State.history.length <= 1; }
  if (backBtn) backBtn.onclick = goBack;

  // ===== UI =====
  function clear(){ State.token++; if (area) area.innerHTML=''; }
  function autoscroll(){ if (area && State.autoScroll) area.scrollTop = area.scrollHeight; }
  function scrollStartOf(el){ el?.scrollIntoView({ block:'start', behavior:'smooth' }); }

  function botHTML(html){
    const d=document.createElement('div');
    d.className='bubble bot';
    d.innerHTML=html;
    area.appendChild(d); autoscroll(); return d;
  }
  function botText(text){
    const d=document.createElement('div');
    d.className='bubble bot';
    d.textContent=text;
    area.appendChild(d); autoscroll(); return d;
  }
  function userBubble(text){
    const d=document.createElement('div');
    d.className='bubble user';
    d.textContent=text;
    area.appendChild(d); autoscroll(); return d;
  }
  function button(text, onClick, cls='btn'){
    const b=document.createElement('button');
    b.className=cls; b.textContent=text;
    b.onclick=()=>{ b.disabled=true; onClick(); };
    area.appendChild(b); autoscroll(); return b;
  }
  function chip(text){
    const c=document.createElement('div'); c.className='chip'; c.textContent=text; return c;
  }
  function inputRow(label, {type='text', id, textarea=false, placeholder='', required=false, autocomplete, inputmode}={}){
    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent=label; if(id) l.htmlFor=id;
    const el= textarea ? document.createElement('textarea') : document.createElement('input');
    if(!textarea) el.type=type; el.className= textarea ? 'textarea' : 'input';
    el.id=id; el.placeholder=placeholder; el.dir='rtl';
    if(required) el.required=true;
    if(autocomplete) el.autocomplete=autocomplete;
    if(inputmode) el.setAttribute('inputmode', inputmode);
    wrap.append(l, el); area.appendChild(wrap); autoscroll(); return el;
  }
  function typingThen(html, delay=800, trusted=true){
    const my=State.token;
    const t=document.createElement('div');
    t.className='typing-indicator';
    t.innerHTML='<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    area.appendChild(t); autoscroll();
    setTimeout(()=>{
      if (my!==State.token) return;
      t.remove();
      trusted ? botHTML(html) : botText(html);
    }, delay);
  }
  function showProcessing(text='שולח למזכירות…'){
    const d=document.createElement('div');
    d.className='bubble bot processing';
    d.innerHTML=`<strong>${text}</strong><div class="progress"><div class="progress-bar"></div></div>`;
    area.appendChild(d); autoscroll(); return ()=>d.remove();
  }

  // ===== Utils =====
  const normalizeILPhone = (raw)=>{
    let p=(raw||'').toString().trim().replace(/[^\d+]/g,'');
    if(p.startsWith('+972')) p='0'+p.slice(4);
    if(p.startsWith('972'))  p='0'+p.slice(3);
    return p;
  };
  const validILPhone = (p)=> /^0\d{8,9}$/.test(p||'');

  async function sendLeadToSheet(payload){
    const url = cfg.SHEETS_WEBAPP_URL;
    const ctrl=new AbortController(); const timeout=setTimeout(()=>ctrl.abort(), 10000);
    try{
      const res=await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'text/plain' }, // ללא preflight
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      try{ const j=await res.json(); return j && j.ok===true; }
      catch(_){ return res.ok; }
    }catch(e){ console.error('Sheets error', e); return false; }
    finally{ clearTimeout(timeout); }
  }

  // ===== Expose =====
  window.Chat = {
    cfg, State, clear, push, goBack, updateBack,
    botHTML, botText, userBubble, button, chip, inputRow,
    typingThen, showProcessing, scrollStartOf,
    normalizeILPhone, validILPhone, sendLeadToSheet
  };
})();