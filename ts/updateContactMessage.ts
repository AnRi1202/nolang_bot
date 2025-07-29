/**
 * Gmail 受信トレイから CONTACTS・MESSAGES・TICKETS を更新するスクリプト
 * - CONTACTS: 連絡先の初回 / 最終アクセス日時を管理
 * - MESSAGES: チケットと紐付けたメール本文を保存
 * - TICKETS : 既存チケット情報（別シート）を参照
 *
 * Google Apps Script で動作させる想定
 * 型補完のため `@types/google-apps-script` を導入しておくと便利
 */

/* ------------------------------------------------------------------
 * ヘッダー行から "列名 → インデックス" マップを生成
 * ----------------------------------------------------------------*/
function getHeaderIndexMap(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
  ): Record<string, number> {
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0] as string[];
    const map: Record<string, number> = {};
    headers.forEach((h, i) => {
      map[h] = i;
    });
    return map;
  }
  
  /* ------------------------------------------------------------------
   * "山田 <foo@example.com>" のような文字列を {name, addr} に分解
   * ----------------------------------------------------------------*/
  function parseAddr(raw: string): { name: string; addr: string } {
    const trimmed = (raw || '').trim();
    if (/</.test(trimmed) && />/.test(trimmed)) {
      const addr = trimmed.match(/<([^>]+)>/i)![1].trim();
      const name = trimmed
        .replace(/<[^>]+>/, '')
        .replace(/(^"|"$)/g, '')
        .trim();
      return { name, addr };
    }
    return { name: '', addr: trimmed.replace(/[<>]/g, '') };
  }
  
  /* ------------------------------------------------------------------
   * カンマ区切りアドレスリスト → 配列へ
   * ----------------------------------------------------------------*/
  function splitAddressList(rawList: string): string[] {
    return rawList
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  
  /* ------------------------------------------------------------------
   * "foo+bar@example.com" → "foo@example.com" など正規化
   * ----------------------------------------------------------------*/
  function normalizeEmail(raw: string): string | null {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replace(/[<>]/g, '').trim().toLowerCase();
    const [user, domain] = cleaned.split('@');
    if (!user || !domain) return null;
    return `${user.split('+')[0]}@${domain}`;
  }
  
  /* ------------------------------------------------------------------
   * メイン処理
   * ----------------------------------------------------------------*/
  function updateContactMessage(): void {
    /** パラメータ */
    const MAX_THREADS = 200;
    const MAX_MSG_PER_THREAD = 3;
  
    const SHEET_ID = '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo';
    const MSG_SHEET = 'MESSAGES';
    const CONTACT_SHEET = 'CONTACTS';
    const TICKET_SHEET = 'TICKETS';
  
    const EXCLUDE_LABEL = 'スプレッドシート';
    const LOGGED_LABEL = 'Logged';
    const SELF_ADDR = 'support.nolang@mvrks.co.jp';
    const TICKET_DATE_CANDIDATES = [
      'updated_at',
      'last_update',
      'date',
      'timestamp',
    ];
  
    /* スプレッドシート準備 */
    const ss = SpreadsheetApp.openById(SHEET_ID);
  
    const shMsg = ss.getSheetByName(MSG_SHEET) ?? ss.insertSheet(MSG_SHEET);
    const shCt = ss.getSheetByName(CONTACT_SHEET) ?? ss.insertSheet(CONTACT_SHEET);
    const shTk = ss.getSheetByName(TICKET_SHEET);
  
    if (shMsg.getLastRow() === 0) {
      shMsg.appendRow([
        'message_id',
        'ticket_id',
        'role',
        'date',
        'from',
        'to',
        'subject',
        'body_plain',
      ]);
    }
    if (shCt.getLastRow() === 0) {
      shCt.appendRow(['contact_id', 'display_name', 'first_seen', 'last_seen']);
    }
  
    /* CONTACTS シートをインメモリ Map 化 */
    const ctIdx = new Map<string, { row: number; name: string }>();
    const ctRowsExisting: (string | GoogleAppsScript.Base.Date)[][] =
      shCt.getLastRow() > 1
        ? (shCt
            .getRange(2, 1, shCt.getLastRow() - 1, 4)
            .getValues() as (string | GoogleAppsScript.Base.Date)[][])
        : [];
  
    ctRowsExisting.forEach((row, i) => {
      const contactId = String(row[0]);
      const displayName = String(row[1]);
      ctIdx.set(contactId, { row: i + 2, name: displayName });
    });
  
    /* 既存メッセージ ID のセット */
    const existingMsgIds = new Set<string>();
    const msgData = shMsg.getDataRange().getValues();
    if (msgData.length > 1) {
      msgData.slice(1).forEach((r) => existingMsgIds.add(String(r[0])));
    }
  
    /* TICKETS シート → contactId ごとのチケット一覧 Map */
    interface TicketInfo {
      id: string;
      date: GoogleAppsScript.Base.Date | null;
    }
    const ticketMap = new Map<string, TicketInfo[]>();
    let tkHeader: Record<string, number> = {};
  
    if (shTk && shTk.getLastRow() > 1) {
      tkHeader = getHeaderIndexMap(shTk);
      const dateColName = TICKET_DATE_CANDIDATES.find(
        (c) => tkHeader[c] !== undefined,
      );
      const tkValues = shTk
        .getRange(2, 1, shTk.getLastRow() - 1, shTk.getLastColumn())
        .getValues();
  
      tkValues.forEach((row) => {
        const ticketId = String(row[tkHeader['ticket_id']]);
        const emailRaw = String(row[tkHeader['contact_id']]);
        const contactId = normalizeEmail(emailRaw);
        if (!contactId) return;
        const ticketDate: GoogleAppsScript.Base.Date | null = dateColName
          ? new Date(row[tkHeader[dateColName]])
          : null;
  
        if (!ticketMap.has(contactId)) ticketMap.set(contactId, []);
        ticketMap.get(contactId)!.push({ id: ticketId, date: ticketDate });
      });
    }
  
    /* Gmail 検索 & 取得 */
    const loggedLabel = GmailApp.createLabel(LOGGED_LABEL);
    const threads = GmailApp.search(
      `in:inbox -label:${EXCLUDE_LABEL}`,
      0,
      MAX_THREADS,
    );
  
    const rowsMsg: (string | GoogleAppsScript.Base.Date)[][] = [];
    const rowsCtNew: (string | GoogleAppsScript.Base.Date)[][] = [];
    const rowsCtUpd: [number, string | null, GoogleAppsScript.Base.Date][] = [];
  
    threads.forEach((th, tIdx) => {
      const messages = th.getMessages().slice(-MAX_MSG_PER_THREAD);
  
      messages.forEach((msg) => {
        const msgId = msg.getId();
        const msgDate = msg.getDate();
        const { addr: fromAddrRaw, name: fromName } = parseAddr(msg.getFrom());
        const fromAddr = fromAddrRaw.toLowerCase();
        const toAddrs = splitAddressList(msg.getTo()).map((a) =>
          parseAddr(a).addr.toLowerCase(),
        );
  
        /* --- A) CONTACTS 登録／更新 ----------------------------- */
        upsertContact(fromAddr, fromName, msgDate);
        toAddrs.forEach((to) => {
          const parsed = parseAddr(to);
          upsertContact(parsed.addr.toLowerCase(), parsed.name, msgDate);
        });
  
        /* --- B) cid (contact_id) 決定 --------------------------- */
        let cid = normalizeEmail(fromAddr) ?? '';
        if (fromAddr === SELF_ADDR.toLowerCase()) {
          const other = toAddrs.find(
            (a) => normalizeEmail(a) !== SELF_ADDR.toLowerCase(),
          );
          if (other) cid = normalizeEmail(other) ?? '';
        }
  
        /* --- C) チケット紐付け ------------------------------- */
        const ticketId = findClosestTicket(cid, msgDate);
        if (!ticketId) return; // 紐付け失敗 → スキップ
  
        /* --- D) MESSAGES 保存 --------------------------------- */
        if (!existingMsgIds.has(msgId)) {
          rowsMsg.push([
            msgId,
            ticketId,
            'human',
            msgDate,
            msg.getFrom(),
            msg.getTo(),
            msg.getSubject(),
            msg.getPlainBody().replace(/\n/g, ' '),
          ]);
          existingMsgIds.add(msgId);
        }
      });
  
      th.addLabel(loggedLabel);
      console.log(`[${tIdx + 1}/${threads.length}] done`);
    });
  
    /* CONTACTS シート書き込み */
    if (rowsCtNew.length) {
      shCt
        .getRange(shCt.getLastRow() + 1, 1, rowsCtNew.length, rowsCtNew[0].length)
        .setValues(rowsCtNew);
    }
    rowsCtUpd.forEach(([rowNum, updateName, lastSeen]) => {
      if (updateName) shCt.getRange(rowNum, 2).setValue(updateName);
      shCt.getRange(rowNum, 4).setValue(lastSeen);
    });
  
    /* MESSAGES シート書き込み */
    if (rowsMsg.length) {
      shMsg
        .getRange(shMsg.getLastRow() + 1, 1, rowsMsg.length, rowsMsg[0].length)
        .setValues(rowsMsg);
    }
  
    console.log(
      'Done: %s new msgs, %s new contacts, %s contacts updated',
      rowsMsg.length,
      rowsCtNew.length,
      rowsCtUpd.length,
    );
  
    /* ------------------------------------------------------------
     * ローカル関数群
     * ----------------------------------------------------------*/
  
    /**
     * contact_id ごとに最も近い (日時差最小) チケット ID を返す
     */
    function findClosestTicket(contactId: string, msgDate: GoogleAppsScript.Base.Date): string | null {
      const list = ticketMap.get(contactId);
      if (!list || list.length === 0) return null;
      let best: TicketInfo = list[0];
      let bestDiff = Math.abs((best.date ?? new Date(0)).getTime() - msgDate.getTime());
      for (let i = 1; i < list.length; i++) {
        const d = list[i];
        const diff = Math.abs((d.date ?? new Date(0)).getTime() - msgDate.getTime());
        if (diff < bestDiff) {
          best = d;
          bestDiff = diff;
        }
      }
      return best.id;
    }
  
    /**
     * CONTACTS シートへの upsert
     */
    function upsertContact(
      emailAddr: string,
      displayName: string,
      seenDate: GoogleAppsScript.Base.Date,
    ): void {
      const cid = normalizeEmail(emailAddr);
      if (!cid) return;
  
      const entry = ctIdx.get(cid);
      if (entry) {
        const needNameUpdate = !entry.name && displayName;
        if (needNameUpdate || true) {
          rowsCtUpd.push([entry.row, needNameUpdate ? displayName : null, seenDate]);
        }
      } else {
        rowsCtNew.push([cid, displayName, seenDate, seenDate]);
        ctIdx.set(cid, {
          row: shCt.getLastRow() + rowsCtNew.length,
          name: displayName,
        });
      }
    }
  }
  