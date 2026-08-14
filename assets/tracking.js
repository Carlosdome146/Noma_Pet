const TRACK_LAST_EMAIL = "noma-last-order-email";
const $t = id => document.getElementById(id);
const moneyT = (n, currency = "EUR") => new Intl.NumberFormat("es-ES", { style:"currency", currency }).format(n);
const escT = (s="") => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const STATUS_LABELS = {
  pending: "Pendiente",
  processing: "Preparando pedido",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

const PAYMENT_LABELS = {
  pending: "Pendiente de pago",
  paid: "Pagado",
  test_paid: "Pago de prueba",
  refunded: "Reembolsado",
  failed: "Pago fallido"
};

function setTrackingError(message="") {
  const el = $t("trackingError");
  el.hidden = !message;
  el.textContent = message;
}

function renderOrder(order) {
  const result = $t("trackingResult");
  const items = (order.items || []).map(item => `
    <div class="order-item-row">
      <span>${escT(item.productName)} <small>× ${item.quantity}</small></span>
      <b>${moneyT(item.unitPrice * item.quantity, order.currency)}</b>
    </div>`).join("");

  result.innerHTML = `
    ${order.stripeTest ? '<div class="order-test-chip">STRIPE TEST · NO SE HA COBRADO DINERO REAL</div>' : (order.test ? '<div class="order-test-chip">PEDIDO DE PRUEBA</div>' : '')}
    <div class="order-code">${escT(order.publicCode)}</div>
    <div class="order-status-grid">
      <div><span>Estado</span><b>${escT(STATUS_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus)}</b></div>
      <div><span>Pago</span><b>${escT(PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus)}</b></div>
      <div><span>Total</span><b>${moneyT(order.total, order.currency)}</b></div>
    </div>
    <div class="order-items">${items}</div>
    ${order.trackingCode ? `<div class="tracking-box"><span>Seguimiento</span><b>${escT(order.trackingCode)}</b>${order.trackingUrl ? `<a class="btn secondary" href="${escT(order.trackingUrl)}" target="_blank" rel="noopener">Abrir transportista</a>` : ""}</div>` : '<p class="meta">Todavía no hay código de seguimiento asignado.</p>'}
  `;
  result.hidden = false;
}

async function lookup(code, email) {
  setTrackingError();
  const res = await fetch("/api/order-status", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ publicCode: code, email })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "No se pudo consultar el pedido.");
  renderOrder(data.order);
}

document.addEventListener("DOMContentLoaded", () => {
  const rememberedEmail = localStorage.getItem(TRACK_LAST_EMAIL) || "";
  if (rememberedEmail) $t("trackingEmail").value = rememberedEmail;

  $t("trackingForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const code = $t("trackingCode").value.trim();
      const email = $t("trackingEmail").value.trim().toLowerCase();
      localStorage.setItem(TRACK_LAST_EMAIL, email);
      await lookup(code, email);
    } catch (error) {
      $t("trackingResult").hidden = true;
      setTrackingError(error.message);
    }
  });
});
