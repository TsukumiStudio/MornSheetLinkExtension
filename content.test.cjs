const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('Ex menu copies escaped HTML and current selection, rejects unknown ranges', async () => {
  let button, observe, written, failure;
  const fields = {
    'input.docs-title-input': { value: '売上<&"' },
    '.docs-sheet-active-tab .docs-sheet-tab-name': { textContent: '9月' },
    '#t-name-box': { value: 'B2:D10' },
  };
  const original = {
    textContent: 'この範囲へのリンクを取得',
    matches: () => false,
    parentElement: { querySelector: () => button },
    after: node => { button = node; },
  };
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const context = {
    URL, URLSearchParams, Blob,
    location: { href: 'https://docs.google.com/spreadsheets/d/example/edit?usp=sharing#gid=123' },
    document: {
      body: {},
      querySelector: selector => fields[selector],
      querySelectorAll: selector => selector.includes('.goog-menuitem') ? [original] : [],
      createElement: tag => tag === 'a' ? {
        get outerHTML() { return `<a href="${escape(this.href)}">${escape(this.textContent)}</a>`; },
      } : { handlers: {}, setAttribute() {}, addEventListener(type, fn) { this.handlers[type] = fn; } },
    },
    MutationObserver: class { constructor(fn) { observe = fn; } observe() {} },
    ClipboardItem: class { constructor(data) { this.data = data; } },
    navigator: { clipboard: { async write(items) { written = items[0].data; } } },
    alert: message => { failure = message; },
    setTimeout() {},
  };
  vm.runInNewContext(readFileSync('content.js', 'utf8'), context);
  assert.equal(button.textContent, 'この範囲へのリンクを作成 Ex');
  const first = button;
  observe();
  assert.equal(button, first, 'menu must not duplicate');
  async function click() {
    button.handlers.click({ preventDefault() {}, stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
  }
  await click();
  assert.equal(await written['text/plain'].text(), '売上<&"_9月_B2:D10');
  assert.equal(await written['text/html'].text(), '<a href="https://docs.google.com/spreadsheets/d/example/edit#gid=123&amp;range=B2%3AD10">売上&lt;&amp;&quot;_9月_B2:D10</a>');
  assert.equal(button.textContent, 'コピーしました');
  fields['#t-name-box'].value = 'A:A';
  fields['.docs-sheet-active-tab .docs-sheet-tab-name'].textContent = '10月';
  context.location.href = 'https://docs.google.com/spreadsheets/d/example/edit#gid=456';
  await click();
  assert.equal(await written['text/plain'].text(), '売上<&"_10月_A:A');
  assert.match(await written['text/html'].text(), /gid=456&amp;range=A%3AA/);
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
});
