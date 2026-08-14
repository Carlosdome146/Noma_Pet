const ADMIN_TOKEN_KEY = "noma-admin-token";
const CART_KEY = "noma-cart";
const LAST_ORDER_EMAIL_KEY = "noma-last-order-email";

const $ = id => document.getElementById(id);
const money = (n, currency = "EUR") => new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(n);
const escapeHtml = (s = "") => String(s).replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));

let products = [];
let cartRows = [];
let isTestMode = false;
let adminToken = "";

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch (_) { return []; }
}

async function loadProducts() {
  const res = await fetch("/api/products", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !Array.isArray(data.products)) throw new Error("No se pudo cargar el catálogo.");
  products = data.products;
}

function buildCartRows() {
  const raw = readCart();
  cartRows = raw.map(row => {
    const p = products.find(x => x.id === row.id);
    return p ? { product: p, qty: Math.max(1, Number(row.qty || 1)) } : null;
  }).filter(Boolean);
}

function renderSummary() {
  const items = $("checkoutItems");
  const totals = $("checkoutTotals");
  if (!cartRows.length) {
    items.innerHTML = `<div class="checkout-empty">Tu carrito está vacío.</div>`;
    totals.innerHTML = `<a class="btn primary" style="width:100%" href="tienda.html">Ir a tienda</a>`;
    $("checkoutSubmit").disabled = true;
    return;
  }

  let total = 0;
  items.innerHTML = cartRows.map(({ product: p, qty }) => {
    const line = Number(p.price || 0) * qty;
    total += line;
    return `<div class="checkout-line">
      <div class="checkout-line-media">${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : escapeHtml(p.emoji || "🐾")}</div>
      <div><b>${escapeHtml(p.name)}</b><span>${qty} × ${money(p.price)}</span></div>
      <strong>${money(line)}</strong>
    </div>`;
  }).join("");

  totals.innerHTML = `
    <div class="row"><span>Productos</span><b>${money(total)}</b></div>
    <div class="row"><span>Envío</span><span>Se definirá antes de activar pagos</span></div>
    <div class="row total"><span>Total provisional</span><span>${money(total)}</span></div>`;
}

function formPayload() {
  return {
    customer: {
      name: $("customerName").value,
      email: $("customerEmail").value,
      phone: $("customerPhone").value,
      addressLine1: $("addressLine1").value,
      addressLine2: $("addressLine2").value,
      postalCode: $("postalCode").value,
      city: $("city").value,
      province: $("province").value,
      country: $("country").value,
      notes: $("orderNotes").value
    },
    items: cartRows.map(x => ({ id: x.product.id, qty: x.qty }))
  };
}

function setError(message = "") {
  const el = $("checkoutError");
  el.hidden = !message;
  el.textContent = message;
}

async function submitTestOrder(event) {
  event.preventDefault();
  setError();

  if (!isTestMode) {
    setError("El pago online todavía no está activado. En la siguiente fase conectaremos Stripe.");
    return;
  }
  if (!cartRows.length) {
    setError("El carrito está vacío.");
    return;
  }
  if (!$("checkoutForm").reportValidity()) return;

  const button = $("checkoutSubmit");
  button.disabled = true;
  const old = button.textContent;
  button.textContent = "Creando pedido de prueba…";

  try {
    const payload = formPayload();
    const res = await fetch("/api/admin/orders/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.message || "No se pudo crear el pedido.");

    localStorage.setItem(LAST_ORDER_EMAIL_KEY, payload.customer.email.trim().toLowerCase());
    localStorage.removeItem(CART_KEY);
    location.href = `pedido-exito.html?code=${encodeURIComponent(data.order.publicCode)}&test=1`;
  } catch (error) {
    setError(error.message);
    button.disabled = false;
    button.textContent = old;
  }
}

async function init() {
  try {
    await loadProducts();
    buildCartRows();
    renderSummary();
  } catch (error) {
    setError(error.message);
    return;
  }

  adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const requestedTest = new URLSearchParams(location.search).get("test") === "1";
  isTestMode = requestedTest && Boolean(adminToken);

  if (isTestMode && cartRows.length) {
    $("testModeNotice").hidden = false;
    $("checkoutTopbar").textContent = "MODO PRUEBA ADMIN · No se cobra dinero";
    $("checkoutSubmit").disabled = false;
    $("checkoutSubmit").textContent = "Crear pedido de prueba";
    $("checkoutHelp").textContent = "Se guardará en D1 con pago TEST y aparecerá en /admin/pedidos.html.";
  } else if (requestedTest && !adminToken) {
    setError("Para crear un pedido de prueba, entra primero en /admin/ y vuelve a abrir el checkout desde Pedidos.");
  }

  $("checkoutForm").addEventListener("submit", submitTestOrder);
}

document.addEventListener("DOMContentLoaded", init);
