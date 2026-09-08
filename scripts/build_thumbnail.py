"""Convert the thumbnail SVG into a layered PSD without changing its design."""
from pathlib import Path
from copy import deepcopy
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from PIL import Image
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
svg = ET.parse(root / 'assets/source/promo.svg').getroot()
size = (int(svg.attrib['width']), int(svg.attrib['height']))
names = ['Background', 'Icon', 'Title', 'Subtitle', 'Label background', 'Label']
assert len(svg) == len(names), 'Update layer names when the SVG structure changes'
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
        psd.create_pixel_layer(Image.open(raster).convert('RGBA'), name=name)
output = root / 'assets/source/thumbnail.psd'
psd.save(output)
reopened = PSDImage.open(output)
assert reopened.size == (440, 280)
assert [layer.name for layer in reopened] == names
reopened.composite().save(root / 'assets/thumbnail-preview.png')
print(output)
