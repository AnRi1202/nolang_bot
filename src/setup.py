#!/usr/bin/env python3
"""
NoLang Support Bot セットアップスクリプト

このスクリプトは、NoLang Support Botを初期設定するためのものです。

必要な設定：
1. OpenAI API Key
2. Google Service Account（Google Sheets連携用）

使用方法：
    python setup.py
"""

import os
import sys
import json
from pathlib import Path


def print_header():
    """ヘッダーを表示"""
    print("=" * 60)
    print("🤖 NoLang Support Bot セットアップ")
    print("=" * 60)


def check_openai_key():
    """OpenAI API Keyの確認"""
    print("\n📋 1. OpenAI API Key の確認")
    api_key = os.environ.get("OPENAI_API_KEY")

    if api_key:
        print(f"✅ OpenAI API Key: {api_key[:8]}...{api_key[-4:]}")
        return True
    else:
        print("❌ OPENAI_API_KEY環境変数が設定されていません")
        print("\n設定方法:")
        print("export OPENAI_API_KEY='your-api-key-here'")
        return False


def check_google_credentials():
    """Google Service Account認証の確認"""
    print("\n📋 2. Google Service Account の確認")

    if Path("sa.json").exists():
        try:
            with open("sa.json", "r") as f:
                creds = json.load(f)
            print(f"✅ Google Service Account: {creds.get('client_email', 'Unknown')}")
            return True
        except Exception as e:
            print(f"❌ sa.jsonファイルの読み込みエラー: {e}")
            return False
    else:
        print("❌ sa.jsonファイルが見つかりません")
        print("\nGoogle Service Account設定方法:")
        print("1. Google Cloud Consoleにアクセス: https://console.cloud.google.com/")
        print("2. プロジェクトを選択または作成")
        print("3. Google Sheets APIを有効化")
        print("4. 認証情報 > サービスアカウントを作成")
        print("5. JSONキーをダウンロードして 'sa.json' として保存")
        print("6. Google Sheetsでサービスアカウントのメールアドレスに閲覧権限を付与")
        return False


def test_google_sheets_connection():
    """Google Sheets接続テスト"""
    print("\n📋 3. Google Sheets 接続テスト")

    try:
        from loader import load_sheet

        df = load_sheet()
        print(f"✅ Google Sheets接続成功: {len(df)}件のデータを取得")
        print(f"列名: {list(df.columns)}")
        return True
    except FileNotFoundError:
        print("❌ sa.jsonファイルが見つかりません")
        return False
    except Exception as e:
        print(f"❌ Google Sheets接続エラー: {e}")
        print("\n確認事項:")
        print("- Google Sheets APIが有効化されているか")
        print("- サービスアカウントにGoogle Sheetsの閲覧権限があるか")
        print("- SPREADSHEET_IDが正しいか")
        return False


def test_embedding_creation():
    """埋め込みベクトル作成テスト"""
    print("\n📋 4. 埋め込みベクトル作成テスト")

    try:
        from embed import embed_texts

        test_text = ["テストメッセージ"]
        vectors = embed_texts(test_text)

        if vectors and len(vectors) > 0:
            print(f"✅ 埋め込みベクトル作成成功: 次元数 {len(vectors[0])}")
            return True
        else:
            print("❌ 埋め込みベクトルの作成に失敗")
            return False
    except Exception as e:
        print(f"❌ 埋め込みベクトル作成エラー: {e}")
        return False


def run_setup():
    """セットアップを実行"""
    print_header()

    all_checks_passed = True

    # 各チェックを実行
    checks = [
        check_openai_key,
        check_google_credentials,
        test_google_sheets_connection,
        test_embedding_creation,
    ]

    for check in checks:
        if not check():
            all_checks_passed = False

    print("\n" + "=" * 60)

    if all_checks_passed:
        print("🎉 セットアップ完了！")
        print("\n次のステップ:")
        print("1. python embed.py      # インデックス構築")
        print("2. python server.py     # サーバー起動")
        print("または")
        print("2. uvicorn server:app --host 0.0.0.0 --port 8000 --reload")
    else:
        print("⚠️  セットアップに問題があります")
        print("上記のエラーを修正してから再度実行してください")

    return all_checks_passed


if __name__ == "__main__":
    success = run_setup()
    sys.exit(0 if success else 1)
