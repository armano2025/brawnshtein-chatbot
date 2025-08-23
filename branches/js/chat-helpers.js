// /branches/js/chat-helpers.js
(function () {
  const cfg = window.APP_CONFIG || {};

  /* ===== DOM ===== */
  const area    = document.getElementById('area');
  const backBtn = document.getElementById('backBtn');

  /* ===== State + History ===== */
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

  /* ===== UI ===== */
  function clear(){ State.token++; if (area) area.innerHTML=''; }
  function autoscroll(){ if (area && State.autoScroll) area.scrollTop = area.scrollHeight; }
  function scrollStartOf(el){ el?.scrollIntoView({ block:'start', behavior:'smooth' }); }

  function botHTML(html){ const d=document.createElement('div'); d.className='bubble bot'; d.innerHTML=html; area.appendChild(d); autoscroll(); return d; }
  function botText(text){ const d=document.createElement('div'); d.className='bubble bot'; d.textContent=text; area.appendChild(d); autoscroll(); return d; }
  function userBubble(text){ const d=document.createElement('div'); d.className='bubble user'; d.textContent=text; area.appendChild(d); autoscroll(); return d; }
  function button(text, onClick, cls='btn'){ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=text; b.onclick=()=>{ b.disabled=true; onClick?.(); }; area.appendChild(b); autoscroll(); return b; }
  function chip(text){ const c=document.createElement('div'); c.className='chip'; c.textContent=text; return c; }

  /* ===== Utils ===== */
  const toNum = s => parseInt(String(s||'').replace(':',''),10) || 0;

  /* ====== pickAvailability – סט קבוע, איפוס אחרי הוספה ====== */
  function pickAvailability(opts={}){
    const {
      titleHtml     = '<strong>בחירת ימים ושעות</strong>',
      tipText       = 'בחרו כמה שיותר אפשרויות שנוחות לכם',
      times         = ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00'],
      days          = ['','א','ב','ג','ד','ה'],
      continueText  = 'המשך',
      allowBack     = true,
    } = opts;

    botHTML(`${titleHtml}<br><span class="muted">${tipText}</span>`);

    return new Promise(resolve=>{
      const wrap = document.createElement('div');
      wrap.className='bubble bot wide';
      wrap.style.padding='16px';
      area.appendChild(wrap);

      // פונקציה ליצירת select עם תווית
      const makeField = (label, values, placeholder)=>{
        const fw=document.createElement('div'); fw.style.display='flex'; fw.style.flexDirection='column'; fw.style.gap='4px';
        const l=document.createElement('label'); l.textContent=label; fw.appendChild(l);
        const sel=document.createElement('select'); sel.className='input';
        const opt0=document.createElement('option'); opt0.value=''; opt0.textContent=placeholder; sel.appendChild(opt0);
        values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
        fw.appendChild(sel);
        return sel;
      };

      // שלושת השדות הקבועים
      const daySel  = makeField('בחר/י יום', days, 'בחר/י יום');
      const fromSel = makeField('משעה', times, 'משעה');
      const toSel   = makeField('עד שעה', times, 'עד שעה');
      wrap.append(daySel, fromSel, toSel);

      const addBtn=document.createElement('button');
      addBtn.className='btn';
      addBtn.textContent='+ הוספת מועד נוסף';
      addBtn.disabled=true;
      wrap.appendChild(addBtn);

      const preview=document.createElement('div');
      preview.className='slot-preview';
      wrap.appendChild(preview);

      const selected=[];

      const isValid=()=> daySel.value && fromSel.value && toSel.value && toNum(fromSel.value)<toNum(toSel.value);

      const refresh=()=>{
        addBtn.disabled=!isValid();
      };

      [daySel,fromSel,toSel].forEach(s=>s.addEventListener('change',refresh));

      const renderChips=()=>{
        preview.innerHTML='';
        selected.forEach((txt,i)=>{
          const c=chip(txt); c.classList.add('emph');
          const x=document.createElement('button');
          x.type='button'; x.className='x'; x.textContent='✖';
          x.onclick=()=>{ selected.splice(i,1); renderChips(); btnContinue.disabled=selected.length===0; };
          c.appendChild(x); preview.appendChild(c);
        });
      };

      addBtn.onclick=()=>{
        if(!isValid()) return;
        const txt=`יום ${daySel.value} ${fromSel.value}–${toSel.value}`;
        selected.push(txt);
        renderChips();
        daySel.value=''; fromSel.value=''; toSel.value='';
        refresh();
        btnContinue.disabled=selected.length===0;
      };

      const actions=document.createElement('div');
      actions.className='slots-actions';
      const btnContinue=document.createElement('button');
      btnContinue.className='btn primary';
      btnContinue.textContent=continueText;
      btnContinue.disabled=true;
      btnContinue.onclick=()=>{ userBubble(continueText); if(!selected.length){ botText('נדרש לבחור לפחות מועד אחד 🕒').classList.add('err'); return; } resolve([...selected]); };
      actions.appendChild(btnContinue);
      if(allowBack){ const backB=document.createElement('button'); backB.className='btn'; backB.textContent='חזרה'; backB.onclick=()=>{ goBack(); resolve(null); }; actions.appendChild(backB); }
      wrap.appendChild(actions);
    });
  }

  /* ===== Expose ===== */
  window.Chat={cfg,State,clear,push,goBack,updateBack,botHTML,botText,userBubble,button,chip,typingThen:()=>{},showProcessing:()=>{},scrollStartOf:()=>{},pickAvailability};
})();