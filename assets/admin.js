const TOKEN_KEY = "noma-admin-token";
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

let products = [];
let token = sessionStorage.getItem(TOKEN_KEY) || "";
let currentImages = [];
let pendingFiles = [];
let uploadingImages = false;
let variants = [];

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));
const escapeHtml = (s = "") => String(s).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

function authHeaders(json = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function readApiResponse(res) {
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (res.status === 401) {
    logout(false);
    throw new Error(data.message || "Sesión no autorizada.");
  }
  if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
  return data;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) }
  });
  return readApiResponse(res);
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

function setImageError(message = "") {
  const el = $("imageError");
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
        throw new Error("ADMIN_TOKEN no está disponible en ESTE Worker. Añádelo en Settings → Variables & Secrets del Worker, pulsa Deploy y vuelve a probar.");
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
    const variantText = (p.variants || []).flatMap(v => [v.name, v.supplierSku]).filter(Boolean);
    const haystack = [p.name, p.cat, p.source?.supplier, p.source?.supplierSku, ...variantText].filter(Boolean).join(" ").toLowerCase();
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
            ${p.imageUrl
              ? `<img class="admin-product-thumb" src="${escapeHtml(p.imageUrl)}" alt="">`
              : `<span class="admin-product-emoji">${escapeHtml(p.emoji || "🐾")}</span>`}
            <div><b>${escapeHtml(p.name)}</b><div class="meta">${escapeHtml(p.id)} · ${(p.images || []).length} foto${(p.images || []).length === 1 ? "" : "s"} · ${(p.variants || []).length} variante${(p.variants || []).length === 1 ? "" : "s"}</div></div>
          </div>
        </td>
        <td>${escapeHtml(p.cat || "")}</td>
        <td><b>${p.hasVariants ? `Desde ${money(p.priceFrom ?? p.price)}` : money(p.price)}</b></td>
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
  $("legacyImageUrl").value = "";
  $("emoji").value = "🐾";
  $("costCurrency").value = "EUR";
  $("stockMode").value = "supplier";
  $("stockStatus").value = "unknown";
  $("complianceStatus").value = "pending";
  $("sortOrder").value = "0";
  $("stockQty").disabled = true;
  $("productId").disabled = false;
  $("deleteBtn").hidden = true;
  currentImages = [];
  pendingFiles = [];
  variants = [];
  renderVariants();
  setFormError();
  setImageError();
  renderImageManager();
}

function openNew() {
  resetForm();
  $("modalTitle").textContent = "Nuevo producto";
  renderImageManager();
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
  $("legacyImageUrl").value = p.images?.length ? "" : (p.imageUrl || "");
  $("published").checked = Boolean(p.published);

  currentImages = Array.isArray(p.images) ? p.images.map(x => ({ ...x })) : [];
  variants = Array.isArray(p.variants) ? p.variants.map(v => ({ ...v })) : [];
  renderVariants();

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
  renderImageManager();
  openModal();
}

