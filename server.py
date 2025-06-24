import json
import os
import re
import pickle
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from openai import OpenAI
from pydantic import BaseModel
from embed import embed_texts
from loader import get_contact_info_by_tag

app = FastAPI(title="NoLang Support Bot", version="1.0.0")

# グローバル変数
NN_MODEL = None
VECTORS = None
METADATA = None
CLIENT = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def load_index_and_metadata():
    """インデックスとメタデータを読み込む"""
    global NN_MODEL, VECTORS, METADATA
    
    try:
        # モデルの読み込み
        with open("nn_model.pkl", "rb") as f:
            data = pickle.load(f)
            NN_MODEL = data['model']
            VECTORS = data['vectors']
        
        # メタデータの読み込み
        with open("metadata.json", "r", encoding="utf-8") as f:
            METADATA = json.load(f)
            
        print(f"モデル読み込み完了: {len(VECTORS)}件のベクトル")
        print(f"メタデータ読み込み完了: {len(METADATA)}件")
    except FileNotFoundError as e:
        print(f"ファイルが見つかりません: {e}")
        print("先にembed_lightweight.pyを実行してインデックスを構築してください")
        return False
    except Exception as e:
        print(f"インデックス読み込みエラー: {e}")
        return False
    
    return True

class Query(BaseModel):
    question: str
    email: str = None  # ユーザーのメールアドレス（オプション）
    inquiry_type: str = None  # 問い合わせタイプ（オプション）

class Response(BaseModel):
    answer: str
    sources: list[dict]
    suggested_contact: str = None  # 推奨連絡先
    assigned_team: str = None  # 担当チーム
    related_cases: list[dict] = []  # 関連する過去の事例

def extract_email_from_text(text: str) -> str:
    """テキストからメールアドレスを抽出"""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    return emails[0] if emails else None

def retrieve(question: str, k: int = 3) -> list[dict]:
    """
    質問に対して関連するコンテキストを検索
    
    Args:
        question: 検索する質問
        k: 返すコンテキストの数
        
    Returns:
        関連するコンテキストのリスト
    """
    if NN_MODEL is None or METADATA is None:
        raise HTTPException(status_code=500, detail="インデックスが読み込まれていません")
    
    try:
        # 質問を埋め込みベクトルに変換
        vec = embed_texts([question])
        if not vec:
            raise HTTPException(status_code=500, detail="埋め込みベクトルの作成に失敗しました")
        
        # scikit-learn検索
        query_vector = np.array([vec[0]]).astype("float32")
        distances, indices = NN_MODEL.kneighbors(query_vector, n_neighbors=min(k, len(VECTORS)))
        
        # 検索結果を返す
        results = []
        for i, distance in zip(indices[0], distances[0]):
            if i < len(METADATA):
                context = METADATA[i].copy()
                # コサイン類似度に変換（NearestNeighborsはコサイン距離を返す）
                context["similarity_score"] = float(1 - distance)
                results.append(context)
        
        return results
        
    except Exception as e:
        print(f"検索エラー: {e}")
        raise HTTPException(status_code=500, detail=f"検索に失敗しました: {str(e)}")

def find_similar_cases_by_tag(tag: str, k: int = 3) -> list[dict]:
    """
    タグに基づいて関連する過去の事例を検索
    """
    if METADATA is None:
        return []
    
    similar_cases = []
    for item in METADATA:
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

def determine_contact_email_with_tag(contexts: list[dict], user_email: str = None, inquiry_type: str = None) -> tuple[str, str]:
    """
    コンテキストとタグに基づいて推奨連絡先と担当チームを決定
    
    Returns:
        tuple: (email, team_name)
    """
    if contexts and "Tag" in contexts[0]:
        tag = contexts[0]["Tag"]
        contact_info = get_contact_info_by_tag(tag)
        return contact_info["email"], contact_info["担当者"]
    
    # デフォルトのサポートメール
    return "support@nolang.ai", "一般サポート"

def generate_answer_with_context(question: str, contexts: list[dict], user_email: str = None, inquiry_type: str = None) -> str:
    """
    コンテキストとタグ情報に基づいて回答を生成
    """
    if not contexts:
        return "申し訳ございませんが、ご質問に関連する情報が見つかりませんでした。詳細についてはサポートチームにお問い合わせください。"
    
    # 最も関連性の高いコンテキストのタグを取得
    primary_tag = contexts[0].get("Tag", "一般問い合わせ")
    
    # 同じタグの過去事例を検索
    similar_cases = find_similar_cases_by_tag(primary_tag)
    
    # コンテキストブロックを作成
    context_block = "\n\n".join(
        f"Q: {c['Question']}\nA: {c['Answer']}\nタグ: {c.get('Tag', 'N/A')}" 
        for c in contexts[:3]
    )
    
    # 過去事例の情報を追加
    past_cases_info = ""
    if similar_cases:
        past_cases_info = "\n\n### 関連する過去の対応事例:\n"
        for case in similar_cases[:2]:  # 最新2件
            past_cases_info += f"- {case['question'][:50]}... (対応状況: {case['status']})\n"
    
    # システムプロンプト
    sys_prompt = f"""あなたはNoLangのサポートAIです。
ユーザーの質問には **以下のコンテキストの範囲内で忠実に** 日本語で答えてください。

問い合わせタグ: {primary_tag}
担当部署: {get_contact_info_by_tag(primary_tag)['担当者']}

重要なルール:
1. コンテキストと過去事例に基づいて正確に回答してください
2. タグに応じた専門的な対応を心がけてください
3. 不明な点があれば、適切な担当部署を案内してください
4. 丁寧で親しみやすい語調で回答してください
5. 回答の最後に担当部署の連絡先を案内してください"""

    # ユーザー情報を追加
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
            max_tokens=1000
        )
        
        generated_answer = resp.choices[0].message.content
        
        # 担当部署の連絡先情報を追加
        contact_info = get_contact_info_by_tag(primary_tag)
        contact_footer = f"\n\n詳細についてはお気軽に{contact_info['担当者']}（{contact_info['email']}）までお問い合わせください。"
        
        return generated_answer + contact_footer
        
    except Exception as e:
        print(f"LLM回答生成エラー: {e}")
        return "申し訳ございませんが、回答の生成中にエラーが発生しました。しばらく後にもう一度お試しいただくか、サポートチームにお問い合わせください。"

