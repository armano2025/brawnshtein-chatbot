// /branches/branch3/js/flows/reschedule.js
const RescheduleFlow = (() => {
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
      titleHtml: '<strong>שינוי יום/שעה קבועה של שיעור</strong><br><span class="muted">נשמור פרטי קשר ונמשיך לפרטים.</span>',
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

    Chat.botHTML('<strong>באיזה מקצוע לשנות את המועד הקבוע?</strong><br><span class="muted">בחר/י מתוך הרשימה</span>');
    const subjSel = Chat.selectSubject({
      id: 'resched_subject',
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
      stepCurrentSlot();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 3: מה המועד הקבוע הנוכחי? יום + שעה ===== */
  function stepCurrentSlot(){
    Chat.push(stepCurrentSlot);

    Chat.botHTML('<strong>מהו המועד הקבוע הנוכחי?</strong><br><span class="muted">בחר/י יום ושעה של השיעור הקבוע כיום</span>');

    // יום (select מקומי)
    const dayWrap=document.createElement('div'); dayWrap.className='input-wrap bubble bot';
    const dayLbl=document.createElement('label'); dayLbl.textContent='יום';
    const daySel=document.createElement('select'); daySel.className='input'; daySel.id='current_day';
    const dayOptions = ['','א','ב','ג','ד','ה','ו'];  // אם לא עובדים בשישי – אפשר להסיר 'ו'
    const opt0=document.createElement('option'); opt0.value=''; opt0.textContent='בחר/י יום'; daySel.appendChild(opt0);
    dayOptions.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; daySel.appendChild(o); });
    dayWrap.append(dayLbl, daySel); document.getElementById('area').appendChild(dayWrap);

    // שעה נוכחית (נשתמש ב-helper selectTime)
    const timeSel = Chat.selectTime({
      id: 'current_time',
      label: 'שעה',
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
    });

    Chat.button('המשך', ()=>{
      Chat.userBubble('המשך');
      const currentDay  = (daySel.value||'').trim();
      const currentTime = (timeSel.value||'').trim();

      if(!currentDay){
        Chat.inlineError('בחר/י יום 🗓️', daySel);
        return;
      }
      if(!currentTime){
        Chat.inlineError('בחר/י שעה ⏰', timeSel);
        return;
      }

      Chat.State.data.currentDay  = currentDay;     // 'א'...'ו'
      Chat.State.data.currentTime = currentTime;    // 'HH:MM'
      stepDesiredAvailability();
    }, 'btn');

    Chat.button('חזרה', ()=> Chat.goBack?.(), 'btn');
  }

  /* ===== שלב 4: זמינות חדשה רצויה (יום + משעה/עד שעה, עם צ׳יפים מרובים) ===== */
  function stepDesiredAvailability(){
    Chat.push(stepDesiredAvailability);

    Chat.pickAvailability({
      titleHtml: '<strong>באילו ימים ושעות נוח לכם ללמוד?</strong>',
      tipText: 'אפשר להוסיף כמה אפשרויות. נבחר את המועד הטוב ביותר לפי הזמינות.',
      times: ['','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
      days:  ['','א','ב','ג','ד','ה','ו'],
      continueText: 'המשך',
      allowBack: true
    }).then(list=>{
      if(list == null) return; // חזרה
      if(!Array.isArray(list) || !list.length){
        Chat.inlineError('נדרש להזין לפחות טווח אחד של זמינות 🕒');
        return;
      }
      // דוגמה לפריט: "יום א 16:00–18:00"
      Chat.State.data.desiredAvailability = list.slice(); // שמירה
      stepNotes();
    });
  }

  /* ===== שלב 5: הערות למזכירות (רשות) ===== */
  function stepNotes(){
    Chat.push(stepNotes);
    Chat.askFreeMessage({
      titleHtml: '<strong>הערות למזכירות (רשות)</strong><br><span class="muted">למשל: מורה קבוע/ה, אילוצים, רמת קושי…</span>',
      messageLabel: 'הודעה למזכירות (רשות)',
      messagePlaceholder: 'כל דבר שיעזור לנו לקבוע את המועד החדש בצורה מיטבית',
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
      ['פעולה:', 'שינוי יום/שעה קבועה של שיעור'],
      ['שם מלא:', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון לחזרה:', d.phone || ''],
      ['מקצוע:', d.subject || ''],
      ['מועד נוכחי:', d.currentDay && d.currentTime ? `יום ${d.currentDay} ${d.currentTime}` : ''],
      ['הודעה:', d.message || '']
    ]);

    if (Array.isArray(d.desiredAvailability) && d.desiredAvailability.length){
      const chips = document.createElement('div');
      chips.className = 'summary';
      const title = document.createElement('div'); title.className='muted'; title.style.margin='6px 0 2px'; title.textContent='טווחי זמינות מבוקשים:';
      card.appendChild(document.createElement('hr'));
      card.appendChild(title);
      d.desiredAvailability.forEach(txt=> chips.appendChild(Chat.chip(txt)));
      card.appendChild(chips);
    }

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
    if(!d.currentDay) errs.push('currentDay');
    if(!d.currentTime) errs.push('currentTime');
    if(!Array.isArray(d.desiredAvailability) || d.desiredAvailability.length===0) errs.push('desired');

    if(errs.length){
      Chat.botText('חסר שדה נדרש. אנא בדקו ונסו שוב.').classList.add('err');
      return;
    }

    const payload = {
      path: 'מנוי/ה קיים/ת – שינוי יום/שעה קבועה',
      cta: 'שינוי יום/שעה קבועה של שיעור',
      subject: d.subject,
      currentDay: d.currentDay,
      currentTime: d.currentTime,
      desiredAvailability: d.desiredAvailability.join('; '),
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
      Chat.botText(`היי ${fname}, הבקשה התקבלה 🎉 נחזור אלייך עם מועד חדש מתאים 👨‍🚀`).classList.add('ok');
      const home = Chat.button('חזרה לתפריט מנוי/ה', ()=> location.href='index.html', 'btn');
      home.focus();
    }else{
      Chat.botText('לא הצלחנו לשמור את הבקשה ❌ אפשר לנסות שוב או לפנות בוואטסאפ 050-9570866.').classList.add('err');
      Chat.button('לנסות שוב', submit, 'btn');
      Chat.button('עריכה', ()=> Chat.goBack?.(), 'btn');
      Chat.button('לתפריט', ()=> location.href='index.html', 'btn');
    }
  }

  return { start };
})();
