"""Export the saved Photoshop icon without replacing its editable source."""
from pathlib import Path
from PIL import Image
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
psd = PSDImage.open(root / 'assets/source/icon.psd')
assert psd.size == (1024, 1024), 'Expected the 1024px icon source'
image = psd.topil()
assert image is not None, 'Save the PSD in Photoshop with a composite preview'
image.save(root / 'assets/icon-preview.png')
for size in (16, 32, 48, 128):
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'icons/icon-{size}.png')
print('Exported icon preview and 16/32/48/128px PNGs; PSD and SVG preserved.')
