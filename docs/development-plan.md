# NoLang Bot 開発計画・実装方針

## 🎯 プロジェクト概要

NoLangのサポート問い合わせを自動化するRAGベースのAIチャットボット。
FAQ、Notion、Googleスプレッドシート、メールに散在する情報を統合し、リアルタイムでの質疑応答を実現。

## 📊 現在の状況

### ✅ 実装済み機能
- Google Sheets連携でのFAQデータ読み込み
- OpenAI Embedding + scikit-learn NearestNeighbors による検索
- FastAPI WebサーバーとHTML UI
- 質問・回答のレスポンス生成
- タグベースの担当者振り分け

### 🔧 技術スタック
- **Backend**: FastAPI + Python 3.12
- **AI/ML**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **Search**: scikit-learn NearestNeighbors (コサイン類似度)
- **Data**: Google Sheets API, JSON metadata
- **Packaging**: Poetry

## 🚀 今後の実装優先順位

### Phase 1: データレイク整備（最優先）
**目標**: 散在するデータソースの統合と構造化

#### 1.1 データソース拡張
- [ ] **Gmail API連携**: メール履歴の自動収集
- [ ] **Notion API連携**: ドキュメント情報の取得
- [ ] **Webスクレイピング**: FAQ更新の自動検知
- [ ] **CSVインポート機能**: レガシーデータの取り込み

#### 1.2 データ前処理パイプライン
- [ ] **自動データクリーニング**: 重複除去、フォーマット統一
- [ ] **情報抽出**: メールから問い合わせ内容・回答を構造化
- [ ] **カテゴリ自動分類**: AI による FAQ のタグ付け
- [ ] **更新検知システム**: データソース変更の自動反映

```python
# 実装イメージ: データソース統合
class DataIntegrationPipeline:
    def __init__(self):
        self.sources = {
            'sheets': GoogleSheetsLoader(),
            'gmail': GmailLoader(),
            'notion': NotionLoader(),
            'web': WebScrapingLoader()
        }
    
    def sync_all_sources(self):
        for source_name, loader in self.sources.items():
            data = loader.fetch_latest()
            processed_data = self.preprocess(data)
            self.update_knowledge_base(processed_data)
```

### Phase 2: RAG性能向上（高優先度）

#### 2.1 検索精度改善
- [ ] **Hybrid Search**: BM25 + Embedding による検索の組み合わせ
- [ ] **Reranking**: クロスエンコーダーによる検索結果の再ランキング
- [ ] **Semantic Chunking**: コンテキストを考慮した文書分割
- [ ] **Query Expansion**: 同義語・関連語による検索クエリ拡張

#### 2.2 高度なRAG手法
- [ ] **RAG-Fusion**: 複数の検索クエリを生成して統合
- [ ] **CRAG (Corrective RAG)**: 検索結果の品質評価と補正
- [ ] **Self-RAG**: 生成結果の自己評価と改善
- [ ] **Graph RAG**: ナレッジグラフを活用した関連情報検索

```python
# 実装イメージ: Hybrid Search
class HybridSearchEngine:
    def __init__(self):
        self.embedding_search = EmbeddingSearch()
        self.keyword_search = BM25Search()
        self.reranker = CrossEncoderReranker()
    
    def search(self, query: str, k: int = 10):
        # 複数手法で検索
        embedding_results = self.embedding_search.search(query, k*2)
        keyword_results = self.keyword_search.search(query, k*2)
        
        # 結果統合とリランキング
        combined_results = self.combine_results(embedding_results, keyword_results)
        return self.reranker.rerank(query, combined_results, k)
```

### Phase 3: Gmail直接連携（中優先度）

#### 3.1 メール自動処理
- [ ] **リアルタイムメール処理**: Gmail Webhook での新着メール検知
- [ ] **自動回答生成**: 問い合わせメールへの自動返信
- [ ] **エスカレーション**: 複雑な問い合わせの人間担当者への転送
- [ ] **メール履歴管理**: 過去のやり取りを考慮した回答生成

#### 3.2 外部サービス検討
- **LangChain**: RAGパイプライン構築
- **Zapier/Make**: 外部サービス連携の自動化

### Phase 4: 分析・改善機能（中優先度）

#### 4.1 リアルタイム分析
- [ ] **問い合わせ分析ダッシュボード**: 頻出質問、トレンド分析
- [ ] **回答品質評価**: ユーザーフィードバック収集・分析
- [ ] **Performance Monitoring**: レスポンス時間、成功率の監視
- [ ] **A/B Testing**: プロンプト・検索手法の比較テスト

#### 4.2 継続的改善
- [ ] **フィードバックループ**: ユーザー評価による学習データ更新
- [ ] **自動再学習**: 新しいデータでの定期的なモデル更新
- [ ] **異常検知**: 回答品質低下の早期発見

