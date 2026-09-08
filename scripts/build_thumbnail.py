"""Convert the thumbnail SVG into a layered PSD without changing its design."""
from pathlib import Path
from copy import deepcopy
import subprocess
import sys
import base64
from io import BytesIO
import tempfile
import xml.etree.ElementTree as ET
from PIL import Image
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
artwork = sys.argv[1] if len(sys.argv) > 1 else 'promo'
if artwork not in ('promo', 'ogp'):
    raise ValueError('Expected promo or ogp')
svg = ET.parse(root / f'assets/source/{artwork}.svg').getroot()
size = (int(svg.attrib['width']), int(svg.attrib['height']))
names = ['Background', 'Icon', 'Title', 'Subtitle', 'Label background', 'Label']
assert len(svg) == len(names), 'Update layer names when the SVG structure changes'
names = [element.get('id', name) for element, name in zip(svg, names)]
psd = PSDImage.new('RGBA', size, (0, 0, 0, 0))
ET.register_namespace('', 'http://www.w3.org/2000/svg')
with tempfile.TemporaryDirectory() as directory:
    for name, element in zip(names, svg):
        layer = ET.Element(svg.tag, svg.attrib)
        ET.SubElement(layer, '{http://www.w3.org/2000/svg}rect', {
            'width': str(size[0]), 'height': str(size[1]), 'fill': 'none',
        })
        layer.append(deepcopy(element))
        vector = Path(directory) / 'layer.svg'
        raster = Path(directory) / 'layer.png'
        ET.ElementTree(layer).write(vector, encoding='unicode')
        subprocess.run(['magick', '-background', 'none', str(vector), str(raster)], check=True)
        pixels = Image.open(raster).convert('RGBA')
        # ImageMagick's SVG renderer omits embedded PNGs; place them from the SVG coordinates.
        for embedded in element.iter('{http://www.w3.org/2000/svg}image'):
            href = embedded.get('{http://www.w3.org/1999/xlink}href', '')
            if not href.startswith('data:image/png;base64,'):
                raise ValueError('Only embedded PNG images are supported')
            picture = Image.open(BytesIO(base64.b64decode(href.split(',', 1)[1]))).convert('RGBA')
            dimensions = tuple(round(float(embedded.get(key))) for key in ('width', 'height'))
            position = tuple(round(float(embedded.get(key, '0'))) for key in ('x', 'y'))
            pixels.alpha_composite(picture.resize(dimensions, Image.Resampling.LANCZOS), position)
        psd.create_pixel_layer(pixels, name=name)
stem = 'thumbnail' if artwork == 'promo' else 'ogp-tsukumi'
output = root / f'assets/source/{stem}.psd'
psd.save(output)
reopened = PSDImage.open(output)
assert reopened.size == ((440, 280) if artwork == 'promo' else (1920, 1080))
assert [layer.name for layer in reopened] == names
composite = reopened.composite()
if artwork == 'ogp':
    assert min(low for low, high in composite.convert('RGB').crop((920, 278, 1820, 840)).getextrema()) < 100, 'Screenshot is missing'
preview = 'thumbnail-preview.png' if artwork == 'promo' else 'ogp-tsukumi.png'
composite.save(root / f'assets/{preview}')
print(output)
