// --- Location-aware base paths (root vs /pages/*) ---
const IS_SUBPAGE = /\/pages\//.test(location.pathname);
const BASE = IS_SUBPAGE ? '..' : '.';

// --- Config ---
// const PRODUCTS_URL = `${BASE}/products.json`;
const PRODUCTS_URL = `${BASE}/api/catalog`; // ← new

// Site config (logo path & name)
const SITE = {
  name: 'Shop Name',
  logo: `${BASE}/images/logo.png`,
  homeHref: `${BASE}/index.html`,
};

// --- State ---
let PRODUCTS = [];
let cart = JSON.parse(localStorage.getItem('cart') || '{}'); // {id: qty}
let activeDetail = null;

// ---- Currency config (prices in PRODUCTS are base EUR) ----
const CURRENCIES = {
  EUR: { label: 'EUR €', symbol: '€', rate: 1,     locale: 'en-US' },
  USD: { label: 'USD $', symbol: '$', rate: 1.08,  locale: 'en-US' },
  GBP: { label: 'GBP £', symbol: '£', rate: 0.85,  locale: 'en-GB' },
};
let currentCurrency = localStorage.getItem('currency') || 'EUR';

function money(eurAmount) {
  const cfg = CURRENCIES[currentCurrency] || CURRENCIES.EUR;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: currentCurrency,
  }).format((eurAmount || 0) * cfg.rate);
}
function setCurrency(code) {
  if (!CURRENCIES[code]) return;
  currentCurrency = code;
  localStorage.setItem('currency', code);
  syncCurrencyUI();
  rerenderPrices();
}
function syncCurrencyUI() {
  const sel = qs('#currency');
  if (sel) sel.value = currentCurrency;
}
function rerenderPrices() {
  renderProducts(PRODUCTS);
  renderCart();
  if (activeDetail) {
    const p = PRODUCTS.find((x) => x.id === activeDetail);
    if (p && qs('#pmPrice')) qs('#pmPrice').textContent = money(p.price);
  }
}

// --- Utils ---
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
const unique = (arr) => [...new Set(arr)];
const getStock = (p) => {
  const n = Number(p?.stock);
  return Number.isFinite(n) ? n : Infinity; // Infinity = untracked
};

function placeholderSVG(text = 'Product') {
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
<rect width='100%' height='100%' fill='%23f2f2f2'/>
<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-family='Inter,system-ui,Arial' font-size='24'>${text}</text>
</svg>`
  );
  return `url("data:image/svg+xml,${svg}")`;
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}
function updateCartCount() {
  const c = Object.values(cart).reduce((s, n) => s + n, 0);
  if (qs('#cartCount')) qs('#cartCount').textContent = c;
}

// --- Data loading ---
async function loadProducts() {
  const res = await fetch(PRODUCTS_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed loading ${PRODUCTS_URL}: ${res.status}`);
  PRODUCTS = await res.json();
}

function setActiveNavLinks() {
  const here = location.pathname.replace(/\/index\.html?$/, '/'); // treat index.html as /
  const all = document.querySelectorAll('#navDrawer .navlink');
  all.forEach((a) => {
    const href = a.getAttribute('href') || '';
    let abs = href.startsWith('http')
      ? href
      : new URL(href, location.origin + location.pathname).pathname;
    if (abs.endsWith('/index.html')) abs = abs.replace(/\/index\.html$/, '/');
    const isActive =
      (location.hash && href.endsWith(location.hash)) ||
      abs === here ||
      (IS_SUBPAGE && href.startsWith('../') && abs === here);
    a.classList.toggle('active', Boolean(isActive));
  });
}

