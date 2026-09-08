"""Verify the delivery PSD contains real editable text, not raster lookalikes."""
from pathlib import Path
import sys
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'assets/source/ogp-editable.psd'
psd = PSDImage.open(path)
expected = {'Morn Sheet Link', 'CHROME EXTENSION', '選択範囲を、',
            'ハイパーリンクとして', 'コピー。',
            'Google スプレッドシートの右クリックに', '「リンクを作成 Ex」を追加。',
            'COPY AS A LINK', '売上管理_9月_B2:D10', 'TSUKUMI STUDIO'}
leaves = [layer for layer in psd.descendants() if not layer.is_group()]
texts = [layer for layer in leaves if layer.kind == 'type']
assert psd.size == (1920, 1080), 'Expected FHD PSD'
assert len(leaves) == 21, 'Expected 21 separately editable elements'
assert len(texts) == 10, 'Expected 10 native text layers'
assert {layer.text.rstrip('\r') for layer in texts} == expected, 'Text content missing or changed'
assert sum(layer.is_group() for layer in psd.descendants()) == 5, 'Expected five organizational groups'
for layer in texts:
    assert layer.engine_dict['StyleRun']['RunArray'], f'Missing text style: {layer.name}'
    left, top, right, bottom = layer.bbox
    assert 0 <= left < right <= 1920 and 0 <= top < bottom <= 1080, f'Text outside canvas: {layer.name}'
print('Verified FHD PSD: 21 elements, 10 native text layers, five groups, all text within canvas.')
