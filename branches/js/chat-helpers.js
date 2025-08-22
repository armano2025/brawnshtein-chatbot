<script>
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
    b.className=cls; b.textContent=text;
    b.onclick=()=>{ b.disabled=true; onClick(); };
    area.appendChild(b); autoscroll(); return b;
  }
  function chip(text){
    const c=document.createElement('div'); c.className='chip'; c.textContent=text;
    // קצת פחות עגול כדי לשפר קריאות
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
    return (...args)=>{ if(used) return; used=true; return fn(...args); };
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
  /**
   * טופס קשר אחיד: שם פרטי, שם משפחה, טלפון.
   * מחזיר Promise עם { firstName, lastName, phone } בעת "המשך".
   */
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

  // ====== Reusable: pickAvailability (שופר לפי הדרישות) ======
  /**
   * בוחר ימים/שעות (גדול, אנכי, עם צ'יפים להסרה).
   * מחזיר Promise עם מערך בחירות ['יום א 16:00–18:00', ...].
   *
   * Options:
   *  - titleHtml: כותרת
   *  - tipText: שורת עזרה
   *  - times: ['','14:00',...]
   *  - days:  ['','א','ב',...]
   *  - continueText: טקסט כפתור המשך
   *  - allowBack: להציג כפתור חזרה
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

      const grid = document.createElement('div'); grid.className='slots-grid';
      grid.style.display = 'grid';
      grid.style.gap = '12px';

      const rowsWrap = document.createElement('div'); rowsWrap.className='slots-grid';
      rowsWrap.style.display = 'grid';
      rowsWrap.style.gap = '12px';

      const preview = document.createElement('div'); preview.className='slot-preview';
      preview.style.display = 'flex';
      preview.style.flexWrap = 'wrap';
      preview.style.gap = '8px';
      preview.style.marginTop = '4px';

      area.appendChild(wrap);

      const toNum = s => parseInt(String(s||'').replace(':',''),10) || 0;

      const makeSel = (placeholder, values)=>{
        const sel = document.createElement('select');
        sel.className='input';
        // גדול וברור + "ריבועי יותר"
        sel.style.width = '100%';
        sel.style.fontSize = '1.05rem';
        sel.style.padding = '12px 14px';
        sel.style.borderRadius = '10px';

        values.forEach(v=>{
          const o=document.createElement('option');
          o.value=v; o.textContent = v ? `${placeholder} ${v}` : placeholder;
          sel.appendChild(o);
        });
        return sel;
      };

      const isRowValid = (row)=>{
        const [dSel,fSel,tSel]=row.querySelectorAll('select');
        return dSel?.value && fSel?.value && tSel?.value && toNum(fSel.value) < toNum(tSel.value);
      };

      const countValidRows = ()=>{
        const rows=[...rowsWrap.children];
        return rows.reduce((acc,r)=> acc + (isRowValid(r)?1:0), 0);
      };

      const lastRowFilled = ()=>{
        const rows=[...rowsWrap.children];
        if(!rows.length) return false;
        return isRowValid(rows.at(-1));
      };

      const refreshPreview = ()=>{
        preview.innerHTML='';
        const rows=[...rowsWrap.children];
        rows.forEach(r=>{
          const [dSel,fSel,tSel]=r.querySelectorAll('select');
          const d=dSel.value, f=fSel.value, t=tSel.value;
          if(isRowValid(r)){
            const c = chip(`יום ${d} ${f}–${t}`); c.classList.add('emph');
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

      let btnContinue, addBtn;

      const wireRow = (row)=>{
        // פריסה אנכית — אחד מתחת לשני
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr';
        row.style.gap = '8px';

        row.querySelectorAll('select').forEach(sel=>{
          sel.addEventListener('change', ()=>{
            row.querySelector('.row-error')?.remove();
            const [ , fSel, tSel] = row.querySelectorAll('select');
            if(fSel.value && tSel.value && toNum(fSel.value) >= toNum(tSel.value)){
              const err=document.createElement('div'); err.className='row-error';
              err.style.color = '#b91c1c';
              err.style.fontSize = '.9rem';
              err.style.marginTop = '2px';
              err.textContent='״עד שעה״ חייב להיות אחרי ״משעה״';
              row.appendChild(err);
            }
            updateUI();
          });
        });
      };

      const addRow = (force=false)=>{
        if(!force && !lastRowFilled()){
          botText('ניתן להוסיף מועד נוסף רק לאחר שמילאתם את המועד הקודם.').classList.add('err');
          return;
        }
        const row=document.createElement('div');
        row.append(makeSel('בחר/י יום',days), makeSel('משעה',times), makeSel('עד שעה',times));
        rowsWrap.appendChild(row);
        wireRow(row);
        updateUI();
        autoscroll();
        return row;
      };

      const ensureEditableTail = ()=>{
        // אם אין שורות — נוסיף שורה חדשה.
        if(rowsWrap.children.length === 0){
          addRow(true);
          return;
        }
        // אם השורה האחרונה מלאה, נוסיף שורה ריקה נוספת כדי לאפשר בחירה מיידית.
        if(lastRowFilled()){
          addRow(true);
        }
      };

      const updateUI = ()=>{
        // כפתור "הוסף" זמין רק כשהשורה האחרונה תקינה
        if(addBtn) addBtn.disabled = !lastRowFilled();
        // כפתור המשך זמין רק אם יש לפחות בחירה אחת תקפה
        if(btnContinue) btnContinue.disabled = (countValidRows() === 0);
        refreshPreview();
      };

      // —— Header tip (לא חוזר פעמיים, מוצג כבר בכותרת העליונה) —— //

      // כפתור הוספת שורה
      addBtn = document.createElement('button');
      addBtn.className='btn';
      addBtn.textContent='+ הוספת מועד נוסף';
      addBtn.disabled = true;
      addBtn.onclick = ()=> addRow(false);

      grid.append(rowsWrap, addBtn, preview);
      wrap.appendChild(grid);

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
        const rows=[...rowsWrap.children]; const chosen=[];
        for(const r of rows){
          if(isRowValid(r)){
            const [dSel,fSel,tSel]=r.querySelectorAll('select');
            chosen.push(`יום ${dSel.value} ${fSel.value}–${tSel.value}`);
          }
        }
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

      // init — יצירת שורה ראשונה ותזמון מצב
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
</script>