const TOKEN_KEY = "noma-admin-token";
let products = [];
let token = sessionStorage.getItem(TOKEN_KEY) || "";

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));
const escapeHtml = (s = "") => String(s).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

function authHeaders(json = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) }
  });

  let data = {};
  try { data = await res.json(); } catch (_) {}

  if (res.status === 401) {
    logout(false);
    throw new Error(data.message || "Sesión no autorizada.");
  }
  if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
  return data;
}

function setLoginError(message = "") {
  const el = $("loginError");
  el.textContent = message;
  el.hidden = !message;
}

function setFormError(message = "") {
  const el = $("formError");
  el.textContent = message;
  el.hidden = !message;
}

function flash(message, kind = "success") {
  const el = $("adminMessage");
  el.textContent = message;
  el.className = `admin-message ${kind}`;
  el.hidden = false;
  window.clearTimeout(flash.timer);
  flash.timer = window.setTimeout(() => { el.hidden = true; }, 3500);
}

function showDashboard() {
  $("loginView").hidden = true;
  $("dashboardView").hidden = false;
  $("logoutBtn").hidden = false;
}

function showLogin() {
  $("loginView").hidden = false;
  $("dashboardView").hidden = true;
  $("logoutBtn").hidden = true;
}

async function login(candidate) {
  token = candidate.trim();
  if (!token) return;
  setLoginError();
  try {
    const res = await fetch("/api/admin/session", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "ADMIN_NOT_CONFIGURED") {
        throw new Error("ADMIN_TOKEN no está disponible en ESTE Worker. Añádelo en Settings → Variables & Secrets del Worker que estás abriendo (no en Build Variables), pulsa Deploy y vuelve a probar.");
      }
      throw new Error(data.message || "Token incorrecto.");
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    showDashboard();
    await loadProducts();
  } catch (error) {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
    setLoginError(error.message);
  }
}

function logout(focus = true) {
  token = "";
  sessionStorage.removeItem(TOKEN_KEY);
  products = [];
  showLogin();
  if (focus) $("adminToken").focus();
}

async function loadProducts() {
  const data = await api("/api/admin/products");
  products = data.products || [];
  render();
}

function render() {
  const query = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const filtered = products.filter(p => {
    const haystack = [p.name, p.cat, p.source?.supplier, p.source?.supplierSku].filter(Boolean).join(" ").toLowerCase();
    const matchesText = !query || haystack.includes(query);
    const matchesStatus = status === "all" || (status === "published" ? p.published : !p.published);
    return matchesText && matchesStatus;
  });

  $("kpiTotal").textContent = products.length;
  $("kpiPublished").textContent = products.filter(p => p.published).length;
  $("kpiDrafts").textContent = products.filter(p => !p.published).length;
  $("kpiSupplier").textContent = products.filter(p => p.source?.supplier).length;

  $("adminRows").innerHTML = filtered.length
    ? filtered.map(p => `
      <tr>
        <td>
          <div class="admin-product-cell">
            <span class="admin-product-emoji">${escapeHtml(p.emoji || "🐾")}</span>
            <div><b>${escapeHtml(p.name)}</b><div class="meta">${escapeHtml(p.id)}</div></div>
          </div>
        </td>
        <td>${escapeHtml(p.cat || "")}</td>
        <td><b>${money(p.price)}</b></td>
        <td>${p.source?.supplier ? `${escapeHtml(p.source.supplier)}<div class="meta">${escapeHtml(p.source.supplierSku || "Sin SKU")}</div>` : '<span class="meta">Sin proveedor</span>'}</td>
        <td><span class="status ${p.published ? "" : "draft"}">${p.published ? "Publicado" : "Borrador"}</span></td>
        <td><button class="btn secondary admin-edit" data-edit="${escapeHtml(p.id)}">Editar</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="admin-empty">No hay productos que coincidan con el filtro.</td></tr>`;
}

function resetForm() {
  $("productForm").reset();
  $("editId").value = "";
  $("sourceId").value = "";
  $("emoji").value = "🐾";
  $("currency")?.value && ($("currency").value = "EUR");
  $("costCurrency").value = "EUR";
  $("stockMode").value = "supplier";
  $("stockStatus").value = "unknown";
  $("complianceStatus").value = "pending";
  $("sortOrder").value = "0";
  $("stockQty").disabled = true;
  $("productId").disabled = false;
  $("deleteBtn").hidden = true;
  setFormError();
}

function openNew() {
  resetForm();
  $("modalTitle").textContent = "Nuevo producto";
  openModal();
}

function openEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  resetForm();

  $("editId").value = p.id;
  $("productId").value = p.id;
  $("productId").disabled = true;
  $("name").value = p.name || "";
  $("slug").value = p.slug || "";
  $("category").value = p.cat || "hogar";
  $("tag").value = p.tag || "";
  $("emoji").value = p.emoji || "🐾";
  $("price").value = Number(p.price || 0).toFixed(2);
  $("sortOrder").value = p.sortOrder ?? 0;
  $("stockMode").value = p.stockMode || "supplier";
  $("stockQty").disabled = p.stockMode !== "finite";
  $("stockQty").value = p.stockQty ?? "";
  $("shortDesc").value = p.desc || "";
  $("description").value = p.description || "";
  $("imageUrl").value = p.imageUrl || "";
  $("published").checked = Boolean(p.published);

  const s = p.source || {};
  $("sourceId").value = s.id || "";
  $("supplier").value = s.supplier || "";
  $("supplierSku").value = s.supplierSku || "";
  $("supplierUrl").value = s.supplierUrl || "";
  $("productCost").value = s.productCost ?? "";
  $("shippingCost").value = s.shippingCost ?? "";
  $("costCurrency").value = s.costCurrency || "EUR";
  $("warehouse").value = s.warehouse || "";
  $("stockStatus").value = s.stockStatus || "unknown";
  $("complianceStatus").value = s.complianceStatus || "pending";
  $("shippingDaysMin").value = s.shippingDaysMin ?? "";
  $("shippingDaysMax").value = s.shippingDaysMax ?? "";
  $("sourceNotes").value = s.notes || "";

  $("deleteBtn").hidden = false;
  $("modalTitle").textContent = "Editar producto";
  openModal();
}

