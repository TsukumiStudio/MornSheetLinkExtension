const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('copies headings from the formula bar without fetching, preserving selection and scroll', async () => {
  let button, observe, written, failure;
  const outsideEvents = [];
  const selections = [];
  const scrollbar = { scrollLeft: 80, scrollTop: 120 };
  const cells = { A1: 'label', C1: 'description', A7: 'item_honya', A8: 'item_cafe', AA1: '' };
  const fields = {
    'input.docs-title-input': { value: '売上<&"' },
    '.docs-sheet-active-tab .docs-sheet-tab-name': { textContent: '9月' },
    '#t-name-box': {
      value: 'B2:D10',
      dispatchEvent(event) {
        assert.equal(event.type, 'keydown');
        assert.equal(event.key, 'Enter');
        assert.equal(event.keyCode, 13);
        selections.push(this.value);
        scrollbar.scrollTop = scrollbar.scrollLeft = 0;
        fields['#t-formula-bar-input .cell-input'].innerText = cells[this.value] ?? '';
      },
    },
    '#t-formula-bar-input .cell-input': { innerText: '' },
  };
  const original = {
    textContent: '行での他の操作項目を表示',
    matches: () => false,
    parentElement: {
      querySelector: () => button,
      append(node) { button = node; this.lastElementChild = node; },
    },
  };
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const context = {
    URL, URLSearchParams, Blob,
    location: { href: 'https://docs.google.com/spreadsheets/d/example/edit?usp=sharing#gid=123' },
    document: {
      hasFocus: () => true,
      body: { dispatchEvent(event) { outsideEvents.push(event); } },
      documentElement: { setAttribute() {} },
      querySelector: selector => fields[selector],
      querySelectorAll: selector => selector === '.native-scrollbar' ? [scrollbar] : [original],
      createElement: tag => tag === 'a' ? {
        get outerHTML() { return `<a href="${escape(this.href)}">${escape(this.textContent)}</a>`; },
      } : { handlers: {}, setAttribute() {}, addEventListener(type, fn) { this.handlers[type] = fn; } },
    },
    MutationObserver: class { constructor(fn) { observe = fn; } observe() {} },
    ClipboardItem: class { constructor(data) { this.data = data; } },
    MouseEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    KeyboardEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    navigator: { clipboard: { async write(items) { written = items[0].data; } } },
    fetch: () => { assert.fail('copy must not make network requests'); },
    alert: message => { failure = message; },
    setTimeout() {},
  };
  vm.runInNewContext(readFileSync('content.js', 'utf8'), context);
  const first = button;
  observe();
  assert.equal(button, first, 'menu must not duplicate');
  original.parentElement.lastElementChild = {};
  observe();
  assert.equal(original.parentElement.lastElementChild, first, 'Ex stays at the bottom of the top-level menu');
  for (const text of ['セルでの他の操作項目を表示', '列での他の操作項目を表示',
    'View more cell actions', 'View more row actions', 'View more column actions']) {
    original.textContent = text;
    button = undefined;
    observe();
    assert.ok(button, text);
    assert.equal(original.parentElement.lastElementChild, button);
  }
  original.textContent = 'この範囲へのリンクを取得';
  button = undefined;
  observe();
  assert.equal(button, undefined, 'must not add an item inside the old submenu');
  original.textContent = '行での他の操作項目を表示';
  observe();
  function activate() {
    let prevented = false;
    button.handlers.mousedown({ button: 0, preventDefault() { prevented = true; }, stopPropagation() {} });
    assert.ok(prevented);
  }
  const tick = () => new Promise(resolve => setImmediate(resolve));
  async function click() { activate(); await tick(); }
  const normalWrite = context.navigator.clipboard.write;
  let finishWrite;
  context.navigator.clipboard.write = async items => {
    await new Promise(resolve => { finishWrite = resolve; });
    await normalWrite(items);
  };
  activate();
  assert.equal(typeof finishWrite, 'function', 'clipboard write must start synchronously');
  assert.equal(button.textContent, 'コピー中…');
  assert.equal(outsideEvents.length, 0);
  const pending = finishWrite;
  activate();
  assert.equal(finishWrite, pending, 'duplicate activation must not start another write');
  finishWrite();
  await tick();
  context.navigator.clipboard.write = normalWrite;
  assert.deepEqual(outsideEvents.map(event => event.type), ['mousedown', 'mouseup']);
  assert.equal(await written['text/plain'].text(), '売上<&"-9月-B2〜D10');
  assert.equal(await written['text/html'].text(), '<a href="https://docs.google.com/spreadsheets/d/example/edit?gid=123#gid=123&amp;range=B2:D10">売上&lt;&amp;&quot;-9月-B2〜D10</a>');
  assert.equal(selections.length, 0, 'ordinary ranges must not navigate');
  fields['.docs-sheet-active-tab .docs-sheet-tab-name'].textContent = '10月';
  context.location.href = 'https://docs.google.com/spreadsheets/d/example/edit?authuser=2#gid=456';
  for (const [range, label, visited] of [
    ['A:A', 'label列', ['A1', 'A:A']],
    ['7:7', 'item_honya行', ['A7', '7:7']],
    ['7:8', 'item_honya〜item_cafe行', ['A7', 'A8', '7:8']],
    ['A:C', 'label〜description列', ['A1', 'C1', 'A:C']],
    ['AA:AA', 'AA列', ['AA1', 'AA:AA']],
    ['C4', 'C4', []],
  ]) {
    fields['#t-name-box'].value = range;
    selections.length = 0;
    await click();
    assert.equal(await written['text/plain'].text(), `売上<&"-10月-${label}`);
    assert.ok((await written['text/html'].text()).includes(`?gid=456#gid=456&amp;range=${range}`));
    assert.deepEqual(selections, visited);
    assert.equal(fields['#t-name-box'].value, range);
    assert.deepEqual(scrollbar, { scrollLeft: 80, scrollTop: 120 });
  }
  const exampleUrl = 'https://docs.google.com/spreadsheets/d/1clx0omYzhnZxXdQFEo0NXXpyTPpgjN8R4_4pKtUSvg8/edit';
  fields['#t-name-box'].value = 'J:J';
  cells.J1 = 'heading';
  for (const suffix of ['?gid=1002067929', '?gid=0#gid=1002067929']) {
    context.location.href = exampleUrl + suffix;
    await click();
    const href = (await written['text/html'].text()).match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&');
    assert.equal(href, exampleUrl + '?gid=1002067929#gid=1002067929&range=J:J');
  }
  fields['#t-name-box'].value = '7:7';
  for (const [value, label] of [['item_<&",\n本屋', 'item_<&",\n本屋'], ['', '7'], ['0', '0']]) {
    cells.A7 = value;
    await click();
    assert.equal(await written['text/plain'].text(), `売上<&"-10月-${label}行`);
  }
  written = undefined;
  button.handlers.click({ detail: 0, preventDefault() {}, stopPropagation() {} });
  await tick();
  assert.ok(written, 'keyboard activation also copies');
  const closedBeforeFailures = outsideEvents.length;
  cells.A7 = '=A1';
  written = undefined;
  await click();
  assert.match(failure, /数式/);
  assert.equal(written, undefined, 'must not silently use a formula instead of its result');
  assert.equal(fields['#t-name-box'].value, '7:7');
  assert.deepEqual(scrollbar, { scrollLeft: 80, scrollTop: 120 });
  delete fields['#t-formula-bar-input .cell-input'];
  await click();
  assert.match(failure, /数式バー/);
  for (const range of ['Budget', 'A1,C3', '', 'A0']) {
    fields['#t-name-box'].value = range;
    await click();
    assert.match(failure, /選択範囲を取得できません/);
  }
  fields['#t-name-box'].value = 'A1';
  context.document.hasFocus = () => false;
  await click();
  assert.match(failure, /シートをクリック/);
  context.document.hasFocus = () => true;
  context.navigator.clipboard.write = async () => { throw new Error('denied'); };
  await click();
  assert.match(failure, /denied/);
  assert.equal(button.textContent, 'コピーできませんでした');
  assert.equal(outsideEvents.length, closedBeforeFailures, 'failures must not dismiss the menu');
  context.navigator.clipboard.write = normalWrite;
  await click();
  assert.equal(button.textContent, 'コピーしました', 'failure must release the copy lock');
});
