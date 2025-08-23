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
      State.token++; // מבטל timeouts ישנים
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
    b.type='button';
    b.className=cls; b.textContent=text;
    b.onclick=()=>{ b.disabled=true; onClick?.(); };
    area.appendChild(b); autoscroll(); return b;
  }
  function chip(text){
    const c=document.createElement('div');
    c.className='chip';
    c.textContent=text;
    c.style.borderRadius='10px'; // טיפונת פחות עגול
    return c;
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

  // ==== Error helpers ====
  function inlineError(msg, el){
    const e = botText(msg); e.classList.add('err'); el?.focus(); return e;
  }
  function clearErrors(){
    [...area.querySelectorAll('.err')].forEach(n=>n.remove());
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

  // ===== One-time click wrapper =====
  function once(fn){
    let used=false;
    return (...args)=>{ if(used) return; used=true; return fn?.(...args); };
  }

  // ===== Summary card =====
  function summaryCard(pairs){
    const card = document.createElement('div'); card.className='bubble bot';
    for(const [k,v] of pairs){
      if(v==null || v==='') continue;
      const row=document.createElement('div');
      const b=document.createElement('strong'); b.textContent=k+' ';
      const s=document.createElement('span');  s.textContent=String(v);
      row.append(b,s); card.appendChild(row);
    }
    area.appendChild(card); autoscroll(); return card;
  }

  // ====== Reusable: askContact ======
  function askContact(opts={}){
    const {
      titleHtml = '<strong>פרטי קשר</strong><br><span class="muted">נשמור שם וטלפון לחזרה</span>',
      nextText = 'המשך',
      requireLast = true,
      showBack = true,
    } = opts;

    clearErrors();
    const h = botHTML(titleHtml);
    scrollStartOf(h);

    const firstName = inputRow('שם פרטי',   { id:'firstName', placeholder:'לדוגמה: דנה', required:true, autocomplete:'given-name' });
    const lastName  = inputRow('שם משפחה',  { id:'lastName',  placeholder:'לדוגמה: לוי', required:requireLast, autocomplete:'family-name' });
    const phone     = inputRow('טלפון לחזרה', { type:'tel', id:'phone', placeholder:'לדוגמה: 0501234567', required:true, autocomplete:'tel', inputmode:'tel' });

    return new Promise(resolve=>{
      const onNext = once(()=>{
        clearErrors();
        const fn  = (firstName.value||'').trim();
        const ln  = (lastName.value||'').trim();
        const tel = normalizeILPhone(phone.value||'');

        if(!fn){ inlineError('נדרש שם פרטי ✏️', firstName); return; }
        if(requireLast && !ln){ inlineError('נדרש שם משפחה ✏️', lastName); return; }
        if(!validILPhone(tel)){ inlineError('מספר טלפון לא תקין 📞', phone); return; }

        resolve({ firstName: fn, lastName: ln, phone: tel });
      });

      button(nextText, ()=>{
        userBubble(nextText);
        onNext();
      }, 'btn primary');

      if(showBack){
        button('חזרה', ()=> goBack());
      }
    });
  }

  // ====== Reusable: pickAvailability (שורה אחת קבועה + צ'יפים) ======
  /**
   * UI לבחירת זמינות:
   * - שורת select יחידה (יום / משעה / עד שעה)
   * - כפתור "+ הוספת מועד נוסף" לא יוצר שורה חדשה — שומר את הבחירה לצ'יפים ומאפס את אותה שורה
   * - כפתור המשך פעיל רק כשנשמר לפחות מועד אחד
   * מחזיר Promise<Array<string>> של טקסטים "יום X HH:MM–HH:MM"
   */
  function pickAvailability(opts = {}) {
    const {
      titleHtml     = '<strong>בחירת ימים ושעות</strong>',
      tipText       = 'בחרו כמה שיותר אפשרויות שנוחות לכם',
      times         = ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00'],
      days          = ['','א','ב','ג','ד','ה'],
      continueText  = 'המשך',
      allowBack     = true,
    } = opts;

    botHTML(`${titleHtml}<br><span class="muted">${tipText}</span>`);

    return new Promise((resolve) => {
      // מעטפת
      const wrap = document.createElement('div'); wrap.className = 'bubble bot wide';
      const grid = document.createElement('div'); grid.className = 'slots-grid';
      const preview = document.createElement('div'); preview.className = 'slot-preview';

      // שורת בחירה יחידה (אנכי)
      const row = document.createElement('div'); row.className = 'slot-row';
      row.style.gridTemplateColumns = '1fr';
      row.style.gap = '8px';

      const makeSel = (placeholder, values) => {
        const sel = document.createElement('select');
        sel.className = 'input';
        // אופציית placeholder
        const o0 = document.createElement('option');
        o0.value = '';
        o0.textContent = placeholder;
        sel.appendChild(o0);
        values.forEach(v => {
          if(v==='') return; // כבר יש placeholder
          const o = document.createElement('option');
          o.value = v;
          o.textContent = v;
          sel.appendChild(o);
        });
        return sel;
      };

      const daySel  = makeSel('בחר/י יום', days);
      const fromSel = makeSel('משעה', times);
      const toSel   = makeSel('עד שעה', times);

      row.append(daySel, fromSel, toSel);
      grid.append(row);

      // “הוספת מועד נוסף” – שומר לצ'יפים, לא מוסיף שורות
      const addBtn = document.createElement('button');
      addBtn.type='button';
      addBtn.className = 'btn';
      addBtn.textContent = '+ הוספת מועד נוסף';

      grid.append(addBtn, preview);
      wrap.appendChild(grid);

      // פעולות
      const actions = document.createElement('div');
      actions.className = 'slots-actions';
      const btnContinue = document.createElement('button');
      btnContinue.type='button';
      btnContinue.className = 'btn primary';
      btnContinue.textContent = continueText;
      btnContinue.disabled = true;
      actions.appendChild(btnContinue);

      if (allowBack) {
        const backB = document.createElement('button');
        backB.type='button';
        backB.className = 'btn';
        backB.textContent = 'חזרה';
        backB.onclick = () => { goBack(); resolve(null); };
        actions.appendChild(backB);
      }
      wrap.appendChild(actions);
      area.appendChild(wrap);

      // לוגיקה
      const toNum = s => parseInt(String(s || '').replace(':', ''), 10) || 0;
      const chosen = new Set(); // למניעת כפילויות

      const keyOf = (d, f, t) => `יום ${d} ${f}–${t}`;

      const clearRowError = () => row.querySelector('.row-error')?.remove();
      const showRowError = (msg) => {
        clearRowError();
        const err = document.createElement('div');
        err.className = 'row-error';
        err.textContent = msg;
        row.appendChild(err);
      };

      const resetSelectors = () => {
        daySel.selectedIndex = 0;
        fromSel.selectedIndex = 0;
        toSel.selectedIndex = 0;
        clearRowError();
      };

      const refreshPreview = () => {
        preview.innerHTML = '';
        [...chosen].forEach(txt => {
          const chipEl = chip(txt);
          chipEl.classList.add('emph');
          const x = document.createElement('button');
          x.type = 'button'; x.className = 'x'; x.title = 'הסר'; x.setAttribute('aria-label', 'הסר מועד'); x.textContent = '✖';
          x.onclick = () => { chosen.delete(txt); refreshPreview(); updateUI(); };
          chipEl.appendChild(x);
          preview.appendChild(chipEl);
        });
      };

      const isCurrentValid = () => {
        const d = daySel.value, f = fromSel.value, t = toSel.value;
        if (!(d && f && t)) { showRowError('נא לבחור יום ושעות מלאות'); return false; }
        if (toNum(f) >= toNum(t)) { showRowError('״עד שעה״ חייב להיות אחרי ״משעה״'); return false; }
        clearRowError();
        return true;
      };

      const updateUI = () => {
        btnContinue.disabled = chosen.size === 0;
      };

      // שינויי select – הסרת שגיאה מיידית
      [daySel, fromSel, toSel].forEach(sel => {
        sel.addEventListener('change', () => { clearRowError(); });
      });

      // לחיצה על “הוספת מועד נוסף” – מוסיף לצ׳יפים ומאפס את אותה שורה
      addBtn.onclick = () => {
        const d = daySel.value, f = fromSel.value, t = toSel.value;
        if (!isCurrentValid()) return;

        const k = keyOf(d, f, t);
        if (chosen.has(k)) {
          showRowError('המועד כבר נבחר');
          return;
        }
        chosen.add(k);
        refreshPreview();
        resetSelectors();
        updateUI();
      };

      // המשך
      btnContinue.onclick = () => {
        userBubble(continueText);
        resolve([...chosen]); // מערך טקסטים "יום X HH:MM–HH:MM"
      };

      // מצב התחלתי
      updateUI();
    });
  }

  // ===== Expose =====
  window.Chat = {
    cfg, State, clear, push, goBack, updateBack,
    botHTML, botText, userBubble, button, chip, inputRow,
    typingThen, showProcessing, scrollStartOf,
    inlineError, clearErrors, summaryCard, once,
    normalizeILPhone, validILPhone, sendLeadToSheet,
    askContact, pickAvailability
  };
})();