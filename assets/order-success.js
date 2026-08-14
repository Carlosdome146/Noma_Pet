const LAST_EMAIL_KEY = "noma-last-order-email";
const $s = id => document.getElementById(id);
const moneyS = (n, currency="EUR") => new Intl.NumberFormat("es-ES",{style:"currency",currency}).format(n);
const escS = (s="") => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

async function initSuccess() {
  const code = new URLSearchParams(location.search).get("code") || "";
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
    const res = await fetch("/api/order-status", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({publicCode:code,email})
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok || !data.ok) throw new Error(data.message || "No se pudo cargar el pedido.");
    const o = data.order;
    box.innerHTML = `
      ${o.test ? '<div class="order-test-chip">PEDIDO DE PRUEBA · NO SE HA COBRADO DINERO</div>' : ''}
      <p class="meta">Número de pedido</p>
      <div class="order-code">${escS(o.publicCode)}</div>
      <div class="order-status-grid">
        <div><span>Total</span><b>${moneyS(o.total,o.currency)}</b></div>
        <div><span>Estado</span><b>${o.fulfillmentStatus === "pending" ? "Pendiente" : escS(o.fulfillmentStatus)}</b></div>
        <div><span>Pago</span><b>${o.paymentStatus === "test_paid" ? "Prueba" : escS(o.paymentStatus)}</b></div>
      </div>`;
  } catch (error) {
    box.innerHTML = `<div class="order-code">${escS(code)}</div><p>${escS(error.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initSuccess);
