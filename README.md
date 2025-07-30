# 🤖 NoLang Support Bot

NoLangのサポート問い合わせに自動対応するGoogle Apps Scriptベースのチャットボットです。

## 🚀 特徴

- **Google Apps Script**: Google SheetsとGmailの自動連携
- **自動メッセージ処理**: Gmailの受信メッセージを自動でスプレッドシートに記録
- **チケット管理**: 問い合わせをチケットとして管理
- **フォーム連携**: Google Formsからの問い合わせを自動処理

## 🛠️ セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Google Apps Script の設定

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. 以下のファイルをアップロード：
   - `dist/onFormSubmit.js`
   - `dist/updateContactMessage.js`
   - `dist/updateTicket.js`
   - `dist/uploadMessagesToDifyAsCsv.js`
   - `dist/appsscript.json`

### 3. スプレッドシートの設定

以下のシートを作成：
- **CONTACTS**: 連絡先情報
- **MESSAGES**: メッセージ履歴
- **TICKETS**: チケット管理

## 🌐 使用方法

### Google Apps Script の実行

1. `updateContactMessage()` 関数を実行してGmailメッセージを処理
2. `updateTicket()` 関数を実行してチケットを更新
3. Google Formsの送信時に `onFormSubmit()` が自動実行

### 手動実行

```bash
# TypeScriptファイルをコンパイル
make ts-compile

# Google Apps Scriptにプッシュ
make clasp-push
```

## 📁 ファイル構成

```
nolang-bot/
├── ts/                    # TypeScriptソースファイル
├── dist/                  # コンパイル済みJavaScriptファイル
│   ├── onFormSubmit.js
│   ├── updateContactMessage.js
│   ├── updateTicket.js
│   ├── uploadMessagesToDifyAsCsv.js
│   └── appsscript.json
├── docs/                  # ドキュメント
└── Makefile              # ビルドスクリプト
```

## 🎯 機能

### メッセージ処理
- Gmailの受信メッセージを自動でスプレッドシートに記録
- 連絡先情報の自動更新
- チケットとの自動紐付け

### フォーム処理
- Google Formsからの問い合わせを自動処理
- スプレッドシートへの自動記録

## 🐳 Docker での開発

```bash
# 開発環境の起動
docker-compose up

# コンテナ内で作業
docker-compose exec app bash
```

## 🔍 トラブルシューティング

- **Clasp認証エラー**: `make clasp-login` を実行
- **TypeScriptコンパイルエラー**: `make ts-compile` を実行
- **Google Apps Scriptエラー**: 権限設定を確認

## 📄 ライセンス

MIT License

