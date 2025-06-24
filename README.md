# 🤖 NoLang Support Bot

NoLangのサポート問い合わせに自動対応するRAG（Retrieval-Augmented Generation）ベースのチャットボットです。

## 🏗️ アーキテクチャ

```
Google Sheets → Data Loader → Embedding → FAISS Vector Search → LLM → 回答生成
     ↓              ↓           ↓              ↓             ↓         ↓
  FAQ データ    loader.py    embed.py    FAISSインデックス  OpenAI   FastAPI
```

## 🚀 特徴

- **RAGベースの正確な回答**: FAQ データベースに基づいた正確な情報提供
- **Google Sheets連携**: 簡単にFAQデータを管理・更新
- **スマートな連絡先案内**: 質問の内容に応じて適切な担当者を案内
- **Webインターフェース**: ブラウザから直接利用可能
- **RESTful API**: 外部システムとの連携も可能

## 📋 必要な環境

- Python 3.12+
- Poetry (パッケージ管理)
- OpenAI API キー
- Google Service Account (Google Sheets アクセス用)

## 🛠️ セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
# 依存関係をインストール
poetry install
```

### 2. 環境変数の設定

#### 方法1: 環境変数として設定

```bash
# OpenAI API キーを設定
export OPENAI_API_KEY="your-openai-api-key-here"
```

#### 方法2: .env ファイルを使用（推奨）

1. `.env.example` ファイルを参考に `.env` ファイルを作成：

```bash
# .env ファイルを作成
cp .env.example .env
```

2. `.env` ファイルを編集して実際の値を設定：

```env
# OpenAI API Key (必須)
# https://platform.openai.com/api-keys から取得
OPENAI_API_KEY=your-openai-api-key-here

# Google Sheets ID (オプション - 現在はハードコード済み)
# カスタムスプレッドシートを使用する場合のみ設定
# SPREADSHEET_ID=your-spreadsheet-id-here

# データベース設定 (Docker Compose使用時)
POSTGRES_PASSWORD=example
POSTGRES_DB=nolang_bot
POSTGRES_USER=postgres

# アプリケーション設定
PYTHONPATH=/opt/nolang-bot
PYTHONUNBUFFERED=1
```

**注意**: `.env` ファイルは `.gitignore` に含まれているため、GitHubにアップロードされません。

### 3. Google Service Account の設定 (オプション)

実際のGoogle Sheetsを使用する場合：

1. Google Cloud Console でプロジェクトを作成
2. Google Sheets API を有効化
3. Service Account を作成し、JSONキーをダウンロード
4. `sa.json` として保存
5. Google Sheets にService Accountのメールアドレスを共有

### 4. セットアップスクリプトの実行

```bash
# セットアップスクリプトを実行
python setup.py
```

または手動で実行：

```bash
# 1. サンプルデータでインデックスを構築
python embed.py

# 2. サーバーを起動
python server.py
```

## 🌐 使用方法

### Web インターフェース

1. サーバーを起動後、ブラウザで `http://localhost:8000` にアクセス
2. 質問を入力して「質問する」ボタンをクリック
3. AIが関連する情報を検索して回答を生成

### API エンドポイント

#### POST /ask
質問に対して回答を生成

```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "NoLangとはなんですか？",
    "email": "user@example.com"
  }'
```

#### GET /health
サーバーの健康状態を確認

```bash
curl http://localhost:8000/health
```

## 📁 ファイル構成

```
nolang-bot/
├── loader.py          # Google Sheets データローダー
├── embed.py           # 埋め込みベクトル生成・FAISSインデックス構築
├── server.py          # FastAPI サーバー
├── setup.py           # セットアップスクリプト
├── pyproject.toml     # Poetry 設定
├── README.md          # このファイル
├── sa.json            # Google Service Account キー (作成が必要)
├── faiss.index        # FAISSベクトルインデックス (自動生成)
└── metadata.json      # FAQ メタデータ (自動生成)
```

## 🎯 FAQ データの形式

Google Sheets には以下の列が必要です：

| 列名 | 説明 | 必須 |
|------|------|------|
| Question | 質問文 | ✅ |
| Answer | 回答文 | ✅ |
| Tag | カテゴリタグ | ✅ |
| UpdatedAt | 更新日時 | ✅ |
| GmailAddress | 担当者メールアドレス | ❌ |

### サンプルデータ

| Question | Answer | Tag | UpdatedAt | GmailAddress |
|----------|--------|-----|-----------|--------------|
| NoLangとはなんですか？ | NoLangは自然言語でプログラミングができる革新的な開発環境です。 | 基本情報 | 2024-01-01 | info@nolang.ai |
| 料金はいくらですか？ | 現在ベータ版で無料です。 | 料金 | 2024-01-01 | billing@nolang.ai |

## 🔧 カスタマイズ

### 1. プロンプトの調整

`server.py` の `generate_answer` 関数内の `sys_prompt` を編集

### 2. 検索パラメータの調整

`server.py` の `retrieve` 関数の `k` パラメータで検索結果数を調整

### 3. 埋め込みモデルの変更

`embed.py` の `model` パラメータを変更（例：`text-embedding-3-large`）

## 🐳 Docker での実行

```bash
# Docker イメージをビルド
docker build -t nolang-bot .

# コンテナを起動
docker run -p 8000:8000 \
  -e OPENAI_API_KEY="your-api-key" \
  nolang-bot
```

## 🔍 トラブルシューティング

### よくある問題

1. **OpenAI API エラー**
   - API キーが正しく設定されているか確認
   - API クォータを確認

2. **Google Sheets アクセスエラー**
   - `sa.json` ファイルが存在するか確認
   - Service Account にシートへのアクセス権限があるか確認

3. **インデックスが見つからない**
   - `python embed.py` を実行してインデックスを作成

4. **依存関係エラー**
   - `poetry install` を実行

## 🚀 デプロイ

### 本番環境での起動

```bash
# Uvicorn で本番モード起動
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

### 環境変数

```bash
export OPENAI_API_KEY="your-api-key"
export SPREADSHEET_ID="your-spreadsheet-id"
export HOST="0.0.0.0"
export PORT="8000"
```

## 📈 今後の拡張予定

- [ ] ユーザー認証機能
- [ ] 会話履歴の保存
- [ ] 多言語対応
- [ ] 画像・ファイル添付対応
- [ ] Slack/Discord 連携
- [ ] 分析ダッシュボード

## 🤝 貢献

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 ライセンス

This project is licensed under the MIT License.

## 📞 サポート

質問やサポートが必要な場合は、以下にお問い合わせください：

- 技術的な問題: tech@nolang.ai
- 一般的な問い合わせ: support@nolang.ai

