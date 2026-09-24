let PRODUCTS = [];
let PRODUCT_SOURCE = 'd1';
let CATALOG_ERROR = '';
let DETAIL_VARIANT_ID = null;
const FREE_SHIPPING_THRESHOLD = 39.90;
const SHIPPING_FLAT = 3.90;

async function loadProducts() {
  CATALOG_ERROR = '';
  try {
    const res = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('No se pudo cargar el catálogo.');
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.products)) throw new Error('Respuesta de catálogo no válida.');
    PRODUCTS = data.products;
  } catch (e) {
    PRODUCTS = [];
    CATALOG_ERROR = e?.message || 'No se pudo cargar el catálogo.';
  }
}

function money(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function normalizeCategory(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function productHref(p) {
  return `/producto/${encodeURIComponent(p?.slug || p?.id || '')}`;
}

function productLogistics(p) {
  const v = variantsOf(p).length ? defaultVariant(p) : null;
  const warehouse = v?.warehouse || p?.warehouse || '';
  const min = v?.shippingDaysMin ?? p?.shippingDaysMin ?? null;
  const max = v?.shippingDaysMax ?? p?.shippingDaysMax ?? null;
  const parts = [];
  if (warehouse) parts.push(`Envío desde ${warehouse}`);
  if (min != null && max != null) parts.push(`${min}–${max} días`);
  return parts.join(' · ');
}

function showCatalogMessage(message = '') {
  const el = document.getElementById('catalogMessage');
  if (!el) return;
  el.hidden = !message;
  el.textContent = message;
}

function cart() {
  try { return JSON.parse(localStorage.getItem('noma-cart') || '[]'); }
  catch (_) { return []; }
}

function saveCart(c) {
  localStorage.setItem('noma-cart', JSON.stringify(c));
  syncBadge();
  renderCartDrawer();
  if (typeof renderCart === 'function') renderCart();
}

function cartItemKey(item) {
  return `${item.id}::${item.variantId || ''}`;
}

function variantsOf(p) {
  return Array.isArray(p?.variants) ? p.variants : [];
}

function defaultVariant(p) {
  const list = variantsOf(p);
  return list.find(v => v.id === p.defaultVariantId) || list.find(v => v.isDefault) || list[0] || null;
}

function variantById(p, id) {
  if (!id) return defaultVariant(p);
  return variantsOf(p).find(v => v.id === id) || defaultVariant(p);
}

function syncBadge() {
  const totalQty = cart().reduce((a, x) => a + Number(x.qty || 0), 0);
  document.querySelectorAll('.cartbadge').forEach(el => el.textContent = totalQty);
  const drawerCount = document.getElementById('drawerCartCount');
  if (drawerCount) drawerCount.textContent = `${totalQty} ${totalQty === 1 ? 'producto' : 'productos'}`;
}

function add(id, qty = 1, variantId = null, openDrawer = true) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  let chosen = variantId;
  if (variantsOf(p).length) {
    const v = variantById(p, chosen);
    if (!v) { location.href = productHref(p); return; }
    chosen = v.id;
    if (v.stockStatus === 'out') { alert('Esta opción está agotada temporalmente.'); return; }
  }
  const c = cart();
  const key = `${id}::${chosen || ''}`;
  const hit = c.find(x => cartItemKey(x) === key);
  hit ? hit.qty += qty : c.push({ id, variantId: chosen || null, qty });
  saveCart(c);

  const b = document.querySelector(`[data-add="${CSS.escape(id)}"]`);
  if (b) {
    const old = b.textContent;
    b.textContent = '✓ Añadido';
    setTimeout(() => b.textContent = old, 1200);
  }

  if (openDrawer) {
    openCartDrawer();
  }
}

function changeItemQty(key, delta) {
  let c = cart();
  const hit = c.find(x => cartItemKey(x) === key);
  if (!hit) return;
  hit.qty = Number(hit.qty || 1) + delta;
  if (hit.qty <= 0) {
    c = c.filter(x => cartItemKey(x) !== key);
  }
  saveCart(c);
}

function removeCartItemByKey(key) {
  saveCart(cart().filter(x => cartItemKey(x) !== key));
}

function productVisual(p) {
  if (p.imageUrl) return `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`;
  return p.emoji || '🐾';
}

function productPriceHtml(p) {
  return p.hasVariants && variantsOf(p).length > 1
    ? `<span class="price-prefix">Desde</span> ${money(p.priceFrom ?? p.price)}`
    : money(p.priceFrom ?? p.price);
}

function productCard(p) {
  const hasVariants = variantsOf(p).length > 0;
  const href = productHref(p);
  const action = hasVariants
    ? `<a class="btn primary" href="${href}">Ver opciones</a>`
    : `<button class="btn primary" data-add="${escapeHtml(p.id)}" onclick="add('${String(p.id).replace(/'/g, "\\'")}', 1, null, true)">Añadir</button>`;
  const logistics = productLogistics(p);
  return `<article class="product" data-cat="${escapeHtml(normalizeCategory(p.cat))}"><a href="${href}" class="photo"><span class="tag">${escapeHtml(p.tag || 'Selección')}</span>${productVisual(p)}</a><div class="product-body"><h3><a href="${href}">${escapeHtml(p.name)}</a></h3><p>${escapeHtml(p.desc || '')}</p>${logistics ? `<div class="product-logistics">${escapeHtml(logistics)}</div>` : ''}<div class="price"><div><strong>${productPriceHtml(p)}</strong><div class="meta">${hasVariants ? `${variantsOf(p).length} opciones · IVA incluido` : 'IVA incluido'}</div></div>${action}</div></div></article>`;
}

function renderProducts(target = 'products', limit) {
  const el = document.getElementById(target);
  if (!el) return;
  if (CATALOG_ERROR) {
    showCatalogMessage('No hemos podido cargar la tienda. Inténtalo de nuevo en unos instantes.');
    el.innerHTML = '';
    return;
  }
  // Excluir productos técnicos/order bumps del grid principal de catálogo
  const catalogList = PRODUCTS.filter(p => p.cat !== 'servicios' && p.id !== 'garantia_envio');
  if (!catalogList.length) {
    showCatalogMessage('Ahora mismo no hay productos publicados.');
    el.innerHTML = '';
    return;
  }
  el.innerHTML = catalogList.slice(0, limit || catalogList.length).map(productCard).join('');
}

function applyFilter(cat = 'all') {
  cat = normalizeCategory(cat) || 'all';
  document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', normalizeCategory(x.dataset.filter) === cat));
  document.querySelectorAll('.product').forEach(p => p.style.display = (cat === 'all' || normalizeCategory(p.dataset.cat) === cat) ? 'flex' : 'none');
}

function initFilters() {
  document.querySelectorAll('.filter').forEach(f => f.addEventListener('click', () => applyFilter(f.dataset.filter)));
  const requested = new URLSearchParams(location.search).get('cat');
  if (requested && document.querySelector(`[data-filter="${CSS.escape(normalizeCategory(requested))}"]`)) {
    applyFilter(requested);
  }
}

function productImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (p.imageUrl) return [{ url: p.imageUrl, alt: p.name || '' }];
  return [];
}

