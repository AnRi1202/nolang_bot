# 🤖 NoLang Support Bot

NoLangのサポート問い合わせに自動対応するRAGベースのチャットボットです。

## 🚀 特徴

- **RAGベースの正確な回答**: FAQデータベースに基づいた正確な情報提供
- **Google Sheets連携**: 簡単にFAQデータを管理・更新
- **Webインターフェース**: ブラウザから直接利用可能
- **RESTful API**: 外部システムとの連携も可能

## 🛠️ セットアップ

### 1. 依存関係のインストール

```bash
poetry install
```

### 2. 環境変数の設定

`.env`ファイルを作成：

```env
OPENAI_API_KEY=your-openai-api-key-here
```

### 3. サーバー起動

```bash
python embed.py  # インデックス構築
python server.py # サーバー起動
```

## 🌐 使用方法

### Web インターフェース

1. ブラウザで `http://localhost:8000` にアクセス
2. 質問を入力して「質問する」ボタンをクリック

### API エンドポイント

```bash
# 質問を送信
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "NoLangとはなんですか？", "email": "user@example.com"}'

# 健康状態確認
curl http://localhost:8000/health
```

## 📁 ファイル構成

```
nolang-bot/
├── loader.py          # Google Sheets データローダー
├── embed.py           # 埋め込みベクトル生成・FAISSインデックス構築
├── server.py          # FastAPI サーバー
├── setup.py           # セットアップスクリプト
├── ts/                # TypeScriptファイル（Google Apps Script用）
└── dist/              # コンパイル済みJavaScriptファイル
```

## 🎯 FAQ データの形式

Google Sheets には以下の列が必要です：

| 列名 | 説明 | 必須 |
|------|------|------|
| Question | 質問文 | ✅ |
| Answer | 回答文 | ✅ |
| Tag | カテゴリタグ | ✅ |
| UpdatedAt | 更新日時 | ✅ |

## 🐳 Docker での実行

```bash
docker build -t nolang-bot .
docker run -p 8000:8000 -e OPENAI_API_KEY="your-api-key" nolang-bot
```

## 🔍 トラブルシューティング

- **OpenAI API エラー**: API キーが正しく設定されているか確認
- **インデックスが見つからない**: `python embed.py` を実行
- **依存関係エラー**: `poetry install` を実行

## 📄 ライセンス

MIT License

