function uploadMessagesToDifyAsCsv() {
    // question_textとanswerの対としてuploadする　messages_upload_{}.csvという名前
    const SHEET_ID    = '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo'; // KBというシート
    const MSG_SHEET   = 'MESSAGES';
    const TKT_SHEET   = 'TICKETS';
  
    const DATASET_ID  = '69479919-12b8-4a5e-8431-3065b97aa492';
    const API_KEY     = 'dataset-eTwwmgh6uhNJT2lXGTwu3HqF';
    const fileName    = 'messages_upload_' + new Date().toISOString().slice(0,10) + '.csv';
  
    const ss  = SpreadsheetApp.openById(SHEET_ID);
    const shM = ss.getSheetByName(MSG_SHEET);
    const shT = ss.getSheetByName(TKT_SHEET);
    if (!shM || !shT) throw new Error('MESSAGES or TICKETS sheet not found');
  
    const tktHdr = getHeaderIndexMap(shT);
    const tktMap = new Map();
    const tktData = shT.getRange(2, 1, shT.getLastRow() - 1, shT.getLastColumn()).getValues();
    tktData.forEach((row, i) => {
      const tid = row[tktHdr['ticket_id']];
      const q   = row[tktHdr['question_text']] || '';
      Logger.log(`TICKET[${i + 2}] ticket_id=${tid}, question_text=${q}`);
      if (tid) tktMap.set(tid, q);
    });
  
    const msgHdr = getHeaderIndexMap(shM);
    const msgData = shM.getRange(2, 1, shM.getLastRow() - 1, shM.getLastColumn()).getValues();
  
    const csvRows = [['question_text', 'body_plain']];
    msgData.forEach((row, i) => {
      const tid = row[msgHdr['ticket_id']];
      const body = row[msgHdr['body_plain']] || '';
      const question = tktMap.get(tid) || '';
      Logger.log(`MESSAGE[${i + 2}] ticket_id=${tid}, question_text=${question}, body_plain=${body}`);
  
      csvRows.push([question, body]);
    });
  
    const csvString = csvRows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  
    Logger.log('=== CSV Content Preview ===');
    Logger.log(csvString);
  
    const blob = Utilities.newBlob(csvString, 'text/csv', fileName);
  
    const url = `https://api.dify.ai/v1/datasets/${DATASET_ID}/document/create-by-file` +
                `?name=${encodeURIComponent(fileName)}&indexing_technique=high_quality&process_rule.mode=automatic`;
  
    const res = UrlFetchApp.fetch(url, {
      method : 'post',
      headers: { Authorization: `Bearer ${API_KEY}` },
      payload: { file: blob },
      muteHttpExceptions: true
    });
  
    Logger.log(`Status: ${res.getResponseCode()}`);
    Logger.log(res.getContentText());
  
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      const docId = JSON.parse(res.getContentText()).document?.id;
      Logger.log(`✅ アップロード成功: document_id = ${docId}`);
    } else {
      Logger.log('❌ アップロード失敗');
    }
  }