function variantButtons(p, selectedId) {
  const list = variantsOf(p);
  if (!list.length) return '';
  return `<div class="variant-selector"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span class="variant-label" style="margin:0">Elige una opción</span>${renderSizeGuideTrigger(p)}</div><div class="variant-options">${list.map(v => `<button type="button" class="variant-option ${v.id === selectedId ? 'active' : ''}" data-select-variant="${escapeHtml(v.id)}" ${v.stockStatus === 'out' ? 'disabled' : ''}><b>${escapeHtml(v.name)}</b><span>${money(v.price)}</span>${v.stockStatus === 'out' ? '<small>Agotada</small>' : ''}</button>`).join('')}</div></div>`;
}

function renderSizeGuideTrigger(p) {
  const needsGuide = ['arnes_antitirones', 'cama_calmante', 'hammock'].includes(p.id) || p.cat === 'paseo' || p.cat === 'hogar';
  if (!needsGuide) return '';
  return `<button type="button" class="size-guide-trigger" onclick="openSizeGuide('${p.id}')">📏 Guía de tallas y medidas</button>`;
}

function updateDetailVariant(p, variantId) {
  const v = variantById(p, variantId);
  if (!v) return;
  DETAIL_VARIANT_ID = v.id;
  document.querySelectorAll('[data-select-variant]').forEach(btn => btn.classList.toggle('active', btn.dataset.selectVariant === v.id));
  const price = document.getElementById('detailPrice');
  if (price) price.textContent = money(v.price);
  const meta = document.getElementById('detailVariantMeta');
  if (meta) {
    const bits = [];
    if (v.warehouse) bits.push(`Envío desde ${v.warehouse}`);
    if (v.shippingDaysMin != null && v.shippingDaysMax != null) bits.push(`${v.shippingDaysMin}–${v.shippingDaysMax} días`);
    meta.textContent = bits.join(' · ');
  }
  const addBtn = document.getElementById('detailAddBtn');
  if (addBtn) addBtn.disabled = v.stockStatus === 'out';

  // Sincronizar sticky bar móvil
  const stickyPrice = document.getElementById('stickyAtcPrice');
  if (stickyPrice) stickyPrice.textContent = money(v.price);
}

