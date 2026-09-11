(() => {
  document.documentElement.setAttribute('data-morn-sheet-link', '0.1.4');
  const label = "この範囲へのリンクを取得Ex";
  const menuLabels = [
    "セルでの他の操作項目を表示", "行での他の操作項目を表示", "列での他の操作項目を表示",
    "View more cell actions", "View more row actions", "View more column actions",
  ].map(text => text.replace(/\s/g, '').toLowerCase());
  let copying = false;

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
    let selection = range.replace(':', '〜');
    if (/^(?:[A-Z]+:[A-Z]+|\d+:\d+)$/.test(range)) {
      const [start, end] = range.split(':');
      const isRow = /^\d/.test(range);
      const nameBox = document.querySelector('#t-name-box');
      const formula = document.querySelector('#t-formula-bar-input .cell-input');
      if (!formula) throw new Error('数式バーを表示してから、もう一度コピーしてください。');
      const scroll = [...document.querySelectorAll('.native-scrollbar')].map(element =>
        ({ element, left: element.scrollLeft, top: element.scrollTop }));
      const select = value => {
        nameBox.value = value;
        nameBox.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
        }));
      };
      try {
        const headings = (start === end ? [start] : [start, end]).map(index => {
          select(isRow ? `A${index}` : `${index}1`);
          // ponytail: read literal headings from Sheets' formula bar; formula results need a displayed-value source.
          const heading = formula.innerText.trim();
          if (heading.startsWith('=')) throw new Error('数式で作られた要素名は取得できません。');
          return heading || index;
        });
        selection = `${headings.join('〜')}${isRow ? '行' : '列'}`;
      } finally {
        select(range);
        for (const { element, left, top } of scroll) {
          element.scrollLeft = left;
          element.scrollTop = top;
        }
      }
    }
    url.search = `gid=${gid}`;
    url.hash = `gid=${gid}&range=${range}`;
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
      if (!document.hasFocus()) {
        throw new Error('シートをクリックしてから、もう一度コピーしてください。');
      }
      const { text, html } = readLink();
      // Read the displayed heading and start writing in the same user action.
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
          !menuLabels.some(label => text.startsWith(label))) continue;
      const menu = original.parentElement;
      const existing = menu.querySelector('.morn-sheet-link');
      if (existing) {
        if (menu.lastElementChild !== existing) menu.append(existing);
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
      menu.append(button);
    }
  }

  new MutationObserver(addMenuItem).observe(document.body, {
    childList: true, characterData: true, subtree: true,
  });
  addMenuItem();
})();
