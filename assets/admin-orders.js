const ORDER_TOKEN_KEY = "noma-admin-token";
const $o = id => document.getElementById(id);
const moneyO = (n, currency="EUR") => new Intl.NumberFormat("es-ES",{style:"currency",currency}).format(n);
const escO = (s="") => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const dtO = value => value ? new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short"}).format(new Date(value.replace(" ","T")+"Z")) : "—";

const F_LABEL = {pending:"Pendiente",processing:"Preparando",shipped:"Enviado",delivered:"Entregado",cancelled:"Cancelado"};
const P_LABEL = {pending:"Pendiente",paid:"Pagado",test_paid:"TEST",refunded:"Reembolsado",failed:"Fallido"};

let orderToken = sessionStorage.getItem(ORDER_TOKEN_KEY) || "";
let orders = [];
let currentOrder = null;

function setLoginError(message=""){const el=$o("ordersLoginError");el.hidden=!message;el.textContent=message}
function setFormError(message=""){const el=$o("orderFormError");el.hidden=!message;el.textContent=message}
function flash(message,type="success"){const el=$o("ordersMessage");el.hidden=false;el.className=`admin-message ${type}`;el.textContent=message;setTimeout(()=>el.hidden=true,3500)}

async function api(path, options={}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${orderToken}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type","application/json");
  const res = await fetch(path,{...options,headers});
  const data = await res.json().catch(()=>({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "Error en la API.");
  return data;
}

async function validateSession() {
  const data = await api("/api/admin/session");
  return data.ok;
}

function showDashboard() {
  $o("ordersLoginView").hidden=true;
  $o("ordersDashboard").hidden=false;
  $o("logoutBtn").hidden=false;
}

async function login(token) {
  orderToken = token.trim();
  if (!orderToken) throw new Error("Introduce el token.");
  await validateSession();
  sessionStorage.setItem(ORDER_TOKEN_KEY,orderToken);
  showDashboard();
  await loadOrders();
}

async function loadOrders() {
  const data=await api("/api/admin/orders");
  orders=data.orders||[];
  renderKpis();
  renderOrders();
}

function renderKpis(){
  $o("ordersKpiTotal").textContent=orders.length;
  $o("ordersKpiPending").textContent=orders.filter(x=>["pending","processing"].includes(x.fulfillmentStatus)).length;
  $o("ordersKpiShipped").textContent=orders.filter(x=>x.fulfillmentStatus==="shipped").length;
  $o("ordersKpiDelivered").textContent=orders.filter(x=>x.fulfillmentStatus==="delivered").length;
}

function renderOrders(){
  const q=$o("ordersSearch").value.trim().toLowerCase();
  const status=$o("ordersStatusFilter").value;
  const filtered=orders.filter(o=>{
    const text=`${o.publicCode} ${o.customerName} ${o.customerEmail}`.toLowerCase();
    return (!q||text.includes(q)) && (status==="all"||o.fulfillmentStatus===status);
  });
  $o("ordersRows").innerHTML=filtered.length?filtered.map(o=>`
    <tr>
      <td><b>${escO(o.publicCode)}</b>${o.stripeTest?'<div class="meta admin-test-order">STRIPE TEST</div>':(o.test?'<div class="meta admin-test-order">PRUEBA ADMIN</div>':"")}<div class="meta">${dtO(o.createdAt)} · ${o.itemCount} línea(s)</div></td>
      <td><b>${escO(o.customerName||"—")}</b><div class="meta">${escO(o.customerEmail||"")}</div></td>
      <td><b>${moneyO(o.total,o.currency)}</b></td>
      <td><span class="status ${o.paymentStatus==="test_paid"?"draft":""}">${escO(P_LABEL[o.paymentStatus]||o.paymentStatus)}</span></td>
      <td><span class="status order-status-${escO(o.fulfillmentStatus)}">${escO(F_LABEL[o.fulfillmentStatus]||o.fulfillmentStatus)}</span></td>
      <td><button class="btn secondary admin-edit" data-order="${escO(o.id)}">Abrir</button></td>
    </tr>`).join(""):`<tr><td colspan="6" class="admin-empty">No hay pedidos que coincidan con el filtro.</td></tr>`;
}

async function openOrder(id){
  const data=await api(`/api/admin/orders/${encodeURIComponent(id)}`);
  currentOrder=data.order;
  const o=currentOrder;
  $o("orderModalTitle").textContent=o.publicCode;
  $o("orderFulfillment").value=o.fulfillmentStatus||"pending";
  $o("orderTrackingCode").value=o.trackingCode||"";
  $o("orderTrackingUrl").value=o.trackingUrl||"";
  $o("deleteTestOrderBtn").hidden=!o.test;

  const items=(o.items||[]).map(i=>`
    <div class="admin-order-item">
      <div><b>${escO(i.productName)}</b><span>${i.quantity} × ${moneyO(i.unitPrice,o.currency)}</span></div>
      <strong>${moneyO(i.unitPrice*i.quantity,o.currency)}</strong>
      <div class="meta">${i.supplier?`${escO(i.supplier)} · ${escO(i.supplierSku||"sin SKU")}`:"Proveedor no asignado"}</div>
    </div>`).join("");

  const events=(o.events||[]).map(e=>`
    <div class="admin-order-event"><b>${escO(e.message||e.type)}</b><span>${dtO(e.createdAt)}</span></div>`).join("");

  $o("orderDetailBody").innerHTML=`
    ${o.stripeTest?'<div class="order-admin-test-banner">STRIPE TEST · No existe cobro real</div>':(o.test?'<div class="order-admin-test-banner">PEDIDO DE PRUEBA ADMIN · No existe cobro real</div>':"")}
    <div class="admin-order-grid">
      <div class="admin-order-box"><span>Cliente</span><b>${escO(o.customerName)}</b><p>${escO(o.customerEmail)}${o.address.phone?`<br>${escO(o.address.phone)}`:""}</p></div>
      <div class="admin-order-box"><span>Entrega</span><b>${escO(o.address.line1||"—")}</b><p>${o.address.line2?escO(o.address.line2)+"<br>":""}${escO(o.address.postalCode)} ${escO(o.address.city)}${o.address.province?`, ${escO(o.address.province)}`:""}</p></div>
      <div class="admin-order-box"><span>Total</span><b>${moneyO(o.total,o.currency)}</b><p>Pago: ${escO(P_LABEL[o.paymentStatus]||o.paymentStatus)}${o.stripeCheckoutSessionId?`<br><span class="meta">Stripe: ${escO(o.stripeCheckoutSessionId)}</span>`:""}${o.stripePaymentIntentId?`<br><span class="meta">PaymentIntent: ${escO(o.stripePaymentIntentId)}</span>`:""}</p></div>
    </div>
    ${o.address.notes?`<div class="notice"><b>Notas cliente:</b> ${escO(o.address.notes)}</div>`:""}
    <h3 class="admin-section-title">Artículos</h3>
    <div class="admin-order-items">${items}</div>
    <h3 class="admin-section-title">Historial</h3>
    <div class="admin-order-events">${events||'<div class="meta">Sin eventos todavía.</div>'}</div>`;

  setFormError();
  const modal=$o("orderModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function closeOrder(){
  $o("orderModal").classList.remove("open");
  $o("orderModal").setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
  currentOrder=null;
}

document.addEventListener("DOMContentLoaded", async()=>{
  $o("ordersLoginForm").addEventListener("submit",async e=>{
    e.preventDefault();setLoginError();
    try{await login($o("ordersToken").value)}catch(err){setLoginError(err.message)}
  });

  $o("logoutBtn").addEventListener("click",()=>{
    sessionStorage.removeItem(ORDER_TOKEN_KEY);location.reload();
  });

  $o("ordersSearch").addEventListener("input",renderOrders);
  $o("ordersStatusFilter").addEventListener("change",renderOrders);

  $o("ordersRows").addEventListener("click",e=>{
    const btn=e.target.closest("[data-order]");
    if(btn)openOrder(btn.dataset.order).catch(err=>flash(err.message,"error"));
  });

  document.querySelectorAll("[data-close-order]").forEach(el=>el.addEventListener("click",closeOrder));

  $o("orderUpdateForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!currentOrder)return;setFormError();
    const button=$o("saveOrderBtn");button.disabled=true;
    try{
      const data=await api(`/api/admin/orders/${encodeURIComponent(currentOrder.id)}`,{
        method:"PUT",
        body:JSON.stringify({
          fulfillmentStatus:$o("orderFulfillment").value,
          trackingCode:$o("orderTrackingCode").value,
          trackingUrl:$o("orderTrackingUrl").value
        })
      });
      currentOrder=data.order;
      await loadOrders();
      closeOrder();
      flash("Pedido actualizado.");
    }catch(err){setFormError(err.message)}
    finally{button.disabled=false}
  });

  $o("deleteTestOrderBtn").addEventListener("click",async()=>{
    if(!currentOrder?.test)return;
    if(!confirm("¿Eliminar definitivamente este pedido de prueba?"))return;
    try{
      await api(`/api/admin/orders/${encodeURIComponent(currentOrder.id)}`,{method:"DELETE"});
      closeOrder();await loadOrders();flash("Pedido de prueba eliminado.");
    }catch(err){setFormError(err.message)}
  });

  if(orderToken){
    try{await validateSession();showDashboard();await loadOrders()}
    catch(_){sessionStorage.removeItem(ORDER_TOKEN_KEY);orderToken=""}
  }
});