@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の処理"""
    print("NoLang Support Bot を起動中...")
    
    # 環境変数チェック
    if not os.environ.get("OPENAI_API_KEY"):
        print("警告: OPENAI_API_KEY環境変数が設定されていません")
    
    # インデックスとメタデータの読み込み
    if not load_index_and_metadata():
        print("警告: インデックスの読み込みに失敗しました")

@app.get("/", response_class=HTMLResponse)
async def root():
    """シンプルなWebインターフェース"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>NoLang Support Bot</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .question-box { margin: 20px 0; }
            textarea { width: 100%; height: 100px; padding: 10px; }
            input[type="email"] { width: 100%; padding: 10px; margin: 10px 0; }
            button { background-color: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
            button:hover { background-color: #0056b3; }
            .response { margin-top: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 5px; }
            .sources { margin-top: 15px; }
            .source-item { margin: 5px 0; padding: 10px; background-color: #e9ecef; border-radius: 3px; }
            .header { text-align: center; margin-bottom: 30px; }
            .badge { background-color: #28a745; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 NoLang Support Bot</h1>
                <span class="badge">Lightweight Version</span>
                <p>NoLangに関するご質問をお気軽にどうぞ！</p>
            </div>
            
            <div class="question-box">
                <input type="email" id="email" placeholder="メールアドレス（オプション）">
                <textarea id="question" placeholder="質問を入力してください..."></textarea>
                <button onclick="askQuestion()">質問する</button>
            </div>
            
            <div id="response" class="response" style="display: none;">
                <h3>回答</h3>
                <div id="answer"></div>
                <div class="sources">
                    <h4>参考情報</h4>
                    <div id="sources"></div>
                </div>
                <p id="contact" style="margin-top: 15px; font-style: italic;"></p>
            </div>
        </div>

        <script>
            async function askQuestion() {
                const email = document.getElementById('email').value;
                const question = document.getElementById('question').value;
                
                if (!question.trim()) {
                    alert('質問を入力してください');
                    return;
                }
                
                try {
                    const response = await fetch('/ask', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            question: question,
                            email: email || null
                        })
                    });
                    
                    const data = await response.json();
                    
                    document.getElementById('answer').innerHTML = data.answer.replace(/\\n/g, '<br>');
                    
                    const sourcesDiv = document.getElementById('sources');
                    sourcesDiv.innerHTML = '';
                    data.sources.forEach(source => {
                        const sourceDiv = document.createElement('div');
                        sourceDiv.className = 'source-item';
                        sourceDiv.innerHTML = `<strong>Q:</strong> ${source.Question}<br><strong>A:</strong> ${source.Answer}`;
                        sourcesDiv.appendChild(sourceDiv);
                    });
                    
                    if (data.suggested_contact) {
                        document.getElementById('contact').innerHTML = `詳細なサポートが必要な場合: ${data.suggested_contact}`;
                    }
                    
                    document.getElementById('response').style.display = 'block';
                    
                } catch (error) {
                    alert('エラーが発生しました: ' + error.message);
                }
            }
        </script>
    </body>
    </html>
    """
    return html_content

@app.post("/ask", response_model=Response)
async def ask(q: Query):
    """質問に対して回答を生成"""
    try:
        print(f"質問受信: {q.question}")
        
        # 関連するコンテキストを検索
        contexts = retrieve(q.question, k=5)
        
        if not contexts:
            return Response(
                answer="申し訳ございませんが、関連する情報が見つかりませんでした。",
                sources=[],
                suggested_contact="support@nolang.ai",
                assigned_team="一般サポート"
            )
        
        # 回答を生成
        answer = generate_answer_with_context(q.question, contexts, q.email, q.inquiry_type)
        
        # 担当者情報を決定
        suggested_contact, assigned_team = determine_contact_email_with_tag(contexts, q.email, q.inquiry_type)
        
        # 関連する過去事例を取得
        primary_tag = contexts[0].get("Tag", "一般問い合わせ") if contexts else "一般問い合わせ"
        related_cases = find_similar_cases_by_tag(primary_tag, k=3)
        
        return Response(
            answer=answer,
            sources=contexts,
            suggested_contact=suggested_contact,
            assigned_team=assigned_team,
            related_cases=related_cases
        )
        
    except Exception as e:
        print(f"エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "model_loaded": NN_MODEL is not None,
        "metadata_loaded": METADATA is not None,
        "total_vectors": len(VECTORS) if VECTORS is not None else 0,
        "total_metadata": len(METADATA) if METADATA else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 