import { API_CONFIG, EMAIL_CONFIG } from './config';

function onFormSubmit(e: GoogleAppsScript.Events.SheetsOnFormSubmit): void {
  const DEBUG = true;


  const kvPairs: Record<string, string> = {};
  Object.entries(e.namedValues).forEach(([title, ansArr]) => {
    const val = ansArr.join(', ');
    if (val) kvPairs[title] = val;
  });
  if (DEBUG) Logger.log(JSON.stringify(kvPairs, null, 2));

  const email = kvPairs['メールアドレス'] || '';
  const category = kvPairs['お問い合わせの内容を選んでください。'] || '';
  if (!email) {
    Logger.log('[2] email が空なので終了');
    return;
  }

  let prompt = `以下のフォーム入力を参考に、${email} 様からの「${category}」に関するお問い合わせへ日本語で丁寧な回答メールを作成してください。\n\n`;
  Object.entries(kvPairs).forEach(([k, v]) => {
    prompt += `${k}: ${v}\n`;
  });
  if (DEBUG) Logger.log('[3] prompt(抜粋)\n' + prompt.slice(0, 300) + '...');

  const difyApiKey = PropertiesService.getScriptProperties().getProperty(API_CONFIG.DIFY_API_KEY_PROPERTY);
  const payload = {
    inputs: { category, form_data: JSON.stringify(kvPairs) },
    query: prompt,
    user: email,
    response_mode: 'blocking'
  };

  if (DEBUG) Logger.log('[4] payload\n' + JSON.stringify(payload, null, 2));

  let res, body, replyText;
  try {
    res = UrlFetchApp.fetch(API_CONFIG.DIFY_BASE_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + difyApiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    body = JSON.parse(res.getContentText() || '{}');
    replyText = (body?.data?.outputs?.output) ?? '自動生成に失敗しました。';

    if (DEBUG) {
      Logger.log(`[5] HTTP ${res.getResponseCode()}`);
      Logger.log('[5] response body\n' + JSON.stringify(body, null, 2));
    }
  } catch (err) {
    Logger.log('[5] fetch error\n' + err);
    replyText = '自動生成に失敗しました。（API エラー）';
  }

  GmailApp.createDraft(
    email,
    EMAIL_CONFIG.SUBJECT,
    replyText
  );
  if (DEBUG) Logger.log('[6] Draft 作成完了: ' + email);
}