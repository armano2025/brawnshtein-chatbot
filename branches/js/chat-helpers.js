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
      State.token++;         // מבטל timeouts ישנים
      last()();
    }
  };
  function updateBack(){ if (backBtn) backBtn.disabled = State.history.length <= 1; }
  if (backBtn) backBtn.onclick = goBack;

  /* ===== UI ===== */
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
    c.style.borderRadius = '10px';
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

  /* ==== Error helpers ==== */
  function inlineError(msg, el){
    const e = botText(msg); e.classList.add('err'); el?.focus(); return e;
  }
  function clearErrors(){
    [...area.querySelectorAll('.err')].forEach(n=>n.remove());
  }

  /* ===== Utils ===== */
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
        headers:{ 'Content-Type':'text/plain' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      try{ const j=await res.json(); return j && j.ok===true; }
      catch(_){ return res.ok; }
    }catch(e){ console.error('Sheets error', e); return false; }
    finally{ clearTimeout(timeout); }
  }

  /* ===== One-time click wrapper ===== */
  function once(fn){
    let used=false;
    return (...args)=>{ if(used) return; used=true; return fn?.(...args); };
  }

  /* ===== Summary card ===== */
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

  /* ====== Reusable: askContact ====== */
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

  /* ====== Reusable: pickAvailability – שורה אחת, צ׳יפים, איפוס ====== */
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
      wrap.style.maxWidth='720px';
      wrap.style.marginInline='auto';

      const row = document.createElement('div');
      row.className='slot-row';
      row.style.display='grid';
      row.style.gridTemplateColumns='1fr';
      row.style.gap='10px';

      const makeField = (label, values, placeholder)=>{
        const fw=document.createElement('div');
        fw.style.display='flex'; fw.style.flexDirection='column'; fw.style.gap='6px';
        const l=document.createElement('label'); l.textContent=label; l.style.fontWeight='700'; l.style.color='var(--muted)';
        const sel=document.createElement('select'); sel.className='input';
        const opt0=document.createElement('option'); opt0.value=''; opt0.textContent=placeholder||`בחר/י ${label}`; sel.appendChild(opt0);
        values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
        fw.append(l, sel);
        return {wrap:fw, sel};
      };

      const {wrap: dayW,  sel: daySel}  = makeField('בחר/י יום', days, 'בחר/י יום');
      const {wrap: fromW, sel: fromSel} = makeField('משעה',     times, 'משעה');
      const {wrap: toW,   sel: toSel}   = makeField('עד שעה',    times, 'עד שעה');

      row.append(dayW, fromW, toW);
      wrap.appendChild(row);

      const hint=document.createElement('div');
      hint.className='muted';
      hint.textContent='ניתן להוסיף יותר ממועד אחד';
      wrap.appendChild(hint);

      const addBtn=document.createElement('button');
      addBtn.className='btn';
      addBtn.textContent='+ הוספת מועד נוסף';
      addBtn.disabled=true;
      wrap.appendChild(addBtn);

      const preview=document.createElement('div');
      preview.className='slot-preview';
      wrap.appendChild(preview);

      area.appendChild(wrap);

      const toNum = s => parseInt(String(s||'').replace(':',''),10) || 0;
      const selected = [];

      const isCurrentValid = ()=> {
        const d=daySel.value, f=fromSel.value, t=toSel.value;
        return d && f && t && toNum(f) < toNum(t);
      };

      const refreshAddState = ()=>{
        row.querySelector('.row-error')?.remove();
        if (fromSel.value && toSel.value && toNum(fromSel.value) >= toNum(toSel.value)) {
          const err=document.createElement('div');
          err.className='row-error';
          err.textContent='״עד שעה״ חייב להיות אחרי ״משעה״';
          row.appendChild(err);
        }
        addBtn.disabled = !isCurrentValid();
      };

      const renderChips = ()=>{
        preview.innerHTML='';
        selected.forEach((txt, i)=>{
          const c=chip(txt); c.classList.add('emph');
          const x=document.createElement('button');
          x.type='button'; x.className='x'; x.title='הסר מועד'; x.setAttribute('aria-label','הסר מועד'); x.textContent='✖';
          x.onclick=()=>{ selected.splice(i,1); renderChips(); btnContinue.disabled = selected.length===0; };
          c.appendChild(x);
          preview.appendChild(c);
        });
      };

      [daySel, fromSel, toSel].forEach(s=> s.addEventListener('change', refreshAddState));

      addBtn.onclick = ()=>{
        if(!isCurrentValid()) return;
        const txt = `יום ${daySel.value} ${fromSel.value}–${toSel.value}`;
        selected.push(txt);
        renderChips();
        daySel.value=''; fromSel.value=''; toSel.value='';
        refreshAddState();
        btnContinue.disabled = selected.length===0;
      };

      const actions=document.createElement('div');
      actions.className='slots-actions';

      const btnContinue=document.createElement('button');
      btnContinue.className='btn primary';
      btnContinue.textContent=continueText;
      btnContinue.disabled=true;
      btnContinue.onclick=()=>{
        userBubble(continueText);
        if(selected.length===0){
          botText('נדרש לבחור לפחות מועד אחד 🕒').classList.add('err');
          return;
        }
        resolve([...selected]);
      };
      actions.appendChild(btnContinue);

      if(allowBack){
        const backB=document.createElement('button');
        backB.className='btn';
        backB.textContent='חזרה';
        backB.onclick=()=>{ goBack(); resolve(null); };
        actions.appendChild(backB);
      }

      wrap.appendChild(actions);
    });
  }

  /* ====== Reusable: askFreeMessage – הודעה/מלל חופשי למזכירות ====== */
  function askFreeMessage(opts = {}){
    const {
      titleHtml          = '<strong>הודעה למזכירות</strong><br><span class="muted">כתבו לנו כל דבר שחשוב שנדע</span>',
      messageLabel       = 'הודעה',
      messagePlaceholder = 'כתבו כאן כל דבר שתרצו',
      requireMessage     = true,
      includeNotes       = true,
      notesLabel         = 'פרטים נוספים (רשות)',
      notesPlaceholder   = 'אם יש עוד פרטים חשובים',
      nextText           = 'המשך',
      showBack           = true,
    } = opts;

    clearErrors();
    const h = botHTML(titleHtml);
    scrollStartOf(h);

    const messageEl = inputRow(messageLabel, { textarea:true, id:'msg',       placeholder: messagePlaceholder });
    const notesEl   = includeNotes ?        inputRow(notesLabel,   { textarea:true, id:'msg_notes', placeholder: notesPlaceholder }) : null;

    return new Promise(resolve=>{
      const onNext = once(()=>{
        clearErrors();
        const message    = (messageEl.value || '').trim();
        const extraNotes = (notesEl?.value || '').trim();

        if(requireMessage && !message){
          inlineError('נדרש למלא הודעה ✍️', messageEl);
          return;
        }
        resolve({ message, extraNotes });
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

  /* ====== Reusable: askCalendarDate – בחירת תאריך מיומן חודשי ====== */
  function askCalendarDate(opts = {}){
    const {
      titleHtml   = '<strong>בחירת תאריך</strong><br><span class="muted">בחרו תאריך בלוח החודשי</span>',
      label       = 'תאריך',
      id          = 'selected_date',
      requireDate = true,
      minToday    = false,
      min,
      max,
      nextText    = 'המשך',
      showBack    = true,
    } = opts;

    clearErrors();
    const h = botHTML(titleHtml);
    scrollStartOf(h);

    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent=label;
    const i=document.createElement('input'); i.type='date'; i.className='input'; i.id=id;
    if(minToday){ i.min = new Date().toISOString().slice(0,10); }
    if(min){ i.min = min; }
    if(max){ i.max = max; }
    wrap.append(l,i); area.appendChild(wrap); autoscroll();

    return new Promise(resolve=>{
      const onNext = once(()=>{
        clearErrors();
        const date = (i.value || '').trim();
        if(requireDate && !date){
          inlineError('נדרש לבחור תאריך 📅', i);
          return;
        }
        resolve({ date });
      });

      button(nextText, ()=>{
        userBubble(nextText);   // <— היה כאן באג: continueText
        onNext();
      }, 'btn primary');

      if(showBack){
        button('חזרה', ()=> goBack());
      }
    });
  }

  /* ====== (Optional helpers) selectTime / selectSubject ====== */
  function selectTime({ id='time', label='שעה', times=['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'] } = {}){
    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent=label;
    const s=document.createElement('select'); s.className='input'; s.id=id;
    const o0=document.createElement('option'); o0.value=''; o0.textContent='בחר/י שעה'; s.appendChild(o0);
    times.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; s.appendChild(o); });
    wrap.append(l,s); area.appendChild(wrap); autoscroll();
    return s;
  }

  function selectSubject({ id='subject', label='מקצוע', subjects=['','מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'] } = {}){
    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent=label;
    const s=document.createElement('select'); s.className='input'; s.id=id;
    subjects.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent = v || 'בחר/י מקצוע'; s.appendChild(o); });
    wrap.append(l,s); area.appendChild(wrap); autoscroll();
    return s;
  }

  /* ===== Helpers: תאריכים ===== */
  function formatDateHeb(yyyy_mm_dd){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd||'')) return yyyy_mm_dd||'';
    const [y,m,d] = yyyy_mm_dd.split('-');
    return `${d}/${m}`;
  }
  function isValidDateStr(yyyy_mm_dd){
    return /^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd||'');
  }

  /* ====== NEW: askDateTimeSlots – תאריכים+שעה מרובים עם צ'יפים ====== */
  function askDateTimeSlots(opts = {}){
    const {
      titleHtml     = '<strong>בחירת תאריך ושעה</strong><br><span class="muted">בחרו תאריך ושעה, הוסיפו, וניתן להוסיף עוד מועדים</span>',
      dateLabel     = 'תאריך',
      timeLabel     = 'שעה',
      idDate        = 'slot_date',
      idTime        = 'slot_time',
      requireAtLeast= 1,
      minToday      = true,
      min,
      max,
      times         = ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText  = 'המשך',
      allowBack     = true,
    } = opts;

    clearErrors();
    const h = botHTML(titleHtml);
    scrollStartOf(h);

    // תאריך
    const wrapDate=document.createElement('div'); wrapDate.className='input-wrap bubble bot';
    const lDate=document.createElement('label'); lDate.textContent=dateLabel;
    const iDate=document.createElement('input'); iDate.type='date'; iDate.className='input'; iDate.id=idDate;
    if(minToday) iDate.min = new Date().toISOString().slice(0,10);
    if(min) iDate.min = min;
    if(max) iDate.max = max;
    wrapDate.append(lDate, iDate);
    area.appendChild(wrapDate); autoscroll();

    // שעה
    const wrapTime=document.createElement('div'); wrapTime.className='input-wrap bubble bot';
    const lTime=document.createElement('label'); lTime.textContent=timeLabel;
    const sTime=document.createElement('select'); sTime.className='input'; sTime.id=idTime;
    const o0=document.createElement('option'); o0.value=''; o0.textContent='בחר/י שעה'; sTime.appendChild(o0);
    (times||[]).forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sTime.appendChild(o); });
    wrapTime.append(lTime, sTime);
    area.appendChild(wrapTime); autoscroll();

    // כפתור הוספת מועד + תצוגת צ'יפים
    const addWrap=document.createElement('div'); addWrap.className='bubble bot'; addWrap.style.padding='12px';
    const addBtn=document.createElement('button'); addBtn.className='btn'; addBtn.textContent='+ הוספת מועד';
    addBtn.disabled = true;
    const chips=document.createElement('div'); chips.className='slot-preview'; chips.style.marginTop='8px';
    addWrap.append(addBtn, chips);
    area.appendChild(addWrap); autoscroll();

    const slots=[]; // {date, time, label}

    const validCurrent = ()=> isValidDateStr(iDate.value) && !!sTime.value.trim();
    const refreshAddState = ()=>{ addBtn.disabled = !validCurrent(); };

    iDate.addEventListener('change', refreshAddState);
    sTime.addEventListener('change', refreshAddState);

    const renderChips = ()=>{
      chips.innerHTML='';
      slots.forEach((slot, idx)=>{
        const c=chip(slot.label); c.classList.add('emph');
        const x=document.createElement('button');
        x.type='button'; x.className='x'; x.title='הסר מועד'; x.setAttribute('aria-label','הסר מועד'); x.textContent='✖';
        x.onclick=()=>{ slots.splice(idx,1); renderChips(); btnContinue.disabled = slots.length < requireAtLeast; };
        c.appendChild(x);
        chips.appendChild(c);
      });
    };

    addBtn.onclick = ()=>{
      if(!validCurrent()) return;
      const d=iDate.value, t=sTime.value.trim();
      const label = `${formatDateHeb(d)} • ${t}`;
      if(slots.some(s=> s.date===d && s.time===t)){
        inlineError('המועד כבר נבחר ✋', sTime);
        return;
      }
      slots.push({ date:d, time:t, label });
      renderChips();
      iDate.value=''; sTime.value='';
      refreshAddState();
      btnContinue.disabled = slots.length < requireAtLeast;
    };

    // אזור פעולות תחתון + Promise תקין
    return new Promise(resolve=>{
      const actions=document.createElement('div'); actions.className='slots-actions';

      const btnContinue=document.createElement('button');
      btnContinue.className='btn primary';
      btnContinue.textContent=continueText;
      btnContinue.disabled = slots.length < requireAtLeast;
      btnContinue.onclick=()=>{
        userBubble(continueText);
        if(slots.length < requireAtLeast){
          inlineError(`נדרש לבחור לפחות ${requireAtLeast} מועד 🕒`, sTime);
          return;
        }
        resolve({ slots: slots.map(s=>({ ...s })) });
      };
      actions.appendChild(btnContinue);

      if(allowBack){
        const backB=document.createElement('button'); backB.className='btn'; backB.textContent='חזרה';
        backB.onclick=()=>{ goBack(); resolve(null); };
        actions.appendChild(backB);
      }

      area.appendChild(actions); autoscroll();
    });
  }

  /* ===== Expose ===== */
  window.Chat = {
    cfg, State, clear, push, goBack, updateBack,
    botHTML, botText, userBubble, button, chip, inputRow,
    typingThen, showProcessing, scrollStartOf,
    inlineError, clearErrors, summaryCard, once,
    normalizeILPhone, validILPhone, sendLeadToSheet,
    askContact, pickAvailability,
    askFreeMessage,
    askCalendarDate,
    selectTime,
    selectSubject,
    askDateTimeSlots
  };
})();