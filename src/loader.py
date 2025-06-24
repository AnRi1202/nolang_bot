import gspread
import pandas as pd
from google.oauth2.service_account import Credentials
import requests
from bs4 import BeautifulSoup
import re

# 実際のスプレッドシートID
SPREADSHEET_ID = "1-zZy350KIQHnKEVDk3uESd7Oy0K6HXGQxVI42UfbPO4"
SCOPE = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# 問い合わせタイプと担当者のマッピング
INQUIRY_TYPE_MAPPING = {
    "NoLang に関するご質問": {
        "tag": "NoLang質問",
        "email": "support@nolang.ai",
        "担当者": "テクニカルサポート",
    },
    "NoLang の不具合": {"tag": "不具合報告", "email": "tech@nolang.ai", "担当者": "開発チーム"},
    "PDFプレゼンモードに対するお問い合わせ": {
        "tag": "PDF機能",
        "email": "product@nolang.ai",
        "担当者": "プロダクトチーム",
    },
    "Live2Dモデル及び音声に関するお問い合わせ": {
        "tag": "Live2D・音声",
        "email": "media@nolang.ai",
        "担当者": "メディアチーム",
    },
    "「不適切な動画」の判定に対する異議申し立て": {
        "tag": "コンテンツ審査",
        "email": "moderation@nolang.ai",
        "担当者": "モデレーションチーム",
    },
    "運営会社 Mavericks に関するお問い合わせ": {
        "tag": "会社情報",
        "email": "info@mavericks.co.jp",
        "担当者": "企業窓口",
    },
    "法人プランのお問い合わせ": {
        "tag": "法人営業",
        "email": "business@nolang.ai",
        "担当者": "法人営業チーム",
    },
    "その他のお問い合わせ": {
        "tag": "一般問い合わせ",
        "email": "support@nolang.ai",
        "担当者": "一般サポート",
    },
}


