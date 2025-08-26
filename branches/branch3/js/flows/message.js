// /branches/branch3/js/flows/message.js
const MessageFlow = (() => {
  /* ===== התחלה ===== */
  function start(){
    Chat.clear();
    Chat.State.data = {}; // איפוס ההקשר
    stepContact();
  }

  /* ===== שלב 1: פרטי קשר (עם האימוג׳י של יוסטון) ===== */
  function stepContact(){
    Chat.push(stepContact);
    Chat.askContact({
      titleHtml: '<strong>שליחת הודעה למזכירות 👨‍🚀</strong><br><span class="muted">נשמור פרטי קשר ונמשיך להודעה</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c }; // firstName, lastName, phone (normalized)
      stepMessage();
    });
  }

  /* ===== שלב 2: הודעה למזכירות ===== */
  function stepMessage(){
    Chat.push(stepMessage);
    Chat.askFreeMessage({
      titleHtml: '<strong>מה תרצו למסור למזכירות?</strong><br><span class="muted">נשמח להודעה קצרה וברורה</span>',
      messageLabel: 'הודעה למזכירות',
      messagePlaceholder: 'כתבו כאן את ההודעה…',
      requireMessage: true,     // מחייב הודעה
      includeNotes: false,      // בלי שדה נוסף
      nextText: 'המשך',
      showBack: true
    }).then(({message}={})=>{
      if(!message || !message.trim()){
        Chat.inlineError('נדרש למלא הודעה ✍️');
        return;
      }
      Chat.State.data.message = message.trim();
      stepSummary();
    });
  }

  /* ===== שלב 3: סיכום ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום ההודעה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה</span>');

    Chat.summaryCard([
      ['פעולה:', 'שליחת הודעה למזכירות'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['הודעה:', d.message || '']
    ]);

    Chat.button('אישור ושליחה למזכירות 📤', submit, 'btn primary');
    Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שליחה ===== */
  async function submit(){
    const d = Chat.State.data;

    // ולידציה סופית
    const errs=[];
    if(!d.firstName || !d.lastName) errs.push('name');
    if(!Chat.validILPhone(d.phone)) errs.push('phone');
    if(!d.message) errs.push('message');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי קיים – הודעה למזכירות',
      cta: 'שליחת הודעה',
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
      Chat.botText(`היי ${fname}, ההודעה נקלטה והועברה למזכירות. נחזור אליך בהקדם 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט מנוי/ה', ()=> location.href='index.html', 'btn');
      home.focus();
    }else{
      Chat.botText('לא הצלחנו לשלוח את ההודעה ❌ ניתן לנסות שוב או לפנות בוואטסאפ 050-9570866.').classList.add('err');
      Chat.button('לנסות שוב', submit, 'btn');
      Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
      Chat.button('לתפריט', ()=> location.href='index.html', 'btn');
    }
  }

  return { start };
})();