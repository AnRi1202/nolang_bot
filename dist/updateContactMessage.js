function updateContactMessage() {
    // gmailの受信トレイからCONTACTSとMESSAGESを記録する
    /* === パラメータ ========================= */
    const MAX_THREADS         = 200;
    const MAX_MSG_PER_THREAD  = 3;
  
    const SHEET_ID       = '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo';
    const MSG_SHEET      = 'MESSAGES';
    const CONTACT_SHEET  = 'CONTACTS';
    const TICKET_SHEET   = 'TICKETS';
  
    const EXCLUDE_LABEL  = 'スプレッドシート';
    const LOGGED_LABEL   = 'Logged';
    const SELF_ADDR = 'support.nolang@mvrks.co.jp';
    const TICKET_DATE_CANDIDATES = ['updated_at', 'last_update', 'date', 'timestamp'];
    /* ======================================= */
  
    const ss = SpreadsheetApp.openById(SHEET_ID);
  
    const shMsg = ss.getSheetByName(MSG_SHEET)      || ss.insertSheet(MSG_SHEET);
    const shCt  = ss.getSheetByName(CONTACT_SHEET)  || ss.insertSheet(CONTACT_SHEET);
    const shTk  = ss.getSheetByName(TICKET_SHEET);
  
    if (shMsg.getLastRow() === 0) {
      shMsg.appendRow(['message_id','ticket_id','role','date','from','to','subject','body_plain']);
    }
    if (shCt.getLastRow() === 0) {
      shCt.appendRow(['contact_id','display_name','first_seen','last_seen']);
    }
  // contact, ticketともに、mapに書き込んでるだけ. あとでsetValuesをする
  // contact
    const ctIdx = new Map();
    let ctRows = [];
    if (shCt.getLastRow() > 1) { //シートにすでに存在しているデータを確認する
      ctRows = shCt.getRange(2, 1, shCt.getLastRow() - 1, 4).getValues();
    }
    ctRows.forEach((row, i) => {
      ctIdx.set(row[0], { row: i + 2, name: row[1] }); //シートの0列目を
    });
  
    let existingMsgIds = new Set();
    const msgData = shMsg.getDataRange().getValues();
    if (msgData.length > 1) {
      const msgIds = msgData.slice(1).map(r => r[0]);
      existingMsgIds = new Set(msgIds.filter(id => id));
    }
  //ticket
    const ticketMap = new Map();
    let tkHeader = {};
    if (shTk && shTk.getLastRow() > 1) {
      tkHeader = getHeaderIndexMap(shTk);
      const dateColName = TICKET_DATE_CANDIDATES.find(c => tkHeader[c] !== undefined);
      const data = shTk.getRange(2, 1, shTk.getLastRow() - 1, shTk.getLastColumn()).getValues();
  
      data.forEach(row => {
        const ticketId   = row[tkHeader['ticket_id']];
        const emailRaw   = row[tkHeader['contact_id']];
        const contactId  = normalizeEmail(emailRaw);
        if (!contactId) return;
        const ticketDate = dateColName ? new Date(row[tkHeader[dateColName]]) : null;
        if (!ticketMap.has(contactId)) ticketMap.set(contactId, []);
        ticketMap.get(contactId).push({ id: ticketId, date: ticketDate });
      });
    }
  
  // Gmailのデータを読み取る
    const loggedLabel = GmailApp.createLabel(LOGGED_LABEL);
    const threads = GmailApp.search(`in:inbox -label:${EXCLUDE_LABEL}`, 0, MAX_THREADS);
  
    const now = new Date();
    const rowsMsg    = [];
    const rowsCtNew  = [];
    const rowsCtUpd  = [];
  
    threads.forEach((th, tIdx) => {
      const slice = th.getMessages().slice(-MAX_MSG_PER_THREAD);
  
      slice.forEach(msg => {
        const msgId   = msg.getId();
        const msgDate = msg.getDate();
        const { addr, name } = parseAddr(msg.getFrom());
        const fromAddr = addr.toLowerCase();
        const toAddrs = splitAddressList(msg.getTo()).map(a => parseAddr(a).addr.toLowerCase());
  
        // --- A) CONTACTS: 送信者と宛先すべてを登録 ---
        upsertContact(fromAddr, name, msgDate);
        toAddrs.forEach(to => {
          const parsed = parseAddr(to);
          upsertContact(parsed.addr.toLowerCase(), parsed.name, msgDate);
        });
  
        // --- B) cid（TICKET 紐付け用）を決定 ---
        let cid = normalizeEmail(fromAddr);
        if (fromAddr === SELF_ADDR.toLowerCase()) {
          const other = toAddrs.find(a => normalizeEmail(a) !== SELF_ADDR.toLowerCase());
          if (other) cid = normalizeEmail(other);
        }
  
        // --- C) チケット紐付け ---
        const ticketId = findClosestTicket(cid, msgDate);
        if (!ticketId) return;
  
        // --- D) MESSAGES 保存 ---
        if (!existingMsgIds.has(msgId)) {
          rowsMsg.push([
            msgId,
            ticketId,
            'human',
            msgDate,
            msg.getFrom(),
            msg.getTo(),
            msg.getSubject(),
            msg.getPlainBody().replace(/\n/g, ' ')
          ]);
          existingMsgIds.add(msgId);
        }
      });
  
      th.addLabel(loggedLabel);
      console.log(`[${tIdx + 1}/${threads.length}] done`);
    });
  
    if (rowsCtNew.length) {
      shCt.getRange(shCt.getLastRow() + 1, 1, rowsCtNew.length, rowsCtNew[0].length)
          .setValues(rowsCtNew);
    }
    rowsCtUpd.forEach(([rowNum, updateName, lastSeen]) => {
      if (updateName) shCt.getRange(rowNum, 2).setValue(updateName);
      shCt.getRange(rowNum, 4).setValue(lastSeen);
    });
  
    if (rowsMsg.length) {
      shMsg.getRange(shMsg.getLastRow() + 1, 1, rowsMsg.length, rowsMsg[0].length)
           .setValues(rowsMsg);
    }
  
    Logger.log('Done: %s new msgs, %s new contacts, %s contacts updated',
               rowsMsg.length, rowsCtNew.length, rowsCtUpd.length);
  
    function findClosestTicket(contactId, msgDate) {
      const list = ticketMap.get(contactId);
      if (!list || list.length === 0) return null;
      let best = list[0];
      let bestDiff = Math.abs(best.date - msgDate);
      for (let i = 1; i < list.length; i++) {
        const diff = Math.abs(list[i].date - msgDate);
        if (diff < bestDiff) {
          best = list[i];
          bestDiff = diff;
        }
      }
      return best.id;
    }
    //contactシートに登録済みなら更新、未登録なら新規登録　
    function upsertContact(emailAddr, displayName, seenDate) {
      const cid = normalizeEmail(emailAddr);
      if (!cid) return;
      const entry = ctIdx.get(cid);
      if (entry) {
        const needName = !entry.name && displayName;
        if (needName || true) {
          rowsCtUpd.push([entry.row, needName ? displayName : null, seenDate]);
        }
      } else {
        rowsCtNew.push([cid, displayName, seenDate, seenDate]);
        ctIdx.set(cid, { row: shCt.getLastRow() + rowsCtNew.length, name: displayName });
      }
    }
  }
  
  /* -------- utilities -------- */
  function normalizeEmail(raw) {
    if (typeof raw !== 'string') return null;
    raw = raw.replace(/[<>]/g, '').trim().toLowerCase();
    const [user, domain] = raw.split('@');
    if (!user || !domain) return null;
    return user.split('+')[0] + '@' + domain;
  }
  
  function parseAddr(raw) {
    raw = (raw || '').trim();
    if (/</.test(raw) && />/.test(raw)) {
      const addr = raw.match(/<([^>]+)>/)[1].trim();
      const name = raw.replace(/<[^>]+>/, '').replace(/(^"|"$)/g, '').trim();
      return { name, addr };
    }
    return { name: '', addr: raw.replace(/[<>]/g, '') };
  }
  
  function getHeaderIndexMap(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const map = {};
    headers.forEach((h, i) => (map[h] = i));
    return map;
  }
  
  function splitAddressList(rawList) {
    return rawList
      .split(',')
      .map(s => s.trim())
      .filter(s => s);
  }