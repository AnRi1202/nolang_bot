# NoLang Bot 開発者ガイド

## 🚀 クイックスタート

### 必要な環境
- Python 3.12+
- Poetry 1.7+
- Git
- Docker (オプション)

### セットアップ手順

```bash
# 1. リポジトリクローン
git clone <repository_url>
cd nolang-bot

# 2. 依存関係インストール
make dev-install

# 3. 環境変数設定
export OPENAI_API_KEY="your-openai-api-key"
export SPREADSHEET_ID="your-google-sheets-id"  # オプション

# 4. データベース初期化
make setup

# 5. サーバー起動
make run
```

## 📋 Make コマンド一覧

### 基本コマンド
```bash
make help          # 利用可能なコマンドを表示
make install       # 本番環境用パッケージをインストール
make dev-install   # 開発環境用パッケージをインストール
```

### 開発・品質管理
```bash
make format        # コードフォーマット (ruff format)
make lint          # コード検査 (ruff check)
make lint-fix      # コード検査＋自動修正
make clean         # 一時ファイル削除
make ts-compile    # TypeScriptをJavaScriptにコンパイル
make ts-watch      # TypeScriptファイルの変更を監視して自動コンパイル
```

### 実行・デプロイ
```bash
make run           # 開発サーバー起動
make run-uvicorn   # Uvicornでサーバー起動
make build         # パッケージビルド
make docker-build  # Dockerイメージビルド
make docker-run    # Docker Composeで起動
```

### 開発ワークフロー
```bash
make dev           # 開発環境セットアップ (install + format + lint-fix)
make ci            # CI環境テスト (install + lint)
make check         # コミット前チェック (format + lint)
```

## 🏗️ プロジェクト構造

```
nolang-bot/
├── docs/                    # ドキュメント
│   ├── developer-guide.md   # 開発者ガイド
│   ├── development-plan.md  # 開発計画
│   └── api-spec.md         # API仕様書
├── src/                     # ソースコード (将来的に移行予定)
├── ts/                      # TypeScriptファイル
│   ├── backfillTicketsFromForms.ts
│   ├── logInboxEmails.ts
│   └── TicketsForm.ts
├── js/                      # コンパイル済みJavaScriptファイル
├── scripts/                 # ユーティリティスクリプト
├── config/                  # 設定ファイル
├── data/                    # データファイル
│   ├── raw/                # 生データ
│   ├── processed/          # 処理済みデータ
│   └── models/             # 学習済みモデル
├── server.py               # FastAPIサーバー
├── embed.py                # 埋め込み処理
├── loader.py               # データローダー
├── setup.py                # セットアップスクリプト
├── test_cli.py             # CLIテスト
├── pyproject.toml          # Poetry設定
├── tsconfig.json           # TypeScript設定
├── package.json            # Node.js依存関係
├── Makefile                # Make設定
├── Dockerfile              # Docker設定
├── docker-compose.yml      # Docker Compose設定
└── README.md               # プロジェクト概要
```

## 🔧 開発環境設定

### TypeScript/JavaScript 開発

#### TypeScriptコンパイル方法

1. **TypeScriptコンパイラ（tsc）を使用**:
```bash
# 単一ファイルのコンパイル
npx tsc ts/backfillTicketsFromForms.ts --outDir js --target es2015 --module commonjs

# 全TypeScriptファイルをコンパイル
npx tsc --outDir js --target es2015 --module commonjs

# 監視モード（ファイル変更時に自動コンパイル）
npx tsc --outDir js --target es2015 --module commonjs --watch
```

2. **tsconfig.json設定例**:
```json
{
  "compilerOptions": {
    "target": "es2015",
    "module": "commonjs",
    "outDir": "./js",
    "rootDir": "./ts",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["ts/**/*"],
  "exclude": ["node_modules", "js"]
}
```

3. **Makefileに追加するコマンド**:
```makefile
ts-compile:
	npx tsc --outDir js --target es2015 --module commonjs

ts-watch:
	npx tsc --outDir js --target es2015 --module commonjs --watch

ts-clean:
	rm -rf js/*.js js/*.d.ts js/*.js.map
```

#### Google Apps Script用の変換

Google Apps Scriptで使用する場合の変換例:
```bash
# Google Apps Script用にコンパイル（ES3互換）
npx tsc ts/backfillTicketsFromForms.ts --target es3 --module none --outDir gs

# または、手動でJavaScriptに変換
# 1. 型定義を削除
# 2. import/export文を削除
# 3. インターフェースを削除
# 4. 型注釈を削除
```

### VS Code 設定 (推奨)

`.vscode/settings.json`:
```json
{
    "python.defaultInterpreterPath": ".venv/bin/python",
    "python.formatting.provider": "none",
    "[python]": {
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
            "source.fixAll": true,
            "source.organizeImports": true
        }
    },
    "[typescript]": {
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
            "source.fixAll": true,
            "source.organizeImports": true
        }
    },
    "ruff.enable": true,
    "ruff.organizeImports": true,
    "typescript.preferences.importModuleSpecifier": "relative"
}
```

