// Hide group & people suggestions in the main feed (PL + EN, text-based detection)
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
  // Posts from non-followed pages/people show a follow chip next to the author name
  const FOLLOW_LABELS = ['obserwuj', 'follow', 'śledź'];
  const FOLLOW_ZONE_PX = 200; // chip must sit in the card header, not in a nested shared post
  const CARD = '[data-tracking-duration-id]';
  const FLAG = 'data-mb-sugg-hidden';
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
  const hasFollowChip = (card) => {
    const cardTop = card.getBoundingClientRect().top;
    const spans = card.querySelectorAll('.native-text, span');
    for (const el of spans) {
      const txt = el.textContent?.trim().toLowerCase();
      if (txt && FOLLOW_LABELS.includes(txt) &&
          el.getBoundingClientRect().top - cardTop < FOLLOW_ZONE_PX) {
        return true;
      }
    }
    return false;
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
    if (hasFollowChip(card)) hideCard(card);
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
