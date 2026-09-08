# Morn Sheet Link Extension

Google スプレッドシートの選択範囲を、ハイパーリンクとしてコピーするChrome拡張です。

リンク名は `ファイル名_タブ名_範囲`。例：**売上管理_9月_B2:D10**

## インストール

1. `chrome://extensions` でデベロッパーモードを有効にします。
2. 「パッケージ化されていない拡張機能を読み込む」で、このフォルダを選びます。
3. スプレッドシートを再読み込みします。

更新時は拡張の丸矢印を押し、シートも再読み込みします。現在は `0.1.2`。Chrome・Arcなど、ブラウザごとに導入が必要です。

## 使い方

範囲を選択 → 右クリック →「セルでの他の操作項目を表示」→「この範囲へのリンクを作成 Ex」。行・列の選択時は、それぞれのメニューを開きます。

Exは標準の「この範囲へのリンクを取得」の直下に表示されます。HTML対応の貼り付け先ではリンクに、テキストのみの場合はリンク名になります。

## 対応範囲

- セル・連続範囲・行全体・列全体。名前付き範囲と離れた複数範囲は対象外。
- 日本語・英語のメニュー。Googleの画面変更で動かなくなる場合があります。
- タブIDを取得できない場合はエラーになります。対象タブを開き直してください。
- 外部送信・Google API認証・クリップボード読み取りはありません。

## 確認・配布

```sh
node --test content.test.cjs
python3 scripts/package.py
python3 scripts/check_package.py
```

ZIPは `dist/` に生成します。PSD・説明文・テストは含みません。

Chromeで `7:8`・`B2:D10` のメニュー表示・再表示・コピー成功を確認済みです。実際の貼り付け先でのリンク名・移動先と、別タブへの切り替えは確認が必要です。

申請素材は `dist/chrome-web-store/`。入力文と残る作業は [申請手順](docs/store-listing.md)、情報の扱いは [プライバシーポリシー](docs/privacy.md) を参照してください。審査提出・公開は未実施です。

## 画像を編集する

| 原稿 | 内容・編集方法 |
| --- | --- |
| [OGP PSD](assets/source/ogp-editable.psd)／[PNG](assets/ogp-editable.png) | FHD。文字10個を直接編集可能。全21要素・5グループ。文字以外はラスターレイヤー。Photoshopで編集しPNGを書き出す。 |
| [アイコンPSD](assets/source/icon.psd)／[SVG](assets/source/icon.svg) | 512×512、4ラスターレイヤー。SVGで形状を編集可能。 |
| [紹介画像PSD](assets/source/thumbnail.psd)／[SVG](assets/source/promo.svg) | 440×280、文字を含む6ラスターレイヤー。文言はSVGで編集し `python3 scripts/build_thumbnail.py` で再生成。 |

配色はMornDesktopTubeのOGPと [TSUKUMI STUDIO](https://tsukumistudio.com/) に合わせています。
提出画像：[アイコン](icons/icon-128.png)・[紹介画像](assets/promo-440x280.png)・[スクリーンショット](assets/screenshot-1280x800.png)。

- `python3 scripts/check_editable_ogp.py`：OGPの文字・レイヤー構成を検証。
- `python3 scripts/build_icon.py`：アイコンを再生成。SVG・PSDへの手編集は上書きされます。
- `python3 scripts/build_thumbnail.py ogp`：比較用のラスターPSDを生成。編集用OGPは上書きしません。
- `python3 scripts/prepare_editable_ogp.py`：OGP再構築用の11要素と文字仕様を `dist/editable-ogp/` へ出力。

画像の生成にはImageMagick・Pillow・psd-toolsが必要です。拡張の利用には不要です。
実装資料：[content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)・[clipboardWrite](https://developer.chrome.com/docs/extensions/reference/permissions-list)。
