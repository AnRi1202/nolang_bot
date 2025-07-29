/**
 * ヘッダー行（1 行目）をもとに「列名 → インデックス」マップを作成
 */
function getHeaderIndexMap(
    sh: GoogleAppsScript.Spreadsheet.Sheet,
  ): Record<string, number> {
    const headers = sh
      .getRange(1, 1, 1, sh.getLastColumn())
      .getValues()[0] as string[];
  
    const map: Record<string, number> = {};
    headers.forEach((h, idx) => {
      map[h] = idx;
    });
    return map;
  }
  
  /**
   * MESSAGES / TICKETS の内容を結合し、CSV を生成して Dify KB にアップロード
   * ファイル名: messages_upload_YYYY-MM-DD.csv
   */
  function uploadMessagesToDifyAsCsv(): void {
    /* ----------------------------- 設定値 ----------------------------- */
    const SHEET_ID = '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo';
    const MSG_SHEET = 'MESSAGES';
    const TKT_SHEET = 'TICKETS';
  
    const DATASET_ID = '69479919-12b8-4a5e-8431-3065b97aa492';
    const API_KEY = 'dataset-eTwwmgh6uhNJT2lXGTwu3HqF'; // ⇒ 実運用ではプロパティ格納推奨
    const fileName =
      'messages_upload_' + new Date().toISOString().slice(0, 10) + '.csv';
  
    /* --------------------------- シート取得 --------------------------- */
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const shM = ss.getSheetByName(MSG_SHEET);
    const shT = ss.getSheetByName(TKT_SHEET);
    if (!shM || !shT) throw new Error('MESSAGES または TICKETS シートが見つかりません');
  
    /* --------------------------- TICKETS 読取 -------------------------- */
    const tktHdr = getHeaderIndexMap(shT);
    const tktValues = shT.getRange(2, 1, shT.getLastRow() - 1, shT.getLastColumn())
      .getValues() as (string | number)[][];
  
    const tktMap = new Map<string, string>(); // ticket_id → question_text
    tktValues.forEach((row, i) => {
      const tid = String(row[tktHdr['ticket_id']] ?? '');
      const question = String(row[tktHdr['question_text']] ?? '');
      if (tid) tktMap.set(tid, question);
      console.log(
        `TICKET[${i + 2}] ticket_id=${tid}, question_text=${question}`,
      );
    });
  
    /* --------------------------- MESSAGES 読取 ------------------------- */
    const msgHdr = getHeaderIndexMap(shM);
    const msgValues = shM.getRange(2, 1, shM.getLastRow() - 1, shM.getLastColumn())
      .getValues() as (string | number)[][];
  
    /* ----------------------------- CSV 生成 ---------------------------- */
    const csvRows: string[][] = [['question_text', 'body_plain']];
  
    msgValues.forEach((row, i) => {
      const tid = String(row[msgHdr['ticket_id']] ?? '');
      const body = String(row[msgHdr['body_plain']] ?? '');
      const question = tktMap.get(tid) ?? '';
      console.log(
        `MESSAGE[${i + 2}] ticket_id=${tid}, question_text=${question}, body_plain=${body}`,
      );
      csvRows.push([question, body]);
    });
  
    const csvString = csvRows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  
    console.log('=== CSV Content Preview ===');
    console.log(csvString);
  
    /* ------------------------- Dify へアップロード ------------------------ */
    const blob = Utilities.newBlob(csvString, 'text/csv', fileName);
  
    const url =
      `https://api.dify.ai/v1/datasets/${DATASET_ID}/document/create-by-file` +
      `?name=${encodeURIComponent(fileName)}` +
      `&indexing_technique=high_quality&process_rule.mode=automatic`;
  
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { Authorization: `Bearer ${API_KEY}` },
      payload: { file: blob },
      muteHttpExceptions: true,
    });
  
    console.log(`Status: ${res.getResponseCode()}`);
    console.log(res.getContentText());
  
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      const docId = (JSON.parse(res.getContentText()) as { document?: { id: string } })
        .document?.id;
      console.log(`✅ アップロード成功: document_id = ${docId}`);
    } else {
      console.log('❌ アップロード失敗');
    }
  }