## 🏗️ アーキテクチャ設計

### 目標アーキテクチャ
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  データソース    │    │   データレイク    │    │   AI処理エンジン │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Gmail API     │───▶│ • Raw Data Store │───▶│ • Hybrid Search │
│ • Google Sheets │    │ • Processed Data │    │ • RAG Engine    │
│ • Notion API    │    │ • Vector Store   │    │ • LLM Router    │
│ • Web Scraping  │    │ • Metadata DB    │    │ • Quality Check │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                       │
                        ┌──────────────────┐    ┌─────────────────┐
                        │   API Gateway    │    │   分析システム   │
                        ├──────────────────┤    ├─────────────────┤
                        │ • FastAPI        │    │ • Analytics DB  │
                        │ • Rate Limiting  │    │ • Dashboard     │
                        │ • Authentication │    │ • Monitoring    │
                        │ • Load Balancer  │    │ • Alerting      │
                        └──────────────────┘    └─────────────────┘
```

### データベース設計
```sql
-- 問い合わせ履歴
CREATE TABLE inquiries (
    id UUID PRIMARY KEY,
    user_email VARCHAR(255),
    question TEXT,
    answer TEXT,
    confidence_score FLOAT,
    sources JSON,
    created_at TIMESTAMP,
    feedback_score INTEGER
);

-- ナレッジベース
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY,
    source_type VARCHAR(50),  -- 'gmail', 'sheets', 'notion'
    source_id VARCHAR(255),
    content TEXT,
    metadata JSON,
    embedding VECTOR(1536),
    tags TEXT[],
    updated_at TIMESTAMP
);
```

## 🔧 開発環境・ツール整備

### 開発フロー改善
- [ ] **Pre-commit hooks**: ruff, pytest の自動実行
- [ ] **CI/CD Pipeline**: GitHub Actions での自動テスト・デプロイ
- [ ] **Docker Compose**: 開発環境の統一
- [ ] **環境管理**: 開発・ステージング・本番環境の分離

### モニタリング・ログ
- [ ] **構造化ログ**: JSON形式でのログ出力
- [ ] **メトリクス収集**: Prometheus + Grafana
- [ ] **分散トレーシング**: 処理フローの可視化
- [ ] **エラー監視**: Sentry による例外追跡

### テスト戦略
- [ ] **ユニットテスト**: 各機能の個別テスト
- [ ] **統合テスト**: API エンドポイントのテスト
- [ ] **パフォーマンステスト**: 負荷テストとベンチマーク
- [ ] **品質テスト**: 回答精度の自動評価

## 📚 ドキュメント体系

### 技術ドキュメント
- [ ] **API仕様書**: OpenAPI/Swagger
- [ ] **アーキテクチャドキュメント**: システム設計詳細
- [ ] **データスキーマ**: データベース・API スキーマ
- [ ] **運用手順書**: デプロイ・トラブルシューティング

### 開発者向けドキュメント
- [ ] **セットアップガイド**: 環境構築手順
- [ ] **コントリビューションガイド**: 開発フロー・コーディング規約
- [ ] **FAQ**: よくある質問・トラブル対応
- [ ] **パフォーマンス指標**: ベンチマーク結果・改善目標

## 🎯 成功指標 (KPI)

### 技術指標
- **回答精度**: 85%以上（ユーザー評価ベース）
- **レスポンス時間**: 3秒以内
- **システム稼働率**: 99.9%以上
- **データ更新頻度**: 1日1回以上

### ビジネス指標
- **問い合わせ自動解決率**: 70%以上
- **顧客満足度**: 4.5/5.0以上
- **サポート工数削減**: 50%以上
- **初回解決率**: 80%以上

## 🔄 実装スケジュール

### Phase 1 (2-3週間)
1. Gmail API連携開発
2. データ前処理パイプライン構築
3. 既存データのクリーニング・統合

### Phase 2 (3-4週間)
1. Hybrid Search実装
2. RAG手法の改善・評価
3. パフォーマンス最適化

### Phase 3 (2-3週間)
1. メール自動処理機能
2. 分析ダッシュボード開発
3. 監視・アラート機能

### Phase 4 (継続)
1. 継続的改善・調整
2. 新機能追加
3. ドキュメント整備

## 🤝 引き継ぎ計画

### 知識移転
- [ ] **技術セッション**: システム全体のウォークスルー
- [ ] **ハンズオン**: 実際の開発・運用作業の体験
- [ ] **質疑応答**: 開発背景・設計判断の共有

### 段階的移行
1. **共同開発期間**: 2-3週間のペアプログラミング
2. **監督期間**: レビュアーとしてのサポート
3. **完全移行**: 定期的なメンタリング継続

このドキュメントは、@kiri さんとの相談結果を反映して随時更新していく予定です。 