import json
import os
import pickle
import numpy as np
from sklearn.neighbors import NearestNeighbors
from tqdm import tqdm
from openai import OpenAI
from loader import load_sheet, create_sample_data

CLIENT = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    テキストのリストを埋め込みベクトルに変換
    
    Args:
        texts: 埋め込みを作成するテキストのリスト
        
    Returns:
        埋め込みベクトルのリスト
    """
    if not texts:
        return []
    
    # OpenAI APIのレート制限を考慮して、1000件ずつ処理
    chunks = [texts[i:i+1000] for i in range(0, len(texts), 1000)]
    vectors = []
    
    for chunk in tqdm(chunks, desc="Creating embeddings"):
        try:
            resp = CLIENT.embeddings.create(
                model="text-embedding-3-small",
                input=chunk
            )
            vectors.extend([d.embedding for d in resp.data])
        except Exception as e:
            print(f"埋め込み作成エラー: {e}")
            raise
    
    return vectors

def build_index(use_sample_data: bool = False):
    """
    scikit-learnベースのインデックスとメタデータを構築
    
    Args:
        use_sample_data: Trueの場合、サンプルデータを使用
    """
    try:
        # データの読み込み
        if use_sample_data:
            print("サンプルデータを使用してインデックスを構築します...")
            df = create_sample_data()
        else:
            print("Google Sheetsからデータを読み込んでインデックスを構築します...")
            df = load_sheet()
        
        if df.empty:
            raise ValueError("データが空です")
        
        print(f"処理するデータ数: {len(df)}件")
        
        # 質問文の埋め込みベクトルを作成
        questions = df["Question"].tolist()
        print("埋め込みベクトルを作成中...")
        vectors = embed_texts(questions)
        
        if not vectors:
            raise ValueError("埋め込みベクトルの作成に失敗しました")
        
        # scikit-learnのNearestNeighborsを使用
        vectors_array = np.array(vectors).astype("float32")
        
        # 最近傍検索モデルを構築
        nn_model = NearestNeighbors(
            n_neighbors=min(10, len(vectors)),  # 最大10件または全データ数
            metric='cosine',
            algorithm='brute'  # 小規模データセットには brute force が効率的
        )
        nn_model.fit(vectors_array)
        
        # モデルとベクトルをpickleで保存
        with open("nn_model.pkl", "wb") as f:
            pickle.dump({
                'model': nn_model,
                'vectors': vectors_array
            }, f)
        print("NearestNeighborsモデルを保存しました: nn_model.pkl")
        
        # メタデータを保存
        metadata = df[["Question", "Answer", "Tag", "UpdatedAt"]].copy()
        
        # GmailAddress列が存在する場合は追加
        if "GmailAddress" in df.columns:
            metadata["GmailAddress"] = df["GmailAddress"]
        
        # JSONファイルに保存
        metadata.to_json("metadata.json", orient="records", indent=2)
        print("メタデータを保存しました: metadata.json")
        
        print(f"インデックス構築完了: {len(vectors)}件のベクトル, 次元数: {len(vectors[0])}")
        
    except Exception as e:
        print(f"インデックス構築エラー: {e}")
        raise

def validate_index():
    """
    構築されたインデックスの検証
    """
    try:
        # モデルの読み込み
        with open("nn_model.pkl", "rb") as f:
            data = pickle.load(f)
            nn_model = data['model']
            vectors = data['vectors']
        
        # メタデータの読み込み
        with open("metadata.json", "r", encoding="utf-8") as f:
            metadata = json.load(f)
        
        print(f"インデックス検証:")
        print(f"  - ベクトル数: {len(vectors)}")
        print(f"  - 次元数: {vectors.shape[1]}")
        print(f"  - メタデータ数: {len(metadata)}")
        
        # サンプル検索テスト
        if len(vectors) > 0 and metadata:
            test_query = "NoLangとは"
            test_vectors = embed_texts([test_query])
            if test_vectors:
                test_vector = np.array([test_vectors[0]]).astype("float32")
                distances, indices = nn_model.kneighbors(test_vector, n_neighbors=1)
                print(f"  - テスト検索: '{test_query}' -> {metadata[indices[0][0]]['Question']}")
        
        return True
        
    except Exception as e:
        print(f"インデックス検証エラー: {e}")
        return False

if __name__ == "__main__":
    # 環境変数チェック
    if not os.environ.get("OPENAI_API_KEY"):
        print("エラー: OPENAI_API_KEY環境変数が設定されていません")
        print("export OPENAI_API_KEY='your-api-key' を実行してください")
        exit(1)
    
    try:
        # 実際のGoogle Sheetsデータでインデックス構築
        build_index(use_sample_data=False)
        
        # 検証
        if validate_index():
            print("インデックス構築と検証が完了しました！")
        else:
            print("インデックス検証に失敗しました")
            
    except Exception as e:
        print(f"処理中にエラーが発生しました: {e}")
        exit(1) 