// --- Product rendering ---
function renderProducts(list) {
  const grid = qs('#products');
  if (!grid) return;
  grid.innerHTML = '';

  list.forEach((p) => {
    const stock = getStock(p);
    const out = stock <= 0;

    const card = document.createElement('article');
    card.className = 'card' + (out ? ' disabled' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', p.title);

    const media = document.createElement('div');
    media.className = 'card-media';
    media.style.backgroundImage = p.image ? `url(${p.image})` : placeholderSVG('Product');
    media.style.backgroundSize = 'cover';
    media.style.backgroundPosition = 'center';
    media.style.position = 'relative';

    // Stock badge (if stock is tracked)
    if (Number.isFinite(Number(p.stock))) {
      const badge = document.createElement('div');
      badge.className = 'card-badge';
      if (stock <= 0) { badge.textContent = 'Out of stock'; badge.classList.add('out'); }
      else if (stock <= 3) { badge.textContent = `Only ${stock} left`; badge.classList.add('low'); }
      else { badge.textContent = 'In stock'; }
      media.appendChild(badge);
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
      <h3 class='card-title'>${p.title}</h3>
      <p class='muted' style='min-height:2.2em'>${p.excerpt || ''}</p>
      <div class='row'>
        <span class='price'>${money(p.price)}</span>
        <div class='row' style='gap:8px'>
          <a class='btn' data-details='1' href='${BASE}/pages/product.html?id=${p.id}'>Details</a>
          <button class='btn add' data-id='${p.id}' ${out ? 'disabled' : ''}>Add</button>
        </div>
      </div>`;

    // prevent Details link from opening the modal
    body.querySelector('[data-details]')?.addEventListener('click', (e)=> e.stopPropagation());

    card.appendChild(media);
    card.appendChild(body);

    card.addEventListener('click', () => { if (!out) openProduct(p.id); });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !out) { e.preventDefault(); openProduct(p.id); }
    });

    grid.appendChild(card);
  });

  const info = qs('#resultInfo');
  if (info) info.textContent = list.length ? `Showing ${list.length} product(s)` : 'No products found';

  qsa('.btn.add', grid).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(btn.dataset.id, 1);
    });
  });
}

function openProduct(id) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;
  activeDetail = id;
  const media = qs('#pmMedia');
  if (media) {
    media.style.background = '#f6f6f6';
    media.style.backgroundImage = p.image ? `url(${p.image})` : placeholderSVG(p.title);
    media.style.backgroundSize = 'cover';
    media.style.backgroundPosition = 'center';
  }
  if (qs('#pmTitle')) qs('#pmTitle').textContent = p.title;
  if (qs('#pmCategory')) qs('#pmCategory').textContent = p.category || '';
  if (qs('#pmPrice')) qs('#pmPrice').textContent = money(p.price);
  if (qs('#pmDesc')) qs('#pmDesc').textContent = p.description || p.excerpt || '';
  if (qs('#pmQty')) qs('#pmQty').value = 1;
  qs('#productModal')?.classList.add('show');
  qs('#productModal')?.setAttribute('aria-hidden', 'false');
}
function closeProduct() {
  qs('#productModal')?.classList.remove('show');
  qs('#productModal')?.setAttribute('aria-hidden', 'true');
  activeDetail = null;
}

// --- Stock-aware addToCart ---
function addToCart(id, qty = 1) {
  const p = PRODUCTS.find(x => x.id === id);
  const max = getStock(p);
  const current = cart[id] || 0;
  const toAdd = Math.max(1, Number(qty) || 1);
  const next = Math.min(current + toAdd, max);
  cart[id] = next;
  if (next === current && max !== Infinity) {
    alert('Sorry, no more stock for this item.');
  }
  saveCart();
}

// --- Cart ---
function openCart() {
  ensureNavInfrastructure();
  qs('#overlay')?.classList.add('show');
  qs('#cartDrawer')?.classList.add('open');
  qs('#cartDrawer')?.setAttribute('aria-hidden', 'false');
  renderCart();
}
function closeCart() {
  qs('#cartDrawer')?.classList.remove('open');
  qs('#cartDrawer')?.setAttribute('aria-hidden', 'true');
  if (!qs('#navDrawer')?.classList.contains('open')) {
    qs('#overlay')?.classList.remove('show');
  }
}

function renderCart() {
  const body = qs('#cartItems');
  if (!body) return;
  body.innerHTML = '';

  let total = 0;
  for (const id in cart) {
    const qty = cart[id];
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) continue;
    const line = p.price * qty;
    total += line;

    const row = document.createElement('div');
    row.className = 'cart-item';

    const img = document.createElement('img');
    img.alt = p.title;
    img.src =
      p.image ||
      `data:image/svg+xml;utf8,${decodeURIComponent(placeholderSVG(' ')).slice(26, -2)}`;

    const meta = document.createElement('div');
    meta.innerHTML = `
      <div style="font-weight:600">${p.title}</div>
      <div class='muted'>${money(p.price)}</div>
      ${Number.isFinite(Number(p.stock)) ? `<div class="tiny muted">Stock: ${Math.max(0, getStock(p))}</div>` : ''}`;

    const controls = document.createElement('div');
    controls.innerHTML = `
      <div class='qty'>
        <button class='btn' data-id='${p.id}' data-act='dec' aria-label='Decrease'>−</button>
        <span>${qty}</span>
        <button class='btn' data-id='${p.id}' data-act='inc' aria-label='Increase'>+</button>
      </div>
      <div style='text-align:right; margin-top:6px'>${money(line)}</div>
      <button class='btn' data-id='${p.id}' data-act='rm' style='margin-top:6px'>Remove</button>`;

    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(controls);
    body.appendChild(row);
  }

  if (qs('#cartTotal')) qs('#cartTotal').textContent = money(total);

  // Checkout button toggle + empty message
  const checkoutArea = qs('#checkoutArea');
  if (checkoutArea) {
    checkoutArea.innerHTML = '';
    if (total > 0) {
      const btn = document.createElement('a');
      btn.className = 'btn primary';
      btn.id = 'checkoutBtn';
      btn.textContent = 'Checkout';
      btn.href = `${BASE}/pages/checkout.html`;
      checkoutArea.appendChild(btn);
    } else {
      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.style.marginTop = '10px';
      msg.textContent = 'Your cart is empty.';
      checkoutArea.appendChild(msg);
    }
  }

  // Controls (stock-capped)
  qsa('.cart-item .btn', body).forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      const p = PRODUCTS.find(x=>x.id===id);
      const max = getStock(p);

      if (act === 'inc') {
        const want = (cart[id] || 0) + 1;
        cart[id] = Math.min(want, max);
        if (want > max && max !== Infinity) alert('Reached stock limit.');
      }
      if (act === 'dec') cart[id] = Math.max(0, (cart[id] || 0) - 1);
      if (act === 'rm') delete cart[id];
      if (cart[id] === 0) delete cart[id];
      saveCart();
      renderCart();
    });
  });
}

// --- NAV drawer (hamburger) ---
function ensureNavInfrastructure() {
  let overlay = qs('#overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }
  let nav = qs('#navDrawer');
  if (!nav) {
    nav = document.createElement('aside');
    nav.id = 'navDrawer';
    nav.className = 'drawer left';
    nav.setAttribute('aria-label', 'Site navigation');
    nav.setAttribute('aria-hidden', 'true');
    nav.innerHTML = `
      <header>
        <strong>Menu</strong>
        <button class="btn" id="closeMenu" aria-label="Close menu">Close</button>
      </header>
      <nav class="body" role="menu">
        <a class="navlink" href="${BASE}/index.html">Home</a>
        <a class="navlink" href="${BASE}/index.html#products">Shop</a>
        <a class="navlink" href="${BASE}/pages/about.html">About</a>
        <a class="navlink" href="${BASE}/pages/contact.html">Contact</a>
        <hr />
        <a class="navlink" href="${BASE}/pages/faq.html">FAQ</a>
        <a class="navlink" href="${BASE}/pages/shipping-returns.html">Shipping & Returns</a>
        <a class="navlink" href="${BASE}/pages/privacy.html">Privacy Policy</a>
        <a class="navlink" href="${BASE}/pages/terms.html">Terms of Service</a>
        <a class="navlink" href="${BASE}/pages/track-order.html">Track Order</a>
        <a class="navlink" href="${BASE}/pages/account.html">Account</a>
        <a class="navlink" href="${BASE}/pages/support.html">Support</a>
      </nav>
    `;
    document.body.appendChild(nav);
  }
}

function openMenu() {
  ensureNavInfrastructure();
  qs('#overlay')?.classList.add('show');
  const d = qs('#navDrawer');
  d?.classList.add('open');
  d?.setAttribute('aria-hidden', 'false');
  qs('#openMenu')?.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  const d = qs('#navDrawer');
  d?.classList.remove('open');
  d?.setAttribute('aria-hidden', 'true');
  qs('#openMenu')?.setAttribute('aria-expanded', 'false');
  if (!qs('#cartDrawer')?.classList.contains('open')) {
    qs('#overlay')?.classList.remove('show');
  }
}

// --- Filters / search / sort ---
function populateCategories() {
  if (!PRODUCTS?.length) return;
  const cats = unique(PRODUCTS.map((p) => p.category).filter(Boolean));
  const sel = qs('#category');
  if (!sel) return;
  sel.innerHTML = '<option value="">All categories</option>';
  cats.forEach((c) => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  });
}

function applyFilters() {
  const q = (qs('#q')?.value || '').trim().toLowerCase();
  const cat = qs('#category')?.value || '';
  const maxPrice = parseFloat(qs('#maxPrice')?.value || '');
  let list = PRODUCTS.filter((p) => {
    const okQ = q
      ? p.title.toLowerCase().includes(q) ||
        (p.excerpt || '').toLowerCase().includes(q)
      : true;
    const okC = cat ? p.category === cat : true;
    const okP = isNaN(maxPrice) ? true : p.price <= maxPrice;
    return okQ && okC && okP;
  });
  const sortSel = qs('#sort');
  const sort = sortSel ? sortSel.value : 'relevance';
  if (sort === 'priceAsc') list.sort((a, b) => a.price - b.price);
  if (sort === 'priceDesc') list.sort((a, b) => b.price - a.price);
  if (sort === 'titleAsc') list.sort((a, b) => a.title.localeCompare(b.title, 'en'));
  renderProducts(list);
}

// --- Init ---
window.addEventListener('DOMContentLoaded', async () => {
  const nameEl = qs('#brandName'); if (nameEl) nameEl.textContent = SITE.name;
  const brand = qs('.brand'); if (brand && SITE.homeHref) brand.setAttribute('href', SITE.homeHref);
  const logoEl = qs('#brandLogo'); if (logoEl) logoEl.src = SITE.logo;

  ensureNavInfrastructure();
  setActiveNavLinks();

  syncCurrencyUI();
  qs('#currency')?.addEventListener('change', (e) => setCurrency(e.target.value));

  qs('#navDrawer')?.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) { closeMenu(); setTimeout(setActiveNavLinks, 50); }
  });

  window.addEventListener('hashchange', () => {
    setActiveNavLinks();
    if (qs('#navDrawer')?.classList.contains('open')) closeMenu();
  });

  const ddBtn = qs('.dropdown .nav-btn');
  const ddMenu = qs('.dropdown .dropdown-menu');
  if (ddBtn && ddMenu) {
    ddBtn.addEventListener('click', () => {
      const open = ddMenu.style.display === 'block';
      ddMenu.style.display = open ? 'none' : 'block';
      ddBtn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', (e) => {
      if (!ddMenu.contains(e.target) && !ddBtn.contains(e.target)) {
        ddMenu.style.display = 'none';
        ddBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const yearEl = qs('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
  const brandFooter = qs('#brandNameFooter'); if (brandFooter) brandFooter.textContent = SITE.name;

  qs('#nlSubmit')?.addEventListener('click', () => {
    const email = (qs('#nlEmail')?.value || '').trim();
    if (!email) { alert('Please enter your email'); return; }
    const subject = encodeURIComponent('Newsletter signup');
    const body = encodeURIComponent(`Please add me to your newsletter.\nEmail: ${email}`);
    window.location.href = `mailto:hello@example.com?subject=${subject}&body=${body}`;
  });

  try { await loadProducts(); } catch (e) { console.warn(e.message); }
  populateCategories();
  renderProducts(PRODUCTS);
  updateCartCount();

  // Search + filters + sort
  qs('#q')?.addEventListener('input', applyFilters);
  qs('#clearSearch')?.addEventListener('click', () => { const q = qs('#q'); if (q) { q.value = ''; applyFilters(); } });
  qs('#category')?.addEventListener('change', applyFilters);
  qs('#maxPrice')?.addEventListener('change', applyFilters);
  qs('#sort')?.addEventListener('change', applyFilters);
  qs('#applyFilters')?.addEventListener('click', applyFilters);
  qs('#resetFilters')?.addEventListener('click', () => {
    const q = qs('#q'); const c = qs('#category'); const m = qs('#maxPrice'); const s = qs('#sort');
    if (q) q.value = ''; if (c) c.value = ''; if (m) m.value = ''; if (s) s.value = 'relevance';
    applyFilters();
  });

  qs('#openCart')?.addEventListener('click', openCart);
  qs('#closeCart')?.addEventListener('click', closeCart);

  qs('#overlay')?.addEventListener('click', () => {
    if (qs('#cartDrawer')?.classList.contains('open')) closeCart();
    if (qs('#navDrawer')?.classList.contains('open')) closeMenu();
    if (qs('#productModal')?.classList.contains('show')) closeProduct();
  });

  // Product modal
  qs('#pmClose')?.addEventListener('click', closeProduct);
  qs('#pmAdd')?.addEventListener('click', () => {
    if (!activeDetail) return;
    const qty = parseInt(qs('#pmQty')?.value || '1', 10);
    addToCart(activeDetail, qty);
    closeProduct();
    openCart();
  });

  qs('#openMenu')?.addEventListener('click', openMenu);
  qs('#closeMenu')?.addEventListener('click', closeMenu);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (qs('#cartDrawer')?.classList.contains('open')) closeCart();
      if (qs('#navDrawer')?.classList.contains('open')) closeMenu();
      closeProduct();
    }
  });
});