function openModal() {
  const modal = $("productModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal() {
  if (uploadingImages) return;
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
    imageUrl: $("legacyImageUrl").value || null,
    published: $("published").checked,
    variants: variants.map((v, index) => ({
      id: v.id || null,
      name: v.name || "",
      price: v.price ?? "",
      supplierSku: v.supplierSku || "",
      productCost: v.productCost ?? "",
      shippingCost: v.shippingCost ?? "",
      costCurrency: v.costCurrency || "EUR",
      weightGrams: v.weightGrams ?? "",
      warehouse: v.warehouse || "",
      stockStatus: v.stockStatus || "unknown",
      supplierStockQty: v.supplierStockQty ?? "",
      shippingDaysMin: v.shippingDaysMin ?? "",
      shippingDaysMax: v.shippingDaysMax ?? "",
      homologationStatus: v.homologationStatus || "pending",
      published: Boolean(v.published),
      isDefault: Boolean(v.isDefault),
      sortOrder: v.sortOrder ?? index * 10
    })),
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

function blankVariant() {
  return {
    id: "",
    name: "",
    price: "",
    supplierSku: "",
    productCost: "",
    shippingCost: "",
    costCurrency: "EUR",
    weightGrams: "",
    warehouse: "",
    stockStatus: "unknown",
    supplierStockQty: "",
    shippingDaysMin: "",
    shippingDaysMax: "",
    homologationStatus: "pending",
    published: true,
    isDefault: variants.length === 0,
    sortOrder: variants.length * 10
  };
}

function variantStatusLabel(status) {
  return ({ pending: "Pendiente", review: "En revisión", approved: "Homologada", rejected: "Rechazada" })[status] || "Pendiente";
}

function renderVariants() {
  const list = $("variantList");
  const empty = $("variantEmpty");
  if (!list || !empty) return;
  empty.hidden = variants.length > 0;
  list.innerHTML = variants.map((v, index) => `
    <article class="variant-card" data-variant-index="${index}">
      <div class="variant-card-head">
        <div class="variant-card-title">
          <span class="variant-index">${index + 1}</span>
          <div><b>${escapeHtml(v.name || `Variante ${index + 1}`)}</b><div class="meta">${v.id ? `ID: ${escapeHtml(v.id)}` : "Se generará el ID al guardar"}</div></div>
          <span class="variant-homologation ${escapeHtml(v.homologationStatus || "pending")}">${variantStatusLabel(v.homologationStatus)}</span>
        </div>
        <button type="button" class="variant-remove" data-variant-remove="${index}">Eliminar</button>
      </div>
      <div class="variant-grid">
        <div class="field span2"><label>Nombre / opción *</label><input data-vfield="name" value="${escapeHtml(v.name || "")}" placeholder="10 ft, 16 ft, Azul…" maxlength="120"></div>
        <div class="field"><label>PVP (€) *</label><input data-vfield="price" type="number" min="0" step="0.01" value="${escapeHtml(v.price ?? "")}"></div>
        <div class="field"><label>Orden</label><input data-vfield="sortOrder" type="number" step="1" value="${escapeHtml(v.sortOrder ?? index * 10)}"></div>

        <div class="field span2"><label>SKU proveedor</label><input data-vfield="supplierSku" value="${escapeHtml(v.supplierSku || "")}" maxlength="180"></div>
        <div class="field"><label>Coste producto</label><input data-vfield="productCost" type="number" min="0" step="0.01" value="${escapeHtml(v.productCost ?? "")}"></div>
        <div class="field"><label>Coste envío</label><input data-vfield="shippingCost" type="number" min="0" step="0.01" value="${escapeHtml(v.shippingCost ?? "")}"></div>

        <div class="field"><label>Peso (g)</label><input data-vfield="weightGrams" type="number" min="0" step="1" value="${escapeHtml(v.weightGrams ?? "")}"></div>
        <div class="field"><label>Almacén</label><input data-vfield="warehouse" value="${escapeHtml(v.warehouse || "")}" placeholder="España"></div>
        <div class="field"><label>Stock proveedor</label>
          <select data-vfield="stockStatus">
            <option value="unknown" ${v.stockStatus === "unknown" ? "selected" : ""}>Sin comprobar</option>
            <option value="in_stock" ${v.stockStatus === "in_stock" ? "selected" : ""}>En stock</option>
            <option value="low" ${v.stockStatus === "low" ? "selected" : ""}>Stock bajo</option>
            <option value="out" ${v.stockStatus === "out" ? "selected" : ""}>Sin stock</option>
          </select>
        </div>
        <div class="field"><label>Unidades proveedor</label><input data-vfield="supplierStockQty" type="number" min="0" step="1" value="${escapeHtml(v.supplierStockQty ?? "")}"></div>

        <div class="field"><label>Envío mín. días</label><input data-vfield="shippingDaysMin" type="number" min="0" step="1" value="${escapeHtml(v.shippingDaysMin ?? "")}"></div>
        <div class="field"><label>Envío máx. días</label><input data-vfield="shippingDaysMax" type="number" min="0" step="1" value="${escapeHtml(v.shippingDaysMax ?? "")}"></div>
        <div class="field"><label>Homologación</label>
          <select data-vfield="homologationStatus">
            <option value="pending" ${v.homologationStatus === "pending" ? "selected" : ""}>Pendiente</option>
            <option value="review" ${v.homologationStatus === "review" ? "selected" : ""}>En revisión</option>
            <option value="approved" ${v.homologationStatus === "approved" ? "selected" : ""}>Homologada</option>
            <option value="rejected" ${v.homologationStatus === "rejected" ? "selected" : ""}>Rechazada</option>
          </select>
        </div>
        <div class="field"><label>Moneda coste</label>
          <select data-vfield="costCurrency"><option value="EUR" ${v.costCurrency !== "USD" ? "selected" : ""}>EUR</option><option value="USD" ${v.costCurrency === "USD" ? "selected" : ""}>USD</option></select>
        </div>

        <div class="variant-flags">
          <label class="variant-check"><input data-vfield="published" type="checkbox" ${v.published ? "checked" : ""}> Visible en tienda</label>
          <label class="variant-check"><input data-vfield="isDefault" type="checkbox" ${v.isDefault ? "checked" : ""}> Variante predeterminada</label>
        </div>
      </div>
    </article>
  `).join("");
}

function setVariantField(index, field, element) {
  const v = variants[index];
  if (!v) return;
  if (element.type === "checkbox") v[field] = element.checked;
  else v[field] = element.value;

  if (field === "isDefault" && element.checked) {
    variants.forEach((other, i) => { other.isDefault = i === index; });
    renderVariants();
  } else if (field === "homologationStatus") {
    renderVariants();
  }
}

function validateVariantsBeforeSave() {
  if (!variants.length) return;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!String(v.name || "").trim()) throw new Error(`La variante ${i + 1} necesita un nombre.`);
    if (v.price === "" || !Number.isFinite(Number(v.price)) || Number(v.price) < 0) throw new Error(`La variante “${v.name}” necesita un PVP válido.`);
  }
  if (!variants.some(v => v.isDefault)) variants[0].isDefault = true;
}

