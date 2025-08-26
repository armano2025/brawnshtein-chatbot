// /branches/branch3/js/flows/boost.js
const BoostFlow = (() => {
  /* ===== התחלה ===== */
  function start(){
    Chat.clear();
    Chat.State.data = {}; // איפוס הקשר זרימה
    stepContact();
  }

  /* ===== שלב 1: פרטי קשר ===== */
  function stepContact(){
    Chat.push(stepContact);
    Chat.askContact({
      titleHtml: '<strong>שיעור תגבור</strong><br><span class="muted">נשמור פרטי קשר ונמשיך לבחירה.</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c }; // firstName, lastName, phone
      stepSubject();
    });
  }

  /* ===== שלב 2: מקצוע ===== */
  function stepSubject(){
    Chat.push(stepSubject);

    Chat.botHTML('<strong>באיזה מקצוע תרצו שיעור תגבור?</strong><br><span class="muted">בחר/י מתוך הרשימה</span>');
    const subjSel = Chat.selectSubject({
      id: 'boost_subject',
      label: 'מקצוע',
      subjects: ['','מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת']
    });

    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      const subject = (subjSel.value||'').trim();
      if(!subject){
        Chat.inlineError('בחר/י מקצוע 📚', subjSel);
        return;
      }
      Chat.State.data.subject = subject;
      stepPlan();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 3: בחירת מסלול/תעריף תגבור ===== */
  function stepPlan(){
    Chat.push(stepPlan);

    Chat.botHTML('<strong>איזה מסלול תגבור מתאים לכם?</strong><br><span class="muted">תעריף לשיעור אחד (למנויים)</span>');

    // בניית select ידני (עוזר כללי)
    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent='מסלול תגבור';
    const s=document.createElement('select'); s.className='input'; s.id='boost_plan';
    const options = [
      { val:'',         text:'בחר/י מסלול' },
      { val:'group',    text:'מסלול קבוצתי – 70₪ לשיעור', price:70 },
      { val:'triple',   text:'מסלול טריפל – 90₪ לשיעור',  price:90 },
      { val:'private',  text:'מסלול פרטי – 160₪ לשיעור', price:160 }
    ];
    options.forEach(o=>{ const opt=document.createElement('option'); opt.value=o.val; opt.textContent=o.text; s.appendChild(opt); });
    wrap.append(l,s);
    area.appendChild(wrap); Chat.scrollStartOf(wrap);

    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      const planType = s.value;
      if(!planType){
        Chat.inlineError('בחר/י מסלול תגבור 🧭', s);
        return;
      }
      const meta = options.find(o=>o.val===planType) || {};
      Chat.State.data.planType = planType;
      Chat.State.data.planText = meta.text || '';
      Chat.State.data.price    = meta.price || '';

      stepDateTimeSlots();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 4: מועדים אפשריים (אפשר רבים) ===== */
  function stepDateTimeSlots(){
    Chat.push(stepDateTimeSlots);

    Chat.askDateTimeSlots({
      titleHtml:
        '<strong>בחירת מועדים נוחים לשיעור התגבור</strong><br>' +
        '<span class="muted">בחר/י תאריך ושעה, לחצ/י "+ הוספת מועד" וניתן להוסיף כמה מועדים. אפשר להסיר כל צ׳יפ לפני המשך.</span>',
      dateLabel: 'תאריך לשיעור תגבור',
      timeLabel: 'שעה',
      minToday: true,
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText: 'המשך',
      allowBack: true
    }).then(res=>{
      if(res == null) return; // המשתמש לחץ חזרה

      const raw = Array.isArray(res) ? res : (res && Array.isArray(res.slots) ? res.slots : []);
      if(!raw.length){
        Chat.inlineError('נדרש לבחור לפחות מועד אחד 🕒');
        return;
      }

      const toObj = (s)=>{
        if(typeof s === 'string'){
          const m1 = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
          if(m1){ const [_, d, t] = m1; return { date:d, time:t, label: humanize(d, t) }; }
          const m2 = s.match(/^(\d{2}\/\d{2})\s*[•·]\s*(\d{2}:\d{2})$/);
          if(m2){ const [_, ddmm, t] = m2; return { date:'', time:t, label:`${ddmm} • ${t}` }; }
          return { date:'', time:'', label:s };
        }
        const d = s.date || '';
        const t = s.time || s.lessonTime || '';
        return { date:d, time:t, label: s.label || humanize(d, t) };
      };

      const slots = raw.map(toObj).filter(x => x.time);
      if(!slots.length){
        Chat.inlineError('נדרש לבחור לפחות מועד אחד תקין 🕒');
        return;
      }

      // שמירה
      Chat.State.data.lessonSlots = slots;
      Chat.State.data.slotsText  = slots.map(s => `${s.date} ${s.time}`.trim()).join('; ');
      Chat.State.data.slotsHuman = slots.map(s => s.label).join('; ');
      // תאימות לאחור – הראשון
      Chat.State.data.lessonDate = slots[0].date || '';
      Chat.State.data.lessonTime = slots[0].time || '';

      stepDetails();
    });

    function humanize(yyyy_mm_dd, hhmm){
      if(!yyyy_mm_dd) return hhmm || '';
      const [y,m,d] = yyyy_mm_dd.split('-');
      return `${d}/${m} • ${hhmm || ''}`.trim();
    }
  }

  /* ===== שלב 5: מלל חופשי (רשות) ===== */
  function stepDetails(){
    Chat.push(stepDetails);
    Chat.askFreeMessage({
      titleHtml: '<strong>פרטים/הערות למזכירות (רשות)</strong><br><span class="muted">העדפה למורה/ה, נושא התגבור או כל דבר נוסף</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'אפשר לכתוב כל דבר שיסייע לנו להתאים את התגבור',
      requireMessage: false,
      includeNotes: false,
      nextText: 'המשך',
      showBack: true
    }).then(({message} = {})=>{
      Chat.State.data.message = message || '';
      stepSummary();
    });
  }

  /* ===== שלב 6: סיכום ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום הבקשה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה.</span>');

    const card = Chat.summaryCard([
      ['פעולה:', 'שיעור תגבור'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
      ['מסלול:', d.planText || ''],
      ['הודעה:', d.message || '']
    ]);

    if (Array.isArray(d.lessonSlots) && d.lessonSlots.length){
      const chips = document.createElement('div');
      chips.className = 'summary';
      d.lessonSlots.forEach(s=>{
        chips.appendChild(Chat.chip(s.label || `${s.date} • ${s.time}`));
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
    if(!d.planType) errs.push('plan');
    const hasSlots = Array.isArray(d.lessonSlots) && d.lessonSlots.length > 0;
    if(!hasSlots){
      if(!d.lessonDate) errs.push('date');
      if(!d.lessonTime) errs.push('time');
    }

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי קיים – שיעור תגבור',
      cta: 'שיעור תגבור',
      subject: d.subject,
      planType: d.planType,
      planText: d.planText,
      price: d.price ? `${d.price}₪` : '',
      lessonDate: hasSlots ? (d.lessonSlots[0]?.date || '') : (d.lessonDate || ''),
      lessonTime: hasSlots ? (d.lessonSlots[0]?.time || '') : (d.lessonTime || ''),
      lessonSlots: hasSlots ? d.lessonSlots.map(s=>`${s.date} ${s.time}`.trim()).join('; ') : '',
      lessonSlotsHuman: hasSlots ? d.lessonSlots.map(s=>s.label).join('; ') : '',
      message: d.message || '',
      extraNotes: '',
      fullName: `${d.firstName||''} ${d.lastName||''}`.trim(),
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
      Chat.botText(`היי ${fname}, קיבלנו את הבקשה לשיעור תגבור ונחזור אלייך לתיאום סופי 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט מנוי/ה', ()=> location.href='index.html', 'btn');
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
