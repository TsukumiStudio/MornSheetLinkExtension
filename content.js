(() => {
  document.documentElement.setAttribute('data-morn-sheet-link', '0.1.3');
  const label = "この範囲へのリンクを取得Ex";
  const originalLabels = [
    "この範囲へのリンクを取得", "このセルへのリンクを取得",
    "この範囲へのリンクを作成", "このセルへのリンクを作成",
    "Get link to this range", "Get link to this cell",
  ].map(text => text.replace(/\s/g, '').toLowerCase());
  let copying = false;

  async function readHeading(pageUrl, gid, cell) {
    const url = new URL(pageUrl);
    const authuser = url.searchParams.get('authuser');
    url.pathname = url.pathname.replace(/\/edit\/?$/, '/export');
    url.hash = '';
    url.search = new URLSearchParams({ format: 'csv', gid, range: cell });
    if (authuser !== null) url.searchParams.set('authuser', authuser);
    for (let attempt = 0; attempt < 3; attempt++) {
      let retryable = true;
      try {
        // ponytail: single-cell CSV export; update this endpoint if Sheets changes it.
        // Authenticate on docs.google.com; the CSV redirect uses wildcard CORS without credentials.
        const response = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store' });
        const type = response.headers.get('content-type') ?? 'Content-Typeなし';
        const login = response.url && new URL(response.url).hostname === 'accounts.google.com';
        retryable = !login && (response.ok || response.status === 408 || response.status === 429 || response.status >= 500);
        if (!response.ok || !type.toLowerCase().includes('text/csv')) {
          throw new Error(login ? 'ログイン画面に転送されました' : `HTTP ${response.status} / ${type}`);
        }
        const csv = (await response.text()).replace(/^\uFEFF/, '').replace(/\r?\n$/, '');
        retryable = false;
        // Reject anything other than one CSV cell, including login/error pages.
        if (!/^(?:"(?:[^"]|"")*"|[^",\r\n]*)$/.test(csv)) {
          throw new Error('取得したCSVが1セル分ではありません');
        }
        return (csv.startsWith('"') ? csv.slice(1, -1).replaceAll('""', '"') : csv).trim();
      } catch (error) {
        if (!retryable || attempt === 2) {
          throw new Error(`${cell}の要素名を取得できません（${error.message}）。`);
        }
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  async function readLink() {
    const file = document.querySelector('input.docs-title-input')?.value?.trim();
    const sheet = document.querySelector('.docs-sheet-active-tab .docs-sheet-tab-name')?.textContent?.trim();
    const range = document.querySelector('#t-name-box')?.value?.trim().toUpperCase();
    const url = new URL(location.href);
    const gid = new URLSearchParams(url.hash.slice(1)).get('gid') ?? url.searchParams.get('gid');
    // ponytail: DOM selectors support the current Sheets editor; update if Google changes its UI.
    if (!file || !sheet || !range || !/^\d+$/.test(gid ?? '') ||
        !/^(?:[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?|[A-Z]+:[A-Z]+|[1-9]\d*:[1-9]\d*)$/.test(range)) {
      throw new Error('選択範囲を取得できません。タブを開き直し、セル範囲を選んでください。');
    }
    let selection = range.replace(':', '〜');
    if (/^(?:[A-Z]+:[A-Z]+|\d+:\d+)$/.test(range)) {
      const [start, end] = range.split(':');
      const isRow = /^\d/.test(range);
      const headings = [];
      for (const index of start === end ? [start] : [start, end]) {
        headings.push(await readHeading(url.href, gid, isRow ? `A${index}` : `${index}1`) || index);
      }
      selection = `${headings.join('〜')}${isRow ? '行' : '列'}`;
    }
    url.search = '';
    url.hash = `gid=${gid}&range=${encodeURIComponent(range)}`;
    const text = `${file}-${sheet}-${selection}`;
    const anchor = document.createElement('a');
    anchor.href = url.href;
    anchor.textContent = text;
    return { text, html: anchor.outerHTML };
  }

  async function copyLink(button) {
    if (copying) return;
    copying = true;
    button.textContent = 'コピー中…';
    try {
      const { text, html } = await readLink();
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      button.textContent = 'コピーしました';
      // Dismiss the menu only after the clipboard write succeeds.
      for (const type of ['mousedown', 'mouseup']) {
        document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
      }
    } catch (error) {
      button.textContent = 'コピーできませんでした';
      alert(`Morn Sheet Link: ${error.message}`);
    } finally {
      copying = false;
    }
    setTimeout(() => { if (!copying) button.textContent = label; }, 2000);
  }

  function addMenuItem() {
    for (const original of document.querySelectorAll('[role="menuitem"], .goog-menuitem')) {
      const text = original.textContent.replace(/\s/g, '').toLowerCase();
      if (original.matches('.morn-sheet-link') ||
          !originalLabels.some(label => text.startsWith(label))) continue;
      const existing = original.parentElement.querySelector('.morn-sheet-link');
      if (existing) {
        if (original.nextElementSibling !== existing) original.after(existing);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'morn-sheet-link';
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      // Keep Sheets from consuming the click or moving the selected range.
      button.addEventListener('mousedown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        void copyLink(button);
      });
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail === 0) void copyLink(button);
      });
      original.after(button);
    }
  }

  new MutationObserver(addMenuItem).observe(document.body, {
    childList: true, characterData: true, subtree: true,
  });
  addMenuItem();
})();
