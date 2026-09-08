(() => {
  document.documentElement.setAttribute('data-morn-sheet-link', '0.1.2');
  const label = "この範囲へのリンクを作成 Ex";
  const originalLabels = [
    "この範囲へのリンクを取得", "このセルへのリンクを取得",
    "この範囲へのリンクを作成", "このセルへのリンクを作成",
    "Get link to this range", "Get link to this cell",
  ].map(text => text.replace(/\s/g, '').toLowerCase());

  function readLink() {
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
    url.search = '';
    url.hash = `gid=${gid}&range=${encodeURIComponent(range)}`;
    const text = `${file}_${sheet}_${range}`;
    const anchor = document.createElement('a');
    anchor.href = url.href;
    anchor.textContent = text;
    return { text, html: anchor.outerHTML };
  }

  async function copyLink(button) {
    try {
      const { text, html } = readLink();
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      button.textContent = 'コピーしました';
    } catch (error) {
      button.textContent = 'コピーできませんでした';
      alert(`Morn Sheet Link: ${error.message}`);
    }
    setTimeout(() => { button.textContent = label; }, 2000);
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
