# GASの管理方法

[claspとは](https://qiita.com/zumi0/items/a4dd6e00cad7ee341d77)

## ログイン方法
- `make clasp-login` でログインしてください。
- 使用するアカウント: support.nolang@mvrks.co.jp

## プロジェクトへのプッシュ
- `make clasp-push CLASP_PROJECT=hoge` で、指定したプロジェクトにプッシュします。
- 現在のプロジェクトオプション: `CLASP_PROJECT=cs_support` または `form`

## フォルダ構成
```
clasp/
├── cs_support : カスタマーサポートに関わるナレッジデータを管理する 
└── form : カスタマーサポートのGoogleフォームが送信された際に起動するスクリプト。フォームに対応するスプレッドシートに付随する。 
```
[cs_supportのプロジェクトリンク](https://script.google.com/home/projects/1tj9tqUJ2w26kF9WsXTp_XPcOcnppT6Teb7Ur7MpC357O4jkETTHg3Adm/edit)

[formのプロジェクトリンク](https://script.google.com/u/0/home/projects/1BuLIRz7PYUq8ybIWX5s7D2AnMx55oxaVPHfoSTArPFSuJ-PV_IqzhNjB/edit)

## パッケージ管理とコンテナ
- **poetry**: ローカルでlangchainなどを用いたRAGの設計を想定してpythonコードのためにインストールしています。しかし、現状はpythonファイルなし。
- **docker**: ローカルでlangchainなどを用いたRAGの設計を想定してpythonコードのためにインストールしています。しかし、現状は使っていない。
- **npm**: GASのために必要。
