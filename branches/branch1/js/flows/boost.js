// /branches/branch1/js/flows/boost.js
const BoostFlow = (() => {
  /* ===== התחלה ===== */
  function start(){
    Chat.clear();
    Chat.State.data = {}; // איפוס הקשר זרימה
    stepContact();
  }

  /* ===== עוזרים קטנים מקומיים ===== */
  function makeSelect({ id, label, options }){
    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent=label;
    const s=document.createElement('select'); s.className='input'; s.id=id;
    options.forEach(({value,text,disabled})=>{
      const o=document.createElement('option');
      o.value=value; o.textContent=text;
      if(disabled) o.disabled=true;
      s.appendChild(o);
    });
    area.appendChild(wrap);
    wrap.append(l,s);
    Chat.scrollStartOf(wrap);
    return s;
  }
  function formatDateHeb(yyyy_mm_dd){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd||'')) return yyyy_mm_dd||'';
    const [y,m,d] = (yyyy_mm_dd||'').split('-');
    return `${d}/${m}`;
  }

  /* ===== קומפוננטה: תאריך + טווח שעות (ריבוי אופציות עם צ'יפים) ===== */
  function askDateWithHourRangeSlots(opts = {}){
    const {
      titleHtml     = '<strong>מתי נוח לכם?</strong> 👨‍🚀<br><span class="muted">בחרו תאריך וטווח שעות. מומלץ להוסיף כמה אפשרויות 👇</span>',
      dateLabel     = 'תאריך',
      fromLabel     = 'משעה',
      toLabel       = 'עד שעה',
      idDate        = 'boost_slot_date',
      idFrom        = 'boost_slot_from',
      idTo          = 'boost_slot_to',
      minToday      = true,
      min,
      max,
      times         = ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText  = 'המשך',
      allowBack     = true,
      requireAtLeast= 1
    } = opts;

    Chat.clearErrors();
    Chat.botHTML(
      `${titleHtml}<div class="muted" style="margin-top:6px">טיפ: טווח רחב (למשל 17:00–20:00) מגדיל סיכוי לשיבוץ מהיר.</div>`
    );

    // תאריך
    const wrapDate=document.createElement('div'); wrapDate.className='input-wrap bubble bot';
    const lDate=document.createElement('label'); lDate.textContent=dateLabel;
    const iDate=document.createElement('input'); iDate.type='date'; iDate.className='input'; iDate.id=idDate;
    if(minToday) iDate.min = new Date().toISOString().slice(0,10);
    if(min) iDate.min = min;
    if(max) iDate.max = max;
    wrapDate.append(lDate, iDate);
    area.appendChild(wrapDate);

    // משעה
    const sFrom = makeSelect({
      id: idFrom,
      label: fromLabel,
      options: [{value:'',text:'בחר/י שעה'}].concat(times.map(t=>({value:t,text:t})))
    });

    // עד שעה
    const sTo = makeSelect({
      id: idTo,
      label: toLabel,
      options: [{value:'',text:'בחר/י שעה'}].concat(times.map(t=>({value:t,text:t})))
    });

    // אזור הוספה וצ'יפים מעוצב
    const addWrap=document.createElement('div');
    addWrap.className='bubble bot';
    addWrap.style.padding='14px';
    addWrap.style.border='1px dashed var(--card-brd,#e6eaf3)';
    addWrap.style.borderRadius='14px';
    addWrap.style.background='rgba(0,0,0,.02)';

    const tip=document.createElement('div');
    tip.className='muted';
    tip.textContent='הוסיפו כמה מועדים. אפשר להסיר כל מועד לפני המשך.';
    tip.style.marginBottom='8px';

    const addBtn=document.createElement('button');
    addBtn.className='btn';
    addBtn.textContent='+ הוספת מועד';
    addBtn.disabled = true;

    const chips=document.createElement('div');
    chips.className='slot-preview';
    chips.style.marginTop='8px';
    chips.style.display='flex';
    chips.style.flexWrap='wrap';
    chips.style.gap='6px';

    addWrap.append(tip, addBtn, chips);
    area.appendChild(addWrap);

    const slots=[]; // {date, from, to, label}

    const toNum = (s)=> parseInt(String(s||'').replace(':',''),10) || 0;
    const validCurrent = ()=> {
      const d = iDate.value;
      const f = sFrom.value?.trim();
      const t = sTo.value?.trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(d||'') && f && t && toNum(f) < toNum(t);
    };
    let btnContinue;

    const refreshAddState = ()=>{
      Chat.clearErrors();
      if(sFrom.value && sTo.value && toNum(sFrom.value) >= toNum(sTo.value)){
        Chat.inlineError('״עד שעה״ חייב להיות אחרי ״משעה״', sTo);
      }
      addBtn.disabled = !validCurrent();
      if(btnContinue) btnContinue.disabled = slots.length < requireAtLeast;
    };

    [iDate, sFrom, sTo].forEach(el => el.addEventListener('change', refreshAddState));

    const renderChips = ()=>{
      chips.innerHTML='';
      slots.forEach((slot, idx)=>{
        const c=Chat.chip(slot.label); c.classList.add('emph');
        const x=document.createElement('button');
        x.type='button'; x.className='x'; x.title='הסר מועד'; x.setAttribute('aria-label','הסר מועד'); x.textContent='✖';
        x.onclick=()=>{
          slots.splice(idx,1);
          renderChips();
          if(btnContinue) btnContinue.disabled = slots.length < requireAtLeast;
        };
        c.appendChild(x);
        chips.appendChild(c);
      });
    };

    addBtn.onclick = ()=>{
      if(!validCurrent()) return;
      const d = iDate.value;
      const f = sFrom.value.trim();
      const t = sTo.value.trim();

      const label = `${formatDateHeb(d)} • ${f}–${t}`;
      if(slots.some(s=> s.date===d && s.from===f && s.to===t)){
        Chat.inlineError('המועד כבר נבחר ✋', sTo);
        return;
      }
      slots.push({ date:d, from:f, to:t, label });
      renderChips();

      iDate.value=''; sFrom.value=''; sTo.value='';
      refreshAddState();
    };

    // פעולות תחתונות
    const actions=document.createElement('div');
    actions.className='slots-actions';
    actions.style.display='flex';
    actions.style.gap='8px';

    btnContinue=document.createElement('button');
    btnContinue.className='btn primary';
    btnContinue.textContent=continueText;
    btnContinue.disabled = true;

    let resolver;

    btnContinue.onclick=()=>{
      Chat.userBubble(continueText);
      if(slots.length < requireAtLeast){
        Chat.inlineError(`נדרש לבחור לפחות ${requireAtLeast} מועד 🕒`, sTo);
        btnContinue.disabled=false;
        return;
      }
      resolver({ slots: slots.map(s=>({ ...s })) });
    };
    actions.appendChild(btnContinue);

    if(allowBack){
      const backB=document.createElement('button'); backB.className='btn'; backB.textContent='חזרה';
      backB.onclick=()=>{ Chat.goBack(); resolver(null); };
      actions.appendChild(backB);
    }
    area.appendChild(actions);

    return new Promise((resolve)=>{
      let resolved=false;
      resolver = (v)=>{ if(resolved) return; resolved=true; resolve(v); };
    });
  }

  /* ===== שלב 1: פרטי קשר ===== */
  function stepContact(){
    Chat.push(stepContact);
    Chat.askContact({
      titleHtml: '<strong>שיעור חד־פעמי (ללא מנוי)</strong> 👨‍🚀<br><span class="muted">אעזור לכם לתאם מול המזכירות. נתחיל בפרטים בסיסיים.</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;

      // דוגמת הטלפון המבוקשת
      const tel = document.getElementById('phone');
      if(tel) tel.placeholder = 'לדוגמה: 0509570866';

      Chat.State.data = { ...Chat.State.data, ...c };
      stepSubject();
    });
  }

  /* ===== שלב 2: מקצוע ===== */
  function stepSubject(){
    Chat.push(stepSubject);

    Chat.botHTML('<strong>באיזה מקצוע תרצו את השיעור?</strong> 👨‍🚀<br><span class="muted">בחר/י מתוך הרשימה</span>');
    const subjSel = Chat.selectSubject({
      id: 'boost_subject',
      label: 'מקצוע',
      subjects: ['','מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת']
    });

    const nextBtn = Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      Chat.clearErrors();
      const subject = (subjSel.value||'').trim();
      if(!subject){
        Chat.inlineError('בחר/י מקצוע 📚', subjSel);
        nextBtn.disabled=false;
        return;
      }
      Chat.State.data.subject = subject;
      stepGrade();
    }, 'btn');
  }

  /* ===== שלב 3: כיתה ===== */
  function stepGrade(){
    Chat.push(stepGrade);

    Chat.botHTML('<strong>באיזו כיתה?</strong> 👨‍🚀');
    const gradeSel = makeSelect({
      id:'boost_grade',
      label:'כיתה',
      options: [
        {value:'', text:'בחר/י כיתה'},
        {value:'ז', text:'ז'},
        {value:'ח', text:'ח'},
        {value:'ט', text:'ט'},
        {value:'י', text:'י'},
        {value:'יא', text:'יא'},
        {value:'יב', text:'יב'}
      ]
    });

    const nextBtn = Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      Chat.clearErrors();
      const grade = (gradeSel.value||'').trim();
      if(!grade){
        Chat.inlineError('בחר/י כיתה 🏫', gradeSel);
        nextBtn.disabled=false;
        return;
      }
      Chat.State.data.grade = grade;

      if(grade === 'יא' || grade === 'יב' || grade === 'י'){
        stepUnits();
      }else{
        Chat.State.data.units = '';
        stepPlan();
      }
    }, 'btn');
  }

  /* ===== שלב 4: יחידות בגרות (מותנה) ===== */
  function stepUnits(){
    Chat.push(stepUnits);

    Chat.botHTML('<strong>כמה יחידות בגרות?</strong> 👨‍🚀');
    const unitsSel = makeSelect({
      id:'boost_units',
      label:'יחידות בגרות',
      options: [
        {value:'', text:'בחר/י'},
        {value:'3', text:'3 יחידות בגרות'},
        {value:'4', text:'4 יחידות בגרות'},
        {value:'5', text:'5 יחידות בגרות'},
      ]
    });

    const nextBtn = Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      Chat.clearErrors();
      const units = (unitsSel.value||'').trim();
      if(!units){
        Chat.inlineError('בחר/י מספר יחידות 🎓', unitsSel);
        nextBtn.disabled=false;
        return;
      }
      Chat.State.data.units = units;
      stepPlan();
    }, 'btn');
  }

  /* ===== שלב 5: בחירת מסלול/תעריף ===== */
  function stepPlan(){
    Chat.push(stepPlan);

    Chat.botHTML('<strong>איזה מסלול שיעור מתאים לכם?</strong> 👨‍🚀<br><span class="muted">תעריף לשיעור אחד (ללא מנוי)</span>');

    const isHigh5 = (Chat.State.data.grade==='יא' || Chat.State.data.grade==='יב') && Chat.State.data.units==='5';

    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent='מסלול';
    const s=document.createElement('select'); s.className='input'; s.id='boost_plan';

    // **** תעריפי ענף 1 ****
    const options = [
      { val:'',         text:'בחר/י מסלול' },
      { val:'group',    text:'מסלול קבוצתי – 80₪ לשיעור',  price:80,  disabled: isHigh5 },
      { val:'triple',   text:'מסלול טריפל – 100₪ לשיעור',  price:100 },
      { val:'private',  text:'מסלול פרטי – 160₪ לשיעור',   price:160 }
    ];

    options.forEach(o=>{
      const opt=document.createElement('option');
      opt.value=o.val; opt.textContent=o.text;
      if(o.disabled) opt.disabled=true;
      s.appendChild(opt);
    });
    wrap.append(l,s);
    area.appendChild(wrap); Chat.scrollStartOf(wrap);

    if(isHigh5){
      const note=document.createElement('div');
      note.className='bubble bot muted';
      note.textContent='לכיתות יא/יב ברמת 5 יח"ל ניתן לבחור רק מסלול טריפל או מסלול פרטי.';
      area.appendChild(note);
    }

    const nextBtn = Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      Chat.clearErrors();
      const planType = s.value;
      if(!planType){
        Chat.inlineError('בחר/י מסלול 🧭', s);
        nextBtn.disabled=false;
        return;
      }
      const meta = options.find(o=>o.val===planType) || {};
      Chat.State.data.planType = planType;
      Chat.State.data.planText = meta.text || '';
      Chat.State.data.price    = meta.price || '';

      stepDateRanges();
    }, 'btn');
  }

  /* ===== שלב 6: תאריכים + טווחי שעות ===== */
  function stepDateRanges(){
    Chat.push(stepDateRanges);

    askDateWithHourRangeSlots({
      titleHtml:
        '<strong>מתי נוח לכם לשיעור?</strong> 👨‍🚀<br>' +
        '<span class="muted">בחר/י תאריך וטווח שעות, לחצ/י "+ הוספת מועד". ניתן להוסיף כמה מועדים ולהסיר לפני המשך.</span>',
      dateLabel: 'תאריך לשיעור',
      fromLabel: 'משעה',
      toLabel:   'עד שעה',
      minToday: true,
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText: 'המשך',
      allowBack: true
    }).then(res=>{
      if(res == null) return; // חזרה

      const raw = Array.isArray(res?.slots) ? res.slots : [];
      if(!raw.length){
        Chat.inlineError('נדרש לבחור לפחות מועד אחד 🕒');
        return;
      }

      const slots = raw
        .map(s=>({ date:s.date||'', from:s.from||'', to:s.to||'', label:s.label||'' }))
        .filter(s=> s.date && s.from && s.to);

      if(!slots.length){
        Chat.inlineError('נדרש לבחור לפחות מועד אחד תקין 🕒');
        return;
      }

      Chat.State.data.boostSlots = slots;
      Chat.State.data.lessonDate = slots[0].date;
      Chat.State.data.lessonTime = `${slots[0].from}–${slots[0].to}`;

      stepStudentName();
    });
  }

  /* ===== שלב 7: שם תלמיד/ה ===== */
  function stepStudentName(){
    Chat.push(stepStudentName);

    Chat.botHTML('<strong>שם התלמיד/ה</strong><br><span class="muted">למי מיועד השיעור?</span>');
    const studentFirst = Chat.inputRow('שם תלמיד/ה', { id:'student_first', placeholder:'לדוגמה: דנה', required:true, autocomplete:'given-name' });
    const studentLast  = Chat.inputRow('שם משפחה התלמיד/ה', { id:'student_last', placeholder:'לדוגמה: לוי', required:true, autocomplete:'family-name' });

    const nextBtn = Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      Chat.clearErrors();
      const fn=(studentFirst.value||'').trim();
      const ln=(studentLast.value||'').trim();
      if(!fn){ Chat.inlineError('נדרש שם תלמיד/ה ✏️', studentFirst); nextBtn.disabled=false; return; }
      if(!ln){ Chat.inlineError('נדרש שם משפחה ✏️', studentLast); nextBtn.disabled=false; return; }

      Chat.State.data.studentFirst = fn;
      Chat.State.data.studentLast  = ln;

      stepDetails();
    }, 'btn');
  }

  /* ===== שלב 8: מלל חופשי (רשות) ===== */
  function stepDetails(){
    Chat.push(stepDetails);
    Chat.askFreeMessage({
      titleHtml: '<strong>פרטים/הערות למזכירות (רשות)</strong><br><span class="muted">העדפה למורה/ה, נושא הלמידה או כל דבר נוסף</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'אפשר לכתוב כל דבר שיסייע לנו להתאים את השיעור',
      requireMessage: false,
      includeNotes: false,
      nextText: 'המשך',
      showBack: false
    }).then(({message} = {})=>{
      Chat.State.data.message = message || '';
      stepSummary();
    });
  }

  /* ===== שלב 9: סיכום ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום הבקשה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה.</span>');

    const card = Chat.summaryCard([
      ['פעולה:', 'שיעור חד־פעמי (ללא מנוי)'],
      ['שם מבקש/ת:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
      ['כיתה:', d.grade || ''],
      ['יחידות:', d.units ? `${d.units} יחידות` : ''],
      ['מסלול:', d.planText || ''],
      ['שם התלמיד/ה:', `${d.studentFirst||''} ${d.studentLast||''}`.trim()],
      ['הודעה:', d.message || '']
    ]);

    if (Array.isArray(d.boostSlots) && d.boostSlots.length){
      const chips = document.createElement('div');
      chips.className = 'summary';
      d.boostSlots.forEach(s=>{
        chips.appendChild(Chat.chip(s.label || `${formatDateHeb(s.date)} • ${s.from}–${s.to}`));
      });
      card.appendChild(document.createElement('hr'));
      card.appendChild(chips);
    }

    Chat.button('אישור ושליחה למזכירות 📤', submit, 'btn');
    Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שליחה ===== */
  async function submit(){
    const d = Chat.State.data;

    const errs=[];
    if(!d.firstName || !d.lastName) errs.push('name');
    if(!Chat.validILPhone(d.phone)) errs.push('phone');
    if(!d.subject) errs.push('subject');
    if(!d.grade) errs.push('grade');
    if((d.grade==='י' || d.grade==='יא' || d.grade==='יב') && !d.units) errs.push('units');
    if(!d.planType) errs.push('plan');
    if(!d.studentFirst || !d.studentLast) errs.push('studentName');

    const hasSlots = Array.isArray(d.boostSlots) && d.boostSlots.length > 0;
    if(!hasSlots) errs.push('slots');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'ענף 1 – שיעור חד־פעמי (ללא מנוי)',
      cta: 'שיעור חד־פעמי',
      subject: d.subject,
      grade: d.grade || '',
      units: d.units || '',
      planType: d.planType,
      planText: d.planText,
      price: d.price ? `${d.price}₪` : '',
      // לתאימות – הראשון
      lessonDate: d.boostSlots[0]?.date || '',
      lessonTime: d.boostSlots[0] ? `${d.boostSlots[0].from}–${d.boostSlots[0].to}` : '',
      // כל המועדים
      boostSlots: d.boostSlots.map(s=>`${s.date} ${s.from}–${s.to}`).join('; '),
      boostSlotsHuman: d.boostSlots.map(s=>s.label).join('; '),
      studentFullName: `${d.studentFirst||''} ${d.studentLast||''}`.trim(),
      message: d.message || '',
      extraNotes: '',
      fullName: `${d.firstName||''} ${d.lastName||''}`.trim(), // מי שמבקש
      phone: d.phone || '',
      source: 'יוסטון – אתר',
      status: 'לטיפול',
      createdAt: new Date().toISOString()
    };

    const stop = Chat.showProcessing('שולח למזכירות…');
    const ok = await Chat.sendLeadToSheet(payload);
    stop();

    Chat.clear();
    const fname = (d.firstName||'').trim() || 'שם פרטי';

    if(ok){
      Chat.botText(`היי ${fname}, קיבלנו את הבקשה לשיעור חד־פעמי ונחזור אלייך לתיאום סופי 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט ענף 1', ()=> location.href='index.html', 'btn');
      home.focus();
    }else{
      Chat.botText('לא הצלחנו לשמור את הבקשה ❌ ניתן לנסות שוב או לפנות בוואטסאפ 050-9570866.').classList.add('err');
      Chat.button('לנסות שוב', submit, 'btn');
      Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
      Chat.button('לתפריט', ()=> location.href='index.html', 'btn');
    }
  }

  return { start };
})();
