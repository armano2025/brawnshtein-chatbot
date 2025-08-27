// /branches/branch3/js/flows/cancel-sub.js
const CancelSubFlow = (() => {
  /* ===== התחלה ===== */
  function start(){
    Chat.clear();
    Chat.State.data = {};
    stepContact();
  }

  /* ===== שלב 1: פרטי קשר ===== */
  function stepContact(){
    Chat.push(stepContact);
    Chat.askContact({
      titleHtml: '👨‍🚀 <strong>ביטול מנוי</strong><br><span class="muted">נשמור פרטי קשר כדי שנוכל לטפל בבקשה</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c };
      stepSubjectAndHour();
    });
  }

  /* ===== שלב 2: מקצוע ושעה ===== */
  function stepSubjectAndHour(){
    Chat.push(stepSubjectAndHour);

    Chat.botHTML('<strong>איזה מקצוע לבטל?</strong><br><span class="muted">בחר/י מקצוע ולאחר מכן שעה (אם רלוונטי)</span>');

    const subjSel = Chat.selectSubject({
      id: 'cancelSub_subject',
      label: 'מקצוע',
      subjects: ['','מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת']
    });

    const timeSel = Chat.selectTime({
      id: 'cancelSub_time',
      label: 'שעה קבועה',
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
    });

    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      const subject = (subjSel.value||'').trim();
      const time    = (timeSel.value||'').trim();
      if(!subject){
        Chat.inlineError('נדרש לבחור מקצוע 📚', subjSel);
        return;
      }
      Chat.State.data.subject = subject;
      Chat.State.data.cancelTime = time;
      stepCancelDate();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 3: מאיזה תאריך לבטל ===== */
  function stepCancelDate(){
    Chat.push(stepCancelDate);
    Chat.askCalendarDate({
      titleHtml: '<strong>מאיזה תאריך לבטל?</strong><br><span class="muted">בחר/י תאריך אחד בלוח השנה</span>',
      label: 'תאריך ביטול',
      id: 'cancelSub_date',
      requireDate: true,
      minToday: true,
      nextText: 'המשך',
      showBack: true
    }).then(({date} = {})=>{
      if(!date) return;
      Chat.State.data.cancelDate = date;
      stepNotes();
    });
  }

  /* ===== שלב 4: הודעה חופשית למזכירות ===== */
  function stepNotes(){
    Chat.push(stepNotes);
    Chat.askFreeMessage({
      titleHtml: '<strong>פרטים נוספים / הערות (רשות)</strong><br><span class="muted">כתבו כאן אם יש מידע נוסף שחשוב לנו לדעת</span>',
      messageLabel: 'הודעה למזכירות',
      messagePlaceholder: 'לדוגמה: סיבה לביטול, עד מתי להפסיק…',
      requireMessage: false,
      includeNotes: false,
      nextText: 'המשך',
      showBack: true
    }).then(({message} = {})=>{
      Chat.State.data.message = message || '';
      stepSummary();
    });
  }

  /* ===== שלב 5: סיכום ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום בקשת ביטול מנוי</strong><br><span class="muted">אנא בדקו שהכול נכון לפני שליחה</span>');

    const card = Chat.summaryCard([
      ['פעולה:', 'ביטול מנוי'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
      ['שעה קבועה:', d.cancelTime || ''],
      ['תאריך ביטול:', d.cancelDate || ''],
      ['הודעה:', d.message || '']
    ]);

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
    if(!d.cancelDate) errs.push('date');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי קיים – ביטול מנוי',
      cta: 'ביטול מנוי',
      subject: d.subject,
      cancelTime: d.cancelTime || '',
      cancelDate: d.cancelDate || '',
      message: d.message || '',
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
      Chat.botText(`היי ${fname}, בקשת ביטול המנוי נקלטה והועברה למזכירות 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט מנוי/ה', ()=> location.href='index.html', 'btn');
      home.focus();
    }else{
      Chat.botText('השליחה נכשלה ❌ ניתן לנסות שוב או לפנות בוואטסאפ.').classList.add('err');
      Chat.button('לנסות שוב', submit, 'btn');
      Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
      Chat.button('לתפריט', ()=> location.href='index.html', 'btn');
    }
  }

  return { start };
})();
