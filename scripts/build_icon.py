"""Render original vector artwork and a layered Photoshop source.
Requires ImageMagick, Pillow and psd-tools (authoring only).
"""
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageChops
from psd_tools import PSDImage

root = Path(__file__).resolve().parents[1]
parts = {
    'Background': '<rect x="48" y="48" width="416" height="416" rx="96" fill="#24253f"/>',
    'Sheet': '<rect x="120" y="116" width="256" height="244" rx="24" fill="none" stroke="#dad7ff" stroke-width="24"/><path d="M120 188h256M120 260h136M204 188v160" fill="none" stroke="#dad7ff" stroke-width="20"/>',
    'Link backing': '<rect x="229" y="229" width="204" height="178" rx="62" fill="#24253f"/>',
    'Link': '<g transform="rotate(-35 326 316)" fill="none" stroke="#79e8c5" stroke-width="24" stroke-linecap="round"><path d="M302 276h-26a40 40 0 0 0 0 80h26M350 276h26a40 40 0 0 1 0 80h-26M292 316h68"/></g>',
}
# Center the combined visible sheet/link bounds on the 512px canvas.
for name in ('Sheet', 'Link backing', 'Link'):
    parts[name] = f'<g transform="translate(-8 6)">{parts[name]}</g>'

def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">{body}</svg>'

source = root / 'assets/source/icon.svg'
source.write_text(svg(''.join(f'<g id="{name.replace(" ", "-")}">{body}</g>' for name, body in parts.items())))
psd = PSDImage.new('RGBA', (512, 512), (0, 0, 0, 0))
with tempfile.TemporaryDirectory() as temp:
    for name, body in parts.items():
        vector = Path(temp) / 'layer.svg'
        raster = Path(temp) / 'layer.png'
        vector.write_text(svg(body))
        subprocess.run(['magick', '-background', 'none', str(vector), str(raster)], check=True)
        psd.create_pixel_layer(Image.open(raster).convert('RGBA'), name=name)
    for size in [16, 32, 48, 128]:
        subprocess.run(['magick', '-background', 'none', str(source), '-resize', f'{size}x{size}', str(root / f'icons/icon-{size}.png')], check=True)
foreground = ImageChops.lighter(psd[1].topil().getchannel('A'), psd[3].topil().getchannel('A'))
left, top, right, bottom = foreground.getbbox()
assert abs((left + right) / 2 - 256) <= 1 and abs((top + bottom) / 2 - 256) <= 1, 'Icon foreground is not centered'
psd.save(root / 'assets/source/icon.psd')
psd.composite().save(root / 'assets/icon-preview.png')
assert [layer.name for layer in PSDImage.open(root / 'assets/source/icon.psd')] == list(parts)
print('Created SVG, 4-layer PSD and 16/32/48/128px PNG icons.')
