// /branches/branch3/js/flows/billing.js
const BillingFlow = (() => {

  /* ===== התחלה ===== */
  function start(){
    Chat.clear();
    Chat.State.data = {}; // איפוס
    stepContact();
  }

  /* ===== שלב 1: פרטי קשר ===== */
  function stepContact(){
    Chat.push(stepContact);
    Chat.askContact({
      titleHtml: '<strong>עדכון פרטי תשלום</strong><br><span class="muted">נשמור פרטי קשר ונמשיך לבחירה.</span>',
      nextText: 'המשך',
      requireLast: true,
      showBack: false
    }).then(c=>{
      if(!c) return;
      Chat.State.data = { ...Chat.State.data, ...c }; // firstName, lastName, phone
      stepOptions();
    });
  }

  /* ===== שלב 2: בחירת פעולות (סימון וי, ניתן לבחור כמה) ===== */
  function stepOptions(){
    Chat.push(stepOptions);

    Chat.botHTML('<strong>מה תרצו לעדכן?</strong><br><span class="muted">אפשר לבחור יותר מאפשרות אחת</span>');

    // בלוק בחירה עם צ׳קבוקסים
    const wrap = document.createElement('div');
    wrap.className = 'bubble bot';
    wrap.style.padding = '12px';

    const mkRow = (id, labelText) =>{
      const row = document.createElement('label');
      row.style.display='flex'; row.style.alignItems='center'; row.style.gap='10px';
      row.style.margin='6px 0';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.id=id;
      const span = document.createElement('span'); span.textContent=labelText;
      row.append(cb, span);
      return { row, cb };
    };

    const opt1 = mkRow('opt_change_method', 'אני רוצה להחליף אמצעי תשלום');
    const opt2 = mkRow('opt_change_date',   'אני רוצה לשנות תאריך תשלום');

    wrap.append(opt1.row, opt2.row);
    area.appendChild(wrap); Chat.scrollStartOf(wrap);

    // כפתורי פעולה
    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      Chat.clearErrors();

      const changeMethod = !!opt1.cb.checked;
      const changeDate   = !!opt2.cb.checked;

      if(!changeMethod && !changeDate){
        Chat.inlineError('סמנו לפחות אפשרות אחת ✔️', opt1.cb);
        return;
      }

      Chat.State.data.billingChangeMethod = changeMethod;
      Chat.State.data.billingChangeDate   = changeDate;

      stepFreeText();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 3: הערות למזכירות (רשות) ===== */
  function stepFreeText(){
    Chat.push(stepFreeText);

    Chat.askFreeMessage({
      titleHtml: '<strong>הערות למזכירות (רשות)</strong><br><span class="muted">אפשר לפרט שינוי רצוי, תאריך מועדף וכו׳</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'כל דבר שיסייע לטיפול מהיר…',
      requireMessage: false,
      includeNotes: false,
      nextText: 'המשך',
      showBack: true
    }).then(({message}={})=>{
      Chat.State.data.message = message || '';
      stepSummary();
    });
  }

  /* ===== שלב 4: סיכום ואישור ===== */
  function stepSummary(){
    Chat.push(stepSummary);
    Chat.clear();

    const d = Chat.State.data;
    Chat.botHTML('<strong>סיכום הבקשה</strong><br><span class="muted">בדקו שהכול נכון לפני שליחה.</span>');

    const selected = [];
    if(d.billingChangeMethod) selected.push('החלפת אמצעי תשלום');
    if(d.billingChangeDate)   selected.push('שינוי תאריך תשלום');

    const card = Chat.summaryCard([
      ['פעולה:', 'עדכון פרטי תשלום'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['נושאים לעדכון:', selected.join(' · ') || '—'],
      ['הודעה:', d.message || '']
    ]);

    Chat.button('אישור ושליחה למזכירות 📤', submit, 'btn');
    Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שליחה ===== */
  async function submit(){
    const d = Chat.State.data;

    // ולידציה מינימלית
    const errs=[];
    if(!d.firstName || !d.lastName) errs.push('name');
    if(!Chat.validILPhone(d.phone)) errs.push('phone');
    if(!d.billingChangeMethod && !d.billingChangeDate) errs.push('opts');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי קיים – עדכון פרטי תשלום',
      cta: 'עדכון פרטי תשלום',
      changePaymentMethod: !!d.billingChangeMethod,
      changePaymentDate:   !!d.billingChangeDate,
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
      Chat.botText(`תודה ${fname}! הבקשה לעדכון פרטי תשלום נקלטה ונחזור אלייך להמשך טיפול 👨‍🚀`).classList.add('ok');
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