/* ==============================================================================
   GUÍA DE TALLAS INTERACTIVA (MODAL)
   ============================================================================== */
function initSizeGuideModal() {
  if (document.getElementById('sizeGuideModal')) return;
  const modal = document.createElement('div');
  modal.id = 'sizeGuideModal';
  modal.className = 'size-guide-modal';
  modal.innerHTML = `
    <div class="size-modal-card">
      <button class="size-modal-close" onclick="closeSizeGuide()">✕</button>
      <div id="sizeGuideContent"></div>
    </div>
  `;
  modal.addEventListener('click', e => {
    if (e.target === modal) closeSizeGuide();
  });
  document.body.appendChild(modal);
}

function openSizeGuide(productId) {
  initSizeGuideModal();
  const modal = document.getElementById('sizeGuideModal');
  const content = document.getElementById('sizeGuideContent');
  if (!modal || !content) return;

  if (productId === 'cama_calmante') {
    content.innerHTML = `
      <h3>Guía de Tamaños · Cama Calmante Donut</h3>
      <p style="font-size:13.5px;color:var(--muted);margin-bottom:16px">Si dudas entre dos tamaños, te recomendamos elegir el superior para que tu mascota se estire con máxima comodidad.</p>
      <table class="size-table">
        <thead><tr><th>Talla</th><th>Diámetro</th><th>Peso Mascota</th><th>Ejemplos de Raza</th></tr></thead>
        <tbody>
          <tr><td><b>S</b></td><td>50 cm</td><td>Hasta 5 kg</td><td>Chihuahua, Yorkshire, Gatos</td></tr>
          <tr><td><b>M</b></td><td>60 cm</td><td>Hasta 9 kg</td><td>Bichón Maltés, Teckel, Pomerania</td></tr>
          <tr><td><b>L</b></td><td>70 cm</td><td>Hasta 18 kg</td><td>Beagle, Bulldog Francés, Cocker</td></tr>
          <tr><td><b>XL</b></td><td>80 cm</td><td>Hasta 28 kg</td><td>Border Collie, Bóxer, Golden retriever</td></tr>
        </tbody>
      </table>
      <div style="background:#f4faf6;border:1px solid #cde0d5;padding:12px;border-radius:8px;font-size:12.5px;color:#143e30;margin-top:14px">
        💡 <b>Consejo:</b> Mide a tu perro desde la nariz hasta la base de la cola mientras duerme y añade 15 cm de margen.
      </div>
    `;
  } else {
    content.innerHTML = `
      <h3>Guía de Medidas · Arnés Ergonómico Antitirones</h3>
      <p style="font-size:13.5px;color:var(--muted);margin-bottom:16px">Usa una cinta métrica flexible alrededor de la parte más ancha del pecho (justo detrás de las patas delanteras).</p>
      <table class="size-table">
        <thead><tr><th>Talla</th><th>Contorno de Pecho</th><th>Contorno de Cuello</th><th>Peso Estimado</th></tr></thead>
        <tbody>
          <tr><td><b>S</b></td><td>36 – 50 cm</td><td>32 – 44 cm</td><td>4 – 8 kg</td></tr>
          <tr><td><b>M</b></td><td>50 – 65 cm</td><td>40 – 52 cm</td><td>8 – 16 kg</td></tr>
          <tr><td><b>L</b></td><td>65 – 82 cm</td><td>50 – 68 cm</td><td>16 – 28 kg</td></tr>
          <tr><td><b>XL</b></td><td>80 – 105 cm</td><td>62 – 84 cm</td><td>28 – 45 kg</td></tr>
        </tbody>
      </table>
      <div style="background:#f4faf6;border:1px solid #cde0d5;padding:12px;border-radius:8px;font-size:12.5px;color:#143e30;margin-top:14px">
        💡 <b>Ajuste ideal:</b> Debes poder introducir dos dedos cómodamente entre las correas del arnés y el cuerpo de tu perro.
      </div>
    `;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSizeGuide() {
  const modal = document.getElementById('sizeGuideModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

/* ==============================================================================
   MÓDULO BUNDLE ("COMPRADOS JUNTOS FRECUENTEMENTE")
   ============================================================================== */
function getComplementaryProduct(currentProduct) {
  if (currentProduct.id === 'cama_calmante') return PRODUCTS.find(p => p.id === 'alfombra_olfativa') || PRODUCTS.find(p => p.id === 'cepillo_vapor');
  if (currentProduct.id === 'arnes_antitirones') return PRODUCTS.find(p => p.id === 'cinturon_elastico') || PRODUCTS.find(p => p.id === 'bottle');
  if (currentProduct.id === 'hammock') return PRODUCTS.find(p => p.id === 'cinturon_elastico');
  if (currentProduct.id === 'cepillo_vapor') return PRODUCTS.find(p => p.id === 'cortaunas_led');
  return PRODUCTS.find(p => p.id !== currentProduct.id && p.cat !== 'servicios' && p.id !== 'garantia_envio') || null;
}

function renderBundleModule(currentProduct) {
  const complement = getComplementaryProduct(currentProduct);
  if (!complement) return '';
  const priceA = Number(currentProduct.price || 0);
  const priceB = Number(complement.price || 0);
  const originalTotal = priceA + priceB;
  const bundleDiscount = 0.15; // 15% de ahorro directo
  const discountedTotal = originalTotal * (1 - bundleDiscount);
  const savings = originalTotal - discountedTotal;

  return `
    <div class="bundle-widget">
      <div class="bundle-header">
        <span class="bundle-title">🎁 Comprados juntos frecuentemente</span>
        <span class="bundle-discount-badge">15% DTO. EN PACK</span>
      </div>
      <div class="bundle-products-grid">
        <div class="bundle-item-card">
          ${currentProduct.imageUrl ? `<img src="${escapeHtml(currentProduct.imageUrl)}" alt="${escapeHtml(currentProduct.name)}">` : '🐾'}
          <div>
            <div style="font-size:12.5px;font-weight:700">${escapeHtml(currentProduct.name)}</div>
            <div style="font-size:12px;color:var(--muted)">${money(priceA)}</div>
          </div>
        </div>
        <span class="bundle-plus">+</span>
        <div class="bundle-item-card">
          ${complement.imageUrl ? `<img src="${escapeHtml(complement.imageUrl)}" alt="${escapeHtml(complement.name)}">` : '🐾'}
          <div>
            <div style="font-size:12.5px;font-weight:700">${escapeHtml(complement.name)}</div>
            <div style="font-size:12px;color:var(--muted)">${money(priceB)}</div>
          </div>
        </div>
      </div>
      <div class="bundle-footer">
        <div class="bundle-price-box">
          <span class="bundle-old-price">${money(originalTotal)}</span>
          <span class="bundle-new-price">${money(discountedTotal)}</span>
          <span style="font-size:11px;color:var(--terracotta);font-weight:700">Ahorras ${money(savings)} con este lote</span>
        </div>
        <button type="button" class="btn primary" onclick="addBundle('${currentProduct.id}', '${complement.id}')">
          Añadir ambos al carrito
        </button>
      </div>
    </div>
  `;
}

function addBundle(idA, idB) {
  add(idA, 1, DETAIL_VARIANT_ID, false);
  add(idB, 1, null, true);
}

/* ==============================================================================
   STICKY ADD TO CART (MÓVIL)
   ============================================================================== */
function setupStickyAtc(p) {
  let sticky = document.getElementById('stickyAtcBar');
  if (!sticky) {
    sticky = document.createElement('div');
    sticky.id = 'stickyAtcBar';
    sticky.className = 'sticky-atc-bar';
    document.body.appendChild(sticky);
  }
  const defaultVar = defaultVariant(p);
  const initialPrice = defaultVar?.price ?? p.price;
  sticky.innerHTML = `
    <div class="sticky-atc-thumb">
      ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : (p.emoji || '🐾')}
    </div>
    <div class="sticky-atc-info">
      <div class="sticky-atc-title">${escapeHtml(p.name)}</div>
      <div class="sticky-atc-price" id="stickyAtcPrice">${money(initialPrice)}</div>
    </div>
    <button class="btn primary sticky-atc-btn" id="stickyAtcBtn" type="button">Añadir</button>
  `;

  document.getElementById('stickyAtcBtn')?.addEventListener('click', () => {
    add(p.id, Number(document.getElementById('qty')?.textContent || 1), DETAIL_VARIANT_ID, true);
  });

  const mainBtn = document.getElementById('detailAddBtn');
  if (!mainBtn || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      sticky.classList.toggle('visible', !entry.isIntersecting);
    });
  }, { threshold: 0.1 });

  observer.observe(mainBtn);
}

/* ==============================================================================
   RENDER FICHA DE PRODUCTO (PDP)
   ============================================================================== */
function renderDetail() {
  const el = document.getElementById('detail');
  if (!el) return;
  const params = new URLSearchParams(location.search);
  const legacyId = params.get('id');
  const pathMatch = location.pathname.match(/^\/producto\/([^/]+)\/?$/);
  const slug = pathMatch ? decodeURIComponent(pathMatch[1]) : '';
  const p = PRODUCTS.find(x => legacyId ? x.id === legacyId : (x.slug === slug || x.id === slug));

  if (!p) {
    el.innerHTML = '<div class="feature"><h2>Producto no encontrado</h2><p>Puede que ya no esté disponible.</p><a class="btn primary" href="/tienda.html">Volver a la tienda</a></div>';
    return;
  }
  document.title = `${p.name} — NÓMA PET`;
  const imgs = productImages(p);
  let visual;
  if (imgs.length) {
    const first = imgs[0];
    const thumbs = imgs.length > 1
      ? `<div class="gallery-thumbs">${imgs.map((img, i) => `<button class="gallery-thumb ${i === 0 ? 'active' : ''}" type="button" data-gallery-index="${i}"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || p.name)}"></button>`).join('')}</div>`
      : '';
    visual = `<div class="product-gallery"><div class="bigphoto"><img id="galleryMainImage" src="${escapeHtml(first.url)}" alt="${escapeHtml(first.alt || p.name)}"></div>${thumbs}</div>`;
  } else {
    visual = `<div class="bigphoto">${p.emoji || '🐾'}</div>`;
  }

  const selected = defaultVariant(p);
  DETAIL_VARIANT_ID = selected?.id || null;
  const baseLogistics = !selected && (p.warehouse || p.shippingDaysMin != null)
    ? `<div class="detail-logistics">${[p.warehouse ? `Envío desde ${escapeHtml(p.warehouse)}` : '', (p.shippingDaysMin != null && p.shippingDaysMax != null) ? `${p.shippingDaysMin}–${p.shippingDaysMax} días` : ''].filter(Boolean).join(' · ')}</div>`
    : '';
  const logistics = selected ? (selected.warehouse || selected.shippingDaysMin != null ? `<div id="detailVariantMeta" class="detail-logistics"></div>` : '') : baseLogistics;

  // Banner de Escasez y Demanda en tiempo real
  const scarcityHtml = `
    <div class="scarcity-banner">
      <span class="scarcity-pulse"></span>
      <span>⚡ <b>Alta demanda:</b> Quedan solo <b>6 unidades</b> disponibles en almacén</span>
    </div>
  `;

  // Módulo de Bundle "Comprados Juntos Habitualmente"
  const bundleHtml = renderBundleModule(p);

  el.innerHTML = `
    ${visual}
    <div class="detail">
      <span class="eyebrow">Selección NÓMA PET</span>
      <h1>${escapeHtml(p.name)}</h1>
      <div class="pricebig" id="detailPrice">${money(selected?.price ?? p.price)}</div>
      ${scarcityHtml}
      ${variantButtons(p, DETAIL_VARIANT_ID)}
      ${logistics}
      <p class="lead product-description">${escapeHtml(p.description || p.desc || '')}</p>
      <div class="detail-trust">
        <span>✓ IVA incluido</span>
        <span>✓ Seguimiento punto a punto</span>
        <span>✓ 14 días desistimiento</span>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin:24px 0">
        <div class="qty"><button onclick="changeQty(-1)">−</button><span id="qty">1</span><button onclick="changeQty(1)">+</button></div>
        <button id="detailAddBtn" class="btn primary" type="button">Añadir al carrito</button>
      </div>
      ${bundleHtml}
    </div>
  `;

  if (imgs.length > 1) {
    el.querySelectorAll('[data-gallery-index]').forEach(btn => btn.addEventListener('click', () => {
      const index = Number(btn.dataset.galleryIndex);
      const img = imgs[index];
      const main = document.getElementById('galleryMainImage');
      if (!img || !main) return;
      main.src = img.url;
      main.alt = img.alt || p.name;
      el.querySelectorAll('[data-gallery-index]').forEach(x => x.classList.toggle('active', x === btn));
    }));
  }

  el.querySelectorAll('[data-select-variant]').forEach(btn => btn.addEventListener('click', () => updateDetailVariant(p, btn.dataset.selectVariant)));
  document.getElementById('detailAddBtn')?.addEventListener('click', () => add(p.id, Number(document.getElementById('qty')?.textContent || 1), DETAIL_VARIANT_ID, true));

  if (selected) updateDetailVariant(p, selected.id);
  setupStickyAtc(p);
}

