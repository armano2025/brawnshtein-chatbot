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
      State.token++;         // מבטל timeouts ישנים
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
    c.style.borderRadius = '10px'; // פחות עגול לטובת קריאות
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

  // ====== Reusable: pickAvailability – פריסה אנכית מלאה ======
  /**
   * מחזיר Promise עם מערך בחירות ['יום א 16:00–18:00', ...].
   * מציג לכל שורה: תווית + select, אחד מתחת לשני (יום / משעה / עד שעה).
   */
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
      // מיכל גדול וברור
      const wrap = document.createElement('div'); wrap.className='bubble bot wide';
      wrap.style.padding = '16px';
      wrap.style.maxWidth = '720px';
      wrap.style.marginInline = 'auto';

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gap = '12px';

      const rowsWrap = document.createElement('div');
      rowsWrap.style.display = 'grid';
      rowsWrap.style.gap = '14px';

      const preview = document.createElement('div'); // צ'יפים של בחירות
      preview.style.display = 'flex';
      preview.style.flexWrap = 'wrap';
      preview.style.gap = '8px';
      preview.style.marginTop = '6px';

      wrap.appendChild(rowsWrap);

      const helper = document.createElement('div');
      helper.className = 'muted';
      helper.textContent = 'ניתן להוסיף יותר ממועד אחד';
      wrap.appendChild(helper);

      // כפתור הוספת שורה
      const addBtn = document.createElement('button');
      addBtn.className = 'btn';
      addBtn.textContent = '+ הוספת מועד נוסף';
      addBtn.disabled = true; // יופעל אחרי שורה תקינה
      wrap.appendChild(addBtn);

      wrap.appendChild(preview);
      area.appendChild(wrap);

      const toNum = s => parseInt(String(s||'').replace(':',''),10) || 0;

      // שדה עם תווית + select (לפריסה אנכית אמיתית)
      function makeField(label, values, placeholder){
        const fw = document.createElement('div');
        fw.style.display = 'flex';
        fw.style.flexDirection = 'column';
        fw.style.gap = '6px';

        const l = document.createElement('label');
        l.textContent = label;
        l.style.fontWeight = '700';
        l.style.color = 'var(--text)';

        const sel = document.createElement('select');
        sel.className = 'input';
        sel.style.width = '100%';
        sel.style.fontSize = '1.05rem';
        sel.style.padding = '12px 14px';
        sel.style.borderRadius = '10px';
        // אפשרות ריקה
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = placeholder || `בחר/י ${label}`;
        sel.appendChild(opt0);
        // שאר האפשרויות
        values.forEach(v=>{
          const o=document.createElement('option');
          o.value=v; o.textContent=v;
          sel.appendChild(o);
        });

        fw.append(l, sel);
        return {wrap: fw, sel};
      }

      const isRowValid = (row)=>{
        const f = row.__d?.value, s = row.__f?.value, t = row.__t?.value;
        return f && s && t && toNum(s) < toNum(t);
      };

      const countValidRows = ()=>{
        return [...rowsWrap.children].reduce((acc,r)=> acc + (isRowValid(r)?1:0), 0);
      };

      const lastRowFilled = ()=>{
        const rows=[...rowsWrap.children];
        if(!rows.length) return false;
        return isRowValid(rows.at(-1));
      };

      const refreshPreview = ()=>{
        preview.innerHTML='';
        [...rowsWrap.children].forEach(r=>{
          if(isRowValid(r)){
            const c = chip(`יום ${r.__d.value} ${r.__f.value}–${r.__t.value}`);
            c.classList.add('emph');
            const x = document.createElement('button');
            x.type='button'; x.className='x'; x.title='הסר'; x.setAttribute('aria-label','הסר מועד'); x.textContent='✖';
            x.onclick=()=>{
              r.remove();
              ensureEditableTail();
              updateUI();
            };
            c.appendChild(x);
            preview.appendChild(c);
          }
        });
      };

      let btnContinue;

      const wireRow = (row)=>{
        // כל שדה בשורה אנכי — כבר נעשה ב‑makeField
        const onChange = ()=>{
          row.querySelector('.row-error')?.remove();
          if(row.__f.value && row.__t.value && toNum(row.__f.value) >= toNum(row.__t.value)){
            const err=document.createElement('div'); err.className='row-error';
            err.style.color = '#b91c1c';
            err.style.fontSize = '.9rem';
            err.style.marginTop = '2px';
            err.textContent='״עד שעה״ חייב להיות אחרי ״משעה״';
            row.appendChild(err);
          }
          updateUI();
        };
        [row.__d, row.__f, row.__t].forEach(sel=> sel.addEventListener('change', onChange));
      };

      const addRow = (force=false)=>{
        if(!force && !lastRowFilled()){
          botText('ניתן להוסיף מועד נוסף רק לאחר שמילאתם את המועד הקודם.').classList.add('err');
          return;
        }
        const row=document.createElement('div');
        row.className='slot-row';
        row.style.display='grid';
        row.style.gridTemplateColumns='1fr'; // אנכי
        row.style.gap='10px';

        const {wrap: dayW,  sel: daySel}  = makeField('בחר/י יום', days, 'בחר/י יום');
        const {wrap: fromW, sel: fromSel} = makeField('משעה',     times, 'משעה');
        const {wrap: toW,   sel: toSel}   = makeField('עד שעה',    times, 'עד שעה');

        row.__d = daySel; row.__f = fromSel; row.__t = toSel;

        row.append(dayW, fromW, toW);
        rowsWrap.appendChild(row);
        wireRow(row);
        updateUI();
        autoscroll();
        return row;
      };

      const ensureEditableTail = ()=>{
        if(rowsWrap.children.length === 0){
          addRow(true);
          return;
        }
        if(lastRowFilled()){
          addRow(true);
        }
      };

      const updateUI = ()=>{
        addBtn.disabled = !lastRowFilled();
        if(btnContinue) btnContinue.disabled = (countValidRows() === 0);
        refreshPreview();
      };

      addBtn.onclick = ()=> addRow(false);

      // Actions
      const actions = document.createElement('div');
      actions.className='slots-actions';
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.justifyContent = 'flex-end';
      actions.style.marginTop = '10px';

      btnContinue = document.createElement('button');
      btnContinue.className='btn primary';
      btnContinue.textContent=continueText;
      btnContinue.disabled = true;
      btnContinue.onclick = ()=>{
        userBubble(continueText);
        const chosen=[];
        [...rowsWrap.children].forEach(r=>{
          if(isRowValid(r)){
            chosen.push(`יום ${r.__d.value} ${r.__f.value}–${r.__t.value}`);
          }
        });
        if(!chosen.length){
          botText('נדרש לבחור לפחות מועד אחד 🕒').classList.add('err');
          return;
        }
        resolve(chosen);
      };
      actions.appendChild(btnContinue);

      if(allowBack){
        const backB = document.createElement('button');
        backB.className='btn';
        backB.textContent='חזרה';
        backB.onclick = ()=>{ goBack(); resolve(null); };
        actions.appendChild(backB);
      }

      wrap.appendChild(actions);

      // init — יצירת שורה ראשונה
      addRow(true);
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