function validateFiles(files, includePending = true) {
  const list = Array.from(files || []);
  if (!list.length) return [];
  const total = currentImages.length + (includePending ? pendingFiles.length : 0) + list.length;
  if (total > MAX_IMAGES) throw new Error(`Máximo ${MAX_IMAGES} imágenes por producto.`);
  for (const file of list) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Solo se admiten JPG, PNG, WebP y AVIF.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error(`La imagen “${file.name}” supera 8 MB.`);
    if (file.size <= 0) throw new Error(`La imagen “${file.name}” está vacía.`);
  }
  return list;
}

function previewUrl(file) {
  if (!file.__previewUrl) file.__previewUrl = URL.createObjectURL(file);
  return file.__previewUrl;
}

function clearPendingPreviews() {
  for (const file of pendingFiles) {
    if (file.__previewUrl) URL.revokeObjectURL(file.__previewUrl);
  }
}

function renderImageManager() {
  const list = $("imageList");
  const editId = $("editId").value;
  const existing = currentImages.map((img, index) => `
    <article class="r2-image-card ${index === 0 ? "primary" : ""}">
      <div class="r2-image-preview"><img src="${escapeHtml(img.url)}" alt=""></div>
      <div class="r2-image-info">
        <b>${index === 0 ? "Foto principal" : `Foto ${index + 1}`}</b>
        <span class="meta">Guardada en R2</span>
      </div>
      <div class="r2-image-actions">
        ${index > 0 ? `<button type="button" class="mini-btn" data-image-primary="${img.id}">Principal</button>` : ""}
        <button type="button" class="mini-btn" data-image-up="${img.id}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="mini-btn" data-image-down="${img.id}" ${index === currentImages.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="mini-btn danger" data-image-delete="${img.id}">Eliminar</button>
      </div>
    </article>
  `).join("");

  const pending = pendingFiles.map((file, index) => `
    <article class="r2-image-card pending">
      <div class="r2-image-preview"><img src="${previewUrl(file)}" alt=""></div>
      <div class="r2-image-info"><b>Pendiente</b><span class="meta">${escapeHtml(file.name)}</span></div>
      <button type="button" class="mini-btn danger" data-pending-delete="${index}">Quitar</button>
    </article>
  `).join("");

  list.innerHTML = existing + pending || '<div class="r2-empty">Todavía no hay imágenes. La tienda mostrará el emoji del producto hasta que subas una.</div>';

  const hint = $("imageUploadHint");
  hint.textContent = editId
    ? `La primera imagen es la principal. ${currentImages.length + pendingFiles.length}/${MAX_IMAGES} imágenes.`
    : pendingFiles.length
      ? `${pendingFiles.length} foto${pendingFiles.length === 1 ? "" : "s"} pendiente${pendingFiles.length === 1 ? "" : "s"}. Se subirán automáticamente al guardar el producto.`
      : "En un producto nuevo puedes seleccionar fotos ahora; se subirán automáticamente cuando pulses Guardar.";
}

async function uploadImages(productId, files) {
  const valid = validateFiles(files, false);
  if (!valid.length) return currentImages;

  const form = new FormData();
  valid.forEach(file => form.append("files", file, file.name));
  uploadingImages = true;
  $("imageDropzone").classList.add("uploading");
  setImageError();

  try {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await readApiResponse(res);
    currentImages = data.images || [];
    renderImageManager();
    return currentImages;
  } finally {
    uploadingImages = false;
    $("imageDropzone").classList.remove("uploading");
    $("imageFiles").value = "";
  }
}

async function handleSelectedFiles(fileList) {
  setImageError();
  try {
    const files = validateFiles(fileList);
    if (!files.length) return;
    const editId = $("editId").value;
    if (editId) {
      await uploadImages(editId, files);
      flash("Imágenes subidas a R2.");
    } else {
      pendingFiles.push(...files);
      renderImageManager();
    }
  } catch (error) {
    setImageError(error.message);
  }
}

async function saveImageOrder(nextImages) {
  const productId = $("editId").value;
  if (!productId) return;
  const data = await api(`/api/admin/products/${encodeURIComponent(productId)}/images/order`, {
    method: "PUT",
    body: JSON.stringify({ ids: nextImages.map(x => x.id) })
  });
  currentImages = data.images || [];
  renderImageManager();
}

