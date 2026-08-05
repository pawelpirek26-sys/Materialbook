// Hide group & people suggestions in the main feed (PL + EN, text-based detection)
// plus a per-card "ignore" button that builds a persistent user blocklist.
(() => {
  const PHRASES = [
    'sugerowane dla ciebie',
    'proponowane grupy',
    'proponowane dla ciebie',
    'osoby, które możesz znać',
    'grupy, które możesz polubić',
    'dołącz do grupy',
    'polecane grupy',
    'suggested for you',
    'suggested groups',
    'people you may know',
    'groups you may like',
    'join group',
  ];
  // Posts from non-followed pages/people show a follow chip next to the author name;
  // posts from suggested groups show a join chip instead
  const FOLLOW_LABELS = ['obserwuj', 'follow', 'śledź', 'dołącz', 'join'];
  const FOLLOW_ZONE_PX = 200; // chip must sit in the card header, not in a nested shared post
  // Group posts carry an "Author • 2 godz." line under the group name; posts from
  // followed pages/friends have a bare timestamp line starting with a digit instead
  const AUTHOR_TIME = /^[^\d•·].{0,60}?[•·]\s*\d+\s*(min|godz|tydz|mies|[a-z])\.?\s*([•·]|$)/i;
  const TIME_ROW = /^\d+\s*(min|godz|tydz|mies|[a-z])\.?\s*([•·]|$)/i;
  const CARD = '[data-tracking-duration-id]';
  const FLAG = 'data-mb-sugg-hidden';
  const BTN_FLAG = 'data-mb-ignore-btn';

  const STORE_KEY = 'mb_ignored_sources';
  let ignored;
  try {
    ignored = new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]'));
  } catch (e) {
    ignored = new Set();
  }
  const saveIgnored = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...ignored])); } catch (e) {}
  };

  const matches = (txt) => {
    const t = txt.toLowerCase();
    return PHRASES.some(p => t.includes(p));
  };

  const hideCard = (card) => {
    card.setAttribute(FLAG, '1');
    card.style.display = 'none';
    const gap = card.previousElementSibling;
    if (gap && !gap.matches(CARD)) gap.style.display = 'none';
  };

  const headerRows = (card) => {
    const cardTop = card.getBoundingClientRect().top;
    const rows = [];
    for (const el of card.querySelectorAll('.native-text, span')) {
      if (el.getBoundingClientRect().top - cardTop >= FOLLOW_ZONE_PX) continue;
      const txt = el.textContent?.trim();
      if (txt) rows.push({ el, txt });
    }
    return rows;
  };

  // Source name = first header row that is not a timestamp, chip or phrase row.
  // Cut at the first bullet, strip trailing decorations.
  const sourceName = (rows) => {
    for (const { txt } of rows) {
      if (txt.length < 2 || txt.length > 120) continue;
      if (TIME_ROW.test(txt)) continue;
      if (FOLLOW_LABELS.includes(txt.toLowerCase())) continue;
      const name = txt.split(/[•·]/)[0].replace(/[✓✔☑\s]+$/g, '').trim();
      if (name.length >= 2) return name.toLowerCase();
    }
    return null;
  };

  // FB overlays cards with transparent tap targets and handles gestures at the
  // document root, so listeners on the button itself never win. Instead a single
  // document-level capture handler (fires before anything FB attached below the
  // document) hit-tests the touch coordinates against registered buttons.
  const buttons = new Map(); // btn -> {card, rows}
  const HIT_PAD = 8;

  const ignoreSource = (card, rows) => {
    const name = sourceName(rows);
    if (name) {
      ignored.add(name);
      saveIgnored();
      document.querySelectorAll(CARD).forEach((c) => {
        if (c.hasAttribute(FLAG)) return;
        if (sourceName(headerRows(c)) === name) hideCard(c);
      });
    }
    hideCard(card);
  };

  const hitButton = (e) => {
    const p = e.touches?.[0] || e.changedTouches?.[0] || e;
    if (p.clientX == null) return null;
    for (const [btn, data] of buttons) {
      if (!btn.isConnected) { buttons.delete(btn); continue; }
      const r = btn.getBoundingClientRect();
      if (p.clientX >= r.left - HIT_PAD && p.clientX <= r.right + HIT_PAD &&
          p.clientY >= r.top - HIT_PAD && p.clientY <= r.bottom + HIT_PAD) {
        return { btn, data };
      }
    }
    return null;
  };

  for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click']) {
    document.addEventListener(type, (e) => {
      const hit = hitButton(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (type === 'touchend' || type === 'click') {
        buttons.delete(hit.btn);
        ignoreSource(hit.data.card, hit.data.rows);
      }
    }, { capture: true, passive: false });
  }

  const addIgnoreButton = (card, rows) => {
    if (card.hasAttribute(BTN_FLAG)) return;
    card.setAttribute(BTN_FLAG, '1');
    const btn = document.createElement('div');
    btn.textContent = '✕';
    btn.style.cssText =
      'position:absolute;top:6px;right:48px;z-index:9999;' +
      'width:32px;height:32px;line-height:32px;text-align:center;' +
      'border-radius:50%;background:rgba(120,120,120,.35);color:#fff;' +
      'font-size:15px;';
    if (!card.style.position) card.style.position = 'relative';
    card.appendChild(btn);
    buttons.set(btn, { card, rows });
  };

  const scanCard = (card) => {
    if (card.hasAttribute(FLAG)) return;
    const labels = card.querySelectorAll('.native-text > span, h3, [data-mcomponent="TextArea"] .native-text');
    for (const el of labels) {
      const txt = el.textContent?.trim();
      if (txt && txt.length < 60 && matches(txt)) {
        hideCard(card);
        return;
      }
    }
    const rows = headerRows(card);
    const name = sourceName(rows);
    if (name && ignored.has(name)) {
      hideCard(card);
      return;
    }
    for (const { txt } of rows) {
      if (FOLLOW_LABELS.includes(txt.toLowerCase())) { hideCard(card); return; }
      if (txt.length < 80 && AUTHOR_TIME.test(txt)) { hideCard(card); return; }
    }
    addIgnoreButton(card, rows);
  };

  const handle = (node) => {
    if (!(node instanceof HTMLElement)) return;
    const cards = node.matches?.(CARD) ? [node] : node.querySelectorAll?.(CARD) || [];
    cards.forEach(scanCard);
  };
  handle(document.body);
  new MutationObserver(muts =>
    muts.forEach(m => m.addedNodes.forEach(handle))
  ).observe(document.body, { childList: true, subtree: true });
})();
