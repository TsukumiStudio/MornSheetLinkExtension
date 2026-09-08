"""Create the Chrome Web Store upload ZIP from runtime files only."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text())
files = {'manifest.json'}
for script in manifest['content_scripts']:
    files.update(script.get('js', []))
    files.update(script.get('css', []))
files.update(manifest.get('icons', {}).values())
for name in files:
    path = (root / name).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f'Missing or invalid runtime file: {name}')
output = root / 'dist' / f'MornSheetLinkExtension-{manifest["version"]}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in sorted(files):
        archive.write(root / name, name)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == files
print(output)
