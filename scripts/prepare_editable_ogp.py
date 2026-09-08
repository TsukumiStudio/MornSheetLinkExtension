"""Prepare non-text layers and a text specification for native Photoshop authoring.
The final editable PSD is saved by Photoshop, never by this raster renderer.
"""
from pathlib import Path
from copy import deepcopy
import base64
from io import BytesIO
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from PIL import Image
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
ns = '{http://www.w3.org/2000/svg}'
svg = ET.parse(root / 'assets/source/ogp.svg').getroot()
size = (1920, 1080)
psd = PSDImage.new('RGBA', size, (0, 0, 0, 0))
texts = []
parts = []
for section in svg:
    for i, child in enumerate(section):
        if child.tag == ns + 'defs':
            continue
        if child.tag == ns + 'text':
            attrs = {**section.attrib, **child.attrib}
            family = attrs.get('font-family', 'Helvetica')
            font = 'HiraginoSans-W3' if family == 'Hiragino Sans' else ('Helvetica-Bold' if attrs.get('font-weight') == 'bold' else 'Helvetica')
            color = attrs.get('fill', '#424e16').lstrip('#')
            texts.append({'section': section.get('id'), 'text': child.text,
                          'font': font, 'size': int(attrs['font-size']),
                          'x': int(attrs['x']), 'y': int(attrs['y']),
                          'anchor': attrs.get('text-anchor', 'start'),
                          'tracking': int(attrs.get('letter-spacing', '0')),
                          'color': dict(zip(('red', 'green', 'blue'), [int(color[n:n+2],16) for n in (0,2,4)]))})
        elif section.get('id') == 'Brand' and child.tag == ns + 'g':
            for piece in child:
                wrapper = ET.Element(child.tag, child.attrib)
                wrapper.append(deepcopy(piece))
                parts.append(('Icon / ' + piece.get('id'), wrapper))
        else:
            parts.append((section.get('id') + ' / ' + str(i+1), child))
ET.register_namespace('', ns[1:-1])
with tempfile.TemporaryDirectory() as directory:
    for name, element in parts:
        pixels = Image.new('RGBA', size)
        if element.tag == ns + 'image':
            uri = element.get('{http://www.w3.org/1999/xlink}href')
            assert uri.startswith('data:image/png;base64,')
            picture = Image.open(BytesIO(base64.b64decode(uri.split(',',1)[1]))).convert('RGBA')
            dimensions = tuple(round(float(element.get(k))) for k in ('width','height'))
            position = tuple(round(float(element.get(k))) for k in ('x','y'))
            pixels.alpha_composite(picture.resize(dimensions, Image.Resampling.LANCZOS), position)
            name = 'Screenshot / Image'
        else:
            layer = ET.Element(svg.tag, svg.attrib)
            for defs in svg.iter(ns+'defs'):
                layer.append(deepcopy(defs))
            ET.SubElement(layer, ns+'rect', {'width':'1920','height':'1080','fill':'none'})
            layer.append(deepcopy(element))
            vector, raster = Path(directory)/'layer.svg', Path(directory)/'layer.png'
            ET.ElementTree(layer).write(vector, encoding='unicode')
            subprocess.run(['magick','-background','none',str(vector),str(raster)],check=True)
            pixels = Image.open(raster).convert('RGBA')
        psd.create_pixel_layer(pixels, name=name)
assert len(texts) == 10 and len(parts) == 11
output = root/'dist/editable-ogp'
output.mkdir(parents=True, exist_ok=True)
psd.save(output/'base.psd')
(output/'text-spec.json').write_text(json.dumps(texts,ensure_ascii=False,indent=2))
print(f'{len(parts)} separate artwork layers and {len(texts)} native text specifications: {output}')
