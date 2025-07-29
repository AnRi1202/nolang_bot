/**
 * フォーム送信トリガー
 * @param e Google スプレッドシートの onFormSubmit イベント
 */
function onFormSubmit(
    e: GoogleAppsScript.Events.SheetsOnFormSubmit,
  ): void {
    /* ---------------------------------- 設定 --------------------------------- */
    const DEBUG = true;              // false にすればログを抑制
    /* --------------------------------- 取得 ---------------------------------- */
    const sheet = e.range.getSheet();
    const headers: string[] = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0] as string[];
  
    // namedValues は { 質問タイトル: string[] } なので結合して平坦化
    const kvPairs: Record<string, string> = {};
    Object.entries(e.namedValues).forEach(([title, ansArr]) => {
      const val: string = ansArr.join(', ');
      if (val) kvPairs[title] = val;
    });
    if (DEBUG) console.log(JSON.stringify(kvPairs, null, 2));
  
    /* ------------------------------ 必須項目確認 ------------------------------ */
    const email: string =
      kvPairs['メールアドレス'] ?? kvPairs['Email'] ?? ''; // 予備フィールドも考慮
    const category: string =
      kvPairs['お問い合わせの内容を選んでください。'] ?? kvPairs['Category'] ?? '';
  
    if (!email) {
      console.log('[2] email が空なので終了');
      return;
    }
  
    /* ------------------------------ プロンプト生成 ----------------------------- */
    let prompt = `以下のフォーム入力を参考に、${email} 様からの「${category}」に関するお問い合わせへ日本語で丁寧な回答メールを作成してください。\n\n`;
    Object.entries(kvPairs).forEach(([k, v]) => {
      prompt += `${k}: ${v}\n`;
    });
    if (DEBUG)
      console.log('[3] prompt(抜粋)\n' + prompt.substring(0, 300) + '...');
  
    /* ------------------------------ Dify 呼び出し ----------------------------- */
    const difyApiKey =
      PropertiesService.getScriptProperties().getProperty('DIFY_API_KEY') ?? '';
  
    interface DifyPayload {
      inputs: { category: string; form_data: string };
      query: string;
      user: string;
      response_mode: 'blocking';
    }
  
    const payload: DifyPayload = {
      inputs: { category, form_data: JSON.stringify(kvPairs) },
      query: prompt,
      user: email,
      response_mode: 'blocking',
    };
  
    if (DEBUG)
      console.log('[4] payload\n' + JSON.stringify(payload, null, 2));
  
    let replyText = '';
  
    try {
      const res = UrlFetchApp.fetch('https://api.dify.ai/v1/workflows/run', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: `Bearer ${difyApiKey}` },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
  
      type DifyResponse = {
        data?: { outputs?: { output?: string } };
      };
      const body: DifyResponse = JSON.parse(res.getContentText() || '{}');
  
      if (body?.data?.outputs?.output) {
        replyText = body.data.outputs.output!;
      } else {
        console.log('[!] 自動生成に失敗。response: ' + JSON.stringify(body, null, 2));
        replyText = '自動生成に失敗しました。（応答が不正です）';
      }
  
      if (DEBUG) {
        console.log(`[5] HTTP ${res.getResponseCode()}`);
        console.log('[5] response body\n' + JSON.stringify(body, null, 2));
      }
    } catch (err) {
      console.log('[5] fetch error\n' + err);
      replyText = '自動生成に失敗しました。（API エラー）';
    }
  
    /* ------------------------------ Gmail 下書き ------------------------------ */
    GmailApp.createDraft(
      email,
      '【NoLangサポート】お問い合わせありがとうございます',
      replyText,
    );
  
    if (DEBUG) console.log('[6] Draft 作成完了: ' + email);
  }