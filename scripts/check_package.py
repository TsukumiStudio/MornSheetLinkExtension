"""Check the actual uploader artifact without touching the working tree."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
expected = {'manifest.json', 'content.js', 'content.css',
            'icons/icon-16.png', 'icons/icon-32.png',
            'icons/icon-48.png', 'icons/icon-128.png'}
with tempfile.TemporaryDirectory() as directory:
    copy = Path(directory)
    for name in expected | {'scripts/package.py'}:
        (copy / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(root / name, copy / name)
    (copy / 'private.psd').write_bytes(b'must not ship')
    (copy / '.env').write_text('SECRET=must-not-ship')
    subprocess.run([sys.executable, str(copy / 'scripts/package.py')], check=True, capture_output=True)
    with ZipFile(next((copy / 'dist').glob('*.zip'))) as archive:
        assert set(archive.namelist()) == expected, 'Unexpected distribution files'
        for name in expected:
            assert archive.read(name) == (copy / name).read_bytes(), name
    (copy / 'content.js').unlink()
    failed = subprocess.run([sys.executable, str(copy / 'scripts/package.py')], capture_output=True)
    assert failed.returncode != 0, 'Missing content.js must reject packaging'
print('Package checked: 7 runtime files, no source/test/private files, missing asset rejected.')
