#!/usr/bin/env python3
"""
NoLang Support Bot CLIテストツール

サーバーを起動せずに、直接RAGシステムをテストできます。
メール文の生成まで行います。

使用方法:
    python test_cli.py "質問内容"
    python test_cli.py "動画が削除できません" --email "user@example.com" --inquiry-type "NoLang の不具合"
"""

import argparse
import sys
import json
from pathlib import Path
import pickle
import pandas as pd
from openai import OpenAI
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from tqdm import tqdm

from embed import embed_texts
from loader import get_contact_info_by_tag, INQUIRY_TYPE_MAPPING

# OpenAI client
CLIENT = OpenAI()

class RAGSystem:
    def __init__(self):
        self.model = None
        self.metadata = None
        self.vectors = None
        self.load_models()
    
    def load_models(self):
        """モデルとメタデータを読み込み"""
        try:
            # NearestNeighborsモデルを読み込み
            with open("nn_model.pkl", "rb") as f:
                model_data = pickle.load(f)
                self.model = model_data["model"]
                self.vectors = model_data["vectors"]
            
            # メタデータを読み込み
            with open("metadata.json", "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            
            print(f"✅ モデルロード完了: {len(self.metadata)}件のデータ")
            
        except FileNotFoundError:
            print("❌ モデルファイルが見つかりません。python embed.py を実行してください。")
            sys.exit(1)
    
    def search(self, query: str, k: int = 5) -> list[dict]:
        """類似検索を実行"""
        if not self.model or not self.metadata:
            return []
        
        try:
            # クエリを埋め込みベクトルに変換
            query_vectors = embed_texts([query])
            query_vector = np.array(query_vectors[0]).reshape(1, -1)
            
            # 類似検索
            distances, indices = self.model.kneighbors(query_vector, n_neighbors=min(k, len(self.metadata)))
            
            results = []
            for i, idx in enumerate(indices[0]):
                result = self.metadata[idx].copy()
                result["similarity"] = 1 - distances[0][i]  # 距離を類似度に変換
                results.append(result)
            
            return results
            
        except Exception as e:
            print(f"❌ 検索エラー: {e}")
            return []
    
    def find_similar_cases_by_tag(self, tag: str, k: int = 3) -> list[dict]:
        """タグに基づいて関連する過去の事例を検索"""
        similar_cases = []
        for item in self.metadata:
            if item.get("Tag") == tag:
                similar_cases.append({
                    "question": item.get("Question", ""),
                    "answer": item.get("Answer", ""),
                    "date": item.get("UpdatedAt", ""),
                    "status": item.get("Status", "未対応"),
                    "original_email": item.get("OriginalEmail", "")
                })
        
        # 最新の事例を優先
        similar_cases.sort(key=lambda x: x.get("date", ""), reverse=True)
        return similar_cases[:k]
    
    def generate_response(self, question: str, contexts: list[dict], user_email: str = None, inquiry_type: str = None) -> dict:
        """回答とメール文を生成"""
        if not contexts:
            return {
                "answer": "申し訳ございませんが、関連する情報が見つかりませんでした。",
                "suggested_contact": "support@nolang.ai",
                "assigned_team": "一般サポート",
                "email_draft": ""
            }
        
        # 最も関連性の高いコンテキストのタグを取得
        primary_tag = contexts[0].get("Tag", "一般問い合わせ")
        contact_info = get_contact_info_by_tag(primary_tag)
        
        # 同じタグの過去事例を検索
        similar_cases = self.find_similar_cases_by_tag(primary_tag)
        
        # 回答を生成
        answer = self._generate_answer(question, contexts, similar_cases, contact_info, user_email, inquiry_type)
        
        # メール文を生成
        email_draft = self._generate_email_draft(question, contexts, similar_cases, contact_info, user_email, inquiry_type)
        
        return {
            "answer": answer,
            "contexts": contexts,
            "suggested_contact": contact_info["email"], 
            "assigned_team": contact_info["担当者"],
            "related_cases": similar_cases,
            "email_draft": email_draft,
            "primary_tag": primary_tag
        }
    
    def _generate_answer(self, question: str, contexts: list[dict], similar_cases: list[dict], contact_info: dict, user_email: str, inquiry_type: str) -> str:
        """回答を生成"""
        context_block = "\n\n".join(
            f"Q: {c['Question']}\nA: {c['Answer']}\nタグ: {c.get('Tag', 'N/A')}" 
            for c in contexts[:3]
        )
        
        past_cases_info = ""
        if similar_cases:
            past_cases_info = "\n\n### 関連する過去の対応事例:\n"
            for case in similar_cases[:2]:
                past_cases_info += f"- {case['question'][:50]}... (対応状況: {case['status']})\n"
        
        sys_prompt = f"""あなたはNoLangのサポートAIです。
ユーザーの質問には **以下のコンテキストの範囲内で忠実に** 日本語で答えてください。

問い合わせタグ: {contexts[0].get('Tag', '一般問い合わせ')}
担当部署: {contact_info['担当者']}

重要なルール:
1. コンテキストと過去事例に基づいて正確に回答してください
2. タグに応じた専門的な対応を心がけてください  
3. 不明な点があれば、適切な担当部署を案内してください
4. 丁寧で親しみやすい語調で回答してください"""

        user_info = f"\nユーザーメール: {user_email}" if user_email else ""
        inquiry_info = f"\n問い合わせタイプ: {inquiry_type}" if inquiry_type else ""
        
        prompt = f"""{sys_prompt}

### コンテキスト
{context_block}

{past_cases_info}

### ユーザーの質問{user_info}{inquiry_info}
{question}

### 回答"""

        try:
            resp = CLIENT.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=800
            )
            
            return resp.choices[0].message.content
            
        except Exception as e:
            print(f"❌ 回答生成エラー: {e}")
            return "申し訳ございませんが、回答の生成中にエラーが発生しました。"
    
    def _generate_email_draft(self, question: str, contexts: list[dict], similar_cases: list[dict], contact_info: dict, user_email: str, inquiry_type: str) -> str:
        """担当者向けのメール文を生成"""
        context_summary = "\n".join([f"- {c['Question'][:60]}..." for c in contexts[:3]])
        
        past_cases_summary = ""
        if similar_cases:
            past_cases_summary = "\n\n【関連する過去事例】\n"
            for case in similar_cases[:2]:
                past_cases_summary += f"- {case['question'][:50]}... (状況: {case['status']}, 日付: {case['date']})\n"
        
        sys_prompt = f"""NoLangサポートチームの{contact_info['担当者']}向けの業務メール文を作成してください。

以下の情報を基に、適切な対応指示を含んだメール文を日本語で作成してください：

【基本情報】
- 問い合わせタイプ: {inquiry_type or 'その他'}
- ユーザーメール: {user_email or '未提供'}
- 担当部署: {contact_info['担当者']}
- 優先度: {'高' if '不具合' in str(inquiry_type) or '緊急' in question else '中'}

【メール文の要件】
1. 件名、宛先、本文を含む完全なメール形式
2. 過去事例を参考にした対応提案
3. 次のアクションステップを明記
4. 専門用語は分かりやすく説明
5. ビジネスメールとして適切な敬語"""

        user_info = f"\nユーザーメール: {user_email}" if user_email else "\nユーザーメール: 未提供"
        
        prompt = f"""{sys_prompt}

【ユーザーからの質問】
{question}

【関連するFAQ/過去対応】
{context_summary}

{past_cases_summary}

【メール文を作成してください】"""

        try:
            resp = CLIENT.chat.completions.create(
                model="gpt-4o-mini", 
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1000
            )
            
            return resp.choices[0].message.content
            
        except Exception as e:
            print(f"❌ メール文生成エラー: {e}")
            return "メール文の生成中にエラーが発生しました。"