function changeQty(d) {
  const q = document.getElementById('qty');
  if (q) q.textContent = Math.max(1, Number(q.textContent) + d);
}

/* ==============================================================================
   CARRITO SLIDE-OVER (DRAWER) CON ELEVADORES DE MARGEN & CRO
   ============================================================================== */
function initCartDrawer() {
  if (document.getElementById('cartDrawer')) return;

  const overlay = document.createElement('div');
  overlay.id = 'cartDrawerOverlay';
  overlay.className = 'cart-drawer-overlay';

  const drawer = document.createElement('aside');
  drawer.id = 'cartDrawer';
  drawer.className = 'cart-drawer';
  drawer.setAttribute('aria-label', 'Cesta de compra');
  drawer.innerHTML = `
    <div class="cart-drawer-header">
      <div class="cart-drawer-title">
        <h3>Tu Cesta</h3>
        <span class="drawer-count-badge" id="drawerCartCount">0 productos</span>
      </div>
      <button class="cart-drawer-close" id="closeCartDrawerBtn" aria-label="Cerrar carrito">✕</button>
    </div>

    <!-- Barra de Envío Gratis Dinámica -->
    <div class="drawer-shipping-bar" id="drawerShippingBar">
      <div class="shipping-bar-text" id="shippingBarText">
        <span>🚚 Añade <b>39,90 €</b> para conseguir <b>Envío Gratis</b></span>
      </div>
      <div class="shipping-bar-track">
        <div class="shipping-bar-fill" id="shippingBarFill" style="width: 0%"></div>
      </div>
    </div>

    <!-- Lista de Productos en Cesta -->
    <div class="cart-drawer-body" id="drawerCartItems"></div>

    <!-- Order Bumps (1-Click Upsell) -->
    <div class="drawer-order-bumps" id="drawerOrderBumps">
      <div class="order-bump-card" id="bumpGuaranteeCard">
        <label class="bump-label">
          <input type="checkbox" id="bumpGuaranteeCheck" onchange="toggleOrderBump('garantia_envio', this.checked)">
          <div class="bump-info">
            <div class="bump-head">
              <span class="bump-badge">RECOMENDADO</span>
              <span class="bump-title">🛡️ Garantía de Envío Protegido</span>
              <span class="bump-price">+1,99 €</span>
            </div>
            <p class="bump-desc">Reemplazo prioritario inmediato ante cualquier pérdida, daño o robo en transporte.</p>
          </div>
        </label>
      </div>

      <div class="order-bump-card" id="bumpRollerCard">
        <label class="bump-label">
          <input type="checkbox" id="bumpRollerCheck" onchange="toggleOrderBump('cepillo_quitapelos', this.checked)">
          <div class="bump-info">
            <div class="bump-head">
              <span class="bump-badge">OFERTA FLASH</span>
              <span class="bump-title">✨ Rodillo Quitapelos Lavable</span>
              <span class="bump-price">+4,99 € <del style="font-size:10.5px;color:#8fa099">9,90 €</del></span>
            </div>
            <p class="bump-desc">Elimina pelos al 100% de sofás, mantas y ropa en 1 pasada. Reutilizable y lavable.</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Resumen y Checkout Seguro -->
    <div class="cart-drawer-footer">
      <div class="drawer-summary-row">
        <span>Subtotal productos</span>
        <b id="drawerSubtotal">0,00 €</b>
      </div>
      <div class="drawer-summary-row">
        <span>Envío a España</span>
        <span id="drawerShipping">3,90 €</span>
      </div>
      <div class="drawer-summary-row drawer-total-row">
        <span>Total a pagar</span>
        <b id="drawerTotal">0,00 €</b>
      </div>

      <a href="/checkout.html" class="btn primary drawer-checkout-btn" id="drawerCheckoutBtn">
        Tramitar Pedido Seguro →
      </a>

      <!-- Insignias de Confianza y Métodos de Pago -->
      <div class="drawer-trust-badges">
        <div class="trust-icons-row">
          <span class="trust-pill">🔒 SSL 256-bit</span>
          <span class="trust-pill">🇪🇸 Entrega Península</span>
          <span class="trust-pill">↩️ 14 Días Devolución</span>
        </div>
        <div class="payment-methods-svgs">
          <span class="pay-method-badge">Apple Pay</span>
          <span class="pay-method-badge">Google Pay</span>
          <span class="pay-method-badge">Visa</span>
          <span class="pay-method-badge">Mastercard</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  overlay.addEventListener('click', closeCartDrawer);
  document.getElementById('closeCartDrawerBtn')?.addEventListener('click', closeCartDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('active')) {
      closeCartDrawer();
    }
  });

  // Interceptar todos los enlaces al carrito para abrir el drawer suavemente
  document.querySelectorAll('a[href$="carrito.html"]').forEach(link => {
    link.addEventListener('click', e => {
      // Si el usuario no presiona Ctrl / Cmd (nueva pestaña), abrimos el drawer
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        openCartDrawer();
      }
    });
  });
}

function openCartDrawer() {
  initCartDrawer();
  renderCartDrawer();
  const overlay = document.getElementById('cartDrawerOverlay');
  const drawer = document.getElementById('cartDrawer');
  if (overlay && drawer) {
    overlay.classList.add('active');
    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeCartDrawer() {
  const overlay = document.getElementById('cartDrawerOverlay');
  const drawer = document.getElementById('cartDrawer');
  if (overlay && drawer) {
    overlay.classList.remove('active');
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function renderCartDrawer() {
  const container = document.getElementById('drawerCartItems');
  if (!container) return;
  const currentCart = cart();
  const rows = currentCart.map(resolveCartRow).filter(Boolean);

  let subtotal = 0;
  if (!rows.length) {
    container.innerHTML = `
      <div class="drawer-empty-state">
        <div class="empty-icon">🛒</div>
        <h4>Tu cesta está vacía</h4>
        <p>Añade alguno de nuestros accesorios funcionales para consentir a tu mascota.</p>
        <a class="btn primary" href="/tienda.html" onclick="closeCartDrawer()">Explorar la tienda</a>
      </div>
    `;
    const bumps = document.getElementById('drawerOrderBumps');
    if (bumps) bumps.style.display = 'none';
    const checkoutBtn = document.getElementById('drawerCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.style.pointerEvents = 'none';
      checkoutBtn.style.opacity = '0.5';
    }
  } else {
    const bumps = document.getElementById('drawerOrderBumps');
    if (bumps) bumps.style.display = 'flex';
    const checkoutBtn = document.getElementById('drawerCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.style.pointerEvents = 'auto';
      checkoutBtn.style.opacity = '1';
    }

    container.innerHTML = rows.map(({ p, v, qty, key }) => {
      const price = v ? Number(v.price) : Number(p.price);
      subtotal += price * qty;
      return `
        <div class="drawer-item">
          <div class="drawer-item-thumb">
            ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}">` : (p.emoji || '🐾')}
          </div>
          <div class="drawer-item-info">
            <span class="drawer-item-name">${escapeHtml(p.name)}</span>
            ${v ? `<span class="drawer-item-variant">${escapeHtml(v.name)}</span>` : ''}
            <div class="drawer-item-stepper">
              <button type="button" onclick="changeItemQty('${escapeHtml(key)}', -1)">−</button>
              <span>${qty}</span>
              <button type="button" onclick="changeItemQty('${escapeHtml(key)}', 1)">+</button>
            </div>
          </div>
          <div class="drawer-item-right">
            <button class="drawer-item-remove" type="button" onclick="removeCartItemByKey('${escapeHtml(key)}')" title="Eliminar">✕</button>
            <span class="drawer-item-price">${money(price * qty)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Actualizar Barra de Envío Gratis
  const shippingText = document.getElementById('shippingBarText');
  const shippingFill = document.getElementById('shippingBarFill');
  const shippingVal = document.getElementById('drawerShipping');
  let shippingCost = SHIPPING_FLAT;

  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    shippingCost = 0;
    if (shippingText) shippingText.innerHTML = `<span>🎉 <b>¡Enhorabuena!</b> Has conseguido <b>Envío Gratis</b> a España</span>`;
    if (shippingFill) {
      shippingFill.style.width = '100%';
      shippingFill.classList.add('achieved');
    }
    if (shippingVal) shippingVal.innerHTML = `<b style="color:var(--green)">GRATIS</b>`;
  } else {
    const diff = (FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2).replace('.', ',');
    const percent = Math.min(100, Math.max(0, (subtotal / FREE_SHIPPING_THRESHOLD) * 100));
    if (shippingText) shippingText.innerHTML = `<span>🚚 Añade <b>${diff} €</b> más para conseguir <b>Envío Gratis</b></span>`;
    if (shippingFill) {
      shippingFill.style.width = `${percent}%`;
      shippingFill.classList.remove('achieved');
    }
    if (shippingVal) shippingVal.textContent = money(SHIPPING_FLAT);
  }

  // Sincronizar checkboxes de Order Bump
  const hasGuarantee = currentCart.some(x => x.id === 'garantia_envio');
  const hasRoller = currentCart.some(x => x.id === 'cepillo_quitapelos');
  const gCheck = document.getElementById('bumpGuaranteeCheck');
  const rCheck = document.getElementById('bumpRollerCheck');
  const gCard = document.getElementById('bumpGuaranteeCard');
  const rCard = document.getElementById('bumpRollerCard');
  if (gCheck) gCheck.checked = hasGuarantee;
  if (rCheck) rCheck.checked = hasRoller;
  if (gCard) gCard.classList.toggle('active', hasGuarantee);
  if (rCard) rCard.classList.toggle('active', hasRoller);

  // Totales
  const subtotalEl = document.getElementById('drawerSubtotal');
  const totalEl = document.getElementById('drawerTotal');
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  if (totalEl) totalEl.textContent = money(subtotal + (rows.length ? shippingCost : 0));
}

