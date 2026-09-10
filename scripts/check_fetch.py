"""Run the CSV redirect regression in Chrome, using only local test servers."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import subprocess
import tempfile
import threading

source = (Path(__file__).resolve().parents[1] / 'content.js').read_text()
authenticated = []


class CSV(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/csv')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'"label"')


class Sheet(CSV):
    def do_GET(self):
        if '/export?' in self.path:
            authenticated.append('test_session=1' in self.headers.get('Cookie', ''))
            self.send_response(307)
            self.send_header('Location', f'http://127.0.0.1:{csv.server_port}/cell.csv')
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Set-Cookie', 'test_session=1; Path=/')
        self.end_headers()
        self.wfile.write(('''<!doctype html><body>
<input class="docs-title-input" value="File">
<div class="docs-sheet-active-tab"><span class="docs-sheet-tab-name">Tab</span></div>
<input id="t-name-box" value="A:A">
<div><div role="menuitem">Get link to this range</div></div>
<pre id="result">WAITING</pre>
<script>
window.alert = message => { document.querySelector('#result').textContent = message; };
Object.defineProperty(navigator, 'clipboard', { value: { async write(items) {
  const text = await (await items[0].getType('text/plain')).text();
  document.querySelector('#result').textContent = text === 'File-Tab-label列' ? 'PASS' : text;
} }});
</script><script>''' + source + '''</script><script>
(async () => {
  try {
    await fetch('/export?format=csv', {credentials: 'include'});
    document.querySelector('#result').textContent = 'FAIL: old request unexpectedly succeeded';
    return;
  } catch {} // The previous credential mode must fail under real CORS enforcement.
  document.querySelector('.morn-sheet-link').dispatchEvent(new MouseEvent('mousedown', {button: 0}));
})();
</script>''').encode())


csv = ThreadingHTTPServer(('127.0.0.1', 0), CSV)
sheet = ThreadingHTTPServer(('127.0.0.1', 0), Sheet)
for server in [csv, sheet]:
    threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    chrome = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    with tempfile.TemporaryDirectory() as profile:
        result = subprocess.run([
            chrome, '--headless', '--no-first-run', f'--user-data-dir={profile}',
            '--dump-dom', '--virtual-time-budget=5000',
            f'http://127.0.0.1:{sheet.server_port}/spreadsheets/d/example/edit#gid=456',
        ], capture_output=True, text=True, timeout=30, check=True)
    assert '<pre id="result">PASS</pre>' in result.stdout, result.stdout
    assert len(authenticated) == 2 and all(authenticated), authenticated
    print('Chrome checked: old credentials fail CORS; fixed request copies heading and keeps initial authentication.')
finally:
    sheet.shutdown()
    csv.shutdown()
