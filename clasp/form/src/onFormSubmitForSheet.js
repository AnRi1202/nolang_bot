
//Google formが送信された際に、difyを経由して、spreadsheetにAIの自動回答を追加する
function onFormSubmitForSheet(e) {
    const DEBUG = true;
  
    const formSheet = e.range.getSheet(); // 送信先シート（フォームの回答）
    const rowIndex = e.range.getRow();    // 今回の回答が入った行
  
    // フォーム値を KV に
    const kvPairs = {};
    Object.entries(e.namedValues).forEach(([title, ansArr]) => {
      const val = ansArr.join(', ');
      if (val) kvPairs[title] = val;
    });
    if (DEBUG) Logger.log(JSON.stringify(kvPairs, null, 2));
  
    // 必須項目
    const email    = kvPairs['メールアドレス'] || '';
    const category = kvPairs['お問い合わせの内容を選んでください。'] || '';
    if (!email) {
      Logger.log('[2] email が空なので終了');
      return;
    }
  
    // プロンプト作成
    let prompt = `以下のフォーム入力を参考に、${email} 様からの「${category}」に関するお問い合わせへ日本語で丁寧な回答メールを作成してください。\n\n`;
    Object.entries(kvPairs).forEach(([k, v]) => prompt += `${k}: ${v}\n`);
  
    // video_url 抽出
    const VIDEO_URL_KEYS = [
      '問題が発生している動画の URL もしくは編集画面の URL',
      '該当の動画の URL'
    ];
    let videoUrl = '';
    for (const key of VIDEO_URL_KEYS) {
      if (kvPairs[key]) { videoUrl = kvPairs[key]; break; }
    }
    if (!videoUrl) {
      const autoKey = Object.keys(kvPairs).find(k => /動画.*URL/i.test(k));
      if (autoKey) videoUrl = kvPairs[autoKey];
    }
  
    // Dify 呼び出し
    const difyApiKey = PropertiesService.getScriptProperties().getProperty('DIFY_API_KEY');
    const payload = {
      inputs: { category, form_data: JSON.stringify(kvPairs) },
      query: prompt,
      user: email,
      response_mode: 'blocking'
    };
    if (videoUrl) payload.inputs.video_url = videoUrl;
  
    let replyText = '';
    try {
      const res = UrlFetchApp.fetch('https://api.dify.ai/v1/workflows/run', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + difyApiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
  
      const body = JSON.parse(res.getContentText() || '{}');
      // 出力キーを柔軟に取得
      replyText = pickReplyText_(body);
      if (!replyText) {
        replyText = '自動生成に失敗しました。（応答が不正です）';
        Logger.log('[!] response: ' + JSON.stringify(body, null, 2));
      }
    } catch (err) {
      replyText = '自動生成に失敗しました。（API エラー）';
      Logger.log('[fetch error]\n' + err);
    }
  
    // === AI_回答本文列のみに書き込む ===
    const lastCol = formSheet.getLastColumn();
    const headers = formSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    let colIndex = headers.indexOf('AI_回答本文') + 1;
    if (colIndex === 0) {
      colIndex = lastCol + 1;
      formSheet.getRange(1, colIndex).setValue('AI_回答本文');
      formSheet.setFrozenRows(1);
    }
    formSheet.getRange(rowIndex, colIndex).setValue(replyText);
    if (DEBUG) Logger.log(`[6] AI_回答本文に書き込み完了 (row=${rowIndex})`);
  }
  
  /**
   * Difyのoutputsから柔軟に本文を取り出す
   */
  function pickReplyText_(body) {
    if (body?.data?.outputs) {
      for (const v of Object.values(body.data.outputs)) {
        if (typeof v === 'string' && v.trim()) return v;
        if (v && typeof v === 'object' && typeof v.text === 'string' && v.text.trim()) return v.text;
      }
    }
    return '';
  }