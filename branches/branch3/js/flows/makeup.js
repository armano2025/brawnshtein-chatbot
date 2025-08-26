// /branches/branch3/js/flows/makeup.js
const MakeupFlow = (() => {
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
      titleHtml: '<strong>השלמת שיעור</strong><br><span class="muted">נשמור פרטי קשר ונמשיך לפרטים.</span>',
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

    Chat.botHTML('<strong>באיזה מקצוע תרצו להשלים?</strong><br><span class="muted">בחר/י מתוך הרשימה</span>');
    const subjSel = Chat.selectSubject({
      id: 'makeup_subject',
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
      stepReason();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 3: סיבת הביטול (נפתח) ===== */
  function stepReason(){
    Chat.push(stepReason);

    Chat.botHTML('<strong>מהי סיבת הביטול?</strong><br><span class="muted">בחר/י מהרשימה</span>');
    const wrap=document.createElement('div'); wrap.className='input-wrap bubble bot';
    const l=document.createElement('label'); l.textContent='סיבת הביטול';
    const s=document.createElement('select'); s.className='input'; s.id='cancel_reason';
    const opts=['','אנחנו ביטלנו את השיעור','אתם ביטלתם את השיעור'];
    opts.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent = v || 'בחר/י סיבה'; s.appendChild(o); });
    wrap.append(l,s); document.getElementById('area').appendChild(wrap);

    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      const reason = (s.value||'').trim();
      if(!reason){
        Chat.inlineError('בחר/י סיבת ביטול ⚠️', s);
        return;
      }
      Chat.State.data.cancelReason = reason;
      stepCanceledWhen();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 4: מתי בוטל השיעור? (תאריך+שעה, צ׳יפים) ===== */
  function stepCanceledWhen(){
    Chat.push(stepCanceledWhen);

    Chat.askDateTimeSlots({
      titleHtml:
        '<strong>באיזה תאריך ושעה בוטל השיעור?</strong><br>' +
        '<span class="muted">בחר/י תאריך ושעה ולחצ/י “+ הוספת מועד”. אם צריך – אפשר לציין כמה ביטולים.</span>',
      dateLabel: 'תאריך הביטול',
      timeLabel: 'שעה',
      minToday: false, // ייתכן שבוטל בעבר – מאפשר בחירה חופשית
      requireAtLeast: 1,
      times: ['','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText: 'המשך',
      allowBack: true
    }).then(res=>{
      if(res == null) return; // חזרה
      const raw = Array.isArray(res) ? res : (res && Array.isArray(res.slots) ? res.slots : []);
      if(!raw.length){ Chat.inlineError('נדרש לציין לפחות מועד אחד של ביטול 🗓️'); return; }

      const toObj = (s)=>{
        if(typeof s === 'string'){
          const m1 = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
          if(m1){ const [_, d, t] = m1; return { date:d, time:t, label: humanize(d,t) }; }
          return { date:'', time:'', label:s };
        }
        const d = s.date || '', t = s.time || s.lessonTime || '';
        return { date:d, time:t, label: s.label || humanize(d,t) };
      };
      const slots = raw.map(toObj).filter(x=> x.date && x.time);

      if(!slots.length){ Chat.inlineError('המועדים שנבחרו אינם תקינים. נסו שוב.', null); return; }

      // נשמור ביטולים
      Chat.State.data.canceledSlots      = slots;
      Chat.State.data.canceledSlotsText  = slots.map(s=>`${s.date} ${s.time}`).join('; ');
      Chat.State.data.canceledSlotsHuman = slots.map(s=>s.label).join('; ');
      Chat.State.data.canceledDate = slots[0].date;
      Chat.State.data.canceledTime = slots[0].time;

      stepDesiredSlots();
    });

    function humanize(yyyy_mm_dd, hhmm){
      if(!yyyy_mm_dd) return hhmm || '';
      const [y,m,d] = yyyy_mm_dd.split('-');
      return `${d}/${m} • ${hhmm || ''}`.trim();
    }
  }

  /* ===== שלב 5: טווחי השלמה אפשריים (תאריכים+שעות, צ׳יפים) ===== */
  function stepDesiredSlots(){
    Chat.push(stepDesiredSlots);

    Chat.askDateTimeSlots({
      titleHtml:
        '<strong>מתי נוח להשלים?</strong><br>' +
        '<span class="muted">אפשר לבחור כמה מועדים נוחים להשלמה. הוסיפו עם “+ הוספת מועד”.</span>',
      dateLabel: 'תאריך להשלמה',
      timeLabel: 'שעה',
      minToday: true,
      requireAtLeast: 1,
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText: 'המשך',
      allowBack: true
    }).then(res=>{
      if(res == null) return; // חזרה
      const raw = Array.isArray(res) ? res : (res && Array.isArray(res.slots) ? res.slots : []);
      if(!raw.length){ Chat.inlineError('בחר/י לפחות מועד אחד להשלמה 🕒'); return; }

      const toObj = (s)=>{
        if(typeof s === 'string'){
          const m1 = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
          if(m1){ const [_, d, t] = m1; return { date:d, time:t, label: humanize(d,t) }; }
          return { date:'', time:'', label:s };
        }
        const d = s.date || '', t = s.time || s.lessonTime || '';
        return { date:d, time:t, label: s.label || humanize(d,t) };
      };
      const slots = raw.map(toObj).filter(x=> x.date && x.time);

      if(!slots.length){ Chat.inlineError('המועדים להשלמה אינם תקינים. נסו שוב.', null); return; }

      // נשמור מועדי השלמה רצויים
      Chat.State.data.desiredSlots      = slots;
      Chat.State.data.desiredSlotsText  = slots.map(s=>`${s.date} ${s.time}`).join('; ');
      Chat.State.data.desiredSlotsHuman = slots.map(s=>s.label).join('; ');

      stepNotes();
    });

    function humanize(yyyy_mm_dd, hhmm){
      if(!yyyy_mm_dd) return hhmm || '';
      const [y,m,d] = yyyy_mm_dd.split('-');
      return `${d}/${m} • ${hhmm || ''}`.trim();
    }
  }

  /* ===== שלב 6: הערות נוספות (רשות) ===== */
  function stepNotes(){
    Chat.push(stepNotes);
    Chat.askFreeMessage({
      titleHtml: '<strong>הערות נוספות (רשות)</strong><br><span class="muted">למשל: מורה מועדפ/ת, רמת קושי, אילוצים מיוחדים…</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'כל פרט שיעזור לנו לתאם את ההשלמה',
      requireMessage: false,
      includeNotes: false,
      nextText: 'המשך',
      showBack: true
    }).then(({message} = {})=>{
      Chat.State.data.message = message || '';
      stepSummary();
    });
  }

  /* ===== שלב 7: סיכום ושליחה ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום הבקשה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה.</span>');

    const card = Chat.summaryCard([
      ['פעולה:', 'השלמת שיעור'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
      ['סיבת ביטול:', d.cancelReason || ''],
      ['הודעה:', d.message || '']
    ]);

    // ביטולים שבוצעו
    if (Array.isArray(d.canceledSlots) && d.canceledSlots.length){
      const chipsCancel = document.createElement('div');
      chipsCancel.className = 'summary';
      const title = document.createElement('div'); title.className='muted'; title.style.margin='6px 0 2px'; title.textContent='מועדי ביטול:';
      card.appendChild(document.createElement('hr'));
      card.appendChild(title);
      d.canceledSlots.forEach(s=> chipsCancel.appendChild(Chat.chip(s.label || `${s.date} • ${s.time}`)));
      card.appendChild(chipsCancel);
    }

    // מועדי השלמה רצויים
    if (Array.isArray(d.desiredSlots) && d.desiredSlots.length){
      const chipsDesired = document.createElement('div');
      chipsDesired.className = 'summary';
      const title = document.createElement('div'); title.className='muted'; title.style.margin='6px 0 2px'; title.textContent='מועדים נוחים להשלמה:';
      card.appendChild(document.createElement('hr'));
      card.appendChild(title);
      d.desiredSlots.forEach(s=> chipsDesired.appendChild(Chat.chip(s.label || `${s.date} • ${s.time}`)));
      card.appendChild(chipsDesired);
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
    if(!Array.isArray(d.canceledSlots) || d.canceledSlots.length === 0) errs.push('canceled');
    if(!Array.isArray(d.desiredSlots)  || d.desiredSlots.length  === 0) errs.push('desired');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי קיים – השלמת שיעור',
      cta: 'השלמת שיעור',
      subject: d.subject,
      cancelReason: d.cancelReason || '',
      // ביטולים (ראשון כ-legacy + כולם)
      canceledDate: d.canceledSlots[0]?.date || '',
      canceledTime: d.canceledSlots[0]?.time || '',
      canceledSlots: d.canceledSlots.map(s=>`${s.date} ${s.time}`).join('; '),
      canceledSlotsHuman: d.canceledSlots.map(s=>s.label).join('; '),
      // מועדים רצויים להשלמה
      desiredFirstDate: d.desiredSlots[0]?.date || '',
      desiredFirstTime: d.desiredSlots[0]?.time || '',
      desiredSlots: d.desiredSlots.map(s=>`${s.date} ${s.time}`).join('; '),
      desiredSlotsHuman: d.desiredSlots.map(s=>s.label).join('; '),
      // הערות
      message: d.message || '',
      extraNotes: '',
      // מזדהה
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
      Chat.botText(`היי ${fname}, בקשת ההשלמה נקלטה ✅ ניצור קשר לתיאום מועד מתאים 👨‍🚀`).classList.add('ok');
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