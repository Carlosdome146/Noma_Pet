const ADMIN_TOKEN_KEY = "noma-admin-token";
const CART_KEY = "noma-cart";
const LAST_ORDER_EMAIL_KEY = "noma-last-order-email";

const $ = id => document.getElementById(id);
const money = (n, currency = "EUR") => new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(n || 0));
const escapeHtml = (s = "") => String(s).replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));

let products = [];
let cartRows = [];
let isAdminTestMode = false;
let stripeTestReady = false;
let adminToken = "";
let shippingFlat = 3.90;
let freeShippingThreshold = 39.90;

function readCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch (_) { return []; } }
function variantsOf(p) { return Array.isArray(p?.variants) ? p.variants : []; }
function defaultVariant(p) { const list=variantsOf(p); return list.find(v=>v.id===p.defaultVariantId)||list.find(v=>v.isDefault)||list[0]||null; }
function variantById(p,id) { return variantsOf(p).find(v=>v.id===id)||defaultVariant(p); }
function logisticsOf(p,v){return {warehouse:v?.warehouse||p?.warehouse||"",min:v?.shippingDaysMin??p?.shippingDaysMin??null,max:v?.shippingDaysMax??p?.shippingDaysMax??null}}

async function loadProducts() {
  const res = await fetch("/api/products", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !Array.isArray(data.products)) throw new Error("No se pudo cargar el catálogo.");
  products = data.products;
}
async function loadHealth() {
  const res = await fetch("/api/health", { headers: { Accept: "application/json" }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) return {};
  return data;
}

function buildCartRows() {
  const raw = readCart();
  cartRows = raw.map(row => {
    const p = products.find(x => x.id === row.id);
    if (!p) return null;
    const v = variantsOf(p).length ? variantById(p, row.variantId) : null;
    if (variantsOf(p).length && !v) return null;
    return { product: p, variant: v, qty: Math.max(1, Number(row.qty || 1)) };
  }).filter(Boolean);
}

function renderSummary() {
  const items = $("checkoutItems"), totals = $("checkoutTotals");
  if (!cartRows.length) {
    items.innerHTML = `<div class="checkout-empty">Tu carrito está vacío.</div>`;
    totals.innerHTML = `<a class="btn primary" style="width:100%" href="tienda.html">Ir a tienda</a>`;
    $("checkoutSubmit").disabled = true; return;
  }
  let subtotal = 0; const groups=new Set();
  items.innerHTML = cartRows.map(({ product:p, variant:v, qty }) => {
    const price=Number(v?.price??p.price??0), line=price*qty; subtotal+=line;
    const l=logisticsOf(p,v); const log=[l.warehouse?`Envío desde ${escapeHtml(l.warehouse)}`:"",(l.min!=null&&l.max!=null)?`${l.min}–${l.max} días`:""].filter(Boolean).join(" · ");
    if(log)groups.add(`${l.warehouse}|${l.min}|${l.max}`);
    return `<div class="checkout-line"><div class="checkout-line-media">${p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="">`:escapeHtml(p.emoji||"🐾")}</div><div><b>${escapeHtml(p.name)}</b>${v?`<span class="checkout-variant">${escapeHtml(v.name)}</span>`:""}<span>${qty} × ${money(price)}</span>${log?`<span class="checkout-logistics">${log}</span>`:""}</div><strong>${money(line)}</strong></div>`;
  }).join("");
  const shipping=subtotal>=freeShippingThreshold?0:shippingFlat, total=subtotal+shipping;
  const split=groups.size>1?`<div class="notice split-shipment-notice"><b>Entrega en varios paquetes.</b> Algunos artículos tienen orígenes o plazos distintos, por lo que pueden llegar por separado.</div>`:"";
  totals.innerHTML = `${split}<div class="row"><span>Productos</span><b>${money(subtotal)}</b></div><div class="row"><span>Envío</span><b>${shipping?money(shipping):"Gratis"}</b></div><div class="row total"><span>Total</span><span>${money(total)}</span></div>${subtotal<freeShippingThreshold ? `<p class="tiny">Envío gratis desde ${money(freeShippingThreshold)}.</p>` : `<p class="tiny">Has conseguido envío gratis.</p>`}`;
}

function formPayload() {
  return {
    customer: {
      name: $("customerName").value, email: $("customerEmail").value, phone: $("customerPhone").value,
      addressLine1: $("addressLine1").value, addressLine2: $("addressLine2").value,
      postalCode: $("postalCode").value, city: $("city").value, province: $("province").value,
      country: $("country").value, notes: $("orderNotes").value
    },
    items: cartRows.map(x => ({ id: x.product.id, variantId: x.variant?.id || null, qty: x.qty }))
  };
}
function setError(message = "") { const el=$("checkoutError"); el.hidden=!message; el.textContent=message; }
function showNotice(html) { const notice=$("testModeNotice"); notice.innerHTML=html; notice.hidden=false; }

async function submitAdminTest(payload) {
  const res=await fetch("/api/admin/orders/test",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${adminToken}`},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({})); if(!res.ok||!data.ok)throw new Error(data.message||"No se pudo crear el pedido de prueba.");
  localStorage.setItem(LAST_ORDER_EMAIL_KEY,payload.customer.email.trim().toLowerCase()); localStorage.removeItem(CART_KEY);
  location.href=`pedido-exito.html?code=${encodeURIComponent(data.order.publicCode)}&test=1`;
}
async function submitStripeTest(payload) {
  const res=await fetch("/api/checkout/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({})); if(!res.ok||!data.ok||!data.checkoutUrl)throw new Error(data.message||"No se pudo iniciar Stripe Checkout.");
  localStorage.setItem(LAST_ORDER_EMAIL_KEY,payload.customer.email.trim().toLowerCase()); location.href=data.checkoutUrl;
}
async function submitCheckout(event) {
  event.preventDefault(); setError();
  if(!cartRows.length){setError("El carrito está vacío.");return}
  if(!$("checkoutForm").reportValidity())return;
  if(!isAdminTestMode&&!stripeTestReady){setError("Stripe TEST todavía no está configurado por completo.");return}
  const button=$("checkoutSubmit"),old=button.textContent; button.disabled=true; button.textContent=isAdminTestMode?"Creando pedido de prueba…":"Abriendo Stripe…";
  try{const payload=formPayload();if(isAdminTestMode)await submitAdminTest(payload);else await submitStripeTest(payload)}catch(error){setError(error.message);button.disabled=false;button.textContent=old}
}

async function init() {
  try { const [_, health] = await Promise.all([loadProducts(), loadHealth()]); stripeTestReady=health.stripe===true&&health.stripeMode==="test"; shippingFlat=Number(health.shippingFlat??3.90); freeShippingThreshold=Number(health.freeShippingThreshold??39.90); buildCartRows(); renderSummary(); }
  catch(error){setError(error.message);return}
  adminToken=sessionStorage.getItem(ADMIN_TOKEN_KEY)||"";
  const params=new URLSearchParams(location.search),requestedAdminTest=params.get("test")==="1",cancelled=params.get("cancel")==="1";
  isAdminTestMode=requestedAdminTest&&Boolean(adminToken);
  if(cancelled)showNotice("<b>Pago cancelado.</b> No se ha cobrado nada y tu carrito sigue intacto.");
  if(isAdminTestMode&&cartRows.length){showNotice("<b>Modo de prueba de administración.</b> Se guardará directamente en D1 y no se abrirá Stripe.");$("checkoutTopbar").textContent="MODO PRUEBA ADMIN · No se cobra dinero";$("checkoutSubmit").disabled=false;$("checkoutSubmit").textContent="Crear pedido de prueba";$("checkoutHelp").textContent="Se guardará en D1 con pago TEST y aparecerá en /admin/pedidos.html."}
  else if(requestedAdminTest&&!adminToken)setError("Para crear un pedido de prueba administrativo, entra primero en /admin/ y vuelve a abrir el checkout desde Pedidos.");
  else if(stripeTestReady&&cartRows.length){showNotice("<b>Stripe TEST activo.</b> La pantalla de pago será de Stripe, pero ninguna tarjeta real será cobrada.");$("checkoutTopbar").textContent="STRIPE TEST · Pago simulado";$("checkoutSubmit").disabled=false;$("checkoutSubmit").textContent="Pagar con Stripe · TEST";$("checkoutHelp").textContent="Usa una tarjeta de prueba de Stripe. El pedido solo se marcará pagado cuando llegue el webhook firmado."}
  else if(cartRows.length){setError("Stripe TEST todavía no está listo. Configura STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en Cloudflare.");$("checkoutSubmit").textContent="Stripe TEST no configurado"}
  $("checkoutForm").addEventListener("submit",submitCheckout);
}
document.addEventListener("DOMContentLoaded",init);