async function makePrimary(imageId) {
  const index = currentImages.findIndex(x => x.id === Number(imageId));
  if (index <= 0) return;
  const next = [...currentImages];
  const [hit] = next.splice(index, 1);
  next.unshift(hit);
  try { await saveImageOrder(next); flash("Foto principal actualizada."); }
  catch (error) { setImageError(error.message); }
}

async function moveImage(imageId, delta) {
  const index = currentImages.findIndex(x => x.id === Number(imageId));
  const target = index + delta;
  if (index < 0 || target < 0 || target >= currentImages.length) return;
  const next = [...currentImages];
  [next[index], next[target]] = [next[target], next[index]];
  try { await saveImageOrder(next); }
  catch (error) { setImageError(error.message); }
}

async function deleteImage(imageId) {
  const productId = $("editId").value;
  if (!productId) return;
  if (!confirm("¿Eliminar esta imagen definitivamente de R2?")) return;
  try {
    const data = await api(`/api/admin/products/${encodeURIComponent(productId)}/images/${Number(imageId)}`, { method: "DELETE" });
    currentImages = data.images || [];
    renderImageManager();
    flash("Imagen eliminada.");
  } catch (error) {
    setImageError(error.message);
  }
}

async function saveProduct(event) {
  event.preventDefault();
  setFormError();
  setImageError();
  const editId = $("editId").value;
  try { validateVariantsBeforeSave(); }
  catch (error) { setFormError(error.message); return; }
  const payload = payloadFromForm();
  const btn = $("saveBtn");
  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    let productId = editId;
    if (editId) {
      await api(`/api/admin/products/${encodeURIComponent(editId)}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      const created = await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
      productId = created.id;
      $("editId").value = productId;
    }

    if (pendingFiles.length) {
      btn.textContent = "Subiendo fotos…";
      const files = [...pendingFiles];
      await uploadImages(productId, files);
      clearPendingPreviews();
      pendingFiles = [];
    }

    closeModal();
    flash(editId ? "Producto actualizado." : "Producto creado.");
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
  if (!confirm(`¿Eliminar definitivamente “${p.name}”?\n\nTambién se eliminarán sus imágenes de R2 y sus datos de proveedor.`)) return;

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

$("addVariantBtn").addEventListener("click", () => {
  variants.push(blankVariant());
  renderVariants();
});

$("variantList").addEventListener("input", e => {
  const card = e.target.closest("[data-variant-index]");
  const field = e.target.dataset.vfield;
  if (!card || !field) return;
  setVariantField(Number(card.dataset.variantIndex), field, e.target);
});
$("variantList").addEventListener("change", e => {
  const card = e.target.closest("[data-variant-index]");
  const field = e.target.dataset.vfield;
  if (!card || !field) return;
  setVariantField(Number(card.dataset.variantIndex), field, e.target);
});
$("variantList").addEventListener("click", e => {
  const remove = e.target.closest("[data-variant-remove]");
  if (!remove) return;
  const index = Number(remove.dataset.variantRemove);
  variants.splice(index, 1);
  if (variants.length && !variants.some(v => v.isDefault)) variants[0].isDefault = true;
  renderVariants();
});

$("selectImagesBtn").addEventListener("click", e => {
  e.stopPropagation();
  $("imageFiles").click();
});
$("imageDropzone").addEventListener("click", e => {
  if (!e.target.closest("button")) $("imageFiles").click();
});
$("imageDropzone").addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("imageFiles").click(); }
});
$("imageFiles").addEventListener("change", () => handleSelectedFiles($("imageFiles").files));

for (const eventName of ["dragenter", "dragover"]) {
  $("imageDropzone").addEventListener(eventName, e => {
    e.preventDefault();
    $("imageDropzone").classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  $("imageDropzone").addEventListener(eventName, e => {
    e.preventDefault();
    $("imageDropzone").classList.remove("dragging");
  });
}
$("imageDropzone").addEventListener("drop", e => handleSelectedFiles(e.dataTransfer.files));

$("imageList").addEventListener("click", e => {
  const primary = e.target.closest("[data-image-primary]");
  const up = e.target.closest("[data-image-up]");
  const down = e.target.closest("[data-image-down]");
  const del = e.target.closest("[data-image-delete]");
  const pending = e.target.closest("[data-pending-delete]");
  if (primary) makePrimary(primary.dataset.imagePrimary);
  if (up) moveImage(up.dataset.imageUp, -1);
  if (down) moveImage(down.dataset.imageDown, 1);
  if (del) deleteImage(del.dataset.imageDelete);
  if (pending) {
    const index = Number(pending.dataset.pendingDelete);
    const [removed] = pendingFiles.splice(index, 1);
    if (removed?.__previewUrl) URL.revokeObjectURL(removed.__previewUrl);
    renderImageManager();
  }
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
