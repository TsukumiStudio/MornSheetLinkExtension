const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('Ex menu copies escaped HTML and current selection, rejects unknown ranges', async () => {
  let button, observe, written, failure;
  const outsideEvents = [];
  const requests = [];
  const retryDelays = [];
  const cells = { A1: 'label', C1: 'description', A7: 'item_honya', A8: 'item_cafe', AA1: '' };
  const fields = {
    'input.docs-title-input': { value: '売上<&"' },
    '.docs-sheet-active-tab .docs-sheet-tab-name': { textContent: '9月' },
    '#t-name-box': { value: 'B2:D10' },
  };
  const original = {
    textContent: 'この範囲へのリンクを取得',
    matches: () => false,
    parentElement: { querySelector: () => button },
    after: node => { button = node; original.nextElementSibling = node; },
  };
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const context = {
    URL, URLSearchParams, Blob,
    location: { href: 'https://docs.google.com/spreadsheets/d/example/edit?usp=sharing#gid=123' },
    document: {
      body: { dispatchEvent(event) { outsideEvents.push(event); } },
      documentElement: { setAttribute() {} },
      querySelector: selector => fields[selector],
      querySelectorAll: selector => selector.includes('.goog-menuitem') ? [original] : [],
      createElement: tag => tag === 'a' ? {
        get outerHTML() { return `<a href="${escape(this.href)}">${escape(this.textContent)}</a>`; },
      } : { handlers: {}, setAttribute() {}, addEventListener(type, fn) { this.handlers[type] = fn; } },
    },
    MutationObserver: class { constructor(fn) { observe = fn; } observe() {} },
    ClipboardItem: class { constructor(data) { this.data = data; } },
    MouseEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    navigator: { clipboard: { async write(items) { written = items[0].data; } } },
    fetch: async (href, options) => {
      const url = new URL(href);
      requests.push(url);
      assert.equal(url.pathname, '/spreadsheets/d/example/export');
      assert.equal(url.searchParams.get('gid'), '456');
      assert.equal(url.searchParams.get('format'), 'csv');
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      const value = cells[url.searchParams.get('range')];
      assert.notEqual(value, undefined, 'only heading cells should be fetched');
      return { ok: true, headers: { get: () => 'text/csv; charset=utf-8' },
        text: async () => `"${value.replaceAll('"', '""')}"\r\n` };
    },
    alert: message => { failure = message; },
    setTimeout(fn, delay) {
      if (delay < 2000) { retryDelays.push(delay); queueMicrotask(fn); }
    },
  };
  vm.runInNewContext(readFileSync('content.js', 'utf8'), context);
  assert.equal(button.textContent, 'この範囲へのリンクを取得Ex');
  const first = button;
  observe();
  assert.equal(button, first, 'menu must not duplicate');
  original.nextElementSibling = null; // Sheets rebuilds and reorders its menu.
  observe();
  assert.equal(original.nextElementSibling, first, 'Ex stays below the native link item');
  async function click() {
    let prevented = false;
    button.handlers.mousedown({ button: 0, preventDefault() { prevented = true; }, stopPropagation() {} });
    assert.ok(prevented, 'mouse down must not move focus out of the menu');
    await new Promise(resolve => setImmediate(resolve));
  }
  const normalWrite = context.navigator.clipboard.write;
  let finishWrite;
  const clipboardPending = new Promise(resolve => { finishWrite = resolve; });
  context.navigator.clipboard.write = async items => {
    await clipboardPending;
    await normalWrite(items);
  };
  await click();
  assert.equal(button.textContent, 'コピー中…');
  assert.equal(outsideEvents.length, 0, 'menu stays open until clipboard write completes');
  assert.equal(written, undefined);
  finishWrite();
  await new Promise(resolve => setImmediate(resolve));
  context.navigator.clipboard.write = normalWrite;
  assert.deepEqual(outsideEvents.map(event => event.type), ['mousedown', 'mouseup']);
  assert.ok(outsideEvents.every(event => event.bubbles && event.button === 0));
  assert.equal(await written['text/plain'].text(), '売上<&"-9月-B2〜D10');
  assert.equal(await written['text/html'].text(), '<a href="https://docs.google.com/spreadsheets/d/example/edit#gid=123&amp;range=B2%3AD10">売上&lt;&amp;&quot;-9月-B2〜D10</a>');
  assert.equal(button.textContent, 'コピーしました');
  assert.equal(requests.length, 0, 'ordinary ranges do not fetch cells');
  fields['#t-name-box'].value = 'A:A';
  fields['.docs-sheet-active-tab .docs-sheet-tab-name'].textContent = '10月';
  context.location.href = 'https://docs.google.com/spreadsheets/d/example/edit#gid=456';
  await click();
  assert.equal(await written['text/plain'].text(), '売上<&"-10月-label列');
  assert.equal(requests.length, 1);
  assert.match(await written['text/html'].text(), /gid=456&amp;range=A%3AA/);
  for (const [range, label] of [['7:7', 'item_honya行'], ['7:8', 'item_honya〜item_cafe行'], ['A:C', 'label〜description列'], ['AA:AA', 'AA列'], ['C4', 'C4']]) {
    fields['#t-name-box'].value = range;
    await click();
    assert.equal(await written['text/plain'].text(), `売上<&"-10月-${label}`);
    assert.ok((await written['text/html'].text()).includes(`range=${encodeURIComponent(range)}`));
  }
  written = undefined;
  button.handlers.click({ detail: 0, preventDefault() {}, stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await written['text/plain'].text(), '売上<&"-10月-C4');
  fields['#t-name-box'].value = '7:7';
  cells.A7 = 'item_<&",\n本屋';
  context.location.href = 'https://docs.google.com/spreadsheets/d/example/edit?authuser=2#gid=456';
  await click();
  assert.equal(await written['text/plain'].text(), '売上<&"-10月-item_<&",\n本屋行');
  assert.ok((await written['text/html'].text()).includes('item_&lt;&amp;&quot;,\n本屋行'));
  assert.equal(requests.at(-1).searchParams.get('authuser'), '2');
  cells.A7 = '';
  await click();
  assert.equal(await written['text/plain'].text(), '売上<&"-10月-7行');
  cells.A7 = '0';
  await click();
  assert.equal(await written['text/plain'].text(), '売上<&"-10月-0行');
  const normalFetch = context.fetch;
  for (const transient of [
    { ok: false, status: 503, headers: { get: () => 'text/html' } },
    { ok: false, status: 429, headers: { get: () => 'text/html' } },
    { ok: true, status: 200, headers: { get: () => 'text/html' } },
    new Error('Failed to fetch'),
  ]) {
    let attempts = 0;
    context.fetch = async (...args) => {
      if (++attempts === 3) return normalFetch(...args);
      if (transient instanceof Error) throw transient;
      return transient;
    };
    failure = undefined;
    await click();
    assert.equal(attempts, 3);
    assert.deepEqual(retryDelays.slice(-2), [500, 1000]);
    assert.equal(failure, undefined);
    assert.equal(await written['text/plain'].text(), '売上<&"-10月-0行');
  }
  let active = 0;
  context.fetch = async (...args) => {
    assert.equal(++active, 1, 'heading requests must run sequentially');
    await Promise.resolve();
    const response = await normalFetch(...args);
    active--;
    return response;
  };
  fields['#t-name-box'].value = 'A:C';
  const before = requests.length;
  const copying = click();
  await click(); // A second activation while the first request is pending.
  await copying;
  assert.equal(requests.length - before, 2, 'duplicate activation must not fetch again');
  assert.equal(await written['text/plain'].text(), '売上<&"-10月-label〜description列');
  fields['#t-name-box'].value = '7:7';
  const closedBeforeFailures = outsideEvents.length;
  for (const response of [
    { ok: false, status: 403, headers: { get: () => 'text/html' }, attempts: 1, error: /HTTP 403/ },
    { ok: false, status: 503, headers: { get: () => 'text/html' }, attempts: 3, error: /HTTP 503/ },
    { ok: true, status: 200, headers: { get: () => 'text/html' }, attempts: 3, error: /HTTP 200 \/ text\/html/ },
    { ok: true, url: 'https://accounts.google.com/login', headers: { get: () => 'text/html' }, attempts: 1, error: /ログイン画面/ },
    { ok: true, headers: { get: () => 'text/csv' }, text: async () => 'a,b\r\nc,d', attempts: 1, error: /1セル分/ },
  ]) {
    let attempts = 0;
    context.fetch = async () => { attempts++; return response; };
    written = undefined;
    await click();
    assert.equal(written, undefined, 'failed heading fetch must not copy a misleading link');
    assert.match(failure, /要素名/);
    assert.match(failure, response.error);
    assert.equal(attempts, response.attempts);
  }
  context.fetch = async () => { throw new Error('offline'); };
  await click();
  assert.match(failure, /offline/);
  for (const range of ['Budget', 'A1,C3', '', 'A0']) {
    fields['#t-name-box'].value = range;
    written = undefined;
    await click();
    assert.equal(written, undefined);
    assert.match(failure, /選択範囲を取得できません/);
  }
  fields['#t-name-box'].value = 'A1';
  context.navigator.clipboard.write = async () => { throw new Error('denied'); };
  await click();
  assert.match(failure, /denied/);
  assert.equal(button.textContent, 'コピーできませんでした');
  assert.equal(outsideEvents.length, closedBeforeFailures, 'fetch and clipboard failures must not dismiss the menu');
});
