// スプレッドシートID
export const SPREADSHEET_IDS = {
  FORM: '1-zZy350KIQHnKEVDk3uESd7Oy0K6HXGQxVI42UfbPO4',
  TICKET: '1bYsMZiqyHW_fpqf7M4ID6BNXfA2H8Np4TLtc-YsYqoo',
  MESSAGES: '1fGQioIEa-13QBpURSmPwZGEKrJXaxNAhQ2LQUwvzUbc'
} as const;

// シート名
export const SHEET_NAMES = {
  FORM_RESPONSES: 'フォームの回答 2',
  TICKETS: 'TICKETS',
  CONTACTS: 'CONTACTS'
} as const;

// Gmail設定
export const GMAIL_CONFIG = {
  EXCLUDE_LABEL: 'スプレッドシート',
  LOGGED_LABEL: 'Logged',
  MAX_THREADS: 400,
  MAX_MSG_PER_THREAD: 6
} as const;

// API設定
export const API_CONFIG = {
  DIFY_BASE_URL: 'https://api.dify.ai/v1/workflows/run',
  DIFY_API_KEY_PROPERTY: 'DIFY_API_KEY'
} as const;

// メール設定
export const EMAIL_CONFIG = {
  SUBJECT: '【NoLangサポート】お問い合わせありがとうございます'
} as const; 