def main():
    parser = argparse.ArgumentParser(description="NoLang Support Bot CLIテストツール")
    parser.add_argument("question", help="質問内容")
    parser.add_argument("--email", "-e", help="ユーザーのメールアドレス", default=None)
    parser.add_argument("--inquiry-type", "-t", help="問い合わせタイプ", default=None, 
                       choices=list(INQUIRY_TYPE_MAPPING.keys()))
    parser.add_argument("--verbose", "-v", action="store_true", help="詳細情報を表示")
    
    args = parser.parse_args()
    
    print("🤖 NoLang Support Bot CLIテストツール")
    print("=" * 60)
    
    # RAGシステムを初期化
    rag = RAGSystem()
    
    # 検索実行
    print(f"\n📋 質問: {args.question}")
    if args.email:
        print(f"📧 ユーザー: {args.email}")
    if args.inquiry_type:
        print(f"🏷️  タイプ: {args.inquiry_type}")
    
    print("\n🔍 関連情報を検索中...")
    contexts = rag.search(args.question, k=5)
    
    if not contexts:
        print("❌ 関連する情報が見つかりませんでした。")
        return
    
    print(f"✅ {len(contexts)}件の関連情報を発見")
    
    # 回答生成
    print("\n🧠 回答とメール文を生成中...")
    result = rag.generate_response(args.question, contexts, args.email, args.inquiry_type)
    
    # 結果表示
    print("\n" + "=" * 60)
    print("📝 生成された回答")
    print("=" * 60)
    print(result["answer"])
    
    print("\n" + "=" * 60)
    print("📬 担当者向けメール文")
    print("=" * 60)
    print(result["email_draft"])
    
    print("\n" + "=" * 60)
    print("📊 処理結果サマリー")
    print("=" * 60)
    print(f"🏷️  検出タグ: {result['primary_tag']}")
    print(f"👥 担当チーム: {result['assigned_team']}")
    print(f"📧 連絡先: {result['suggested_contact']}")
    print(f"📚 関連事例: {len(result['related_cases'])}件")
    
    if args.verbose:
        print("\n" + "=" * 60)
        print("🔍 検索された関連情報")
        print("=" * 60)
        for i, ctx in enumerate(contexts[:3], 1):
            print(f"\n【{i}】類似度: {ctx.get('similarity', 0):.3f}")
            print(f"タグ: {ctx.get('Tag', 'N/A')}")
            print(f"質問: {ctx['Question'][:100]}...")
            print(f"回答: {ctx['Answer'][:100]}...")
        
        if result['related_cases']:
            print("\n" + "=" * 60)
            print("📚 同じタグの過去事例")
            print("=" * 60)
            for i, case in enumerate(result['related_cases'][:3], 1):
                print(f"\n【{i}】{case['date']} - {case['status']}")
                print(f"質問: {case['question'][:100]}...")

if __name__ == "__main__":
    main() 