"""Compare editable OGP typography and layout with the copied source PSD."""
from math import isclose
from pathlib import Path
import sys
from PIL import Image, ImageChops
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'assets/source/ogp-editable.psd'
psd = PSDImage.open(path)
source = PSDImage.open(root / 'assets/source/reference/MornDesktopTube/ogp.psd')
expected = {
    'Brand rich': 'MornSheetLink',
    'Hero first': '選択範囲を、',
    'Hero second': 'リンクでコピー。',
    'Copy first': 'Google スプレッドシートを、便利に。',
    'Install label': 'Chrome 拡張',
    'macOS タグ文字': 'FREE',
    'Footer studio': 'TSUKUMI STUDIO',
}
layers = {layer.name: layer for layer in psd.descendants()}
originals = {layer.name: layer for layer in source.descendants()}
assert psd.size == source.size == (1200, 630), 'Expected 1200×630 OGP'
for name, text in expected.items():
    layer, original = layers[name], originals[name]
    assert layer.kind == 'type' and layer.is_visible(), f'Editable text missing: {name}'
    assert layer.text.rstrip('\r') == text, f'Unexpected text: {name}'
    style = layer.engine_dict['StyleRun']['RunArray'][0]['StyleSheet']['StyleSheetData']
    old = original.engine_dict['StyleRun']['RunArray'][0]['StyleSheet']['StyleSheetData']
    assert layer.resource_dict['FontSet'][int(style['Font'])]['Name'] == original.resource_dict['FontSet'][int(old['Font'])]['Name'], f'Font changed: {name}'
    for key in ('FontSize', 'Tracking', 'FillColor'):
        assert style[key] == old[key], f'{key} changed: {name}'
    # Badge wording changes width; its center stays fixed instead of its left edge.
    indices = (0, 1, 2, 3, 5) if name in ('Install label', 'macOS タグ文字') else range(6)
    assert all(isclose(layer._data.transform[i], original._data.transform[i], abs_tol=0.01) for i in indices), f'Position or scale changed: {name}'
    left, top, right, bottom = layer.bbox
    assert 0 <= left < right <= 1200 and 0 <= top < bottom <= 630, f'Text outside canvas: {name}'
assert layers['背景・グリッド'].is_group(), 'Original background group missing'
assert layers['ウィンドウと選択範囲（ベクトル）'].kind == 'smartobject', 'Window must stay editable'
assert layers['Sheet Link マーク'].kind == 'smartobject', 'Logo must stay editable'
assert layers['コピーするリンク名'].text.rstrip('\r') == '売上管理-9月-B2〜D10'
icon = PSDImage.open(root / 'assets/source/icon.psd')
assert icon.size == (1024, 1024), 'Expected 1024px icon source'
assert sum(layer.kind == 'smartobject' for layer in icon) == 2, 'Icon glyphs must stay editable'
for size in (16, 32, 48, 128):
    output = Image.open(root / f'icons/icon-{size}.png').convert('RGB')
    expected_icon = icon.topil().convert('RGB').resize((size, size), Image.Resampling.LANCZOS)
    assert output.size == (size, size), f'Wrong icon size: {size}'
    assert ImageChops.difference(output, expected_icon).getbbox() is None, f'Stale icon export: {size}'
print('Verified 1200×630 OGP: seven original text styles and positions, editable sources and four icon exports.')
