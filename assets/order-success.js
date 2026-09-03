const LAST_EMAIL_KEY = "noma-last-order-email";
const CART_KEY = "noma-cart";
const $s = id => document.getElementById(id);
const moneyS = (n, currency="EUR") => new Intl.NumberFormat("es-ES",{style:"currency",currency}).format(n);
const escS = (s="") => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const PAYMENT_LABELS = {
  pending: "Confirmando…",
  paid: "Pagado",
  test_paid: "Prueba admin",
  failed: "Fallido",
  refunded: "Reembolsado"
};
const FULFILLMENT_LABELS = {
  pending: "Pendiente",
  processing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

async function fetchOrder(code, email) {
  const res = await fetch("/api/order-status", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({publicCode:code,email})
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "No se pudo cargar el pedido.");
  return data.order;
}

function renderOrder(box, o) {
  const testText = o.stripeTest
    ? '<div class="order-test-chip">STRIPE TEST · NO SE HA COBRADO DINERO REAL</div>'
    : (o.test ? '<div class="order-test-chip">PEDIDO DE PRUEBA · NO SE HA COBRADO DINERO</div>' : '');

  box.innerHTML = `
    ${testText}
    <p class="meta">Número de pedido</p>
    <div class="order-code">${escS(o.publicCode)}</div>
    <div class="order-status-grid">
      <div><span>Total</span><b>${moneyS(o.total,o.currency)}</b></div>
      <div><span>Estado</span><b>${escS(FULFILLMENT_LABELS[o.fulfillmentStatus] || o.fulfillmentStatus)}</b></div>
      <div><span>Pago</span><b>${escS(PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus)}</b></div>
    </div>
    ${o.paymentStatus === "pending" ? '<p class="tiny">Estamos esperando la confirmación segura del pago; suele tardar solo unos instantes.</p>' : ''}`;
}

async function initSuccess() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code") || "";
  const cameFromStripe = params.get("stripe") === "1";
  const email = localStorage.getItem(LAST_EMAIL_KEY) || "";
  const box = $s("orderSuccess");

  if (!code) {
    box.innerHTML = `<p>No se ha indicado un número de pedido.</p>`;
    return;
  }

  if (!email) {
    box.innerHTML = `<div class="order-code">${escS(code)}</div><p>Guarda este número para consultar el seguimiento.</p>`;
    return;
  }

  try {
    let order = await fetchOrder(code, email);
    renderOrder(box, order);

    if (cameFromStripe && order.paymentStatus === "pending") {
      for (let i = 0; i < 8 && order.paymentStatus === "pending"; i++) {
        await sleep(1000);
        order = await fetchOrder(code, email);
        renderOrder(box, order);
      }
    }

    if (cameFromStripe && order.paymentStatus === "paid") {
      localStorage.removeItem(CART_KEY);
    }
  } catch (error) {
    box.innerHTML = `<div class="order-code">${escS(code)}</div><p>${escS(error.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initSuccess);