function toggleOrderBump(productId, isChecked) {
  let c = cart();
  if (isChecked) {
    if (!c.some(x => x.id === productId)) {
      c.push({ id: productId, variantId: null, qty: 1 });
    }
  } else {
    c = c.filter(x => x.id !== productId);
  }
  saveCart(c);
}

/* ==============================================================================
   PÁGINA DEDICADA DE CARRITO (/carrito.html)
   ============================================================================== */
function resolveCartRow(x) {
  const p = PRODUCTS.find(y => y.id === x.id);
  if (!p) return null;
  const v = variantsOf(p).length ? variantById(p, x.variantId) : null;
  return { p, v, qty: Math.max(1, Number(x.qty || 1)), key: cartItemKey(x) };
}

function renderCart() {
  const list = document.getElementById('cart-items');
  const sum = document.getElementById('summary');
  if (!list || !sum) return;
  const rows = cart().map(resolveCartRow).filter(Boolean);
  if (!rows.length) {
    list.innerHTML = '<div class="feature"><h3>Tu carrito está vacío</h3><p>Prueba a añadir uno de los productos del catálogo.</p><a class="btn primary" href="tienda.html">Ir a tienda</a></div>';
    sum.innerHTML = '';
    return;
  }
  let subtotal = 0;
  list.innerHTML = rows.map(({ p, v, qty, key }) => {
    const price = v ? Number(v.price) : Number(p.price);
    subtotal += price * qty;
    return `<div class="cartitem"><div class="cartthumb">${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : p.emoji || '🐾'}</div><div><b>${escapeHtml(p.name)}</b>${v ? `<div class="cart-variant">${escapeHtml(v.name)}</div>` : ''}<div class="meta">${money(price)} · Cantidad ${qty}</div><button style="border:0;background:none;padding:6px 0;color:#8a4a34;cursor:pointer" data-remove-key="${escapeHtml(key)}">Eliminar</button></div><div class="right"><b>${money(price * qty)}</b></div></div>`;
  }).join('');
  list.querySelectorAll('[data-remove-key]').forEach(btn => btn.addEventListener('click', () => removeItem(btn.dataset.removeKey)));
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  sum.innerHTML = `<h3>Resumen</h3><div class="row"><span>Productos</span><b>${money(subtotal)}</b></div><div class="row"><span>Envío</span><b>${shipping ? money(shipping) : "Gratis"}</b></div><div class="row total"><span>Total</span><span>${money(subtotal + shipping)}</span></div>${subtotal < FREE_SHIPPING_THRESHOLD ? `<p class="tiny">Envío gratis desde ${money(FREE_SHIPPING_THRESHOLD)}.</p>` : '<p class="tiny">Has conseguido envío gratis.</p>'}<a class="btn primary" style="width:100%;margin-top:14px" href="checkout.html">Continuar al pago</a>`;
}

function removeItem(key) {
  saveCart(cart().filter(x => cartItemKey(x) !== key));
  renderCart();
}

function adminRows() {
  const tb = document.getElementById('adminRows');
  if (!tb) return;
  tb.innerHTML = PRODUCTS.map(p => `<tr><td>${p.emoji || '🐾'} ${escapeHtml(p.name)}</td><td>${escapeHtml(p.cat)}</td><td>${productPriceHtml(p)}</td><td><span class="status">Publicado</span></td><td></td></tr>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  syncBadge();
  initCartDrawer();
  renderProducts();
  renderProducts('featured', 6);
  initFilters();
  renderDetail();
  renderCart();
  adminRows();
});
