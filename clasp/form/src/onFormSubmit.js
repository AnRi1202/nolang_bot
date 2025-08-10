//google formが送信された際、difyを経由して回答をgmailの下書きに溜める。
//現状使っていない。onFormSubmitForSheetが使われてる。
function onFormSubmit(e) {
    const DEBUG = true;                           // ← false にすれば静かに動作
    const sheet   = e.range.getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const responses = e.values;
    const kvPairs = {};
    Object.entries(e.namedValues).forEach(([title, ansArr]) => {
      const val = ansArr.join(', ');
      if (val) kvPairs[title] = val;
    });
    if (DEBUG) Logger.log(JSON.stringify(kvPairs, null, 2));
  
    // 2) 必須項目
    const email    = kvPairs['メールアドレス'] || '';
    const category = kvPairs['お問い合わせの内容を選んでください。'] || '';
    if (!email) {
      Logger.log('[2] email が空なので終了');
      return;
    }
  
    // 3) プロンプト生成
    let prompt = `以下のフォーム入力を参考に、${email} 様からの「${category}」に関するお問い合わせへ日本語で丁寧な回答メールを作成してください。\n\n`;
    Object.entries(kvPairs).forEach(([k, v]) => prompt += `${k}: ${v}\n`);
    if (DEBUG) Logger.log('[3] prompt(抜粋)\n' + prompt.slice(0, 300) + '...');
  
    // 4) Dify 呼び出し
    const difyApiKey = PropertiesService.getScriptProperties()
                       .getProperty('DIFY_API_KEY');
    // 4.1) video_urlの抽出
    const VIDEO_URL_KEYS = [
      '問題が発生している動画の URL もしくは編集画面の URL',
      '該当の動画の URL'
    ];
    let videoUrl = '';
    for (const key of VIDEO_URL_KEYS) {
      if (kvPairs[key]) {                
        videoUrl = kvPairs[key];
        break;
      }
    }
    if (!videoUrl) {
      const autoKey = Object.keys(kvPairs)
        .find(k => /動画.*URL/i.test(k)); // 「動画 … URL」を含む列
      if (autoKey) videoUrl = kvPairs[autoKey];
    }
  
  
  
    /* 4-b) payload を組み立て */
    const payload = {
      inputs: {
        category,
        form_data: JSON.stringify(kvPairs)
      },
      query: prompt,
      user:  email,
      response_mode: 'blocking'
    };
    // 4-c) URL が取得できた場合のみ追加
    if (videoUrl) {
      payload.inputs.video_url = videoUrl;   // ← API 側で期待するキー名に合わせる
    }
  
    if (DEBUG) Logger.log('[4] payload\n' + JSON.stringify(payload, null, 2));
  
    let res, body, replyText;
    try {
      res = UrlFetchApp.fetch('https://api.dify.ai/v1/workflows/run', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + difyApiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
  
      body = JSON.parse(res.getContentText() || '{}');
  
      if (body?.data?.outputs?.output) {
        replyText = body.data.outputs.output;
      } else {
        Logger.log('[!] 自動生成に失敗。response: ' + JSON.stringify(body, null, 2));
        replyText = '自動生成に失敗しました。（応答が不正です）';
      }
  
      if (DEBUG) {
        Logger.log(`[5] HTTP ${res.getResponseCode()}`);
        Logger.log('[5] response body\n' + JSON.stringify(body, null, 2));
      }
  
    } catch (err) {
      Logger.log('[5] fetch error\n' + err);
      replyText = '自動生成に失敗しました。（API エラー）';
    }
  
    // 5) Gmail 下書き
    GmailApp.createDraft(
      email,
      '【NoLangサポート】お問い合わせありがとうございます',
      replyText
    );
    if (DEBUG) Logger.log('[6] Draft 作成完了: ' + email);
  }
  