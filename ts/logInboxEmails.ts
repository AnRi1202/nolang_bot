import { SPREADSHEET_IDS, SHEET_NAMES, GMAIL_CONFIG } from './config';

/**
 * Gmail 受信トレイのメールをmessages dbへ転記し、Logged ラベルを付与する。
 * デバッグログ付き版
 */
function logInboxEmails(): void {
  const MAX_THREADS = GMAIL_CONFIG.MAX_THREADS;        // 取得するスレッド上限
  const MAX_MSG_PER_THREAD = GMAIL_CONFIG.MAX_MSG_PER_THREAD;   // 各スレッドで保存する通数
  const execStart = new Date();
  Logger.log('=== Script start: %s ===', execStart.toISOString());

  /* === 設定値 =========================== */
  const SHEET_ID = SPREADSHEET_IDS.MESSAGES;   // ★置換済み
  const SHEET_NAME = SHEET_NAMES.FORM_RESPONSES;
  const EXCLUDE_LABEL_NAME = GMAIL_CONFIG.EXCLUDE_LABEL;
  const LOGGED_LABEL_NAME = GMAIL_CONFIG.LOGGED_LABEL;
  /* ====================================== */

  // シート取得
  const ss: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet: GoogleAppsScript.Spreadsheet.Sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  Logger.log('Target sheet: %s (lastRow=%s)', SHEET_NAME, sheet.getLastRow());

  // ラベル・検索クエリ
  const loggedLabel: GoogleAppsScript.Gmail.GmailLabel = GmailApp.createLabel(LOGGED_LABEL_NAME);
  const query: string = `in:inbox -label:${EXCLUDE_LABEL_NAME} -label:${LOGGED_LABEL_NAME}`;
  Logger.log('Gmail query: %s', query);

  // スレッド検索
  const threads: GoogleAppsScript.Gmail.GmailThread[] = GmailApp.search(query, 0, MAX_THREADS); // ★ 第3引数で上限
  Logger.log('Threads found (capped): %s', threads.length);
  if (threads.length === 0) {
    Logger.log('No target threads. Exit.');
    return;
  }

  // 転記準備
  const rows: (string | Date)[][] = [];
  threads.forEach((thread: GoogleAppsScript.Gmail.GmailThread, idx: number) => {
    const messages: GoogleAppsScript.Gmail.GmailMessage[] = thread.getMessages().slice(-MAX_MSG_PER_THREAD); // ★ 末尾から n 通
    // 先頭3件だけ件名をログに出す
    messages.slice(0, 3).forEach((m: GoogleAppsScript.Gmail.GmailMessage) => console.log(
      `[${idx + 1}] ${m.getDate()} | ${m.getSubject()}`
    ));

    messages.forEach((msg: GoogleAppsScript.Gmail.GmailMessage) => {
        rows.push([
        msg.getDate().toISOString(),
        msg.getFrom(),
        msg.getSubject(),
        msg.getPlainBody().slice(0, 100).replace(/\n/g, ' '),
        msg.getId()
    ]);
    });

    thread.addLabel(loggedLabel);   // 重複防止
    // thread.moveToArchive();      // 必要ならアーカイブ
  });

  Logger.log('Rows to append: %s', rows.length);
  if (rows.length) {
    const start: number = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
    Logger.log('Wrote %s rows into sheet, starting at row %s', rows.length, start);
  }

  const execEnd = new Date();
  Logger.log('=== Script end: %s (duration: %ss) ===',
    execEnd.toISOString(),
    ((execEnd.getTime() - execStart.getTime()) / 1000).toFixed(2));
}
