/**
 * Google フォーム回答を走査し、TICKETS と CONTACTS シートを更新するスクリプト
 *
 * - フォーム回答行に未発行の ticket_id があれば生成しセルへ書き戻し
 * - CONTACTS シートに存在しない contact_id は新規追加
 * - 既存チケットはスキップし重複登録を防止
 *
 * `@types/google-apps-script` を入れて型補完を有効にしておくと便利
 */

/* ------------------------------------------------------------------
 * メイン処理
 * ----------------------------------------------------------------*/
function updateTicket(): void {
    const FORM_SS_ID = '1-zZy350KIQHnKEVDk3uESd7Oy0K6HXGQxVI42UfbPO4';
    const FORM_SHEET = 'フォームの回答 2';
    const TICKET_SS_ID = '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo';
    const TICKET_SHEET = 'TICKETS';
    const CONTACT_SHEET = 'CONTACTS';
  
    /* ------------------------ スプレッドシート取得 ----------------------- */
    const formSS = SpreadsheetApp.openById(FORM_SS_ID);
    const formSH = formSS.getSheetByName(FORM_SHEET);
    if (!formSH) throw new Error(`フォームシート "${FORM_SHEET}" が見つかりません`);
  
    const ticketSS = SpreadsheetApp.openById(TICKET_SS_ID);
    let ticketSH = ticketSS.getSheetByName(TICKET_SHEET);
    let contactSH = ticketSS.getSheetByName(CONTACT_SHEET);
  
    /* -------------------------- シート初期化 ---------------------------- */
    if (!contactSH) {
      contactSH = ticketSS.insertSheet(CONTACT_SHEET);
      contactSH.appendRow(['contact_id', 'display_name', 'first_seen', 'last_seen']);
      console.log('CONTACTS シートを新規作成しました');
    }
    if (!ticketSH) {
      ticketSH = ticketSS.insertSheet(TICKET_SHEET);
      ticketSH.appendRow([
        'ticket_id',
        'contact_id',
        'subject',
        'category',
        'source',
        'status',
        'created_at',
        'updated_at',
        'thread_id',
        'question_text',
      ]);
      console.log('TICKETS シートを新規作成しました');
    }
  
    /* 既存チケット・連絡先 ID のセット */
    const existIds = new Set<string>();
    if (ticketSH.getLastRow() > 1) {
      ticketSH
        .getRange(2, 1, ticketSH.getLastRow() - 1, 1)
        .getValues()
        .forEach((v) => existIds.add(String(v[0])));
    }
  
    const existContacts = new Set<string>();
    if (contactSH.getLastRow() > 1) {
      contactSH
        .getRange(2, 1, contactSH.getLastRow() - 1, 1)
        .getValues()
        .forEach((v) => existContacts.add(String(v[0])));
    }
  
    console.log(`Existing ticket count: ${existIds.size}`);
    console.log(`Existing contact count: ${existContacts.size}`);
  
    /* -------------------------- フォームヘッダー ------------------------- */
    const headers = formSH
      .getRange(1, 1, 1, formSH.getLastColumn())
      .getValues()[0] as string[];
    const hIdx: Record<string, number> = Object.fromEntries(
      headers.map((h, i) => [h.trim(), i]),
    );
  
    const REQUIRED = [
      'タイムスタンプ',
      'メールアドレス',
      'お問い合わせの内容を選んでください。',
    ];
    REQUIRED.forEach((h) => {
      if (hIdx[h] === undefined) throw new Error(`Header "${h}" が見つかりません`);
    });
  
    /* ticket_id 列がなければ追加 */
    const TICKET_COL_NAME = 'ticket_id';
    let ticketColIdx = hIdx[TICKET_COL_NAME];
    if (ticketColIdx === undefined) {
      formSH.getRange(1, headers.length + 1).setValue(TICKET_COL_NAME);
      ticketColIdx = headers.length;
      headers.push(TICKET_COL_NAME);
      hIdx[TICKET_COL_NAME] = ticketColIdx;
      console.log('ticket_id 列を新規追加しました');
    }
  
    /* ---------------------- フォームデータ読み込み ----------------------- */
    const totalRows = formSH.getLastRow() - 1;
    if (totalRows <= 0) {
      console.log('処理対象のフォーム回答がありません');
      return;
    }
  
    const MAX_PROCESS = 500; // デバッグ用上限
    const data = formSH.getRange(2, 1, Math.min(totalRows, MAX_PROCESS), headers.length).getValues();
    console.log(`読み込んだフォームエントリ数: ${data.length} 件`);
  
    let addedTickets = 0;
    let addedContacts = 0;
  
    data.forEach((row, rIdx) => {
      const emailRaw = row[hIdx['メールアドレス']] as string;
      const contactId = normaliseEmail(emailRaw);
      const category = row[hIdx['お問い合わせの内容を選んでください。']] as string;
      const timeStamp = row[hIdx['タイムスタンプ']];
      const status = row[hIdx['未対応']];
  
      /* 複数候補カラムを結合して question_text を生成 */
      const questionSources = [
        'ご質問内容を詳細にご記入ください。(20文字以上)',
        'お問い合わせ内容を入力してください。(20文字以上)',
        '問題の詳細を記述してください。',
        '問題の詳細をご記入ください\n※ どのような操作をした際にどのようなエラーが出るかを詳細にご記入いただくことで、よりスムーズなご対応が可能です。',
        '以下の記入例を参考に、問題の詳細をご記入ください。\n※ 問題が発生しているページの URL や、関連する情報 (プランの情報等) を含めて詳細にご記入いただくことで、よりスムーズなご対応が可能です。',
        'お問い合わせ内容を、以下に自由に記述ください。',
      ];
      const question = questionSources
        .map((key) => row[hIdx[key]] as string)
        .filter((v) => v)
        .join('\n');
  
      /* CONTACTS シートへ upsert */
      if (!existContacts.has(contactId)) {
        contactSH.appendRow([contactId, '', '', timeStamp]);
        existContacts.add(contactId);
        addedContacts++;
        console.log(`New contact added: ${contactId}`);
      }
  
      /* ticket_id 列に値がなければ生成してセルへ書き戻し */
      let ticketId = row[ticketColIdx] as string;
      if (!ticketId) {
        ticketId = Utilities.getUuid();
        formSH.getRange(rIdx + 2, ticketColIdx + 1).setValue(ticketId);
        console.log(`New ticket_id created: ${ticketId} for row ${rIdx + 2}`);
      }
  
      /* 既存チケットはスキップ */
      if (existIds.has(ticketId)) {
        console.log(`ticket_id already exists, skip: ${ticketId}`);
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
        '', // thread_id
        question,
      ]);
  
      existIds.add(ticketId);
      addedTickets++;
    });
  
    console.log(`Done: added ${addedTickets} tickets, ${addedContacts} contacts.`);
  }
  
  /* ------------------------------------------------------------------
   * メールアドレス正規化: foo+bar@example.com → foo@example.com
   * ----------------------------------------------------------------*/
  function normaliseEmail(addr: string): string {
    if (!addr) return '';
    const lower = addr.toLowerCase();
    const [user, domain] = lower.split('@');
    if (!user || !domain) return lower;
    return `${user.split('+')[0]}@${domain}`;
  }
  