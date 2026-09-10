# Morn Sheet Link Extension

Google スプレッドシートの選択範囲を、名前付きのリンクとしてコピーするChrome拡張です。バージョン **0.1.3**。

## インストール・更新

1. `chrome://extensions` でデベロッパーモードを有効にします。
2. 「パッケージ化されていない拡張機能を読み込む」で、このフォルダを選びます。
3. スプレッドシートを再読み込みします。

更新時は拡張の更新ボタンを押し、シートも再読み込みしてください。Chrome・Arcなど、ブラウザごとに導入が必要です。

## 右クリックからコピー

範囲を選択 → 右クリック →「セルでの他の操作項目を表示」→「この範囲へのリンクを取得Ex」。行・列を選んだ場合は、それぞれのメニューを開きます。Exは標準のリンク取得項目の直下にあります。

処理中は「コピー中…」と表示し、**コピー成功後にメニューを閉じます**。失敗時は閉じずにエラーを表示します。貼り付け先がHTML対応ならリンクに、テキストのみならリンク名になります。

リンク名は `ファイル名-タブ名-範囲`。要素を `-`、区間を `〜` でつなぎます。

| 選択 | リンク名の例 |
| --- | --- |
| セル範囲 | `売上管理-9月-B2〜D10` |
| 行全体：A列の値を使用 | `売上管理-9月-item_honya行` |
| 列全体：1行目の値を使用 | `売上管理-9月-label〜description列` |

複数行・列は先頭と末尾の要素名を使い、空欄なら行番号・列記号で補います。リンク先は選択した範囲全体です。

## 待ち時間とエラー

行・列の要素名はGoogleからCSVで取得するため、コピーまで待ち時間があります。一時的な失敗は最大2回再試行します。保存前の変更は反映されない場合があります。

失敗が続く場合は、表示されたエラーを添えて[Issues](https://github.com/TsukumiStudio/MornSheetLinkExtension/issues)へ報告してください。タブIDを取得できない場合はシートを開き直してください。

日本語・英語のメニューに対応。名前付き範囲と離れた複数範囲は対象外です。Googleの画面変更で動かなくなる場合があります。Google以外への送信やクリップボードの読み取りはありません。詳細は[プライバシーポリシー](docs/privacy.md)を参照してください。

## テスト・配布

```sh
node --test content.test.cjs
python3 scripts/package.py
python3 scripts/check_package.py
```

ZIPは `dist/MornSheetLinkExtension-0.1.3.zip` に生成します。実行用ファイルのみを含みます。ストア用の画像・掲載文は[申請手順](docs/store-listing.md)を参照してください。

通信の再現テストは `python3 scripts/check_fetch.py`。ローカルの模擬サーバーとChromeを使います。macOS以外では環境変数 `CHROME` に実行ファイルを指定します。この環境ではChrome起動がタイムアウトしており、最新変更の実ブラウザ検証は未完了です。

## 画像の原稿

[OGP PSD](assets/source/ogp-editable.psd)・[アイコンPSD](assets/source/icon.psd)・[紹介画像PSD](assets/source/thumbnail.psd)。OGPはPhotoshopで文字を編集し、PNGを書き出します。

再生成・検証用スクリプトは `scripts/` にあります。画像生成にはImageMagick・Pillow・psd-toolsが必要です。`build_icon.py` はSVG・PSDへの手編集を上書きします。
