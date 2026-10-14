import { iconURL } from './icons.js';

const SLOT_COUNT = 27;
const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

function focusables(root) {
  return [...root.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
}

export function createUI({ chests, profile, onRequestChest, onClosed }) {
  const chat = $('#chat');
  const held = $('#held');
  const hotbar = $('#hotbar');
  const dim = $('#dim');
  const gui = $('#gui');
  const slots = $('#slots');
  const detail = $('#detail');
  const book = $('#book');

  let openId = null;
  let openScreen = null;
  let returnFocus = null;
  let heldTimer = 0;

  // Chat ----------------------------------------------------------------
  function say(text, who = 'Guide') {
    const line = el('p', {}, [el('span', { class: 'who', text: `<${who}> ` }), text]);
    chat.append(line);
    while (chat.children.length > 5) chat.firstElementChild.remove();
    setTimeout(() => line.classList.add('is-fading'), 11000);
    setTimeout(() => line.remove(), 11500);
  }

  // Hotbar -----------------------------------------------------------------
  const hotbarButtons = chests.map((c, i) =>
    el(
      'button',
      {
        type: 'button',
        'aria-label': `Open the ${c.title} chest`,
        'aria-keyshortcuts': String(i + 1),
        'data-id': c.id,
        onclick: () => onRequestChest(c.id),
        onmouseenter: () => showHeld(c.title),
        onfocus: () => showHeld(c.title),
      },
      [el('img', { src: iconURL(`chest-${c.kind}`), alt: '', width: 16, height: 16 }), el('span', { class: 'key', 'aria-hidden': 'true', text: String(i + 1) })],
    ),
  );
  hotbar.append(...hotbarButtons);

  function showHeld(text) {
    held.textContent = text;
    held.classList.remove('is-faded');
    clearTimeout(heldTimer);
    heldTimer = setTimeout(() => held.classList.add('is-faded'), 1800);
  }

  function setActive(id) {
    hotbarButtons.forEach((b) => (b.dataset.id === id ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    const c = chests.find((x) => x.id === id);
    if (c) showHeld(c.title);
  }

  // Item detail ------------------------------------------------------------
  function renderDetail(item, target = detail) {
    const nodes = [el('h3', { text: item.name })];
    if (item.meta) nodes.push(el('p', { class: 'meta', text: item.meta }));
    for (const t of item.text ?? []) nodes.push(el('p', { text: t }));
    if (item.list) nodes.push(el('ul', {}, item.list.map((t) => el('li', { text: t }))));
    if (item.tags) nodes.push(el('ul', { class: 'tags', 'aria-label': item.name }, item.tags.map((t) => el('li', { text: t }))));
    if (item.links) {
      nodes.push(
        el(
          'div',
          { class: 'links' },
          item.links.map((l) => {
            if (l.copy) {
              return el('button', {
                class: 'mc-button',
                type: 'button',
                text: l.label,
                onclick: async (e) => {
                  const btn = e.currentTarget;
                  try {
                    await navigator.clipboard.writeText(l.copy);
                    btn.textContent = 'Copied';
                    say(`Copied ${l.copy} to your clipboard.`);
                  } catch {
                    btn.textContent = l.copy;
                  }
                  setTimeout(() => (btn.textContent = l.label), 1600);
                },
              });
            }
            const external = /^https?:/.test(l.href);
            return el('a', {
              class: 'mc-button',
              href: l.href,
              text: l.label,
              download: l.download || undefined,
              target: external ? '_blank' : undefined,
              rel: external ? 'noopener' : undefined,
            });
          }),
        ),
      );
    }
    target.className = `detail rarity-${item.rarity ?? 'white'}`;
    target.replaceChildren(...nodes);
    target.scrollTop = 0;
  }

  function renderChest(c) {
    $('#gui-title').replaceChildren(c.title, el('small', { text: c.kindName }));
    const buttons = c.items.map((item, i) =>
      el(
        'button',
        {
          class: 'slot',
          type: 'button',
          'aria-label': item.name,
          'aria-pressed': 'false',
          'aria-controls': 'detail',
          tabindex: i === 0 ? '0' : '-1',
          onclick: () => select(i),
          onkeydown: (e) => {
            const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!dir) return;
            e.preventDefault();
            const next = (i + dir + c.items.length) % c.items.length;
            select(next);
            buttons[next].focus();
          },
        },
        [el('img', { src: iconURL(item.icon), alt: '', width: 16, height: 16 })],
      ),
    );
    const empty = Array.from({ length: SLOT_COUNT - buttons.length }, () => el('div', { class: 'slot', 'aria-hidden': 'true' }));
    slots.replaceChildren(...buttons, ...empty);

    function select(i) {
      buttons.forEach((b, j) => {
        b.setAttribute('aria-pressed', String(i === j));
        b.tabIndex = i === j ? 0 : -1;
      });
      renderDetail(c.items[i]);
    }
    select(0);
    return buttons[0];
  }

  // Screens ------------------------------------------------------------------
  function show(screen, focusTarget) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openScreen = screen;
    screen.hidden = false;
    screen.classList.remove('is-closing');
    dim.classList.add('is-on');
    requestAnimationFrame(() => screen.classList.add('is-open'));
    (focusTarget ?? focusables(screen)[0])?.focus({ preventScroll: true });
  }

  function hide(screen, { restoreFocus = true } = {}) {
    screen.classList.add('is-closing');
    screen.classList.remove('is-open');
    dim.classList.remove('is-on');
    const done = () => {
      if (!screen.classList.contains('is-open')) screen.hidden = true;
    };
    screen.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 220);
    if (openScreen === screen) openScreen = null;
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function openChest(id) {
    const c = chests.find((x) => x.id === id);
    if (!c) return;
    if (openScreen === book) hide(book, { restoreFocus: false });
    openId = id;
    setActive(id);
    const first = renderChest(c);
    const keepFocus = openScreen === gui;
    if (keepFocus) first.focus({ preventScroll: true });
    else show(gui, first);
    history.replaceState(null, '', `#${id}`);
  }

  function closeChest({ silent = false, restoreFocus = true } = {}) {
    if (!openId) return;
    const id = openId;
    openId = null;
    hide(gui, { restoreFocus });
    history.replaceState(null, '', location.pathname + location.search);
    onClosed(id, { silent });
  }

  // Whole CV book ------------------------------------------------------------
  const bookBody = $('#book-body');
  bookBody.className = 'detail';
  bookBody.append(
    el('section', {}, [
      el('p', { class: 'meta', text: `${profile.role} · ${profile.education}` }),
      el('p', { text: `${profile.email} · ${profile.phone} · Hong Kong` }),
      el('div', { class: 'links' }, [
        el('a', { class: 'mc-button', href: profile.cv, download: true, text: 'Download PDF' }),
        el('a', { class: 'mc-button', href: profile.github, target: '_blank', rel: 'noopener', text: 'GitHub' }),
        el('a', { class: 'mc-button', href: profile.linkedin, target: '_blank', rel: 'noopener', text: 'LinkedIn' }),
        el('a', { class: 'mc-button', href: profile.site, target: '_blank', rel: 'noopener', text: 'Website' }),
      ]),
    ]),
    ...chests
      .filter((c) => c.id !== 'contact')
      .map((c) =>
        el('section', {}, [
          el('h3', { class: 'chapter', text: c.title }),
          ...c.items.map((item) =>
            el('article', {}, [
              el('h4', { text: item.name }),
              item.meta && el('p', { class: 'meta', text: item.meta }),
              ...(item.text ?? []).map((t) => el('p', { text: t })),
              (item.list || item.tags) && el('ul', {}, (item.list ?? [item.tags.join(', ')]).map((t) => el('li', { text: t }))),
            ]),
          ),
        ]),
      ),
  );

  function openBook() {
    if (openId) closeChest({ restoreFocus: false });
    show(book, book.querySelector('[data-close]'));
  }

  $('#open-cv').addEventListener('click', openBook);

  // Shared screen behaviour --------------------------------------------------
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      if (openScreen === gui) closeChest();
      else if (openScreen === book) hide(book);
    }
  });
  dim.addEventListener('click', () => {
    if (openScreen === gui) closeChest();
    else if (openScreen === book) hide(book);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, textarea')) return;
    if (e.key === 'Escape' || (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey)) {
      if (openScreen === gui) {
        e.preventDefault();
        closeChest();
      } else if (openScreen === book) {
        e.preventDefault();
        hide(book);
      }
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= chests.length && !e.metaKey && !e.ctrlKey && !e.altKey) {
      onRequestChest(chests[n - 1].id);
      return;
    }
    if (e.key === 'Tab' && openScreen) {
      const list = focusables(openScreen);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  return {
    say,
    setActive,
    openChest,
    closeChest,
    get openId() {
      return openId;
    },
    get busy() {
      return openScreen !== null;
    },
  };
}
