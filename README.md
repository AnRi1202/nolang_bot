# GASの管理方法

[claspとは](https://qiita.com/zumi0/items/a4dd6e00cad7ee341d77)

`make clasp-login` でログイン

`make clasp-push CLASP_PROJECT=hoge` で、指定したプロジェクトにpushをする

## フォルダ構成
```
clasp/
├── cs_support : カスタマーサポートに関わるナレッジデータを管理する
└── form : カスタマーサポートのGoogleフォームが送信された際に起動するスクリプト。フォームに対応するスプレッドシートに付随する。
```
