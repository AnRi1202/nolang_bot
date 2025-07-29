function updateTicket() {
    //　これまでのformのスライドを走査して、TICKETS, CONTACTSシートに追加。既存のシートにticket_idも付与する
    Logger.log('[Start] backfillTicketsFromForms');
    
    const FORM_SS_ID    = '1-zZy350KIQHnKEVDk3uESd7Oy0K6HXGQxVI42UfbPO4';
    const FORM_SHEET    = 'フォームの回答 2';
    const TICKET_SS_ID  = '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo';
    const TICKET_SHEET  = 'TICKETS';
    const CONTACT_SHEET = 'CONTACTS';  // ★ 追加
  
    const formSS   = SpreadsheetApp.openById(FORM_SS_ID);
    const formSH   = formSS.getSheetByName(FORM_SHEET);
    const ticketSS = SpreadsheetApp.openById(TICKET_SS_ID);
    let ticketSH = ticketSS.getSheetByName(TICKET_SHEET);
    let contactSH = ticketSS.getSheetByName(CONTACT_SHEET);
    if (!contactSH) {
      contactSH = ticketSS.insertSheet(CONTACT_SHEET);
      contactSH.appendRow(['contact_id', 'display_name', 'first_seen', 'last_seen']); // ヘッダー追加
      Logger.log('CONTACTS シートを新規作成しました');
    }
    if (!ticketSH) {
      ticketSH = ticketSS.insertSheet(TICKET_SHEET);
      ticketSH.appendRow([
        'ticket_id', 'contact_id', 'subject', 'category', 'source',
        'status', 'created_at', 'updated_at', 'thread_id', 'question_text'
      ]);
      Logger.log('TICKETS シートを新規作成しました');
    }
  
  
    // チケット既存ID
    const lastRow = ticketSH.getLastRow();
    const existIds = new Set(
      lastRow <= 1 ? [] : ticketSH.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    );
  
    // ★ 連絡先の既存 contact_id を取得
    const contactLastRow = contactSH.getLastRow();
    const existContacts = new Set(
      contactLastRow <= 1 ? [] : contactSH.getRange(2, 1, contactLastRow - 1, 1).getValues().flat()
    );
  
    Logger.log(`Existing ticket count: ${existIds.size}`);
    Logger.log(`Existing contact count: ${existContacts.size}`);
  
    const headers = formSH.getRange(1, 1, 1, formSH.getLastColumn()).getValues()[0];
    const hIdx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
  
    const REQUIRED = ['タイムスタンプ', 'メールアドレス', 'お問い合わせの内容を選んでください。'];
    REQUIRED.forEach(h => {
      if (hIdx[h] === undefined) throw new Error(`Header "${h}" が見つかりません`);
    });
  
    const TICKET_COL_NAME = 'ticket_id';
    let ticketColIdx = hIdx[TICKET_COL_NAME];
    if (ticketColIdx === undefined) {
      formSH.getRange(1, headers.length + 1).setValue(TICKET_COL_NAME);
      ticketColIdx = headers.length;
      headers.push(TICKET_COL_NAME);
      hIdx[TICKET_COL_NAME] = ticketColIdx;
      Logger.log('ticket_id 列を新規追加');
    }
  
    const totalRows = formSH.getLastRow() - 1;
    if (totalRows <= 0) {
      Logger.log('No form entries to process.');
      return;
    }
  
    const maxRows = Math.min(totalRows, 500);  // デバッグ用に数を指定
    const data = formSH.getRange(2, 1, maxRows, headers.length).getValues();
    Logger.log(`読み込んだフォームエントリ数: ${maxRows}件`);
    let added = 0;
    let newContacts = 0;
  
    data.forEach((row, rIdx) => {
      const emailRaw  = row[hIdx['メールアドレス']] || '';
      const contactId = normaliseEmail(emailRaw);
      const category  = row[hIdx['お問い合わせの内容を選んでください。']] || '';
      const timeStamp = row[hIdx['タイムスタンプ']];
      const status = row[hIdx['未対応']];
      const question = [
        row[hIdx['ご質問内容を詳細にご記入ください。(20文字以上)']],
        row[hIdx['お問い合わせ内容を入力してください。(20文字以上)']],
        row[hIdx['問題の詳細を記述してください。']],
        row[hIdx['問題の詳細をご記入ください\n※ どのような操作をした際にどのようなエラーが出るかを詳細にご記入いただくことで、よりスムーズなご対応が可能です。']],
        row[hIdx['以下の記入例を参考に、問題の詳細をご記入ください。\n※ 問題が発生しているページの URL や、関連する情報 (プランの情報等) を含めて詳細にご記入いただくことで、よりスムーズなご対応が可能です。']],
        row[hIdx['お問い合わせ内容を、以下に自由に記述ください。']]
      ].filter(v => v).join('\n');
  
      // ★ contact_id が CONTACTS にない場合は追加
      if (!existContacts.has(contactId)) {
        contactSH.appendRow([contactId, '','', timeStamp]); // name, source などは空でもOK
        existContacts.add(contactId);
        newContacts++;
        Logger.log(`New contact added: ${contactId}`);
      }
  
      let ticketId = row[ticketColIdx];
      if (!ticketId) {
        ticketId = Utilities.getUuid();
        formSH.getRange(rIdx + 2, ticketColIdx + 1).setValue(ticketId);
        Logger.log(`New ticket_id created: ${ticketId} for row ${rIdx + 2}`);
      }
  
      if (existIds.has(ticketId)) {
        Logger.log(`ticket_id already exists, skip: ${ticketId}`);
        return;
      }
  
      ticketSH.appendRow([
        ticketId,
        contactId,
        'フォーム質問',
        category,
        'form',
        status,
        timeStamp,
        timeStamp,
        '',  // thread_id
        question
      ]);
  
      existIds.add(ticketId);
      added++;
    });
  
  }
  
  function normaliseEmail(addr) {
    if (!addr) return '';
    const lower = addr.toLowerCase();
    const parts = lower.split('@');
    if (parts.length !== 2) return lower;
    return parts[0].split('+')[0] + '@' + parts[1];
  }
  