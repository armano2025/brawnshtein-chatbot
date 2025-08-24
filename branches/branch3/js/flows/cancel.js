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
      titleHtml: '<strong>ביטול שיעור עתידי</strong><br><span class="muted">נשמור פרטי קשר ונמשיך לפרטים.</span>',
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

    Chat.botHTML('<strong>איזה מקצוע לביטול?</strong><br><span class="muted">בחר/י מתוך הרשימה</span>');
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

  /* ===== שלב 3: בחירת תאריך ושעה (אפשר כמה) ===== */
  function stepDateTimeSlots(){
    Chat.push(stepDateTimeSlots);

    // שים לב: askDateTimeSlots כולל בתוכו כבר כפתורי "הוסף מועד", "המשך" ו"חזרה"
    Chat.askDateTimeSlots({
      titleHtml:
        '<strong>בחירת תאריך ושעה לביטול</strong><br>' +
        '<span class="muted">בחר/י תאריך ושעה, לחצ/י "+ הוספת מועד", וניתן להוסיף כמה מועדים. ניתן להסיר כל צ׳יפ לפני המשך.</span>',
      dateLabel: 'תאריך השיעור',
      timeLabel: 'שעה',
      minToday: true,
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      continueText: 'המשך',
      allowBack: true
    }).then(res=>{
      if(!res) return; // המשתמש חזר אחורה
      const { slots = [] } = res;

      if(!slots.length){
        Chat.inlineError('נדרש לבחור לפחות מועד אחד לביטול 🕒');
        return;
      }

      // נשמור גם טקסטים לאחור-תאימות/דו"ח
      Chat.State.data.lessonSlots = slots; // [{date, time, label}]
      Chat.State.data.slotsText   = slots.map(s => `${s.date} ${s.time}`).join('; ');
      Chat.State.data.slotsHuman  = slots.map(s => s.label).join('; ');

      // לשדות legacy (למקרה שהגיליון מצפה לשדה יחיד)
      const first = slots[0] || {};
      Chat.State.data.lessonDate = first.date || '';
      Chat.State.data.lessonTime = first.time || '';

      stepReason();
    });
  }

  /* ===== שלב 4: סיבת ביטול (רשות) ===== */
  function stepReason(){
    Chat.push(stepReason);
    Chat.askFreeMessage({
      titleHtml: '<strong>סיבת ביטול / פרטים (רשות)</strong><br><span class="muted">אפשר לדלג אם אין צורך</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'הסבר קצר אם תרצו להוסיף…',
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

    // כרטיס סיכום+צ׳יפים של המועדים
    const card = Chat.summaryCard([
      ['פעולה:', 'ביטול שיעור'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
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

    // ולידציה סופית לפני שליחה
    const errs=[];
    if(!d.firstName || !d.lastName) errs.push('name');
    if(!Chat.validILPhone(d.phone)) errs.push('phone');
    if(!d.subject) errs.push('subject');

    // אם יש אסופה – נבדוק שיש לפחות אחת; אחרת נסתמך על השדות היחידים
    const hasSlots = Array.isArray(d.lessonSlots) && d.lessonSlots.length > 0;
    if(!hasSlots){
      if(!d.lessonDate) errs.push('date');
      if(!d.lessonTime) errs.push('time');
    }

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    // הכנה לשילוח
    const payload = {
      path: 'מנויה קיימת – ביטול שיעור',
      cta: 'ביטול שיעור',
      subject: d.subject,
      // Legacy (שדה יחיד – נשתמש ב״ראשון״ אם יש צבר)
      lessonDate: hasSlots ? (d.lessonSlots[0]?.date || '') : (d.lessonDate || ''),
      lessonTime: hasSlots ? (d.lessonSlots[0]?.time || '') : (d.lessonTime || ''),
      // ייצוג מלא של כל המועדים שנבחרו
      lessonSlots: hasSlots ? d.lessonSlots.map(s=>`${s.date} ${s.time}`).join('; ') : '',
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