function openModal() {
  const modal = $("productModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal() {
  const modal = $("productModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function payloadFromForm() {
  const id = $("editId").value || $("productId").value.trim();
  return {
    id,
    name: $("name").value,
    slug: $("slug").value,
    category: $("category").value,
    tag: $("tag").value,
    emoji: $("emoji").value,
    price: $("price").value,
    currency: "EUR",
    sortOrder: $("sortOrder").value,
    stockMode: $("stockMode").value,
    stockQty: $("stockQty").value,
    shortDesc: $("shortDesc").value,
    description: $("description").value,
    imageUrl: $("imageUrl").value,
    published: $("published").checked,
    source: {
      id: $("sourceId").value || null,
      supplier: $("supplier").value,
      supplierSku: $("supplierSku").value,
      supplierUrl: $("supplierUrl").value,
      productCost: $("productCost").value,
      shippingCost: $("shippingCost").value,
      costCurrency: $("costCurrency").value,
      warehouse: $("warehouse").value,
      stockStatus: $("stockStatus").value,
      complianceStatus: $("complianceStatus").value,
      shippingDaysMin: $("shippingDaysMin").value,
      shippingDaysMax: $("shippingDaysMax").value,
      notes: $("sourceNotes").value
    }
  };
}

async function saveProduct(event) {
  event.preventDefault();
  setFormError();
  const editId = $("editId").value;
  const payload = payloadFromForm();
  const btn = $("saveBtn");
  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    if (editId) {
      await api(`/api/admin/products/${encodeURIComponent(editId)}`, { method: "PUT", body: JSON.stringify(payload) });
      flash("Producto actualizado.");
    } else {
      await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
      flash("Producto creado.");
    }
    closeModal();
    await loadProducts();
  } catch (error) {
    setFormError(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
}

async function deleteProduct() {
  const id = $("editId").value;
  const p = products.find(x => x.id === id);
  if (!id || !p) return;
  if (!confirm(`¿Eliminar definitivamente "${p.name}"?\n\nTambién se eliminarán sus datos de proveedor asociados.`)) return;

  const btn = $("deleteBtn");
  btn.disabled = true;
  btn.textContent = "Eliminando…";
  try {
    await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    closeModal();
    flash("Producto eliminado.");
    await loadProducts();
  } catch (error) {
    setFormError(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Eliminar producto";
  }
}

$("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  login($("adminToken").value);
});
$("logoutBtn").addEventListener("click", () => logout());
$("newProductBtn").addEventListener("click", openNew);
$("productForm").addEventListener("submit", saveProduct);
$("deleteBtn").addEventListener("click", deleteProduct);
$("searchInput").addEventListener("input", render);
$("statusFilter").addEventListener("change", render);
$("stockMode").addEventListener("change", () => {
  const finite = $("stockMode").value === "finite";
  $("stockQty").disabled = !finite;
  if (!finite) $("stockQty").value = "";
});

$("adminRows").addEventListener("click", e => {
  const btn = e.target.closest("[data-edit]");
  if (btn) openEdit(btn.dataset.edit);
});

document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

(async function init() {
  if (!token) {
    showLogin();
    return;
  }
  try {
    const res = await fetch("/api/admin/session", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    showDashboard();
    await loadProducts();
  } catch (_) {
    logout(false);
  }
})();
