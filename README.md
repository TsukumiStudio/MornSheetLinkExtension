# Morn Sheet Link Extension

Googleスプレッドシートの右クリックメニューで「この範囲へのリンクを取得」の直下に「この範囲へのリンクを作成 Ex」を追加するChrome系ブラウザ用拡張です。日本語・英語のメニューに対応します。

## 導入

1. Chromeの `chrome://extensions` を開き、デベロッパーモードを有効にします。
2. 「パッケージ化されていない拡張機能を読み込む」で、このフォルダを指定します。
3. 開いているスプレッドシートを再読み込みします。
4. セル範囲を選択し、右クリック →「セルでの他の操作項目を表示」（行選択なら「行での他の操作項目を表示」）→「この範囲へのリンクを作成 Ex」を選びます。

更新時は、利用しているブラウザの `chrome://extensions` でこの拡張の更新ボタン（丸矢印）を押し、その後スプシも再読み込みしてください。バージョン表示は `0.1.2` です。ChromeとArcなど、別ブラウザへのインストールは共有されません。

例：ファイル「売上管理」、タブ「9月」、範囲 `B2:D10` → **売上管理_9月_B2:D10** という表示名で、その範囲へのリンクをコピーします。

HTMLを受け付ける貼り付け先ではクリック可能なリンクになります。プレーンテキストのみの貼り付け先では表示名だけになります。実際のリンク保持は貼り付け先の仕様によります。

## 制約と確認

- スプシの内部DOMに依存しています。Googleの画面変更や日本語・英語以外の表示言語では、項目追加・情報取得の調整が必要です。
- 通常のセル・連続範囲・行全体・列全体に対応します。名前付き範囲や複数の離れた範囲は対象外です。
- URLからタブIDを取得できない場合はコピーせずエラーを表示します。対象タブを切り替えて開き直してください。
- サーバーへの送信、Google API認証、クリップボード読み取りは行いません。
- 自動チェック：`node --test content.test.cjs`。模擬DOMでメニュー操作からコピー内容までを確認します。Chromeの実Google Sheetsでも、行範囲 `7:8` とセル範囲 `B2:D10` でExの表示位置・再表示・「コピーしました」表示まで確認済みです（0.1.2）。貼り付け先でのリンク保持は別途確認が必要です。

実機確認：範囲選択 → Ex → Google Docs等に貼り付け → 表示名とクリック先を確認し、タブを切り替えて再度確認してください。

拡張機能の実装方式：[Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)、[clipboardWrite権限](https://developer.chrome.com/docs/extensions/reference/permissions-list)。

## 公開用ファイル

- `python3 scripts/package.py`：`dist/` にストア提出用ZIPを生成します。PSD、説明文、テストはZIPに含めません。
- [アイコンPSD](assets/source/icon.psd)：512×512、背景・表・リンク下地・リンクの4レイヤー。各レイヤーはラスターレイヤーです。
- [サムネイルPSD](assets/source/thumbnail.psd)：440×280、背景・アイコン・タイトル・説明文・帯背景・帯文字の6レイヤー。文字もラスターレイヤーです。文字内容の編集は [SVG](assets/source/promo.svg) で行い、`python3 scripts/build_thumbnail.py` で再生成できます。
- [アイコンSVG](assets/source/icon.svg)：形状を編集できるベクター原稿。
- [アイコンプレビュー](assets/icon-preview.png)、[紹介画像](assets/promo-440x280.png)、[実画面スクリーンショット](assets/screenshot-1280x800.png)。
- [ストア掲載文と公開手順](docs/store-listing.md)、[プライバシーポリシー](docs/privacy.md)。

配布チェック：`python3 scripts/check_package.py`。
アイコンを作り直す場合：`python3 scripts/build_icon.py`（制作環境にImageMagick・Pillow・psd-toolsが必要。拡張利用時は不要）。SVGとPSDはこのスクリプトから生成されるため、再生成すると手編集は上書きされます。

ストアへの審査提出・公開はまだ行っていません。提出時にサポート連絡先と公開済みプライバシーポリシーURLを登録してください。
