// /branches/branch3/js/flows/message.js
const MessageFlow = (() => {

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
      titleHtml: '<strong>שליחת הודעה למזכירות</strong><br><span class="muted">נשמור פרטי קשר ונמשיך להודעה.</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c };
      stepMessage();
    });
  }

  /* ===== שלב 2: ההודעה ===== */
  function stepMessage(){
    Chat.push(stepMessage);
    Chat.askFreeMessage({
      titleHtml: '<strong>כתבו את ההודעה שלכם למזכירות</strong>',
      messageLabel: 'הודעה',
      messagePlaceholder: 'מה תרצו שנדע או שנבצע עבורכם?',
      requireMessage: true,
      includeNotes: true,
      nextText: 'המשך',
      showBack: true
    }).then(({message, extraNotes}={})=>{
      Chat.State.data.message    = message    || '';
      Chat.State.data.extraNotes = extraNotes || '';
      stepSummary();
    });
  }

  /* ===== שלב 3: סיכום ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום ההודעה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה.</span>');

    Chat.summaryCard([
      ['פעולה:', 'שליחת הודעה למזכירות'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['הודעה:', d.message || ''],
      ['פרטים נוספים:', d.extraNotes || '']
    ]);

    Chat.button('אישור ושליחה 📤', submit, 'btn');
    Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שליחה ===== */
  async function submit(){
    const d = Chat.State.data;

    // ולידציה
    const errs=[];
    if(!d.firstName || !d.lastName) errs.push('name');
    if(!Chat.validILPhone(d.phone)) errs.push('phone');
    if(!d.message) errs.push('message');

    if(errs.length){
      Chat.botText('יש למלא את כל השדות הנדרשים ✏️').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי קיים – שליחת הודעה למזכירות',
      cta: 'שליחת הודעה',
      message: d.message || '',
      extraNotes: d.extraNotes || '',
      fullName: `${d.firstName||''} ${d.lastName||''}`.trim(),
      phone: d.phone || '',
      source: 'יוסטון – אתר',
      status: 'לטיפול',
      createdAt: new Date().toISOString()
    };

    const stop = Chat.showProcessing('שולח הודעה…');
    const ok = await Chat.sendLeadToSheet(payload);
    stop();

    Chat.clear();
    const fname = (d.firstName||'').trim() || 'שם פרטי';

    if(ok){
      Chat.botText(`תודה ${fname}! ההודעה שלך נשלחה למזכירות.\nנחזור אלייך בהקדם 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט מנוי/ה', ()=> location.href='index.html', 'btn');
      home.focus();
    }else{
      Chat.botText('שליחת ההודעה נכשלה ❌ ניתן לנסות שוב או לפנות לוואטסאפ 050-9570866.').classList.add('err');
      Chat.button('לנסות שוב', submit, 'btn');
      Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
      Chat.button('לתפריט', ()=> location.href='index.html', 'btn');
    }
  }

  return { start };
})();