def load_faq_data():
    """
    NoLang FAQページからデータを取得
    """
    try:
        print("FAQデータを取得中...")
        response = requests.get("https://no-lang.com/faq", timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")
        faq_data = []

        # FAQの構造を解析（実際のHTMLに応じて調整が必要）
        faq_items = soup.find_all(["div", "section"], class_=re.compile(r"faq|question|qa"))

        for item in faq_items:
            question_elem = item.find(
                ["h2", "h3", "h4", "dt"], class_=re.compile(r"question|title")
            )
            answer_elem = item.find(["p", "div", "dd"], class_=re.compile(r"answer|content"))

            if question_elem and answer_elem:
                question = question_elem.get_text(strip=True)
                answer = answer_elem.get_text(strip=True)

                if len(question) > 10 and len(answer) > 20:
                    faq_data.append(
                        {
                            "Question": question,
                            "Answer": answer,
                            "Tag": "FAQ",
                            "UpdatedAt": "2024-01-01",
                            "GmailAddress": "support@nolang.ai",
                        }
                    )

        print(f"FAQから{len(faq_data)}件のデータを取得しました")
        return faq_data

    except Exception as e:
        print(f"FAQ取得エラー: {e}")
        return []


def load_sheet() -> pd.DataFrame:
    """
    Google Sheetsからデータを読み込む
    """
    try:
        creds = Credentials.from_service_account_file("sa.json", scopes=SCOPE)
        gc = gspread.authorize(creds)
        sheet = gc.open_by_key(SPREADSHEET_ID).sheet1

        # 全データを取得
        all_values = sheet.get_all_values()
        headers = all_values[0]  # 1行目がヘッダー
        data_rows = all_values[1:]  # 2行目以降がデータ

        # カスタムヘッダーマッピング
        header_mapping = {}
        for i, header in enumerate(headers):
            if "担当者" in header:
                header_mapping[i] = "担当者"
            elif "対応" in header and "未" in header:
                header_mapping[i] = "ステータス"
            elif "受付日" in header or "日時" in header:
                header_mapping[i] = "受付日"
            elif "メールアドレス" in header:
                header_mapping[i] = "メールアドレス"
            elif "お問い合わせの内容を選んでください" in header:
                header_mapping[i] = "問い合わせ種別"
            elif "ご質問内容" in header and "詳細" in header:
                header_mapping[i] = "質問内容"
            elif "お問い合わせ内容" in header and "20文字以上" in header:
                header_mapping[i] = "問い合わせ詳細"

        # RAG用にデータを変換
        rag_data = []

        for row in data_rows:
            if len(row) == 0:
                continue

            # 各列のデータを取得
            row_data = {}
            for i, value in enumerate(row):
                if i in header_mapping:
                    row_data[header_mapping[i]] = value

            # 質問内容を抽出
            question_candidates = [row_data.get("質問内容", ""), row_data.get("問い合わせ詳細", "")]

            question = ""
            for candidate in question_candidates:
                if candidate and len(str(candidate).strip()) > 10:
                    question = str(candidate).strip()
                    break

            if question:
                inquiry_type = row_data.get("問い合わせ種別", "その他のお問い合わせ")
                mapping = INQUIRY_TYPE_MAPPING.get(
                    inquiry_type, INQUIRY_TYPE_MAPPING["その他のお問い合わせ"]
                )

                # 過去の対応パターンを参考にした回答生成
                base_answer = f"お問い合わせいただきありがとうございます。{mapping['担当者']}が対応いたします。"

                # 問い合わせタイプ別の詳細回答
                if "不具合" in inquiry_type:
                    base_answer += "技術チームが調査し、解決策をご提案いたします。"
                elif "法人プラン" in inquiry_type:
                    base_answer += "法人向けの詳細なプランについてご案内いたします。"
                elif "PDF" in inquiry_type:
                    base_answer += "PDFプレゼンモード機能の詳細についてサポートいたします。"

                rag_data.append(
                    {
                        "Question": question,
                        "Answer": base_answer,
                        "Tag": mapping["tag"],
                        "UpdatedAt": row_data.get("受付日", "2024-01-01"),
                        "GmailAddress": mapping["email"],
                        "InquiryType": inquiry_type,
                        "Status": row_data.get("ステータス", "未対応"),
                        "OriginalEmail": row_data.get("メールアドレス", ""),
                    }
                )

        # FAQデータも追加
        faq_data = load_faq_data()
        rag_data.extend(faq_data)

        rag_df = pd.DataFrame(rag_data)

        # 重複を削除
        rag_df = rag_df.drop_duplicates(subset=["Question"])

        print(f"合計{len(rag_df)}件のQ&Aデータを生成しました")
        print(f"タグ別件数: {rag_df['Tag'].value_counts().to_dict()}")

        return rag_df

    except FileNotFoundError:
        raise FileNotFoundError("sa.json ファイルが見つかりません。")
    except Exception as e:
        raise Exception(f"Google Sheets読み込みエラー: {str(e)}")


def get_contact_info_by_tag(tag: str) -> dict:
    """
    タグに基づいて連絡先情報を取得
    """
    tag_to_inquiry = {
        "NoLang質問": "NoLang に関するご質問",
        "不具合報告": "NoLang の不具合",
        "PDF機能": "PDFプレゼンモードに対するお問い合わせ",
        "Live2D・音声": "Live2Dモデル及び音声に関するお問い合わせ",
        "コンテンツ審査": "「不適切な動画」の判定に対する異議申し立て",
        "会社情報": "運営会社 Mavericks に関するお問い合わせ",
        "法人営業": "法人プランのお問い合わせ",
        "一般問い合わせ": "その他のお問い合わせ",
    }

    inquiry_type = tag_to_inquiry.get(tag, "その他のお問い合わせ")
    return INQUIRY_TYPE_MAPPING[inquiry_type]


def create_sample_data() -> pd.DataFrame:
    """
    テスト用のサンプルデータを作成
    """
    sample_data = [
        {
            "Question": "動画を編集中に削除しました。削除した動画は元に戻せますか？",
            "Answer": "削除された動画の復元については、技術サポートチームが対応いたします。削除から24時間以内であれば復元可能な場合があります。",
            "Tag": "NoLang質問",
            "UpdatedAt": "2025-06-23",
            "GmailAddress": "support@nolang.ai",
            "InquiryType": "NoLang に関するご質問",
        },
        {
            "Question": "動画の音声の音間はくださっと読みますがどうしてもくさ大変でしても困ります。急にテロップが現れてピッタリよろしくお願い致します。",
            "Answer": "音声とテロップの同期に関する不具合のご報告をありがとうございます。技術チームが調査し、解決策をご提案いたします。",
            "Tag": "不具合報告",
            "UpdatedAt": "2025-06-21",
            "GmailAddress": "tech@nolang.ai",
            "InquiryType": "NoLang の不具合",
        },
        {
            "Question": "AI資料解析機能において、アップロードしたPDFの内容が正しく認識されません。",
            "Answer": "PDFプレゼンモード機能の詳細についてサポートいたします。プロダクトチームが対応いたします。",
            "Tag": "PDF機能",
            "UpdatedAt": "2025-06-18",
            "GmailAddress": "product@nolang.ai",
            "InquiryType": "PDFプレゼンモードに対するお問い合わせ",
        },
    ]

    return pd.DataFrame(sample_data)


if __name__ == "__main__":
    try:
        df = load_sheet()
        print(f"読み込み成功: {len(df)}件")
        print("\nサンプルデータ:")
        print(df[["Question", "Tag", "GmailAddress"]].head(10))
    except Exception as e:
        print(f"Google Sheets読み込みに失敗しました: {e}")
        print("サンプルデータを使用します...")
        df = create_sample_data()
        print(df)
