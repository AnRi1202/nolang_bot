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
make test          # テスト実行
make clean         # 一時ファイル削除
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
make dev           # 開発環境セットアップ (install + format + lint-fix + test)
make ci            # CI環境テスト (install + lint + test)
make check         # コミット前チェック (format + lint + test)
```

## 🏗️ プロジェクト構造

```
nolang-bot/
├── docs/                    # ドキュメント
│   ├── developer-guide.md   # 開発者ガイド
│   ├── development-plan.md  # 開発計画
│   └── api-spec.md         # API仕様書
├── src/                     # ソースコード (将来的に移行予定)
├── tests/                   # テストコード
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
├── Makefile                # Make設定
├── Dockerfile              # Docker設定
├── docker-compose.yml      # Docker Compose設定
└── README.md               # プロジェクト概要
```

## 🔧 開発環境設定

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
    "ruff.enable": true,
    "ruff.organizeImports": true
}
```

### Pre-commit hooks 設定

```bash
# pre-commit インストール
pip install pre-commit

# フックをインストール
pre-commit install

# 手動実行
pre-commit run --all-files
```

`.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.8
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: local
    hooks:
      - id: pytest
        name: pytest
        entry: make test
        language: system
        pass_filenames: false
```

## 🧪 テスト

### テスト実行
```bash
# 全テスト実行
make test

# 特定のテストファイル
poetry run pytest tests/test_server.py -v

# カバレッジ付きテスト
poetry run pytest --cov=. --cov-report=html

# パフォーマンステスト
poetry run pytest tests/test_performance.py -v
```

### テスト構造
```
tests/
├── unit/                   # ユニットテスト
│   ├── test_embed.py      # 埋め込み機能テスト
│   ├── test_loader.py     # ローダーテスト
│   └── test_server.py     # サーバーテスト
├── integration/           # 統合テスト
│   ├── test_api.py       # API統合テスト
│   └── test_pipeline.py  # パイプラインテスト
├── performance/           # パフォーマンステスト
│   └── test_benchmark.py # ベンチマークテスト
└── fixtures/              # テストデータ
    ├── sample_faq.json   # サンプルFAQ
    └── mock_responses.py # モックレスポンス
```

## 🔌 API 開発

### エンドポイント追加例

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["新機能"])

class NewRequest(BaseModel):
    param: str

class NewResponse(BaseModel):
    result: str

@router.post("/new-endpoint", response_model=NewResponse)
async def new_endpoint(request: NewRequest):
    try:
        # 処理ロジック
        result = process_request(request.param)
        return NewResponse(result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# server.py でルーター登録
app.include_router(router)
```

### API テスト

```python
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_new_endpoint():
    response = client.post(
        "/api/v1/new-endpoint",
        json={"param": "test_value"}
    )
    assert response.status_code == 200
    assert response.json()["result"] == "expected_result"
```

## 📊 データ処理

### 新しいデータソース追加

1. **ローダークラス作成**:
```python
# loaders/new_source_loader.py
from typing import List, Dict
import pandas as pd

class NewSourceLoader:
    def __init__(self, config: Dict):
        self.config = config
    
    def load_data(self) -> pd.DataFrame:
        """新しいデータソースからデータを読み込み"""
        # 実装
        pass
    
    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """データの前処理"""
        # 実装
        pass
```

2. **メインローダーに統合**:
```python
# loader.py に追加
from loaders.new_source_loader import NewSourceLoader

def load_from_new_source() -> pd.DataFrame:
    loader = NewSourceLoader(config)
    raw_data = loader.load_data()
    return loader.preprocess(raw_data)
```

### 埋め込み処理のカスタマイズ

```python
# embed.py の拡張例
def embed_with_custom_model(texts: List[str], model: str = "text-embedding-3-large"):
    """カスタムモデルでの埋め込み生成"""
    # 実装
    pass

def build_hybrid_index(texts: List[str], metadata: List[Dict]):
    """Hybrid Search用のインデックス構築"""
    # BM25 + Embedding の組み合わせ
    pass
```

## 🐳 Docker 開発

### 開発用 Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - ~/.cache/pypoetry:/root/.cache/pypoetry
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DEVELOPMENT=true
    ports:
      - "8000:8000"
    command: poetry run uvicorn server:app --reload --host 0.0.0.0
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: nolang_bot
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Docker コマンド

```bash
# 開発環境起動
docker-compose -f docker-compose.dev.yml up

# ログ確認
docker-compose logs -f app

# コンテナ内でコマンド実行
docker-compose exec app make test

# クリーンアップ
docker-compose down -v
```

## 🔍 デバッグ・トラブルシューティング

### よくある問題と解決方法

#### 1. OpenAI API エラー
```bash
# API キー確認
echo $OPENAI_API_KEY

# API クォータ確認
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/usage
```

#### 2. 依存関係の問題
```bash
# Poetry環境リセット
rm poetry.lock
rm -rf .venv
make dev-install
```

#### 3. ベクトルインデックスの問題
```bash
# インデックス再構築
rm -f nn_model.pkl metadata.json
python embed.py
```

### ログ設定

```python
# logging_config.py
import logging
import sys

def setup_logging(level: str = "INFO"):
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('app.log')
        ]
    )
```

## 🚀 デプロイ

### 本番環境デプロイ

```bash
# 1. 環境変数設定
export OPENAI_API_KEY="prod-api-key"
export DATABASE_URL="postgresql://..."

# 2. 依存関係インストール
make install

# 3. データベースマイグレーション (将来)
# alembic upgrade head

# 4. インデックス構築
python embed.py

# 5. サーバー起動
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

### Nginx 設定例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📈 パフォーマンス最適化

### プロファイリング

```bash
# プロファイル実行
poetry run python -m cProfile -o profile.stats server.py

# 結果分析
poetry run python -m pstats profile.stats
```

### メモリ使用量監視

```python
import psutil
import tracemalloc

# メモリトレース開始
tracemalloc.start()

# 処理実行後
current, peak = tracemalloc.get_traced_memory()
print(f"Current memory usage: {current / 1024 / 1024:.1f} MB")
print(f"Peak memory usage: {peak / 1024 / 1024:.1f} MB")
```

## 🤝 コントリビューション

### ブランチ戦略
- `main`: 本番環境用ブランチ
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発ブランチ
- `hotfix/*`: 緊急修正ブランチ

### プルリクエストワークフロー

1. **機能ブランチ作成**:
```bash
git checkout -b feature/new-feature develop
```

2. **開発・テスト**:
```bash
make dev
make check
```

3. **プルリクエスト作成**: GitHub で PR 作成

4. **レビュー・マージ**: レビュー承認後、`develop` にマージ

### コミットメッセージ規約

```
type(scope): subject

body

footer
```

例:
```
feat(api): add new search endpoint

- Add hybrid search functionality
- Implement BM25 + embedding combination
- Add comprehensive tests

Closes #123
```

このガイドは継続的に更新され、チーム全体の開発効率向上を目指します。 