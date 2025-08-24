// /branches/branch3/js/flows/cancel.js
const CancelFlow = (() => {
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
      titleHtml: '<strong>ביטול שיעור עתידי</strong><br><span class="muted">נשמור פרטי קשר ואז נבחר מקצוע ותאריכים לביטול.</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c }; // firstName, lastName, phone (normalized)
      stepSubject();
    });
  }

  /* ===== שלב 2: בחירת מקצוע ===== */
  function stepSubject(){
    Chat.push(stepSubject);

    Chat.botHTML('<strong>באיזה מקצוע לבטל?</strong><br><span class="muted">בחר/י מקצוע מהרשימה</span>');
    const subjSel = Chat.selectSubject({
      id: 'cancel_subject',
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
      stepDateTimeSlots();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 3: בחירת כמה תאריכים+שעות (צ׳יפים) ===== */
  function stepDateTimeSlots(){
    Chat.push(stepDateTimeSlots);

    Chat.askDateTimeSlots({
      titleHtml:
        '<strong>בחירת תאריך ושעה לביטול</strong><br>' +
        '<span class="muted">בחר/י תאריך ושעה, הוסיפ/י לרשימה, וניתן להוסיף כמה מועדים</span>',
      dateLabel: 'תאריך השיעור',
      timeLabel: 'שעה',
      minToday: true,
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText: 'המשך',
      allowBack: true
    }).then(res=>{
      if(!res) return; // המשתמש חזר אחורה
      const { slots=[] } = res;  // [{date, time, label}, ...]
      if(!slots.length){
        Chat.inlineError('נדרש לבחור לפחות מועד אחד לביטול 🕒');
        return;
      }

      // שמירה ב-State
      Chat.State.data.lessonSlots = slots;                           // מערך מלא
      Chat.State.data.slotsText   = slots.map(s=>`${s.date} ${s.time}`).join('; ');
      Chat.State.data.slotsHuman  = slots.map(s=>s.label).join('; ');

      // תאימות לאחור (אם צריך בשיטס): מועד ראשון לשדות יחידניים
      const first = slots[0] || {};
      Chat.State.data.lessonDate = first.date || '';
      Chat.State.data.lessonTime = first.time || '';

      stepReason();
    });
  }

  /* ===== שלב 4: סיבת ביטול – מלל חופשי (רשות) ===== */
  function stepReason(){
    Chat.push(stepReason);
    Chat.askFreeMessage({
      titleHtml: '<strong>סיבת ביטול / פרטים (רשות)</strong><br><span class="muted">אפשר לדלג אם אין צורך</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'רשות: הסבר קצר…',
      requireMessage: false,
      includeNotes: false,
      nextText: 'המשך',
      showBack: true
    }).then(({message})=>{
      Chat.State.data.message = message || '';
      stepSummary();
    });
  }

  /* ===== שלב 5: סיכום ושליחה ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום הבקשה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה.</span>');

    // בנייה ידידותית של רשימת מועדים
    const humanList = (d.lessonSlots||[]).length
      ? (d.lessonSlots||[]).map(s=>s.label).join(' • ')
      : (d.slotsHuman || '');

    Chat.summaryCard([
      ['פעולה:', 'ביטול שיעור'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
      ['מועדים לביטול:', humanList || `${d.lessonDate||''} • ${d.lessonTime||''}`],
      ['הודעה:', d.message || '']
    ]);

    Chat.button('אישור ושליחה למזכירות 📤', submit, 'btn');
    Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שליחה ===== */
  async function submit(){
    const d = Chat.State.data;

    // ולידציה סופית
    const errs=[];
    if(!d.firstName || !d.lastName) errs.push('name');
    if(!Chat.validILPhone(d.phone)) errs.push('phone');
    if(!d.subject) errs.push('subject');

    // חייב לפחות מועד אחד: או lessonSlots (חדש) או שדות בודדים (תאימות)
    const hasMulti = Array.isArray(d.lessonSlots) && d.lessonSlots.length>0;
    const hasSingle = d.lessonDate && d.lessonTime;
    if(!hasMulti && !hasSingle) errs.push('slots');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    // נלקח המועד הראשון לשדות הישנים:
    const first = hasMulti ? d.lessonSlots[0] : { date: d.lessonDate, time: d.lessonTime };

    const payload = {
      path: 'מנויה קיימת – ביטול שיעור',
      cta: 'ביטול שיעור',

      // תמיכה אחורה (שדה יחיד)
      lessonDate: first?.date || '',
      lessonTime: first?.time || '',

      // תמיכה קדימה (מרובה מועדים)
      lessonSlots: hasMulti ? d.lessonSlots : [{ date: d.lessonDate, time: d.lessonTime }],
      slotsText:   d.slotsText || (hasSingle ? `${d.lessonDate} ${d.lessonTime}` : ''),
      slotsHuman:  d.slotsHuman || (hasSingle ? `${d.lessonDate} • ${d.lessonTime}` : ''),

      subject: d.subject,
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
      Chat.botText(`היי ${fname}, הבקשה נקלטה והועברה למזכירות להמשך טיפול.\nאני אדאג שיחזרו אלייך 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט מנויה קיימת', ()=> location.href='index.html', 'btn');
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