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
let adminSession = null;
let currentFulfillmentPreview = null;

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
  adminSession = data;
  renderEmailStatus();
  return data.ok;
}

function renderEmailStatus(){
  const el=$o("ordersEmailStatus");
  if(!el||!adminSession)return;
  if(adminSession.email){
    el.className="status";
    el.textContent=adminSession.emailMode==="test"?"Email Resend · TEST":"Email Resend · ACTIVO";
  }else{
    el.className="status draft";
    el.textContent="Email sin configurar";
  }
  const cj=$o("ordersCjStatus");
  if(cj){
    cj.className=adminSession.cj?"status":"status draft";
    cj.textContent=adminSession.cj?`CJ · ${String(adminSession.cjMode||"sandbox").toUpperCase()}`:"CJ sin configurar";
  }
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
      <td><b>${escO(o.publicCode)}</b>${o.stripeTest?'<div class="meta admin-test-order">STRIPE TEST</div>':(o.test?'<div class="meta admin-test-order">PRUEBA ADMIN</div>':"")}${o.supplierOrderCount?`<div class="meta">CJ: ${escO(o.supplierStatuses||"creado")}</div>`:""}<div class="meta">${dtO(o.createdAt)} · ${o.itemCount} línea(s)</div></td>
      <td><b>${escO(o.customerName||"—")}</b><div class="meta">${escO(o.customerEmail||"")}</div></td>
      <td><b>${moneyO(o.total,o.currency)}</b></td>
      <td><span class="status ${o.paymentStatus==="test_paid"?"draft":""}">${escO(P_LABEL[o.paymentStatus]||o.paymentStatus)}</span></td>
      <td><span class="status order-status-${escO(o.fulfillmentStatus)}">${escO(F_LABEL[o.fulfillmentStatus]||o.fulfillmentStatus)}</span></td>
      <td><button class="btn secondary admin-edit" data-order="${escO(o.id)}">Abrir</button></td>
    </tr>`).join(""):`<tr><td colspan="6" class="admin-empty">No hay pedidos que coincidan con el filtro.</td></tr>`;
}


function fulfillmentHtml(o){
  if(!adminSession?.cj){
    return `<div class="notice"><b>CJ todavía no está conectado.</b><br><span class="meta">Configura CJ_API_KEY en Cloudflare para probar el fulfillment sandbox.</span></div>`;
  }
  const supplierOrders=o.supplierOrders||[];
  if(!supplierOrders.length){
    const preview=currentFulfillmentPreview;
    const previewHtml=preview?`<div class="admin-order-events">${(preview.groups||[]).map(g=>`<div class="admin-order-event"><b>${escO(g.originCountry)} → ES · ${escO(g.selectedLogistic?.logisticName||"Sin logística")}</b><span>${g.selectedLogistic?.priceUsd!=null?`$${Number(g.selectedLogistic.priceUsd).toFixed(2)}`:""} ${escO(g.selectedLogistic?.aging||"")}</span><div class="meta">${(g.items||[]).map(i=>`${escO(i.productName)}${i.variantName?` · ${escO(i.variantName)}`:""} · ${escO(i.supplierSku)} → VID ${escO(i.vid)}`).join("<br>")}</div></div>`).join("")}${(preview.incompatible||[]).length?`<div class="notice"><b>Líneas no CJ:</b> ${(preview.incompatible||[]).map(x=>escO(x.productName)).join(", ")}</div>`:""}</div>`:"";
    return `<div class="notice"><b>Fulfillment CJ ${escO(String(adminSession.cjMode||"sandbox").toUpperCase())}</b><br><span class="meta">Primero validaremos SKU, VID y logística. Crear el pedido en SANDBOX no cobra ni envía nada real.</span></div>${previewHtml}<div class="admin-fulfillment-actions"><button class="btn secondary" type="button" data-fulfillment-action="preview">Comprobar CJ</button><button class="btn primary" type="button" data-fulfillment-action="create">Crear pedido CJ Sandbox</button></div>`;
  }
  const cards=supplierOrders.map(so=>`<div class="admin-order-box"><span>CJ ${escO(String(so.mode||"").toUpperCase())} · ${escO(so.originCountry)}</span><b>${escO(so.supplierOrderCode||so.supplierOrderId||"Pedido CJ")}</b><p>Estado: ${escO(so.subStatus||so.status)}<br>Logística: ${escO(so.logisticName||"—")}${so.postageUsd!=null?`<br>Portes CJ: $${Number(so.postageUsd).toFixed(2)}`:""}${so.trackingCode?`<br>Tracking: ${escO(so.trackingCode)}`:""}</p><div class="meta">${(so.items||[]).map(i=>`${escO(i.productName)}${i.variantName?` · ${escO(i.variantName)}`:""}<br>${escO(i.supplierSku)} · VID ${escO(i.supplierVariantId)}`).join("<br>")}</div></div>`).join("");
  const sandbox=String(adminSession.cjMode||"")==="sandbox";
  return `<div class="admin-order-grid">${cards}</div><div class="admin-fulfillment-actions"><button class="btn secondary" type="button" data-fulfillment-action="sync">Sincronizar CJ</button>${sandbox?'<button class="btn secondary" type="button" data-fulfillment-action="sandbox-pay">Simular pago CJ</button><button class="btn primary" type="button" data-fulfillment-action="sandbox-ship">Simular envío CJ</button>':""}</div>`;
}

async function fulfillmentAction(action){
  if(!currentOrder)return;
  const buttons=[...document.querySelectorAll("[data-fulfillment-action]")];
  buttons.forEach(b=>b.disabled=true);setFormError();
  try{
    const data=await api(`/api/admin/orders/${encodeURIComponent(currentOrder.id)}/fulfillment/${action}`,{method:"POST",body:JSON.stringify({})});
    if(action==="preview"){
      currentFulfillmentPreview=data.preview;
      flash("CJ validado: SKU, VID y logística disponibles.");
      await openOrder(currentOrder.id,true);
    }else{
      currentFulfillmentPreview=null;
      currentOrder=data.order||currentOrder;
      if(action==="create") flash("Pedido CJ Sandbox creado. No se ha cobrado ni enviado nada real.");
      else if(action==="sandbox-pay") flash("Pago CJ Sandbox simulado. Sin cargo real.");
      else if(action==="sandbox-ship") flash("Envío CJ Sandbox simulado.");
      else flash("CJ sincronizado.");
      await loadOrders();
      await openOrder(currentOrder.id,true);
    }
  }catch(err){setFormError(err.message)}
  finally{buttons.forEach(b=>b.disabled=false)}
}

async function openOrder(id,preservePreview=false){
  if(!preservePreview) currentFulfillmentPreview=null;
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
      <div><b>${escO(i.productName)}</b>${i.variantName?`<span class="order-variant">${escO(i.variantName)}</span>`:""}<span>${i.quantity} × ${moneyO(i.unitPrice,o.currency)}</span></div>
      <strong>${moneyO(i.unitPrice*i.quantity,o.currency)}</strong>
      <div class="meta">${i.supplier?`${escO(i.supplier)} · ${escO(i.supplierSku||"sin SKU")}`:"Proveedor no asignado"}</div>
    </div>`).join("");

  const events=(o.events||[]).map(e=>`
    <div class="admin-order-event"><b>${escO(e.message||e.type)}</b><span>${dtO(e.createdAt)}</span></div>`).join("");

  const emails=(o.emails||[]).map(e=>`
    <div class="admin-order-event"><b>${e.status==="sent"?"✓":"!"} ${escO(e.type)} · ${escO(e.status)}</b><span>${escO(e.recipient||"")} · ${dtO(e.createdAt)}</span>${e.error?`<div class="meta" style="color:#9c3426">${escO(e.error)}</div>`:""}</div>`).join("");

  $o("orderDetailBody").innerHTML=`
    ${o.stripeTest?'<div class="order-admin-test-banner">STRIPE TEST · No existe cobro real</div>':(o.test?'<div class="order-admin-test-banner">PEDIDO DE PRUEBA ADMIN · No existe cobro real</div>':"")}
    <div class="admin-order-grid">
      <div class="admin-order-box"><span>Cliente</span><b>${escO(o.customerName)}</b><p>${escO(o.customerEmail)}${o.address.phone?`<br>${escO(o.address.phone)}`:""}</p></div>
      <div class="admin-order-box"><span>Entrega</span><b>${escO(o.address.line1||"—")}</b><p>${o.address.line2?escO(o.address.line2)+"<br>":""}${escO(o.address.postalCode)} ${escO(o.address.city)}${o.address.province?`, ${escO(o.address.province)}`:""}</p></div>
      <div class="admin-order-box"><span>Total</span><b>${moneyO(o.total,o.currency)}</b><p>Productos: ${moneyO(o.subtotal ?? o.total,o.currency)}<br>Envío: ${Number(o.shipping||0)>0?moneyO(o.shipping,o.currency):"Gratis"}<br>Pago: ${escO(P_LABEL[o.paymentStatus]||o.paymentStatus)}${o.stripeCheckoutSessionId?`<br><span class="meta">Stripe: ${escO(o.stripeCheckoutSessionId)}</span>`:""}${o.stripePaymentIntentId?`<br><span class="meta">PaymentIntent: ${escO(o.stripePaymentIntentId)}</span>`:""}</p></div>
    </div>
    ${o.address.notes?`<div class="notice"><b>Notas cliente:</b> ${escO(o.address.notes)}</div>`:""}
    <h3 class="admin-section-title">Artículos</h3>
    <div class="admin-order-items">${items}</div>
    <h3 class="admin-section-title">Fulfillment proveedor</h3>
    <div id="supplierFulfillment">${fulfillmentHtml(o)}</div>
    <h3 class="admin-section-title">Emails</h3>
    <div class="admin-order-events">${emails||'<div class="meta">Todavía no hay emails registrados para este pedido.</div>'}</div>
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

  $o("orderDetailBody").addEventListener("click",e=>{
    const btn=e.target.closest("[data-fulfillment-action]");
    if(btn) fulfillmentAction(btn.dataset.fulfillmentAction);
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
      if(data.email?.error) flash(`Pedido actualizado. Email no enviado: ${data.email.error}`,"error");
      else if(data.email?.sent) flash("Pedido actualizado y email enviado.");
      else flash("Pedido actualizado.");
    }catch(err){setFormError(err.message)}
    finally{button.disabled=false}
  });

  $o("sendOrderEmailBtn").addEventListener("click",async()=>{
    if(!currentOrder)return;
    const btn=$o("sendOrderEmailBtn");btn.disabled=true;setFormError();
    try{
      const data=await api(`/api/admin/orders/${encodeURIComponent(currentOrder.id)}/email`,{method:"POST",body:JSON.stringify({})});
      currentOrder=data.order;
      flash(data.email?.sent?"Email enviado.":"No se envió ningún email.",data.email?.sent?"success":"error");
      await openOrder(currentOrder.id);
    }catch(err){setFormError(err.message)}
    finally{btn.disabled=false}
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
