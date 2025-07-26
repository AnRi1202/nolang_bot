import { SPREADSHEET_IDS, SHEET_NAMES } from './config';

interface FormData {
  timestamp: string;
  email: string;
  category: string;
  status: string;
  question: string;
  ticketId?: string;
}

interface TicketData {
  ticketId: string;
  contactId: string;
  subject: string;
  category: string;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  threadId: string;
  questionText: string;
}

interface ContactData {
  contactId: string;
  displayName: string;
  firstSeen: string;
  lastSeen: string;
}

function backfillTicketsFromForms(): void {
  // これまでのformのスライドを走査して、TICKETS, CONTACTSに追加　Questionの部分
  console.log('[Start] backfillTicketsFromForms');
  
  const FORM_SS_ID = SPREADSHEET_IDS.FORM;
  const FORM_SHEET = SHEET_NAMES.FORM_RESPONSES;
  const TICKET_SS_ID = SPREADSHEET_IDS.TICKET;
  const TICKET_SHEET = SHEET_NAMES.TICKETS;
  const CONTACT_SHEET = SHEET_NAMES.CONTACTS;  // ★ 追加

  const formSS = SpreadsheetApp.openById(FORM_SS_ID);
  const formSH = formSS.getSheetByName(FORM_SHEET);
  const ticketSS = SpreadsheetApp.openById(TICKET_SS_ID);
  let ticketSH = ticketSS.getSheetByName(TICKET_SHEET);
  let contactSH = ticketSS.getSheetByName(CONTACT_SHEET);
  
  if (!contactSH) {
    contactSH = ticketSS.insertSheet(CONTACT_SHEET);
    contactSH.appendRow(['contact_id', 'display_name', 'first_seen', 'last_seen']); // ヘッダー追加
    console.log('CONTACTS シートを新規作成しました');
  }
  
  if (!ticketSH) {
    ticketSH = ticketSS.insertSheet(TICKET_SHEET);
    ticketSH.appendRow([
      'ticket_id', 'contact_id', 'subject', 'category', 'source',
      'status', 'created_at', 'updated_at', 'thread_id', 'question_text'
    ]);
    console.log('TICKETS シートを新規作成しました');
  }

  // チケット既存ID
  const lastRow = ticketSH.getLastRow();
  const existIds = new Set<string>(
    lastRow <= 1 ? [] : ticketSH.getRange(2, 1, lastRow - 1, 1).getValues().flat()
  );

  // ★ 連絡先の既存 contact_id を取得
  const contactLastRow = contactSH.getLastRow();
  const existContacts = new Set<string>(
    contactLastRow <= 1 ? [] : contactSH.getRange(2, 1, contactLastRow - 1, 1).getValues().flat()
  );

  console.log(`Existing ticket count: ${existIds.size}`);
  console.log(`Existing contact count: ${existContacts.size}`);

  const headers = formSH.getRange(1, 1, 1, formSH.getLastColumn()).getValues()[0];
  const hIdx: { [key: string]: number } = {};
  headers.forEach((h: string, i: number) => {
    hIdx[h.trim()] = i;
  });

  const REQUIRED = ['問い合わせ受付日', 'メールアドレス', 'お問い合わせの内容を選んでください。'];
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
    console.log('ticket_id 列を新規追加');
  }

  const totalRows = formSH.getLastRow() - 1;
  if (totalRows <= 0) {
    console.log('No form entries to process.');
    return;
  }

  const maxRows = Math.min(totalRows, 500);  // デバッグ用に数を指定
  const data = formSH.getRange(2, 1, maxRows, headers.length).getValues();
  console.log(`読み込んだフォームエントリ数: ${maxRows}件`);
  let added = 0;
  let newContacts = 0;

  data.forEach((row: any[], rIdx: number) => {
    const emailRaw = row[hIdx['メールアドレス']] || '';
    const contactId = normaliseEmail(emailRaw);
    const category = row[hIdx['お問い合わせの内容を選んでください。']] || '';
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
      contactSH.appendRow([contactId, '', '', timeStamp]); // name, source などは空でもOK
      existContacts.add(contactId);
      newContacts++;
      console.log(`New contact added: ${contactId}`);
    }

    let ticketId = row[ticketColIdx];
    if (!ticketId) {
      ticketId = Utilities.getUuid();
      formSH.getRange(rIdx + 2, ticketColIdx + 1).setValue(ticketId);
      console.log(`New ticket_id created: ${ticketId} for row ${rIdx + 2}`);
    }

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
      '',  // thread_id
      question
    ]);

    existIds.add(ticketId);
    added++;
  });

  console.log(`処理完了: ${added}件のチケット、${newContacts}件のコンタクトを追加しました`);
}

function normaliseEmail(addr: string): string {
  if (!addr) return '';
  const lower = addr.toLowerCase();
  const parts = lower.split('@');
  if (parts.length !== 2) return lower;
  return parts[0].split('+')[0] + '@' + parts[1];
}

// Google Apps Scriptの型定義（実際の環境では適切な型定義ファイルを使用）
declare const SpreadsheetApp: any;
declare const Utilities: any;
declare const Logger: any;

// エクスポート
export { backfillTicketsFromForms, normaliseEmail };
