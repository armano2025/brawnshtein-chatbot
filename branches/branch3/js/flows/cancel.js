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
      titleHtml: '<strong>ביטול שיעור עתידי</strong><br><span class="muted">נשמור פרטי קשר ונמשיך לבחירת המועד לביטול.</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c }; // firstName, lastName, phone (normalized)
      stepDetails_Date();
    });
  }

  /* ===== שלב 2: תאריך מיומן חודשי ===== */
  function stepDetails_Date(){
    Chat.push(stepDetails_Date);
    Chat.askCalendarDate({
      titleHtml: '<strong>בחירת תאריך</strong><br><span class="muted">בחרו את תאריך השיעור שברצונכם לבטל</span>',
      label: 'תאריך השיעור',
      id: 'cancel_date',
      minToday: true,   // אפשר לשנות ל-false אם צריך גם עבר
      nextText: 'המשך',
      showBack: true
    }).then(({date})=>{
      if(!date) return;
      Chat.State.data.lessonDate = date; // YYYY-MM-DD
      stepDetails_TimeSubject();
    });
  }

  /* ===== שלב 3: שעה + מקצוע ===== */
  function stepDetails_TimeSubject(){
    Chat.push(stepDetails_TimeSubject);

    Chat.botHTML('<strong>פרטי השיעור</strong><br><span class="muted">בחרו שעה ומקצוע</span>');

    const timeSel = Chat.selectTime({
      id: 'cancel_time',
      label: 'שעה',
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
    });

    const subjSel = Chat.selectSubject({
      id: 'cancel_subject',
      label: 'מקצוע',
      subjects: ['','מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת']
    });

    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');

      const lessonTime = (timeSel.value||'').trim();
      const subject    = (subjSel.value||'').trim();

      if(!lessonTime){
        Chat.inlineError('בחר/י שעה ⏰', timeSel);
        return;
      }
      if(!subject){
        Chat.inlineError('בחר/י מקצוע 📚', subjSel);
        return;
      }

      Chat.State.data.lessonTime = lessonTime;
      Chat.State.data.subject    = subject;

      stepDetails_Message();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 4: מלל חופשי למזכירות ===== */
  function stepDetails_Message(){
    Chat.push(stepDetails_Message);
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

    Chat.summaryCard([
      ['פעולה:', 'ביטול שיעור'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['תאריך:', d.lessonDate || ''],
      ['שעה:', d.lessonTime || ''],
      ['מקצוע:', d.subject || ''],
      ['הודעה:', d.message || '']
    ]);

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
    if(!d.lessonDate) errs.push('date');
    if(!d.lessonTime) errs.push('time');
    if(!d.subject) errs.push('subject');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנויה קיימת – ביטול שיעור',
      cta: 'ביטול שיעור',
      lessonDate: d.lessonDate,       // YYYY-MM-DD
      lessonTime: d.lessonTime,       // HH:MM
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
