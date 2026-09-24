const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const SHIPPING_FLAT_CENTS = 390;
const FREE_SHIPPING_THRESHOLD_CENTS = 3990;
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function cleanText(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value, max = 5000) {
  const v = cleanText(value, max);
  return v || null;
}

function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function centsFromValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function slugify(value) {
  return cleanText(value, 160)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function productPayload(body, currentId = "") {
  const name = cleanText(body.name, 180);
  const slug = slugify(body.slug || name);
  const id = cleanText(body.id || currentId || slug.replace(/-/g, "_"), 120);
  const stockMode = ["supplier", "finite", "unlimited"].includes(body.stockMode)
    ? body.stockMode
    : "supplier";

  if (!name) throw new Error("El nombre es obligatorio.");
  if (!slug) throw new Error("El slug es obligatorio.");
  if (!id) throw new Error("El ID es obligatorio.");

  return {
    id,
    slug,
    name,
    shortDesc: cleanText(body.shortDesc ?? body.desc, 360),
    description: cleanText(body.description, 5000),
    category: cleanText(body.category ?? body.cat, 80) || "hogar",
    tag: cleanText(body.tag, 50),
    emoji: cleanText(body.emoji, 12) || "🐾",
    priceCents: centsFromValue(body.price),
    currency: cleanText(body.currency, 3).toUpperCase() || "EUR",
    published: body.published ? 1 : 0,
    sortOrder: toInt(body.sortOrder, 0),
    stockMode,
    stockQty: stockMode === "finite" ? Math.max(0, toInt(body.stockQty, 0)) : null,
    imageUrl: nullableText(body.imageUrl, 1200)
  };
}

function sourcePayload(body) {
  const s = body.source || {};
  const supplier = cleanText(s.supplier, 160);
  if (!supplier) return null;

  return {
    id: s.id ? toInt(s.id, 0) : 0,
    supplier,
    supplierSku: nullableText(s.supplierSku, 180),
    supplierUrl: nullableText(s.supplierUrl, 1600),
    productCostCents: s.productCost === "" || s.productCost == null ? null : centsFromValue(s.productCost),
    shippingCostCents: s.shippingCost === "" || s.shippingCost == null ? null : centsFromValue(s.shippingCost),
    costCurrency: cleanText(s.costCurrency, 3).toUpperCase() || "EUR",
    warehouse: nullableText(s.warehouse, 160),
    stockStatus: cleanText(s.stockStatus, 40) || "unknown",
    shippingDaysMin: s.shippingDaysMin === "" || s.shippingDaysMin == null ? null : Math.max(0, toInt(s.shippingDaysMin, 0)),
    shippingDaysMax: s.shippingDaysMax === "" || s.shippingDaysMax == null ? null : Math.max(0, toInt(s.shippingDaysMax, 0)),
    complianceStatus: cleanText(s.complianceStatus, 40) || "pending",
    notes: nullableText(s.notes, 3000)
  };
}

function variantPayloads(body, productId) {
  const raw = Array.isArray(body.variants) ? body.variants : [];
  const variants = [];
  const seenIds = new Set();

  for (let index = 0; index < raw.length; index++) {
    const v = raw[index] || {};
    const name = cleanText(v.name, 120);
    if (!name) continue;

    let id = cleanText(v.id, 160);
    if (!id) {
      const base = slugify(name) || `variant-${index + 1}`;
      id = `${productId}__${base}__${crypto.randomUUID().slice(0, 8)}`;
    }
    if (seenIds.has(id)) throw new Error("Hay dos variantes con el mismo ID.");
    seenIds.add(id);

    const stockStatus = ["unknown", "in_stock", "low", "out"].includes(v.stockStatus) ? v.stockStatus : "unknown";
    const homologationStatus = ["pending", "review", "approved", "rejected"].includes(v.homologationStatus)
      ? v.homologationStatus
      : "pending";

    variants.push({
      id,
      productId,
      name,
      priceCents: centsFromValue(v.price),
      supplierSku: nullableText(v.supplierSku, 180),
      productCostCents: v.productCost === "" || v.productCost == null ? null : centsFromValue(v.productCost),
      shippingCostCents: v.shippingCost === "" || v.shippingCost == null ? null : centsFromValue(v.shippingCost),
      costCurrency: cleanText(v.costCurrency, 3).toUpperCase() || "EUR",
      weightGrams: v.weightGrams === "" || v.weightGrams == null ? null : Math.max(0, toInt(v.weightGrams, 0)),
      warehouse: nullableText(v.warehouse, 160),
      stockStatus,
      supplierStockQty: v.supplierStockQty === "" || v.supplierStockQty == null ? null : Math.max(0, toInt(v.supplierStockQty, 0)),
      shippingDaysMin: v.shippingDaysMin === "" || v.shippingDaysMin == null ? null : Math.max(0, toInt(v.shippingDaysMin, 0)),
      shippingDaysMax: v.shippingDaysMax === "" || v.shippingDaysMax == null ? null : Math.max(0, toInt(v.shippingDaysMax, 0)),
      homologationStatus,
      published: v.published ? 1 : 0,
      isDefault: v.isDefault ? 1 : 0,
      sortOrder: toInt(v.sortOrder, index * 10)
    });
  }

  if (variants.length) {
    const defaults = variants.filter(v => v.isDefault);
    if (defaults.length === 0) variants[0].isDefault = 1;
    if (defaults.length > 1) {
      let kept = false;
      for (const v of variants) {
        if (v.isDefault && !kept) kept = true;
        else if (v.isDefault) v.isDefault = 0;
      }
    }
  }

  return variants;
}

async function readJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("El cuerpo debe ser JSON.");
  return request.json();
}

async function tokenMatches(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;

  const supplied = new TextEncoder().encode(auth.slice(7));
  const expected = new TextEncoder().encode(String(env.ADMIN_TOKEN));
  if (supplied.byteLength !== expected.byteLength) return false;

  const a = new Uint8Array(supplied);
  const b = new Uint8Array(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return json(
      { ok: false, error: "ADMIN_NOT_CONFIGURED", message: "Falta configurar el secreto ADMIN_TOKEN en Cloudflare." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!(await tokenMatches(request, env))) {
    return json(
      { ok: false, error: "UNAUTHORIZED", message: "Token de administración incorrecto." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

function mediaUrl(objectKey) {
  return "/media/" + String(objectKey)
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");
}

function imageDto(row) {
  return {
    id: Number(row.id),
    url: mediaUrl(row.object_key),
    objectKey: row.object_key,
    alt: row.alt_text || "",
    sortOrder: Number(row.sort_order || 0)
  };
}

function mapPublicProduct(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    desc: p.short_desc,
    description: p.description,
    cat: p.category,
    tag: p.tag,
    emoji: p.emoji,
    price: Number(p.price_cents || 0) / 100,
    currency: p.currency,
    stockMode: p.stock_mode,
    stockQty: p.stock_qty,
    imageUrl: p.image_url,
    warehouse: p.warehouse || "",
    shippingDaysMin: p.shipping_days_min == null ? null : Number(p.shipping_days_min),
    shippingDaysMax: p.shipping_days_max == null ? null : Number(p.shipping_days_max)
  };
}

function mapAdminProduct(p) {
  return {
    ...mapPublicProduct(p),
    published: Boolean(p.published),
    sortOrder: Number(p.sort_order || 0),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    source: p.source_id
      ? {
          id: p.source_id,
          supplier: p.supplier || "",
          supplierSku: p.supplier_sku || "",
          supplierUrl: p.supplier_url || "",
          productCost: p.product_cost_cents == null ? "" : Number(p.product_cost_cents) / 100,
          shippingCost: p.shipping_cost_cents == null ? "" : Number(p.shipping_cost_cents) / 100,
          costCurrency: p.cost_currency || "EUR",
          warehouse: p.warehouse || "",
          stockStatus: p.stock_status || "unknown",
          shippingDaysMin: p.shipping_days_min ?? "",
          shippingDaysMax: p.shipping_days_max ?? "",
          complianceStatus: p.compliance_status || "pending",
          notes: p.source_notes || "",
          checkedAt: p.checked_at || ""
        }
      : null
  };
}

function publicVariantDto(v) {
  return {
    id: v.id,
    name: v.name,
    price: Number(v.price_cents || 0) / 100,
    currency: v.cost_currency ? "EUR" : "EUR",
    stockStatus: v.stock_status || "unknown",
    supplierStockQty: v.supplier_stock_qty == null ? null : Number(v.supplier_stock_qty),
    warehouse: v.warehouse || "",
    shippingDaysMin: v.shipping_days_min == null ? null : Number(v.shipping_days_min),
    shippingDaysMax: v.shipping_days_max == null ? null : Number(v.shipping_days_max),
    isDefault: Boolean(v.is_default),
    sortOrder: Number(v.sort_order || 0)
  };
}

function adminVariantDto(v) {
  return {
    ...publicVariantDto(v),
    supplierSku: v.supplier_sku || "",
    productCost: v.product_cost_cents == null ? "" : Number(v.product_cost_cents) / 100,
    shippingCost: v.shipping_cost_cents == null ? "" : Number(v.shipping_cost_cents) / 100,
    costCurrency: v.cost_currency || "EUR",
    weightGrams: v.weight_grams == null ? "" : Number(v.weight_grams),
    homologationStatus: v.homologation_status || "pending",
    published: Boolean(v.published),
    createdAt: v.created_at,
    updatedAt: v.updated_at
  };
}

const ADMIN_LIST_SQL = `
  SELECT
    p.*,
    s.id AS source_id,
    s.supplier,
    s.supplier_sku,
    s.supplier_url,
    s.product_cost_cents,
    s.shipping_cost_cents,
    s.cost_currency,
    s.warehouse,
    s.stock_status,
    s.shipping_days_min,
    s.shipping_days_max,
    s.compliance_status,
    s.notes AS source_notes,
    s.checked_at
  FROM products p
  LEFT JOIN product_sources s
    ON s.id = (
      SELECT MIN(s2.id)
      FROM product_sources s2
      WHERE s2.product_id = p.id
    )
`;

async function attachImages(env, rows, mapper) {
  const products = (rows || []).map(mapper);
  if (!products.length) return products;

  const { results } = await env.DB.prepare(`
    SELECT id, product_id, object_key, alt_text, sort_order
    FROM product_images
    ORDER BY product_id ASC, sort_order ASC, id ASC
  `).all();

  const grouped = new Map();
  for (const row of results || []) {
    if (!grouped.has(row.product_id)) grouped.set(row.product_id, []);
    grouped.get(row.product_id).push(imageDto(row));
  }

  for (const product of products) {
    product.images = grouped.get(product.id) || [];
    if (product.images.length) product.imageUrl = product.images[0].url;
  }
  return products;
}

async function attachVariants(env, products, admin = false) {
  if (!products.length) return products;
  await ensureCatalogSchema(env);
  const where = admin ? "" : "WHERE published = 1";
  const { results } = await env.DB.prepare(`
    SELECT *
    FROM product_variants
    ${where}
    ORDER BY product_id ASC, sort_order ASC, name ASC
  `).all();

  const grouped = new Map();
  for (const row of results || []) {
    if (!grouped.has(row.product_id)) grouped.set(row.product_id, []);
    grouped.get(row.product_id).push(admin ? adminVariantDto(row) : publicVariantDto(row));
  }

  for (const product of products) {
    product.variants = grouped.get(product.id) || [];
    product.hasVariants = product.variants.length > 0;
    if (product.hasVariants) {
      const prices = product.variants.map(v => Number(v.price || 0)).filter(Number.isFinite);
      if (prices.length) {
        product.priceFrom = Math.min(...prices);
        if (!admin) product.price = product.priceFrom;
      }
      product.defaultVariantId = product.variants.find(v => v.isDefault)?.id || product.variants[0]?.id || null;
    } else {
      product.priceFrom = product.price;
      product.defaultVariantId = null;
    }
  }
  return products;
}

async function saveVariants(env, productId, variants) {
  await ensureCatalogSchema(env);
  const current = await env.DB.prepare("SELECT id FROM product_variants WHERE product_id = ?")
    .bind(productId).all();
  const currentIds = new Set((current.results || []).map(x => String(x.id)));
  const keepIds = new Set(variants.map(v => String(v.id)));
  const statements = [];

  for (const id of currentIds) {
    if (!keepIds.has(id)) {
      statements.push(env.DB.prepare("DELETE FROM product_variants WHERE id = ? AND product_id = ?").bind(id, productId));
    }
  }

  for (const v of variants) {
    statements.push(env.DB.prepare(`
      INSERT INTO product_variants (
        id, product_id, name, price_cents, supplier_sku, product_cost_cents, shipping_cost_cents,
        cost_currency, weight_grams, warehouse, stock_status, supplier_stock_qty,
        shipping_days_min, shipping_days_max, homologation_status, published, is_default, sort_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        price_cents = excluded.price_cents,
        supplier_sku = excluded.supplier_sku,
        product_cost_cents = excluded.product_cost_cents,
        shipping_cost_cents = excluded.shipping_cost_cents,
        cost_currency = excluded.cost_currency,
        weight_grams = excluded.weight_grams,
        warehouse = excluded.warehouse,
        stock_status = excluded.stock_status,
        supplier_stock_qty = excluded.supplier_stock_qty,
        shipping_days_min = excluded.shipping_days_min,
        shipping_days_max = excluded.shipping_days_max,
        homologation_status = excluded.homologation_status,
        published = excluded.published,
        is_default = excluded.is_default,
        sort_order = excluded.sort_order,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      v.id, productId, v.name, v.priceCents, v.supplierSku, v.productCostCents, v.shippingCostCents,
      v.costCurrency, v.weightGrams, v.warehouse, v.stockStatus, v.supplierStockQty,
      v.shippingDaysMin, v.shippingDaysMax, v.homologationStatus, v.published, v.isDefault, v.sortOrder
    ));
  }

  if (statements.length) await env.DB.batch(statements);
}

async function listProductImages(env, productId) {
  const { results } = await env.DB.prepare(`
    SELECT id, product_id, object_key, alt_text, sort_order
    FROM product_images
    WHERE product_id = ?
    ORDER BY sort_order ASC, id ASC
  `).bind(productId).all();
  return (results || []).map(imageDto);
}

async function upsertSource(env, productId, source) {
  if (!source) return;

  if (source.id) {
    await env.DB.prepare(`
      UPDATE product_sources SET
        supplier = ?, supplier_sku = ?, supplier_url = ?,
        product_cost_cents = ?, shipping_cost_cents = ?, cost_currency = ?,
        warehouse = ?, stock_status = ?, shipping_days_min = ?, shipping_days_max = ?,
        compliance_status = ?, notes = ?, checked_at = CURRENT_TIMESTAMP
      WHERE id = ? AND product_id = ?
    `).bind(
      source.supplier,
      source.supplierSku,
      source.supplierUrl,
      source.productCostCents,
      source.shippingCostCents,
      source.costCurrency,
      source.warehouse,
      source.stockStatus,
      source.shippingDaysMin,
      source.shippingDaysMax,
      source.complianceStatus,
      source.notes,
      source.id,
      productId
    ).run();
    return;
  }

  await env.DB.prepare(`
    INSERT INTO product_sources (
      product_id, supplier, supplier_sku, supplier_url,
      product_cost_cents, shipping_cost_cents, cost_currency,
      warehouse, stock_status, shipping_days_min, shipping_days_max,
      compliance_status, notes, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    productId,
    source.supplier,
    source.supplierSku,
    source.supplierUrl,
    source.productCostCents,
    source.shippingCostCents,
    source.costCurrency,
    source.warehouse,
    source.stockStatus,
    source.shippingDaysMin,
    source.shippingDaysMax,
    source.complianceStatus,
    source.notes
  ).run();
}

function validateImageFile(file) {
  if (!file || typeof file.size !== "number" || typeof file.type !== "string") {
    throw new Error("Archivo de imagen no válido.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Formato no admitido. Usa JPG, PNG, WebP o AVIF.");
  }
  if (file.size <= 0) throw new Error("La imagen está vacía.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Cada imagen puede ocupar como máximo 8 MB.");
}

async function uploadProductImages(request, env, productId) {
  if (!env.PRODUCT_IMAGES) {
    return json({ ok: false, error: "R2_NOT_CONFIGURED", message: "Falta el binding R2 PRODUCT_IMAGES." }, { status: 503 });
  }

  const product = await env.DB.prepare("SELECT id, name FROM products WHERE id = ?").bind(productId).first();
  if (!product) return json({ ok: false, error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("files");
  if (!files.length) return json({ ok: false, error: "NO_FILES", message: "Selecciona al menos una imagen." }, { status: 400 });

  for (const file of files) validateImageFile(file);

  const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?")
    .bind(productId).first();
  const currentCount = Number(countRow?.total || 0);
  if (currentCount + files.length > MAX_IMAGES_PER_PRODUCT) {
    return json({ ok: false, error: "TOO_MANY_IMAGES", message: `Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto.` }, { status: 400 });
  }

  const maxRow = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -10) AS max_sort FROM product_images WHERE product_id = ?")
    .bind(productId).first();
  let nextSort = Number(maxRow?.max_sort ?? -10) + 10;

  for (const file of files) {
    const ext = IMAGE_EXTENSIONS[file.type] || "img";
    const safeProduct = slugify(productId) || "product";
    const key = `products/${safeProduct}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    await env.PRODUCT_IMAGES.put(key, file, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable"
      },
      customMetadata: {
        productId: String(productId)
      }
    });

    try {
      await env.DB.prepare(`
        INSERT INTO product_images (product_id, object_key, alt_text, sort_order)
        VALUES (?, ?, ?, ?)
      `).bind(productId, key, product.name || "", nextSort).run();
      nextSort += 10;
    } catch (error) {
      await env.PRODUCT_IMAGES.delete(key).catch(() => {});
      throw error;
    }
  }

  return json({ ok: true, images: await listProductImages(env, productId) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function reorderProductImages(request, env, productId) {
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids.map(x => Number(x)).filter(Number.isInteger) : [];

  const { results } = await env.DB.prepare("SELECT id FROM product_images WHERE product_id = ? ORDER BY sort_order, id")
    .bind(productId).all();
  const currentIds = (results || []).map(r => Number(r.id));

  if (ids.length !== currentIds.length || new Set(ids).size !== ids.length || currentIds.some(id => !ids.includes(id))) {
    return json({ ok: false, error: "INVALID_ORDER", message: "El orden de imágenes no es válido." }, { status: 400 });
  }

  if (ids.length) {
    const statements = ids.map((id, index) => env.DB.prepare(
      "UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?"
    ).bind(index * 10, id, productId));
    await env.DB.batch(statements);
  }

  return json({ ok: true, images: await listProductImages(env, productId) }, { headers: { "Cache-Control": "no-store" } });
}

async function deleteProductImage(env, productId, imageId) {
  const row = await env.DB.prepare(
    "SELECT id, object_key FROM product_images WHERE id = ? AND product_id = ?"
  ).bind(imageId, productId).first();
  if (!row) return json({ ok: false, error: "NOT_FOUND", message: "Imagen no encontrada." }, { status: 404 });

  await env.DB.prepare("DELETE FROM product_images WHERE id = ? AND product_id = ?")
    .bind(imageId, productId).run();

  if (env.PRODUCT_IMAGES) {
    await env.PRODUCT_IMAGES.delete(row.object_key).catch(error => console.error("R2 delete orphan:", error));
  }

  const images = await listProductImages(env, productId);
  if (images.length) {
    const statements = images.map((img, index) => env.DB.prepare(
      "UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?"
    ).bind(index * 10, img.id, productId));
    await env.DB.batch(statements);
  }

  return json({ ok: true, images: await listProductImages(env, productId) }, { headers: { "Cache-Control": "no-store" } });
}


// ============================================================
// PEDIDOS / CHECKOUT + STRIPE TEST (FASE 6)
// - Pedido manual de prueba protegido por ADMIN_TOKEN.
// - Checkout Stripe alojado usando exclusivamente sk_test_.
// - El webhook firmado es la única fuente que marca un pago Stripe como pagado.
// ============================================================

const STRIPE_API_VERSION = "2026-07-29.dahlia";
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function safeQuantity(value) {
  const qty = toInt(value, 0);
  return Math.max(0, Math.min(qty, 20));
}

function randomHex(bytes = 5) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function datedPublicCode(prefix) {
  const d = new Date();
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${day}-${randomHex(5)}`;
}

function makeTestPublicCode() {
  return datedPublicCode("TNP");
}

function makeStripePublicCode(mode) {
  return datedPublicCode(mode === "live" ? "NP" : "SNP");
}

function isTestOrderId(orderId) {
  const id = String(orderId || "");
  return id.startsWith("test_") || id.startsWith("stripe_test_");
}

function isStripeTestOrderId(orderId) {
  return String(orderId || "").startsWith("stripe_test_");
}

function stripeConfig(env) {
  const requested = String(env.STRIPE_MODE || "test").trim().toLowerCase();
  const mode = requested === "live" ? "live" : "test";
  const secretKey = typeof env.STRIPE_SECRET_KEY === "string" ? env.STRIPE_SECRET_KEY.trim() : "";
  const webhookSecret = typeof env.STRIPE_WEBHOOK_SECRET === "string" ? env.STRIPE_WEBHOOK_SECRET.trim() : "";
  const keyOk = mode === "live" ? secretKey.startsWith("sk_live_") : secretKey.startsWith("sk_test_");
  return { mode, secretKey, webhookSecret, enabled: Boolean(keyOk && webhookSecret.startsWith("whsec_")) };
}

function stripeConfigured(env) {
  return stripeConfig(env).enabled;
}

let catalogSchemaReady = false;
let orderSchemaReady = false;

async function ensureCatalogSchema(env) {
  if (catalogSchemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        supplier_sku TEXT,
        product_cost_cents INTEGER,
        shipping_cost_cents INTEGER,
        cost_currency TEXT NOT NULL DEFAULT 'EUR',
        weight_grams INTEGER,
        warehouse TEXT,
        stock_status TEXT NOT NULL DEFAULT 'unknown',
        supplier_stock_qty INTEGER,
        shipping_days_min INTEGER,
        shipping_days_max INTEGER,
        homologation_status TEXT NOT NULL DEFAULT 'pending',
        published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants (product_id, published, sort_order)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_variants_default ON product_variants (product_id, is_default)`)
  ]);
  catalogSchemaReady = true;
}

async function ensureOrderSchema(env) {
  if (orderSchemaReady) return;
  await ensureCatalogSchema(env);
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_addresses (
        order_id TEXT PRIMARY KEY,
        phone TEXT,
        address_line1 TEXT NOT NULL DEFAULT '',
        address_line2 TEXT,
        postal_code TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        province TEXT,
        country TEXT NOT NULL DEFAULT 'ES',
        customer_notes TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        email_type TEXT NOT NULL,
        recipient TEXT NOT NULL,
        original_recipient TEXT,
        provider TEXT NOT NULL DEFAULT 'resend',
        provider_message_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        dedupe_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS supplier_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'cj',
        mode TEXT NOT NULL DEFAULT 'sandbox',
        origin_country TEXT NOT NULL DEFAULT 'CN',
        supplier_order_id TEXT,
        supplier_order_code TEXT,
        logistic_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        sub_status TEXT,
        tracking_code TEXT,
        tracking_url TEXT,
        product_amount_usd REAL,
        postage_usd REAL,
        total_usd REAL,
        error TEXT,
        last_synced_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS supplier_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_order_local_id INTEGER NOT NULL,
        order_item_id INTEGER NOT NULL,
        supplier_sku TEXT,
        supplier_variant_id TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (supplier_order_local_id) REFERENCES supplier_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_supplier_orders_order ON supplier_orders (order_id, created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_supplier_order_items_parent ON supplier_order_items (supplier_order_local_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_order_emails_order ON order_emails (order_id, created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id, created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_email_code ON orders (customer_email, public_code)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders (stripe_checkout_session_id)`)
  ]);

  const columns = await env.DB.prepare("PRAGMA table_info(order_items)").all();
  const names = new Set((columns.results || []).map(x => String(x.name)));
  if (!names.has("variant_id")) {
    await env.DB.prepare("ALTER TABLE order_items ADD COLUMN variant_id TEXT").run();
  }
  if (!names.has("variant_name")) {
    await env.DB.prepare("ALTER TABLE order_items ADD COLUMN variant_name TEXT").run();
  }

  const orderColumns = await env.DB.prepare("PRAGMA table_info(orders)").all();
  const orderNames = new Set((orderColumns.results || []).map(x => String(x.name)));
  if (!orderNames.has("subtotal_cents")) {
    await env.DB.prepare("ALTER TABLE orders ADD COLUMN subtotal_cents INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!orderNames.has("shipping_cents")) {
    await env.DB.prepare("ALTER TABLE orders ADD COLUMN shipping_cents INTEGER NOT NULL DEFAULT 0").run();
  }
  orderSchemaReady = true;
}

function cleanCustomer(body = {}) {
  const customer = body.customer || {};
  const name = cleanText(customer.name, 180);
  const email = normalizeEmail(customer.email);
  const phone = cleanText(customer.phone, 60);
  const addressLine1 = cleanText(customer.addressLine1, 240);
  const addressLine2 = nullableText(customer.addressLine2, 240);
  const postalCode = cleanText(customer.postalCode, 30);
  const city = cleanText(customer.city, 120);
  const province = nullableText(customer.province, 120);
  const country = cleanText(customer.country, 2).toUpperCase() || "ES";
  const notes = nullableText(customer.notes, 1000);

  if (!name) throw new Error("Introduce el nombre y apellidos.");
  if (!email || !email.includes("@")) throw new Error("Introduce un email válido.");
  if (!addressLine1) throw new Error("Introduce la dirección de envío.");
  if (!postalCode) throw new Error("Introduce el código postal.");
  if (!city) throw new Error("Introduce la localidad.");
  if (country !== "ES") throw new Error("En esta primera fase solo preparamos envíos a España.");

  return {
    name, email, phone, addressLine1, addressLine2,
    postalCode, city, province, country, notes
  };
}

async function resolveOrderItems(env, rawItems) {
  await ensureCatalogSchema(env);
  const normalized = [];
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const id = cleanText(raw?.id, 120);
    const variantId = nullableText(raw?.variantId, 180);
    const quantity = safeQuantity(raw?.qty);
    if (!id || quantity < 1) continue;
    const hit = normalized.find(x => x.id === id && (x.variantId || "") === (variantId || ""));
    if (hit) hit.quantity = Math.min(20, hit.quantity + quantity);
    else normalized.push({ id, variantId, quantity });
  }

  if (!normalized.length) throw new Error("El carrito está vacío.");
  if (normalized.length > 20) throw new Error("El carrito contiene demasiados productos.");

  const statements = normalized.map(item => env.DB.prepare(`
    SELECT
      p.id, p.name, p.price_cents, p.currency, p.published,
      p.stock_mode, p.stock_qty,
      s.supplier, s.supplier_sku AS base_supplier_sku,
      s.warehouse AS base_warehouse, s.shipping_days_min AS base_shipping_days_min, s.shipping_days_max AS base_shipping_days_max,
      v.id AS variant_id, v.name AS variant_name, v.price_cents AS variant_price_cents,
      v.supplier_sku AS variant_supplier_sku, v.published AS variant_published,
      v.stock_status AS variant_stock_status, v.supplier_stock_qty,
      v.warehouse AS variant_warehouse, v.shipping_days_min AS variant_shipping_days_min, v.shipping_days_max AS variant_shipping_days_max,
      (SELECT COUNT(*) FROM product_variants vc WHERE vc.product_id = p.id AND vc.published = 1) AS published_variant_count
    FROM products p
    LEFT JOIN product_sources s
      ON s.id = (
        SELECT MIN(s2.id)
        FROM product_sources s2
        WHERE s2.product_id = p.id
      )
    LEFT JOIN product_variants v
      ON v.product_id = p.id
     AND v.published = 1
     AND (v.id = ? OR (? IS NULL AND v.is_default = 1))
    WHERE p.id = ?
    LIMIT 1
  `).bind(item.variantId, item.variantId, item.id));

  const results = await env.DB.batch(statements);
  const resolved = [];

  for (let i = 0; i < normalized.length; i++) {
    const item = normalized[i];
    const row = results[i]?.results?.[0];
    if (!row || Number(row.published) !== 1) {
      throw new Error("Uno de los productos ya no está disponible.");
    }

    const hasVariants = Number(row.published_variant_count || 0) > 0;
    if (hasVariants && !row.variant_id) {
      throw new Error(`Selecciona una variante disponible de “${row.name}”.`);
    }
    if (row.variant_stock_status === "out") {
      throw new Error(`La variante “${row.variant_name}” de “${row.name}” está agotada.`);
    }
    if (row.supplier_stock_qty != null && Number(row.supplier_stock_qty) < item.quantity) {
      throw new Error(`No hay suficientes unidades de “${row.name} · ${row.variant_name}”.`);
    }
    if (!hasVariants && row.stock_mode === "finite" && Number(row.stock_qty || 0) < item.quantity) {
      throw new Error(`No hay suficientes unidades de “${row.name}”.`);
    }

    resolved.push({
      productId: row.id,
      productName: row.name,
      variantId: row.variant_id || null,
      variantName: row.variant_name || null,
      quantity: item.quantity,
      unitPriceCents: hasVariants ? Number(row.variant_price_cents || 0) : Number(row.price_cents || 0),
      currency: row.currency || "EUR",
      supplier: row.supplier || null,
      supplierSku: row.variant_supplier_sku || row.base_supplier_sku || null,
      warehouse: row.variant_warehouse || row.base_warehouse || "",
      shippingDaysMin: row.variant_shipping_days_min == null ? (row.base_shipping_days_min == null ? null : Number(row.base_shipping_days_min)) : Number(row.variant_shipping_days_min),
      shippingDaysMax: row.variant_shipping_days_max == null ? (row.base_shipping_days_max == null ? null : Number(row.base_shipping_days_max)) : Number(row.variant_shipping_days_max)
    });
  }

  const currency = resolved[0]?.currency || "EUR";
  if (resolved.some(x => x.currency !== currency)) {
    throw new Error("No se pueden mezclar monedas distintas en un mismo pedido.");
  }

  const subtotalCents = resolved.reduce((sum, x) => sum + x.unitPriceCents * x.quantity, 0);
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS;
  return {
    items: resolved,
    currency,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents
  };
}

function orderInsertStatements(env, { orderId, publicCode, customer, cart, paymentStatus, eventType, eventMessage }) {
  return [
    env.DB.prepare(`
      INSERT INTO orders (
        id, public_code, customer_email, customer_name,
        subtotal_cents, shipping_cents, total_cents, currency, payment_status, fulfillment_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      orderId, publicCode, customer.email, customer.name,
      cart.subtotalCents, cart.shippingCents, cart.totalCents, cart.currency, paymentStatus
    ),
    env.DB.prepare(`
      INSERT INTO order_addresses (
        order_id, phone, address_line1, address_line2, postal_code,
        city, province, country, customer_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, customer.phone || null, customer.addressLine1, customer.addressLine2,
      customer.postalCode, customer.city, customer.province, customer.country, customer.notes
    ),
    ...cart.items.map(item => env.DB.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price_cents,
        supplier, supplier_sku
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, item.productId, item.productName, item.variantId, item.variantName, item.quantity,
      item.unitPriceCents, item.supplier, item.supplierSku
    )),
    env.DB.prepare(`
      INSERT INTO order_events (order_id, event_type, message)
      VALUES (?, ?, ?)
    `).bind(orderId, eventType, eventMessage)
  ];
}

async function createTestOrder(request, env) {
  await ensureOrderSchema(env);
  const body = await readJson(request);
  const customer = cleanCustomer(body);
  const cart = await resolveOrderItems(env, body.items);

  const orderId = `test_${crypto.randomUUID()}`;
  const publicCode = makeTestPublicCode();

  await env.DB.batch(orderInsertStatements(env, {
    orderId,
    publicCode,
    customer,
    cart,
    paymentStatus: "test_paid",
    eventType: "created_test",
    eventMessage: "Pedido de prueba creado desde el checkout de administración."
  }));

  return json({
    ok: true,
    order: {
      id: orderId,
      publicCode,
      total: cart.totalCents / 100,
      currency: cart.currency,
      paymentStatus: "test_paid",
      fulfillmentStatus: "pending",
      test: true,
      stripeTest: false
    }
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function stripeApiPost(env, path, params) {
  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (value !== undefined && value !== null) body.append(key, String(value));
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION
    },
    body
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Stripe devolvió HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data;
}

async function createStripeSession(env, origin, customer, cart, orderId, publicCode) {
  const params = [
    ["mode", "payment"],
    ["locale", "es"],
    ["submit_type", "pay"],
    ["payment_method_types[0]", "card"],
    ["customer_email", customer.email],
    ["client_reference_id", orderId],
    ["metadata[order_id]", orderId],
    ["metadata[public_code]", publicCode],
    ["payment_intent_data[metadata][order_id]", orderId],
    ["payment_intent_data[metadata][public_code]", publicCode],
    ["success_url", `${origin}/pedido-exito.html?code=${encodeURIComponent(publicCode)}&stripe=1&session_id={CHECKOUT_SESSION_ID}`],
    ["cancel_url", `${origin}/checkout.html?cancel=1`]
  ];

  cart.items.forEach((item, index) => {
    params.push(
      [`line_items[${index}][price_data][currency]`, cart.currency.toLowerCase()],
      [`line_items[${index}][price_data][product_data][name]`, item.variantName ? `${item.productName} — ${item.variantName}` : item.productName],
      [`line_items[${index}][price_data][unit_amount]`, item.unitPriceCents],
      [`line_items[${index}][quantity]`, item.quantity]
    );
  });
  if (cart.shippingCents > 0) {
    const index = cart.items.length;
    params.push(
      [`line_items[${index}][price_data][currency]`, cart.currency.toLowerCase()],
      [`line_items[${index}][price_data][product_data][name]`, "Envío estándar"],
      [`line_items[${index}][price_data][unit_amount]`, cart.shippingCents],
      [`line_items[${index}][quantity]`, 1]
    );
  }

  return stripeApiPost(env, "/checkout/sessions", params);
}

async function cleanupFailedStripeOrder(env, orderId) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM supplier_order_items WHERE supplier_order_local_id IN (SELECT id FROM supplier_orders WHERE order_id = ?)").bind(orderId),
    env.DB.prepare("DELETE FROM supplier_orders WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_emails WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_events WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_addresses WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(orderId)
  ]);
}

async function createStripeCheckout(request, env, url) {
  const stripe = stripeConfig(env);
  if (!stripe.enabled) {
    return json({
      ok: false,
      error: "STRIPE_NOT_CONFIGURED",
      message: `Stripe ${stripe.mode.toUpperCase()} no está completamente configurado.`
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  await ensureOrderSchema(env);
  const body = await readJson(request);
  const customer = cleanCustomer(body);
  const cart = await resolveOrderItems(env, body.items);
  const isLive = stripe.mode === "live";
  const orderId = `${isLive ? "stripe_live" : "stripe_test"}_${crypto.randomUUID()}`;
  const publicCode = makeStripePublicCode(stripe.mode);

  await env.DB.batch(orderInsertStatements(env, {
    orderId,
    publicCode,
    customer,
    cart,
    paymentStatus: "pending",
    eventType: "stripe_checkout_requested",
    eventMessage: `Checkout Stripe ${stripe.mode.toUpperCase()} solicitado. Pendiente de confirmación por webhook.`
  }));

  try {
    const session = await createStripeSession(env, url.origin, customer, cart, orderId, publicCode);
    if (!session?.id || !session?.url || Boolean(session.livemode) !== isLive) {
      throw new Error(`Stripe no devolvió una sesión ${stripe.mode.toUpperCase()} válida.`);
    }

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE orders
        SET stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(session.id, orderId),
      env.DB.prepare(`
        INSERT INTO order_events (order_id, event_type, message)
        VALUES (?, 'stripe_session_created', ?)
      `).bind(orderId, `Sesión Stripe ${stripe.mode.toUpperCase()} creada: ${session.id}`)
    ]);

    return json({
      ok: true,
      checkoutUrl: session.url,
      order: {
        id: orderId, publicCode, total: cart.totalCents / 100, currency: cart.currency,
        paymentStatus: "pending", fulfillmentStatus: "pending",
        test: !isLive, stripeTest: !isLive
      }
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await cleanupFailedStripeOrder(env, orderId).catch(cleanupError => console.error("Stripe cleanup error:", cleanupError));
    throw error;
  }
}

function parseStripeSignature(headerValue) {
  const timestamp = [];
  const signatures = [];
  for (const part of String(headerValue || "").split(",")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp.push(value);
    if (key === "v1") signatures.push(value);
  }
  return { timestamp: timestamp[0] || "", signatures };
}

function constantTimeStringEqual(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeWebhook(rawBody, signatureHeader, secret) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signatures.length) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNumber) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return signatures.some(signature => constantTimeStringEqual(expected, signature));
}


function escapeHtmlEmail(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function emailConfig(env) {
  const apiKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  const customFrom = typeof env.EMAIL_FROM === "string" ? env.EMAIL_FROM.trim() : "";
  const testRecipient = typeof env.EMAIL_TEST_RECIPIENT === "string" ? normalizeEmail(env.EMAIL_TEST_RECIPIENT) : "";
  const replyTo = typeof env.EMAIL_REPLY_TO === "string" ? normalizeEmail(env.EMAIL_REPLY_TO) : "";

  if (!apiKey || !apiKey.startsWith("re_")) {
    return { enabled: false, mode: "disabled", provider: "resend", from: "", testRecipient, replyTo };
  }
  if (customFrom) {
    return { enabled: true, mode: "domain", provider: "resend", from: customFrom, testRecipient, replyTo };
  }
  if (testRecipient) {
    return {
      enabled: true,
      mode: "test",
      provider: "resend",
      from: "NÓMA PET <onboarding@resend.dev>",
      testRecipient,
      replyTo
    };
  }
  return { enabled: false, mode: "disabled", provider: "resend", from: "", testRecipient: "", replyTo };
}

function emailModeLabel(env) {
  return emailConfig(env).mode;
}

function emailSiteOrigin(requestOrOrigin) {
  if (typeof requestOrOrigin === "string" && requestOrOrigin.startsWith("http")) return requestOrOrigin.replace(/\/$/, "");
  try { return new URL(requestOrOrigin.url).origin; } catch (_) { return ""; }
}

function emailMoney(amount, currency = "EUR") {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(amount || 0));
  } catch (_) {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function buildOrderEmail(order, type, origin, config) {
  const isTest = Boolean(order.test);
  const safeCode = escapeHtmlEmail(order.publicCode);
  const safeName = escapeHtmlEmail(order.customerName || "");
  const site = origin || "";
  const trackingHref = order.trackingUrl || (site ? `${site}/seguimiento.html` : "");
  const trackingCode = order.trackingCode || "";

  let rows = (order.items || []).map(item => {
    const variant = item.variantName ? ` <span style="color:#5e6d67">· ${escapeHtmlEmail(item.variantName)}</span>` : "";
    const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e2d8"><b>${escapeHtmlEmail(item.productName)}</b>${variant}<br><span style="color:#5e6d67;font-size:13px">${Number(item.quantity || 0)} × ${emailMoney(item.unitPrice, order.currency)}</span></td><td style="padding:10px 0;border-bottom:1px solid #e6e2d8;text-align:right;font-weight:700;color:#0f1715">${emailMoney(lineTotal, order.currency)}</td></tr>`;
  }).join("");
  if (Number(order.shipping || 0) > 0) {
    rows += `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e2d8"><b>Envío estándar peninsular</b></td><td style="padding:10px 0;border-bottom:1px solid #e6e2d8;text-align:right;font-weight:700;color:#0f1715">${emailMoney(order.shipping, order.currency)}</td></tr>`;
  } else {
    rows += `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e2d8"><b>Envío estándar peninsular</b></td><td style="padding:10px 0;border-bottom:1px solid #e6e2d8;text-align:right;font-weight:700;color:#143e30">GRATIS</td></tr>`;
  }

  let title = "Pedido confirmado";
  let intro = `Hemos recibido correctamente el pago de tu pedido <b>${safeCode}</b>. Nos ponemos en marcha para prepararlo.`;
  let subject = `Pedido confirmado · ${order.publicCode}`;
  let actionLabel = "Consultar pedido";
  let actionHref = site ? `${site}/seguimiento.html` : "";

  if (type === "shipped") {
    title = "Tu pedido está en camino";
    subject = `Tu pedido ${order.publicCode} ha sido enviado`;
    intro = `Tu pedido <b>${safeCode}</b> ya ha salido del almacén y viaja hacia tu dirección.`;
    actionLabel = trackingUrlIsSafe(trackingHref) && order.trackingUrl ? "Abrir seguimiento" : "Consultar estado";
    actionHref = trackingHref;
  } else if (type === "delivered") {
    title = "Pedido entregado";
    subject = `Pedido ${order.publicCode} entregado`;
    intro = `Tu pedido <b>${safeCode}</b> figura como entregado. Esperamos que a tu mascota le encante.`;
    actionLabel = "Ver pedido";
    actionHref = site ? `${site}/seguimiento.html` : "";
  }

  if (isTest) subject = `[TEST] ${subject}`;

  const trackingBlock = type === "shipped" && trackingCode
    ? `<div style="background:#eaf2ed;border-left:4px solid #143e30;border-radius:8px;padding:14px 18px;margin:18px 0"><div style="font-size:11.5px;color:#5e6d67;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Número de Seguimiento</div><div style="font-size:18px;font-weight:800;color:#143e30;margin-top:4px">${escapeHtmlEmail(trackingCode)}</div></div>`
    : "";

  const address = order.address || {};
  const addressBlock = type === "confirmation"
    ? `<div style="margin-top:22px;background:#fcfaf6;border:1px solid #e6e2d8;border-radius:10px;padding:14px"><div style="font-size:11.5px;font-weight:700;color:#5e6d67;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Dirección de Entrega</div><div style="font-size:14px;color:#0f1715;line-height:1.4">${escapeHtmlEmail(address.line1 || "")}${address.line2 ? `<br>${escapeHtmlEmail(address.line2)}` : ""}<br>${escapeHtmlEmail(address.postalCode || "")} ${escapeHtmlEmail(address.city || "")}${address.province ? `, ${escapeHtmlEmail(address.province)}` : ""}</div></div>`
    : "";

  const testBanner = isTest ? `<div style="background:#fff0df;color:#9a4b16;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12px;font-weight:800">ENTORNO DE PRUEBA · No corresponde a un cobro real.</div>` : "";
  const redirectedBanner = config.mode === "test"
    ? `<div style="background:#eef1ff;color:#34427a;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12px">Modo email de prueba: este mensaje se ha redirigido a ${escapeHtmlEmail(config.testRecipient)}.</div>`
    : "";

  const button = actionHref
    ? `<a href="${escapeHtmlEmail(actionHref)}" style="display:inline-block;background:#143e30;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;letter-spacing:0.02em">${escapeHtmlEmail(actionLabel)} →</a>`
    : "";

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/></head><body style="margin:0;padding:0;background-color:#f4efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1715;-webkit-font-smoothing:antialiased"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4efe6;padding:32px 12px"><tr><td align="center"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;background-color:#ffffff;border:1px solid #e6e2d8;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,21,0.04)"><tr><td style="padding:28px 32px;background-color:#143e30;text-align:left"><span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.02em">NÓMA PET</span><div style="font-size:12px;color:#cde0d5;margin-top:2px;letter-spacing:0.04em">ACCESORIOS FUNCIONALES</div></td></tr><tr><td style="padding:32px">${testBanner}${redirectedBanner}<div style="display:inline-block;background:#eaf2ed;color:#143e30;font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px">PEDIDO ${safeCode}</div><h1 style="font-size:26px;font-weight:800;color:#0f1715;line-height:1.2;margin:0 0 14px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#3b4742;margin:0 0 20px">Hola${safeName ? ` ${safeName}` : ""}. ${intro}</p>${trackingBlock}<div style="font-size:13px;font-weight:800;color:#0f1715;text-transform:uppercase;letter-spacing:0.05em;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #143e30">Resumen de tu compra</div><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${rows}</table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;border-top:1px solid #e6e2d8;padding-top:14px"><tr><td style="font-size:16px;font-weight:800;color:#0f1715">Total pagado</td><td style="font-size:18px;font-weight:900;color:#143e30;text-align:right">${emailMoney(order.total, order.currency)}</td></tr></table>${addressBlock}<div style="margin-top:28px;text-align:left">${button}</div><hr style="border:none;border-top:1px solid #e6e2d8;margin:32px 0 16px"/><p style="font-size:12px;color:#8b9993;line-height:1.5;margin:0">¿Tienes alguna duda sobre tu pedido? Responde a este correo o visita nomapet.com. Estaremos encantados de ayudarte.</p></td></tr></table><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin-top:16px"><tr><td style="text-align:center;font-size:12px;color:#8b9993;padding:0 12px">© 2026 NÓMA PET. Todos los derechos reservados.</td></tr></table></td></tr></table></body></html>`;

  const textLines = [
    `NÓMA PET — ${title}`,
    `Pedido: ${order.publicCode}`,
    "",
    type === "confirmation" ? "Pago confirmado correctamente." : (type === "shipped" ? "Tu pedido ya ha sido enviado." : "Tu pedido figura como entregado."),
    ...(trackingCode ? [`Seguimiento: ${trackingCode}`] : []),
    "",
    ...(order.items || []).map(item => `${item.quantity} x ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} — ${emailMoney(Number(item.unitPrice || 0) * Number(item.quantity || 0), order.currency)}`),
    "",
    `Total: ${emailMoney(order.total, order.currency)}`,
    ...(actionHref ? [`Más información: ${actionHref}`] : [])
  ];

  return { subject, html, text: textLines.join("\n") };
}

function trackingUrlIsSafe(value) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch (_) { return false; }
}

async function resendSend(env, payload, idempotencyKey) {
  const config = emailConfig(env);
  if (!config.enabled) throw new Error("EMAIL_NOT_CONFIGURED");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 256)
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.message || data?.error?.message || `Resend devolvió HTTP ${response.status}.`;
    throw new Error(msg);
  }
  return data;
}

async function sendOrderEmail(env, orderId, emailType, origin, options = {}) {
  await ensureOrderSchema(env);
  const allowed = new Set(["confirmation", "shipped", "delivered"]);
  if (!allowed.has(emailType)) throw new Error("Tipo de email no válido.");

  const config = emailConfig(env);
  if (!config.enabled) {
    return { sent: false, skipped: true, reason: "EMAIL_NOT_CONFIGURED" };
  }

  const order = await getAdminOrder(env, orderId);
  if (!order) throw new Error("Pedido no encontrado para enviar email.");

  if (emailType === "confirmation" && !["paid", "test_paid"].includes(order.paymentStatus)) {
    return { sent: false, skipped: true, reason: "PAYMENT_NOT_CONFIRMED" };
  }
  if (emailType === "shipped" && order.fulfillmentStatus !== "shipped" && !options.force) {
    return { sent: false, skipped: true, reason: "NOT_SHIPPED" };
  }
  if (emailType === "delivered" && order.fulfillmentStatus !== "delivered" && !options.force) {
    return { sent: false, skipped: true, reason: "NOT_DELIVERED" };
  }

  const originalRecipient = normalizeEmail(order.customerEmail);
  let recipient = originalRecipient;
  if (config.mode === "test") recipient = config.testRecipient;
  else if (order.test && config.testRecipient) recipient = config.testRecipient;
  if (!recipient) return { sent: false, skipped: true, reason: "MISSING_RECIPIENT" };

  const force = Boolean(options.force);
  const dedupeKey = force
    ? `manual/${order.id}/${emailType}/${crypto.randomUUID()}`
    : `auto/${order.id}/${emailType}`;

  if (!force) {
    const existing = await env.DB.prepare(`
      SELECT status, provider_message_id FROM order_emails
      WHERE dedupe_key = ? LIMIT 1
    `).bind(dedupeKey).first();
    if (existing && existing.status === "sent") {
      return { sent: false, skipped: true, reason: "ALREADY_SENT", id: existing.provider_message_id || "" };
    }
  }

  const email = buildOrderEmail(order, emailType, origin, config);
  await env.DB.prepare(`
    INSERT INTO order_emails (
      order_id, email_type, recipient, original_recipient, provider, status, dedupe_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'resend', 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(dedupe_key) DO UPDATE SET
      recipient = excluded.recipient,
      original_recipient = excluded.original_recipient,
      status = 'pending', error = NULL, updated_at = CURRENT_TIMESTAMP
  `).bind(order.id, emailType, recipient, originalRecipient, dedupeKey).run();

  const payload = {
    from: config.from,
    to: [recipient],
    subject: config.mode === "test" && originalRecipient && recipient !== originalRecipient
      ? `${email.subject} · destinatario real: ${originalRecipient}`
      : email.subject,
    html: email.html,
    text: email.text
  };
  if (config.replyTo) payload.reply_to = config.replyTo;

  try {
    const result = await resendSend(env, payload, dedupeKey);
    const providerId = cleanText(result?.id, 200);
    await env.DB.prepare(`
      UPDATE order_emails
      SET status = 'sent', provider_message_id = ?, error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE dedupe_key = ?
    `).bind(providerId || null, dedupeKey).run();
    await addOrderEvent(env, order.id, "email_sent", `Email ${emailType} enviado a ${recipient}${config.mode === "test" ? " (modo prueba)" : ""}.`);
    return { sent: true, skipped: false, id: providerId, recipient, mode: config.mode };
  } catch (error) {
    const message = String(error?.message || error).slice(0, 1000);
    await env.DB.prepare(`
      UPDATE order_emails
      SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE dedupe_key = ?
    `).bind(message, dedupeKey).run();
    await addOrderEvent(env, order.id, "email_failed", `No se pudo enviar el email ${emailType}: ${message}`);
    throw error;
  }
}

async function sendOrderEmailSafe(env, orderId, emailType, origin, options = {}) {
  try {
    return await sendOrderEmail(env, orderId, emailType, origin, options);
  } catch (error) {
    console.error(`Email ${emailType} error:`, error);
    return { sent: false, skipped: false, error: String(error?.message || error) };
  }
}

function stripeObjectId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.id) return String(value.id);
  return null;
}

async function addOrderEvent(env, orderId, eventType, message) {
  if (!orderId) return;
  await env.DB.prepare(`
    INSERT INTO order_events (order_id, event_type, message)
    VALUES (?, ?, ?)
  `).bind(orderId, eventType, message).run();
}

async function applyStripeSessionEvent(env, eventType, session, origin = "") {
  const orderId = cleanText(session?.metadata?.order_id || session?.client_reference_id, 160);
  if (!orderId) return;

  const order = await env.DB.prepare(`
    SELECT id, total_cents, currency, payment_status
    FROM orders
    WHERE id = ?
    LIMIT 1
  `).bind(orderId).first();
  if (!order) return;

  const previousPaymentStatus = order.payment_status || "pending";
  const sessionId = stripeObjectId(session?.id);
  const paymentIntentId = stripeObjectId(session?.payment_intent);

  if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
    const amountMatches = Number(session?.amount_total) === Number(order.total_cents || 0);
    const currencyMatches = String(session?.currency || "").toUpperCase() === String(order.currency || "EUR").toUpperCase();

    if (!amountMatches || !currencyMatches) {
      await env.DB.prepare(`
        UPDATE orders
        SET payment_status = 'failed', stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
            stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND payment_status <> 'paid'
      `).bind(sessionId, paymentIntentId, orderId).run();
      await addOrderEvent(env, orderId, "stripe_amount_mismatch", "Stripe confirmó una sesión cuyo importe o moneda no coincide con el pedido. Revisar manualmente.");
      return;
    }

    if (session?.payment_status === "paid" || eventType === "checkout.session.async_payment_succeeded") {
      await env.DB.prepare(`
        UPDATE orders
        SET payment_status = 'paid', stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
            stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(sessionId, paymentIntentId, orderId).run();
      await addOrderEvent(env, orderId, "stripe_paid", `Pago confirmado por webhook firmado de Stripe ${stripeConfig(env).mode.toUpperCase()}.`);
      if (previousPaymentStatus !== "paid") {
        await sendOrderEmailSafe(env, orderId, "confirmation", origin);
      }
      return;
    }

    await env.DB.prepare(`
      UPDATE orders
      SET stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
          stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(sessionId, paymentIntentId, orderId).run();
    await addOrderEvent(env, orderId, "stripe_completed_pending", "Stripe completó el checkout, pero el pago todavía no figura como pagado.");
    return;
  }

  if (eventType === "checkout.session.expired") {
    await env.DB.prepare(`
      UPDATE orders
      SET payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'failed' END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    await addOrderEvent(env, orderId, "stripe_expired", `La sesión Stripe ${stripeConfig(env).mode.toUpperCase()} expiró sin pago confirmado.`);
    return;
  }

  if (eventType === "checkout.session.async_payment_failed") {
    await env.DB.prepare(`
      UPDATE orders
      SET payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'failed' END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    await addOrderEvent(env, orderId, "stripe_payment_failed", "Stripe informó de un pago asíncrono fallido.");
  }
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET || !String(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")) {
    return json({ ok: false, error: "WEBHOOK_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }

  const signatureHeader = request.headers.get("Stripe-Signature") || "";
  const rawBody = await request.text();
  const valid = await verifyStripeWebhook(rawBody, signatureHeader, String(env.STRIPE_WEBHOOK_SECRET));
  if (!valid) {
    return json({ ok: false, error: "INVALID_STRIPE_SIGNATURE" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (_) {
    return json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!event?.id || !event?.type) {
    return json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }
  const stripe = stripeConfig(env);
  if (!stripe.enabled) {
    return json({ ok: false, error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }
  const expectedLive = stripe.mode === "live";
  if (Boolean(event.livemode) !== expectedLive) {
    return json({ ok: false, error: "STRIPE_MODE_MISMATCH", message: `El webhook recibido no corresponde al modo ${stripe.mode.toUpperCase()} configurado.` }, { status: 400 });
  }

  await ensureOrderSchema(env);
  const already = await env.DB.prepare("SELECT event_id FROM stripe_webhook_events WHERE event_id = ? LIMIT 1")
    .bind(event.id).first();
  if (already) return json({ ok: true, duplicate: true });

  const supported = new Set([
    "checkout.session.completed",
    "checkout.session.expired",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed"
  ]);

  if (supported.has(event.type)) {
    await applyStripeSessionEvent(env, event.type, event.data?.object || {}, new URL(request.url).origin);
  }

  await env.DB.prepare(`
    INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type)
    VALUES (?, ?)
  `).bind(event.id, event.type).run();

  return json({ ok: true, received: event.type });
}


let cjTokenCache = { apiKey: "", accessToken: "", expiresAt: 0 };

function cjMode(env) {
  return cleanText(env.CJ_MODE || "sandbox", 20).toLowerCase() === "live" ? "live" : "sandbox";
}

function cjConfigured(env) {
  return cleanText(env.CJ_API_KEY, 400).length > 20;
}

function isCjSupplier(name) {
  const n = cleanText(name, 180).toLowerCase();
  return n.includes("cj") || n.includes("qksource") || n.includes("qk source") || n.includes("dropshipping");
}

function countryCodeFromWarehouse(value) {
  const w = cleanText(value, 180).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!w) return "CN";
  if (w.includes("espana") || w.includes("spain")) return "ES";
  if (w.includes("china")) return "CN";
  if (w.includes("germany") || w.includes("alemania")) return "DE";
  if (w.includes("france") || w.includes("francia")) return "FR";
  if (w.includes("italy") || w.includes("italia")) return "IT";
  if (w.includes("poland") || w.includes("polonia")) return "PL";
  if (w.includes("czech") || w.includes("chequia") || w.includes("republica checa")) return "CZ";
  if (w.includes("netherlands") || w.includes("paises bajos")) return "NL";
  if (w.includes("belgium") || w.includes("belgica")) return "BE";
  if (w.includes("portugal")) return "PT";
  return "CN";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cjAccessToken(env) {
  if (!cjConfigured(env)) throw new Error("Falta configurar CJ_API_KEY en Cloudflare.");
  const apiKey = cleanText(env.CJ_API_KEY, 400);
  const now = Date.now();
  if (cjTokenCache.apiKey === apiKey && cjTokenCache.accessToken && cjTokenCache.expiresAt > now + 60_000) {
    return cjTokenCache.accessToken;
  }
  const response = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.result !== true || !data?.data?.accessToken) {
    throw new Error(`CJ no aceptó la API Key: ${data?.message || response.status}`);
  }
  // Cache prudente de 12 horas en el isolate. CJ mantiene tokens de larga duración.
  cjTokenCache = { apiKey, accessToken: data.data.accessToken, expiresAt: now + 12 * 60 * 60 * 1000 };
  return cjTokenCache.accessToken;
}

async function cjRequest(env, path, options = {}) {
  const token = await cjAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set("CJ-Access-Token", token);
  if (options.body != null) headers.set("Content-Type", "application/json");
  const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.result !== true || Number(data?.code || 0) !== 200) {
    const detail = data?.message || data?.data?.message || `HTTP ${response.status}`;
    throw new Error(`CJ: ${detail}`);
  }
  return data.data;
}

async function cjResolveVariantBySku(env, sku, countryCode = "") {
  const cleanSku = cleanText(sku, 180);
  if (!cleanSku) throw new Error("Falta SKU del proveedor.");
  const params = new URLSearchParams({ variantSku: cleanSku });
  if (countryCode) params.set("countryCode", countryCode);
  const data = await cjRequest(env, `/product/variant/query?${params.toString()}`);
  const variants = Array.isArray(data) ? data : [];
  if (!variants.length) throw new Error(`CJ no encuentra el SKU ${cleanSku}.`);
  const exact = variants.find(v => String(v.variantSku || "").toLowerCase() === cleanSku.toLowerCase()) || variants[0];
  if (!exact?.vid) throw new Error(`CJ no devolvió VID para ${cleanSku}.`);
  return {
    vid: String(exact.vid),
    variantSku: String(exact.variantSku || cleanSku),
    variantName: String(exact.variantNameEn || exact.variantName || ""),
    sellPriceUsd: Number(exact.variantSellPrice || 0)
  };
}

function cjFreightTotal(option) {
  const total = Number(option?.totalPostageFee);
  if (Number.isFinite(total) && total >= 0) return total;
  return Number(option?.logisticPrice || 0) + Number(option?.taxesFee || 0) + Number(option?.clearanceOperationFee || 0);
}

async function cjFreightOptions(env, originCountry, destinationCountry, postalCode, products) {
  const data = await cjRequest(env, "/logistic/freightCalculate", {
    method: "POST",
    body: {
      startCountryCode: originCountry,
      endCountryCode: destinationCountry,
      zip: postalCode || undefined,
      products: products.map(p => ({ quantity: p.quantity, vid: p.vid }))
    }
  });
  const options = (Array.isArray(data) ? data : [])
    .map(x => ({
      logisticName: String(x.logisticName || ""),
      aging: String(x.logisticAging || ""),
      priceUsd: cjFreightTotal(x),
      basePriceUsd: Number(x.logisticPrice || 0),
      taxesUsd: Number(x.taxesFee || 0),
      clearanceUsd: Number(x.clearanceOperationFee || 0)
    }))
    .filter(x => x.logisticName && Number.isFinite(x.priceUsd))
    .sort((a, b) => a.priceUsd - b.priceUsd);
  if (!options.length) throw new Error(`CJ no ofrece logística ${originCountry} → ${destinationCountry} para este pedido.`);
  return options;
}

async function buildCjFulfillmentPreview(env, orderId) {
  if (!cjConfigured(env)) throw new Error("Falta configurar CJ_API_KEY en Cloudflare.");
  const order = await getAdminOrder(env, orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  if (!['paid','test_paid'].includes(order.paymentStatus)) throw new Error("El pedido todavía no figura como pagado.");
  if (!order.address.phone) throw new Error("CJ exige teléfono del destinatario. Este pedido no tiene teléfono.");

  const compatible = order.items.filter(i => isCjSupplier(i.supplier));
  const incompatible = order.items.filter(i => !isCjSupplier(i.supplier));
  if (!compatible.length) throw new Error("Este pedido no contiene líneas asociadas a CJ/QKsource.");

  const resolved = [];
  for (let index = 0; index < compatible.length; index++) {
    const item = compatible[index];
    if (!item.supplierSku) throw new Error(`Falta SKU proveedor en ${item.productName}${item.variantName ? ` · ${item.variantName}` : ''}.`);
    const originCountry = countryCodeFromWarehouse(item.warehouse);
    const variant = await cjResolveVariantBySku(env, item.supplierSku, originCountry === 'ES' ? 'ES' : '');
    resolved.push({
      orderItemId: item.id,
      productName: item.productName,
      variantName: item.variantName || "",
      supplierSku: item.supplierSku,
      vid: variant.vid,
      quantity: item.quantity,
      originCountry
    });
    if (index < compatible.length - 1) await sleep(550);
  }

  const groupMap = new Map();
  for (const item of resolved) {
    if (!groupMap.has(item.originCountry)) groupMap.set(item.originCountry, []);
    groupMap.get(item.originCountry).push(item);
  }

  const groups = [];
  for (const [originCountry, items] of groupMap.entries()) {
    const logistics = await cjFreightOptions(env, originCountry, order.address.country || 'ES', order.address.postalCode, items);
    groups.push({ originCountry, items, logistics, selectedLogistic: logistics[0] });
    if (groups.length < groupMap.size) await sleep(550);
  }

  return {
    orderId: order.id,
    publicCode: order.publicCode,
    mode: cjMode(env),
    groups,
    incompatible: incompatible.map(i => ({ id: i.id, productName: i.productName, supplier: i.supplier || "" }))
  };
}

async function createCjSupplierOrders(request, env, orderId) {
  await ensureOrderSchema(env);
  const existing = await env.DB.prepare(`SELECT COUNT(*) AS total FROM supplier_orders WHERE order_id = ? AND provider = 'cj'`).bind(orderId).first();
  if (Number(existing?.total || 0) > 0) {
    return json({ ok: false, error: "ALREADY_CREATED", message: "Este pedido ya tiene fulfillment CJ creado. Usa Sincronizar." }, { status: 409 });
  }

  const preview = await buildCjFulfillmentPreview(env, orderId);
  const order = await getAdminOrder(env, orderId);
  const mode = cjMode(env);
  const created = [];

  for (let groupIndex = 0; groupIndex < preview.groups.length; groupIndex++) {
    const group = preview.groups[groupIndex];
    const logistic = group.selectedLogistic;
    const payload = {
      orderNumber: `${order.publicCode}-${group.originCountry}`.slice(0, 50),
      shippingZip: order.address.postalCode,
      shippingCountryCode: order.address.country || "ES",
      shippingCountry: "Spain",
      shippingProvince: order.address.province || order.address.city || "Spain",
      shippingCity: order.address.city,
      shippingAddress: order.address.line1,
      shippingAddress2: order.address.line2 || "",
      shippingCustomerName: order.customerName,
      shippingPhone: order.address.phone,
      remark: `NÓMA PET ${order.publicCode}`,
      fromCountryCode: group.originCountry,
      logisticName: logistic.logisticName,
      isSandbox: mode === "sandbox" ? 1 : 0,
      products: group.items.map(i => ({ vid: i.vid, quantity: i.quantity, shippingName: i.productName.slice(0, 180) }))
    };

    // Create Order never pays the provider. In sandbox it also never creates real fulfillment.
    const supplierOrderId = String(await cjRequest(env, "/shopping/order/createOrder", { method: "POST", body: payload }));
    const local = await env.DB.prepare(`
      INSERT INTO supplier_orders (
        order_id, provider, mode, origin_country, supplier_order_id, logistic_name,
        status, postage_usd, total_usd, last_synced_at
      ) VALUES (?, 'cj', ?, ?, ?, ?, 'CREATED', ?, ?, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(orderId, mode, group.originCountry, supplierOrderId, logistic.logisticName, logistic.priceUsd, logistic.priceUsd).first();

    const localId = Number(local?.id || 0);
    if (!localId) throw new Error("No se pudo registrar el pedido de proveedor en D1.");
    for (const item of group.items) {
      await env.DB.prepare(`
        INSERT INTO supplier_order_items (supplier_order_local_id, order_item_id, supplier_sku, supplier_variant_id, quantity)
        VALUES (?, ?, ?, ?, ?)
      `).bind(localId, item.orderItemId, item.supplierSku, item.vid, item.quantity).run();
    }
    await addOrderEvent(env, orderId, "supplier_order_created", `CJ ${mode.toUpperCase()} creado (${group.originCountry}) · ${supplierOrderId} · ${logistic.logisticName}.`);
    created.push({ localId, supplierOrderId, originCountry: group.originCountry, logisticName: logistic.logisticName, sandbox: mode === "sandbox" });
    if (groupIndex < preview.groups.length - 1) await sleep(550);
  }

  return json({ ok: true, created, order: await getAdminOrder(env, orderId) }, { headers: { "Cache-Control": "no-store" } });
}

async function syncSingleCjSupplierOrder(env, supplierOrder) {
  const detail = await cjRequest(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(supplierOrder.supplier_order_id)}`);
  const status = String(detail?.orderStatus || "OTHER");
  const subStatus = detail?.subStatus ? String(detail.subStatus) : null;
  const trackingCode = detail?.trackNumber ? String(detail.trackNumber) : null;
  const trackingUrl = detail?.trackingUrl ? String(detail.trackingUrl) : null;
  const totalUsd = detail?.orderAmount == null ? null : Number(detail.orderAmount);
  const productUsd = detail?.productAmount == null ? null : Number(detail.productAmount);
  const postageUsd = detail?.postageAmount == null ? null : Number(detail.postageAmount);
  await env.DB.prepare(`
    UPDATE supplier_orders
    SET supplier_order_code = ?, status = ?, sub_status = ?, tracking_code = ?, tracking_url = ?,
        product_amount_usd = COALESCE(?, product_amount_usd), postage_usd = COALESCE(?, postage_usd),
        total_usd = COALESCE(?, total_usd), error = NULL, last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(detail?.cjOrderCode || detail?.orderNum || null, status, subStatus, trackingCode, trackingUrl, productUsd, postageUsd, totalUsd, supplierOrder.id).run();
  return { ...detail, orderStatus: status, subStatus, trackNumber: trackingCode, trackingUrl };
}

async function reconcileCustomerOrderFromSupplier(env, orderId, origin = "") {
  const { results } = await env.DB.prepare(`SELECT status, sub_status, tracking_code, tracking_url FROM supplier_orders WHERE order_id = ?`).bind(orderId).all();
  const rows = results || [];
  if (!rows.length) return;
  const effective = rows.map(r => String(r.sub_status || r.status || "").toUpperCase());
  let fulfillment = null;
  if (effective.every(s => ["DELIVERED", "COMPLETED", "CLOSED"].includes(s))) fulfillment = "delivered";
  else if (effective.every(s => ["SHIPPED", "DELIVERED", "COMPLETED", "CLOSED"].includes(s))) fulfillment = "shipped";
  else if (effective.some(s => ["PENDING", "PROCESSING", "UNSHIPPED", "SHIPPED", "DELIVERED", "COMPLETED"].includes(s))) fulfillment = "processing";
  if (!fulfillment) return;

  const trackRows = rows.filter(r => r.tracking_code);
  const oneTrack = rows.length === 1 && trackRows.length === 1 ? trackRows[0] : null;
  const before = await env.DB.prepare(`SELECT fulfillment_status FROM orders WHERE id = ? LIMIT 1`).bind(orderId).first();
  await env.DB.prepare(`
    UPDATE orders
    SET fulfillment_status = ?,
        tracking_code = CASE WHEN ? IS NOT NULL THEN ? ELSE tracking_code END,
        tracking_url = CASE WHEN ? IS NOT NULL THEN ? ELSE tracking_url END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(fulfillment, oneTrack?.tracking_code || null, oneTrack?.tracking_code || null, oneTrack?.tracking_url || null, oneTrack?.tracking_url || null, orderId).run();
  if (origin && before?.fulfillment_status !== fulfillment) {
    if (fulfillment === "shipped") await sendOrderEmailSafe(env, orderId, "shipped", origin);
    else if (fulfillment === "delivered") await sendOrderEmailSafe(env, orderId, "delivered", origin);
  }
}

async function syncCjSupplierOrders(env, orderId, origin = "") {
  await ensureOrderSchema(env);
  const { results } = await env.DB.prepare(`SELECT * FROM supplier_orders WHERE order_id = ? AND provider = 'cj' ORDER BY id`).bind(orderId).all();
  if (!(results || []).length) return json({ ok: false, error: "NO_SUPPLIER_ORDER", message: "Todavía no hay pedidos CJ para sincronizar." }, { status: 404 });
  const synced = [];
  for (let i = 0; i < results.length; i++) {
    synced.push(await syncSingleCjSupplierOrder(env, results[i]));
    if (i < results.length - 1) await sleep(550);
  }
  await reconcileCustomerOrderFromSupplier(env, orderId, origin);
  await addOrderEvent(env, orderId, "supplier_sync", "Estados de CJ sincronizados.");
  return json({ ok: true, synced, order: await getAdminOrder(env, orderId) }, { headers: { "Cache-Control": "no-store" } });
}

async function sandboxPayCjSupplierOrders(env, orderId, origin = "") {
  if (cjMode(env) !== "sandbox") return json({ ok: false, error: "SANDBOX_ONLY", message: "Esta acción solo está disponible en CJ_MODE=sandbox." }, { status: 403 });
  const { results } = await env.DB.prepare(`SELECT * FROM supplier_orders WHERE order_id = ? AND provider='cj' ORDER BY id`).bind(orderId).all();
  if (!(results || []).length) return json({ ok: false, error: "NO_SUPPLIER_ORDER", message: "Crea primero el pedido CJ Sandbox." }, { status: 404 });
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    const detail = await cjRequest(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(row.supplier_order_id)}`);
    const current = String(detail?.subStatus || detail?.orderStatus || "").toUpperCase();
    if (["CREATED", "IN_CART"].includes(current)) {
      await cjRequest(env, "/shopping/order/confirmOrder", { method: "PATCH", body: { orderId: row.supplier_order_id } });
      await sleep(550);
    }
    const afterConfirm = await cjRequest(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(row.supplier_order_id)}`);
    const statusNow = String(afterConfirm?.subStatus || afterConfirm?.orderStatus || "").toUpperCase();
    if (["UNPAID", "CREATED", "IN_CART"].includes(statusNow)) {
      await cjRequest(env, "/shopping/sandbox/simulatePay", { method: "POST", body: { orderId: row.supplier_order_id } });
    }
    if (i < results.length - 1) await sleep(550);
  }
  await addOrderEvent(env, orderId, "supplier_sandbox_paid", "Pago CJ Sandbox simulado. No se ha descontado saldo real.");
  return syncCjSupplierOrders(env, orderId, origin);
}

async function sandboxShipCjSupplierOrders(env, orderId, origin = "") {
  if (cjMode(env) !== "sandbox") return json({ ok: false, error: "SANDBOX_ONLY", message: "Esta acción solo está disponible en CJ_MODE=sandbox." }, { status: 403 });
  const { results } = await env.DB.prepare(`SELECT * FROM supplier_orders WHERE order_id = ? AND provider='cj' ORDER BY id`).bind(orderId).all();
  if (!(results || []).length) return json({ ok: false, error: "NO_SUPPLIER_ORDER", message: "Crea primero el pedido CJ Sandbox." }, { status: 404 });
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    const detail = await cjRequest(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(row.supplier_order_id)}`);
    const current = String(detail?.subStatus || detail?.orderStatus || "").toUpperCase();
    if (["CREATED", "IN_CART", "UNPAID"].includes(current)) {
      throw new Error("El pedido CJ Sandbox todavía no está pagado. Pulsa primero “Simular pago CJ”.");
    }
    if (current === "PENDING" || current === "UNSHIPPED") {
      await cjRequest(env, "/shopping/sandbox/updateStatus", { method: "POST", body: { orderId: row.supplier_order_id, targetStatus: 400 } });
      await sleep(550);
    }
    const afterProcessing = await cjRequest(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(row.supplier_order_id)}`);
    const state2 = String(afterProcessing?.subStatus || afterProcessing?.orderStatus || "").toUpperCase();
    if (state2 === "PROCESSING" || state2 === "UNSHIPPED") {
      await cjRequest(env, "/shopping/sandbox/updateStatus", { method: "POST", body: { orderId: row.supplier_order_id, targetStatus: 500 } });
      await sleep(550);
    }
    const fakeTrack = `NOMA-SBX-${String(row.supplier_order_id).slice(-10)}`.slice(0, 64);
    await cjRequest(env, "/shopping/sandbox/updateTrackNumber", { method: "POST", body: { orderId: row.supplier_order_id, trackNumber: fakeTrack } });
    if (i < results.length - 1) await sleep(550);
  }
  await addOrderEvent(env, orderId, "supplier_sandbox_shipped", "Envío CJ Sandbox simulado con tracking ficticio.");
  const response = await syncCjSupplierOrders(env, orderId, origin);
  return response;
}

async function listAdminOrders(env) {
  await ensureOrderSchema(env);
  const { results } = await env.DB.prepare(`
    SELECT
      o.id, o.public_code, o.customer_email, o.customer_name,
      o.subtotal_cents, o.shipping_cents, o.total_cents, o.currency, o.payment_status, o.fulfillment_status,
      o.tracking_code, o.tracking_url, o.stripe_checkout_session_id,
      o.created_at, o.updated_at,
      a.city, a.province, a.country,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT COUNT(*) FROM supplier_orders so WHERE so.order_id = o.id) AS supplier_order_count,
      (SELECT GROUP_CONCAT(DISTINCT COALESCE(so.sub_status, so.status)) FROM supplier_orders so WHERE so.order_id = o.id) AS supplier_statuses
    FROM orders o
    LEFT JOIN order_addresses a ON a.order_id = o.id
    ORDER BY o.created_at DESC
    LIMIT 250
  `).all();

  return (results || []).map(row => ({
    id: row.id,
    publicCode: row.public_code,
    customerEmail: row.customer_email || "",
    customerName: row.customer_name || "",
    subtotal: Number(row.subtotal_cents || 0) / 100,
    shipping: Number(row.shipping_cents || 0) / 100,
    total: Number(row.total_cents || 0) / 100,
    currency: row.currency || "EUR",
    paymentStatus: row.payment_status || "pending",
    fulfillmentStatus: row.fulfillment_status || "pending",
    trackingCode: row.tracking_code || "",
    trackingUrl: row.tracking_url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    city: row.city || "",
    province: row.province || "",
    country: row.country || "ES",
    itemCount: Number(row.item_count || 0),
    supplierOrderCount: Number(row.supplier_order_count || 0),
    supplierStatuses: row.supplier_statuses || "",
    test: isTestOrderId(row.id),
    stripeTest: isStripeTestOrderId(row.id) && Boolean(row.stripe_checkout_session_id)
  }));
}

async function getAdminOrder(env, orderId) {
  await ensureOrderSchema(env);
  const order = await env.DB.prepare(`
    SELECT
      o.*,
      a.phone, a.address_line1, a.address_line2, a.postal_code,
      a.city, a.province, a.country, a.customer_notes
    FROM orders o
    LEFT JOIN order_addresses a ON a.order_id = o.id
    WHERE o.id = ?
    LIMIT 1
  `).bind(orderId).first();

  if (!order) return null;

  const [itemsResult, eventsResult, emailsResult, supplierOrdersResult, supplierItemsResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT oi.id, oi.product_id, oi.product_name, oi.variant_id, oi.variant_name, oi.quantity, oi.unit_price_cents,
             oi.supplier, oi.supplier_sku,
             COALESCE(v.warehouse, s.warehouse, '') AS warehouse
      FROM order_items oi
      LEFT JOIN product_variants v ON v.id = oi.variant_id
      LEFT JOIN product_sources s ON s.id = (SELECT MIN(s2.id) FROM product_sources s2 WHERE s2.product_id = oi.product_id)
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `).bind(orderId),
    env.DB.prepare(`
      SELECT id, event_type, message, created_at
      FROM order_events
      WHERE order_id = ?
      ORDER BY created_at DESC, id DESC
    `).bind(orderId),
    env.DB.prepare(`
      SELECT id, email_type, recipient, original_recipient, provider_message_id, status, error, created_at, updated_at
      FROM order_emails
      WHERE order_id = ?
      ORDER BY created_at DESC, id DESC
    `).bind(orderId),
    env.DB.prepare(`
      SELECT * FROM supplier_orders
      WHERE order_id = ?
      ORDER BY id ASC
    `).bind(orderId),
    env.DB.prepare(`
      SELECT soi.*, oi.product_name, oi.variant_name
      FROM supplier_order_items soi
      JOIN order_items oi ON oi.id = soi.order_item_id
      JOIN supplier_orders so ON so.id = soi.supplier_order_local_id
      WHERE so.order_id = ?
      ORDER BY soi.id ASC
    `).bind(orderId)
  ]);

  return {
    id: order.id,
    publicCode: order.public_code,
    customerEmail: order.customer_email || "",
    customerName: order.customer_name || "",
    subtotal: Number(order.subtotal_cents || 0) / 100,
    shipping: Number(order.shipping_cents || 0) / 100,
    total: Number(order.total_cents || 0) / 100,
    currency: order.currency || "EUR",
    paymentStatus: order.payment_status || "pending",
    fulfillmentStatus: order.fulfillment_status || "pending",
    trackingCode: order.tracking_code || "",
    trackingUrl: order.tracking_url || "",
    stripeCheckoutSessionId: order.stripe_checkout_session_id || "",
    stripePaymentIntentId: order.stripe_payment_intent_id || "",
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    test: isTestOrderId(order.id),
    stripeTest: isStripeTestOrderId(order.id),
    address: {
      phone: order.phone || "",
      line1: order.address_line1 || "",
      line2: order.address_line2 || "",
      postalCode: order.postal_code || "",
      city: order.city || "",
      province: order.province || "",
      country: order.country || "ES",
      notes: order.customer_notes || ""
    },
    items: (itemsResult.results || []).map(item => ({
      id: Number(item.id),
      productId: item.product_id,
      productName: item.product_name,
      variantId: item.variant_id || null,
      variantName: item.variant_name || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price_cents || 0) / 100,
      supplier: item.supplier || "",
      supplierSku: item.supplier_sku || "",
      warehouse: item.warehouse || ""
    })),
    events: (eventsResult.results || []).map(event => ({
      id: Number(event.id),
      type: event.event_type,
      message: event.message || "",
      createdAt: event.created_at
    })),
    emails: (emailsResult.results || []).map(email => ({
      id: Number(email.id),
      type: email.email_type,
      recipient: email.recipient || "",
      originalRecipient: email.original_recipient || "",
      providerMessageId: email.provider_message_id || "",
      status: email.status || "pending",
      error: email.error || "",
      createdAt: email.created_at,
      updatedAt: email.updated_at
    })),
    supplierOrders: (supplierOrdersResult.results || []).map(so => ({
      id: Number(so.id),
      provider: so.provider || "cj",
      mode: so.mode || "sandbox",
      originCountry: so.origin_country || "",
      supplierOrderId: so.supplier_order_id || "",
      supplierOrderCode: so.supplier_order_code || "",
      logisticName: so.logistic_name || "",
      status: so.status || "pending",
      subStatus: so.sub_status || "",
      trackingCode: so.tracking_code || "",
      trackingUrl: so.tracking_url || "",
      productAmountUsd: so.product_amount_usd == null ? null : Number(so.product_amount_usd),
      postageUsd: so.postage_usd == null ? null : Number(so.postage_usd),
      totalUsd: so.total_usd == null ? null : Number(so.total_usd),
      error: so.error || "",
      lastSyncedAt: so.last_synced_at || "",
      createdAt: so.created_at,
      items: (supplierItemsResult.results || []).filter(x => Number(x.supplier_order_local_id) === Number(so.id)).map(x => ({
        orderItemId: Number(x.order_item_id),
        productName: x.product_name || "",
        variantName: x.variant_name || "",
        supplierSku: x.supplier_sku || "",
        supplierVariantId: x.supplier_variant_id || "",
        quantity: Number(x.quantity || 0)
      }))
    }))
  };
}

async function updateAdminOrder(request, env, orderId) {
  await ensureOrderSchema(env);
  const body = await readJson(request);
  const allowed = new Set(["pending", "processing", "shipped", "delivered", "cancelled"]);
  const fulfillmentStatus = cleanText(body.fulfillmentStatus, 30);
  if (!allowed.has(fulfillmentStatus)) {
    return json({ ok: false, error: "INVALID_STATUS", message: "Estado de pedido no válido." }, { status: 400 });
  }

  const trackingCode = nullableText(body.trackingCode, 180);
  const trackingUrl = nullableText(body.trackingUrl, 1200);
  if (trackingUrl && !trackingUrlIsSafe(trackingUrl)) {
    return json({ ok: false, error: "INVALID_TRACKING_URL", message: "La URL de seguimiento debe comenzar por http:// o https://." }, { status: 400 });
  }

  const current = await env.DB.prepare(`
    SELECT id, fulfillment_status FROM orders WHERE id = ? LIMIT 1
  `).bind(orderId).first();
  if (!current) {
    return json({ ok: false, error: "NOT_FOUND", message: "Pedido no encontrado." }, { status: 404 });
  }

  const changedStatus = current.fulfillment_status !== fulfillmentStatus;
  const statements = [
    env.DB.prepare(`
      UPDATE orders
      SET fulfillment_status = ?, tracking_code = ?, tracking_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(fulfillmentStatus, trackingCode, trackingUrl, orderId)
  ];

  if (changedStatus) {
    statements.push(env.DB.prepare(`
      INSERT INTO order_events (order_id, event_type, message)
      VALUES (?, 'fulfillment_updated', ?)
    `).bind(orderId, `Estado actualizado: ${fulfillmentStatus}`));
  }

  if (trackingCode || trackingUrl) {
    statements.push(env.DB.prepare(`
      INSERT INTO order_events (order_id, event_type, message)
      VALUES (?, 'tracking_updated', 'Datos de seguimiento actualizados.')
    `).bind(orderId));
  }

  await env.DB.batch(statements);

  let emailResult = null;
  const origin = new URL(request.url).origin;
  if (changedStatus && fulfillmentStatus === "shipped") {
    emailResult = await sendOrderEmailSafe(env, orderId, "shipped", origin);
  } else if (changedStatus && fulfillmentStatus === "delivered") {
    emailResult = await sendOrderEmailSafe(env, orderId, "delivered", origin);
  }

  return json({ ok: true, order: await getAdminOrder(env, orderId), email: emailResult }, { headers: { "Cache-Control": "no-store" } });
}

async function resendAdminOrderEmail(request, env, orderId) {
  await ensureOrderSchema(env);
  const body = await readJson(request).catch(() => ({}));
  const order = await getAdminOrder(env, orderId);
  if (!order) return json({ ok: false, error: "NOT_FOUND", message: "Pedido no encontrado." }, { status: 404 });

  let type = cleanText(body.type, 30);
  if (!type) {
    if (order.fulfillmentStatus === "delivered") type = "delivered";
    else if (order.fulfillmentStatus === "shipped") type = "shipped";
    else type = "confirmation";
  }

  try {
    const result = await sendOrderEmail(env, orderId, type, new URL(request.url).origin, { force: true });
    return json({ ok: true, email: result, order: await getAdminOrder(env, orderId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return json({ ok: false, error: "EMAIL_SEND_FAILED", message: String(error?.message || error) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

async function deleteTestOrder(env, orderId) {
  await ensureOrderSchema(env);
  if (!isTestOrderId(orderId)) {
    return json({ ok: false, error: "FORBIDDEN", message: "Solo se pueden borrar pedidos de prueba." }, { status: 403 });
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM order_emails WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_events WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_addresses WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(orderId)
  ]);
  return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function publicOrderStatus(request, env) {
  await ensureOrderSchema(env);
  const body = await readJson(request);
  const publicCode = cleanText(body.publicCode ?? body.code, 80).toUpperCase();
  const email = normalizeEmail(body.email);

  if (!publicCode || !email) {
    return json({ ok: false, error: "MISSING_FIELDS", message: "Introduce número de pedido y email." }, { status: 400 });
  }

  const order = await env.DB.prepare(`
    SELECT id, public_code, customer_name, customer_email,
           total_cents, currency, payment_status, fulfillment_status,
           tracking_code, tracking_url, created_at, updated_at
    FROM orders
    WHERE UPPER(public_code) = ? AND LOWER(customer_email) = ?
    LIMIT 1
  `).bind(publicCode, email).first();

  if (!order) {
    return json({ ok: false, error: "NOT_FOUND", message: "No encontramos un pedido con esos datos." }, { status: 404 });
  }

  const { results } = await env.DB.prepare(`
    SELECT product_name, variant_name, quantity, unit_price_cents
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).bind(order.id).all();

  return json({
    ok: true,
    order: {
      publicCode: order.public_code,
      customerName: order.customer_name || "",
      total: Number(order.total_cents || 0) / 100,
      currency: order.currency || "EUR",
      paymentStatus: order.payment_status || "pending",
      fulfillmentStatus: order.fulfillment_status || "pending",
      trackingCode: order.tracking_code || "",
      trackingUrl: order.tracking_url || "",
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      test: isTestOrderId(order.id),
      stripeTest: isStripeTestOrderId(order.id),
      items: (results || []).map(item => ({
        productName: item.product_name,
        variantName: item.variant_name || "",
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price_cents || 0) / 100
      }))
    }
  }, { headers: { "Cache-Control": "no-store" } });
}


async function handleAdminApi(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  await ensureCatalogSchema(env);

  if (url.pathname === "/api/admin/session" && request.method === "GET") {
    const mail = emailConfig(env);
    return json({ ok: true, r2: Boolean(env.PRODUCT_IMAGES), email: mail.enabled, emailMode: mail.mode, emailProvider: mail.provider, cj: cjConfigured(env), cjMode: cjMode(env) }, { headers: { "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/api/admin/orders/test" && request.method === "POST") {
    return createTestOrder(request, env);
  }

  if (url.pathname === "/api/admin/orders" && request.method === "GET") {
    return json({ ok: true, orders: await listAdminOrders(env) }, { headers: { "Cache-Control": "no-store" } });
  }

  const orderEmailMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/email$/);
  if (orderEmailMatch && request.method === "POST") {
    return resendAdminOrderEmail(request, env, decodeURIComponent(orderEmailMatch[1]));
  }

  const fulfillmentMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/fulfillment\/(preview|create|sync|sandbox-pay|sandbox-ship)$/);
  if (fulfillmentMatch && request.method === "POST") {
    const orderId = decodeURIComponent(fulfillmentMatch[1]);
    const action = fulfillmentMatch[2];
    try {
      if (action === "preview") return json({ ok: true, preview: await buildCjFulfillmentPreview(env, orderId) }, { headers: { "Cache-Control": "no-store" } });
      if (action === "create") return createCjSupplierOrders(request, env, orderId);
      if (action === "sync") return syncCjSupplierOrders(env, orderId, new URL(request.url).origin);
      if (action === "sandbox-pay") return sandboxPayCjSupplierOrders(env, orderId, new URL(request.url).origin);
      if (action === "sandbox-ship") return sandboxShipCjSupplierOrders(env, orderId, new URL(request.url).origin);
    } catch (error) {
      console.error("CJ fulfillment error:", error);
      return json({ ok: false, error: "CJ_FULFILLMENT_ERROR", message: String(error?.message || error) }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
  }

  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  const adminOrderId = orderMatch ? decodeURIComponent(orderMatch[1]) : "";

  if (adminOrderId && request.method === "GET") {
    const order = await getAdminOrder(env, adminOrderId);
    if (!order) return json({ ok: false, error: "NOT_FOUND", message: "Pedido no encontrado." }, { status: 404 });
    return json({ ok: true, order }, { headers: { "Cache-Control": "no-store" } });
  }

  if (adminOrderId && request.method === "PUT") {
    return updateAdminOrder(request, env, adminOrderId);
  }

  if (adminOrderId && request.method === "DELETE") {
    return deleteTestOrder(env, adminOrderId);
  }

  const imageOrderMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/images\/order$/);
  if (imageOrderMatch && request.method === "PUT") {
    return reorderProductImages(request, env, decodeURIComponent(imageOrderMatch[1]));
  }

  const imageDeleteMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/images\/(\d+)$/);
  if (imageDeleteMatch && request.method === "DELETE") {
    return deleteProductImage(env, decodeURIComponent(imageDeleteMatch[1]), Number(imageDeleteMatch[2]));
  }

  const imageUploadMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/images$/);
  if (imageUploadMatch && request.method === "POST") {
    return uploadProductImages(request, env, decodeURIComponent(imageUploadMatch[1]));
  }

  const base = "/api/admin/products";

  if (url.pathname === base && request.method === "GET") {
    const { results } = await env.DB.prepare(`${ADMIN_LIST_SQL} ORDER BY p.sort_order ASC, p.name ASC`).all();
    return json(
      { ok: true, products: await attachVariants(env, await attachImages(env, results || [], mapAdminProduct), true) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (url.pathname === base && request.method === "POST") {
    const body = await readJson(request);
    const p = productPayload(body);
    const source = sourcePayload(body);
    const variants = variantPayloads(body, p.id);

    const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ? OR slug = ? LIMIT 1")
      .bind(p.id, p.slug).first();
    if (existing) return json({ ok: false, error: "DUPLICATE", message: "Ya existe un producto con ese ID o slug." }, { status: 409 });

    await env.DB.prepare(`
      INSERT INTO products (
        id, slug, name, short_desc, description, category, tag, emoji,
        price_cents, currency, published, sort_order, stock_mode, stock_qty,
        image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      p.id, p.slug, p.name, p.shortDesc, p.description, p.category, p.tag, p.emoji,
      p.priceCents, p.currency, p.published, p.sortOrder, p.stockMode, p.stockQty, p.imageUrl
    ).run();

    await upsertSource(env, p.id, source);
    await saveVariants(env, p.id, variants);
    return json({ ok: true, id: p.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  const id = productMatch ? decodeURIComponent(productMatch[1]) : "";

  if (id && request.method === "PUT") {
    const current = await env.DB.prepare("SELECT id, image_url FROM products WHERE id = ?").bind(id).first();
    if (!current) return json({ ok: false, error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });

    const body = await readJson(request);
    if (body.imageUrl == null) body.imageUrl = current.image_url || "";
    const p = productPayload({ ...body, id }, id);
    const source = sourcePayload(body);
    const variants = variantPayloads(body, id);

    const duplicate = await env.DB.prepare("SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1")
      .bind(p.slug, id).first();
    if (duplicate) return json({ ok: false, error: "DUPLICATE_SLUG", message: "Ese slug ya está siendo usado por otro producto." }, { status: 409 });

    await env.DB.prepare(`
      UPDATE products SET
        slug = ?, name = ?, short_desc = ?, description = ?, category = ?,
        tag = ?, emoji = ?, price_cents = ?, currency = ?, published = ?,
        sort_order = ?, stock_mode = ?, stock_qty = ?, image_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      p.slug, p.name, p.shortDesc, p.description, p.category,
      p.tag, p.emoji, p.priceCents, p.currency, p.published,
      p.sortOrder, p.stockMode, p.stockQty, p.imageUrl, id
    ).run();

    await upsertSource(env, id, source);
    await saveVariants(env, id, variants);
    return json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  }

  if (id && request.method === "DELETE") {
    const { results: imageRows } = await env.DB.prepare("SELECT object_key FROM product_images WHERE product_id = ?").bind(id).all();
    const result = await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    const changed = Number(result?.meta?.changes || 0);
    if (!changed) return json({ ok: false, error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });

    const keys = (imageRows || []).map(x => x.object_key).filter(Boolean);
    if (keys.length && env.PRODUCT_IMAGES) {
      await env.PRODUCT_IMAGES.delete(keys).catch(error => console.error("R2 delete product images:", error));
    }
    return json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  }

  return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

let contactSchemaReady = false;
async function ensureContactSchema(env) {
  if (contactSchemaReady) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_message_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_contact_email_created ON contact_messages (email, created_at)`).run();
  contactSchemaReady = true;
}

async function publicContact(request, env) {
  const config = emailConfig(env);
  if (!config.enabled) return json({ ok:false, error:"EMAIL_NOT_CONFIGURED", message:"El formulario de contacto no está disponible temporalmente." }, { status:503 });
  const body = await readJson(request);
  if (cleanText(body.website, 200)) return json({ ok:true });
  const name = cleanText(body.name, 120);
  const email = normalizeEmail(body.email);
  const subject = cleanText(body.subject, 120) || "Contacto web";
  const message = cleanText(body.message, 3000);
  if (!name || !email || !email.includes("@") || !message) return json({ ok:false, error:"MISSING_FIELDS", message:"Completa nombre, email y mensaje." }, { status:400 });
  await ensureContactSchema(env);
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM contact_messages WHERE email = ? AND created_at >= datetime('now','-1 hour')`).bind(email).first();
  if (Number(recent?.total || 0) >= 3) return json({ ok:false, error:"RATE_LIMIT", message:"Has enviado varios mensajes recientemente. Inténtalo de nuevo más tarde." }, { status:429 });
  const recipient = normalizeEmail(env.CONTACT_TO || "") || (config.mode === "test" ? config.testRecipient : config.replyTo || config.testRecipient);
  if (!recipient) return json({ ok:false, error:"CONTACT_RECIPIENT_NOT_CONFIGURED", message:"El canal de contacto no está configurado todavía." }, { status:503 });
  const id = `contact_${crypto.randomUUID()}`;
  await env.DB.prepare(`INSERT INTO contact_messages (id,name,email,subject,message,status) VALUES (?,?,?,?,?,'pending')`).bind(id,name,email,subject,message).run();
  const safeName=escapeHtmlEmail(name), safeEmail=escapeHtmlEmail(email), safeSubject=escapeHtmlEmail(subject), safeMessage=escapeHtmlEmail(message).replace(/\n/g,"<br>");
  const payload={
    from:config.from,
    to:[recipient],
    reply_to:email,
    subject:`NÓMA PET · ${subject}`,
    html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>Nuevo mensaje desde NÓMA PET</h2><p><b>Nombre:</b> ${safeName}<br><b>Email:</b> ${safeEmail}<br><b>Asunto:</b> ${safeSubject}</p><p>${safeMessage}</p></div>`,
    text:`Nuevo mensaje desde NÓMA PET\nNombre: ${name}\nEmail: ${email}\nAsunto: ${subject}\n\n${message}`
  };
  try {
    const result=await resendSend(env,payload,`contact/${id}`);
    await env.DB.prepare(`UPDATE contact_messages SET status='sent', provider_message_id=? WHERE id=?`).bind(cleanText(result?.id,200)||null,id).run();
    return json({ ok:true });
  } catch(error) {
    await env.DB.prepare(`UPDATE contact_messages SET status='failed' WHERE id=?`).bind(id).run();
    throw error;
  }
}

function seoIndexingEnabled(env) {
  return String(env.SEO_INDEXING_ENABLED || "false").trim().toLowerCase() === "true";
}
function xmlEscape(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c])); }
function absoluteFrom(origin, value) { try { return new URL(value || "/", origin).href; } catch (_) { return origin + "/"; } }
function productSeoDescription(product) {
  const raw = cleanText(product?.desc || product?.description || "Accesorios funcionales para mascotas seleccionados por NÓMA PET.", 170);
  return raw.length > 160 ? `${raw.slice(0,157).trim()}…` : raw;
}
async function findPublicProduct(env, identifier, byId=false) {
  await ensureCatalogSchema(env);
  const field = byId ? "p.id" : "p.slug";
  const { results } = await env.DB.prepare(`
    SELECT p.id,p.slug,p.name,p.short_desc,p.description,p.category,p.tag,p.emoji,p.price_cents,p.currency,p.stock_mode,p.stock_qty,p.image_url,
           s.warehouse,s.shipping_days_min,s.shipping_days_max
    FROM products p
    LEFT JOIN product_sources s ON s.id=(SELECT MIN(s2.id) FROM product_sources s2 WHERE s2.product_id=p.id)
    WHERE ${field}=? AND p.published=1 LIMIT 1
  `).bind(identifier).all();
  if (!(results || []).length) return null;
  const list = await attachVariants(env, await attachImages(env, results, mapPublicProduct), false);
  return list[0] || null;
}
function productSchema(product, origin, canonical) {
  const images=(product.images||[]).map(img=>absoluteFrom(origin,img.url));
  if(!images.length && product.imageUrl) images.push(absoluteFrom(origin,product.imageUrl));
  const variants=Array.isArray(product.variants)?product.variants:[];
  const offers=variants.length ? variants.map(v=>({
    "@type":"Offer", name:v.name, url:canonical, priceCurrency:"EUR", price:Number(v.price||0).toFixed(2),
    availability:v.stockStatus==="out"?"https://schema.org/OutOfStock":"https://schema.org/InStock",
    itemCondition:"https://schema.org/NewCondition"
  })) : [{"@type":"Offer",url:canonical,priceCurrency:product.currency||"EUR",price:Number(product.price||0).toFixed(2),availability:product.stockQty===0&&product.stockMode==="finite"?"https://schema.org/OutOfStock":"https://schema.org/InStock",itemCondition:"https://schema.org/NewCondition"}];
  return {"@context":"https://schema.org","@type":"Product",name:product.name,description:productSeoDescription(product),image:images,brand:{"@type":"Brand",name:"NÓMA PET"},category:product.cat||"Accesorios para mascotas",offers};
}
function applyResponseHeaders(response, env, pathname, forceNoindex=false) {
  const headers=new Headers(response.headers);
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Referrer-Policy","strict-origin-when-cross-origin");
  headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options","SAMEORIGIN");
  const privatePath=forceNoindex || pathname.startsWith("/admin/") || ["/carrito.html","/checkout.html","/pedido-exito.html","/seguimiento.html"].includes(pathname);
  if (!seoIndexingEnabled(env) || privatePath) headers.set("X-Robots-Tag","noindex, nofollow");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function renderProductSeo(request, env, url, product) {
  const assetUrl=new URL("/producto.html",url.origin);
  const raw=await env.ASSETS.fetch(new Request(assetUrl,{headers:request.headers}));
  if(!raw.ok) return raw;
  const canonical=`${url.origin}/producto/${encodeURIComponent(product.slug)}`;
  const description=productSeoDescription(product);
  const image=absoluteFrom(url.origin,product.imageUrl||product.images?.[0]?.url||"/assets/og-cover.png");
  const schema=JSON.stringify(productSchema(product,url.origin,canonical));
  const response=applyResponseHeaders(raw,env,url.pathname,false);
  return new HTMLRewriter()
    .on("title",{element(e){e.setInnerContent(`${product.name} — NÓMA PET`)}})
    .on('meta[name="description"]',{element(e){e.setAttribute("content",description)}})
    .on('link[rel="canonical"]',{element(e){e.setAttribute("href",canonical)}})
    .on('meta[property="og:type"]',{element(e){e.setAttribute("content","product")}})
    .on('meta[property="og:title"]',{element(e){e.setAttribute("content",`${product.name} — NÓMA PET`)}})
    .on('meta[property="og:description"]',{element(e){e.setAttribute("content",description)}})
    .on('meta[property="og:url"]',{element(e){e.setAttribute("content",canonical)}})
    .on('meta[property="og:image"]',{element(e){e.setAttribute("content",image)}})
    .on('meta[name="twitter:title"]',{element(e){e.setAttribute("content",`${product.name} — NÓMA PET`)}})
    .on('meta[name="twitter:description"]',{element(e){e.setAttribute("content",description)}})
    .on('meta[name="twitter:image"]',{element(e){e.setAttribute("content",image)}})
    .on('#product-structured-data',{element(e){e.setInnerContent(schema)}})
    .transform(response);
}
async function serveRobots(env, url) {
  const lines=["User-agent: *","Disallow: /admin/","Disallow: /api/","Disallow: /checkout.html","Disallow: /pedido-exito.html","Disallow: /carrito.html","Disallow: /seguimiento.html",`Sitemap: ${url.origin}/sitemap.xml`];
  return new Response(lines.join("\n")+"\n",{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=3600"}});
}
async function serveSitemap(env, url) {
  await ensureCatalogSchema(env);
  const pages=["/","/tienda.html","/contacto.html","/envios.html","/devoluciones.html","/condiciones.html"];
  const {results}=await env.DB.prepare(`SELECT slug,updated_at FROM products WHERE published=1 ORDER BY sort_order,name`).all();
  const urls=pages.map(path=>({loc:url.origin+path,lastmod:""})).concat((results||[]).map(p=>({loc:`${url.origin}/producto/${encodeURIComponent(p.slug)}`,lastmod:String(p.updated_at||"").slice(0,10)})));
  const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(x=>`  <url><loc>${xmlEscape(x.loc)}</loc>${x.lastmod?`<lastmod>${xmlEscape(x.lastmod)}</lastmod>`:""}</url>`).join("\n")}\n</urlset>\n`;
  return new Response(body,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, max-age=3600"}});
}
async function serveAssetWithSeo(request, env, url) {
  const raw=await env.ASSETS.fetch(request);
  const type=raw.headers.get("Content-Type")||"";
  if(!type.includes("text/html")) return applyResponseHeaders(raw,env,url.pathname,false);
  const canonicalPath=url.pathname==="/index.html"?"/":url.pathname;
  const canonical=url.origin+canonicalPath;
  const image=absoluteFrom(url.origin,"/assets/og-cover.png");
  const response=applyResponseHeaders(raw,env,url.pathname,false);
  return new HTMLRewriter()
    .on('link[rel="canonical"]',{element(e){e.setAttribute("href",canonical)}})
    .on('meta[property="og:url"]',{element(e){e.setAttribute("content",canonical)}})
    .on('meta[property="og:image"]',{element(e){e.setAttribute("content",image)}})
    .on('meta[name="twitter:image"]',{element(e){e.setAttribute("content",image)}})
    .transform(response);
}

async function handlePublicApi(request, env, url) {
  await ensureCatalogSchema(env);
  if (url.pathname === "/api/health") {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
    try {
      const [productRow, variantRow] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total FROM products").first(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM product_variants").first()
      ]);
      return json(
        { ok: true, database: "connected", products: Number(productRow?.total || 0), variants: Number(variantRow?.total || 0), r2: Boolean(env.PRODUCT_IMAGES), orders: true, stripe: stripeConfigured(env), stripeMode: stripeConfigured(env) ? stripeConfig(env).mode : "disabled", email: emailConfig(env).enabled, emailMode: emailModeLabel(env), emailProvider: "resend", cj: cjConfigured(env), cjMode: cjMode(env), shippingFlat: SHIPPING_FLAT_CENTS / 100, freeShippingThreshold: FREE_SHIPPING_THRESHOLD_CENTS / 100, seoIndexing: seoIndexingEnabled(env) },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      console.error("D1 health error:", error);
      return json(
        { ok: false, database: "disconnected", error: String(error?.message || error) },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  if (url.pathname === "/api/products") {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
    try {
      const { results } = await env.DB.prepare(`
        SELECT
          p.id, p.slug, p.name, p.short_desc, p.description, p.category, p.tag, p.emoji,
          p.price_cents, p.currency, p.stock_mode, p.stock_qty, p.image_url,
          s.warehouse, s.shipping_days_min, s.shipping_days_max
        FROM products p
        LEFT JOIN product_sources s
          ON s.id = (SELECT MIN(s2.id) FROM product_sources s2 WHERE s2.product_id = p.id)
        WHERE p.published = 1
        ORDER BY p.sort_order ASC, p.name ASC
      `).all();
      return json(
        { ok: true, products: await attachVariants(env, await attachImages(env, results || [], mapPublicProduct), false) },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch (error) {
      console.error("D1 products error:", error);
      return json(
        { ok: false, error: "DATABASE_UNAVAILABLE", detail: String(error?.message || error) },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }


  if (url.pathname === "/api/contact" && request.method === "POST") {
    try { return await publicContact(request, env); }
    catch (error) { console.error("Contact error:", error); return json({ ok:false, error:"CONTACT_SEND_FAILED", message:"No se pudo enviar el mensaje. Inténtalo de nuevo." }, { status:500 }); }
  }

  if (url.pathname === "/api/checkout/create" && request.method === "POST") {
    try {
      return await createStripeCheckout(request, env, url);
    } catch (error) {
      console.error("Stripe checkout create error:", error);
      return json({ ok: false, error: "STRIPE_CHECKOUT_ERROR", message: String(error?.message || error) }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
    try {
      return await handleStripeWebhook(request, env);
    } catch (error) {
      console.error("Stripe webhook error:", error);
      return json({ ok: false, error: "WEBHOOK_PROCESSING_ERROR" }, { status: 500 });
    }
  }

  if (url.pathname === "/api/order-status" && request.method === "POST") {
    try {
      return await publicOrderStatus(request, env);
    } catch (error) {
      return json({ ok: false, error: "BAD_REQUEST", message: String(error?.message || error) }, { status: 400 });
    }
  }

  return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

async function handleMedia(request, env, url) {
  if (!env.PRODUCT_IMAGES) return new Response("R2 not configured", { status: 503 });
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const encoded = url.pathname.slice("/media/".length);
  if (!encoded) return new Response("Not Found", { status: 404 });

  let key;
  try {
    key = encoded.split("/").map(part => decodeURIComponent(part)).join("/");
  } catch (_) {
    return new Response("Bad Request", { status: 400 });
  }

  const object = request.method === "HEAD"
    ? await env.PRODUCT_IMAGES.head(key)
    : await env.PRODUCT_IMAGES.get(key);
  if (!object) return new Response("Not Found", { status: 404 });

  if (request.headers.get("If-None-Match") === object.httpEtag) {
    return new Response(null, { status: 304, headers: { ETag: object.httpEtag } });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/media/")) return await handleMedia(request, env, url);
      if (url.pathname.startsWith("/api/admin/")) return await handleAdminApi(request, env, url);
      if (url.pathname.startsWith("/api/")) return await handlePublicApi(request, env, url);
      if (url.pathname === "/robots.txt") return await serveRobots(env, url);
      if (url.pathname === "/sitemap.xml") return await serveSitemap(env, url);

      const productPath = url.pathname.match(/^\/producto\/([^/]+)\/?$/);
      if (productPath && request.method === "GET") {
        const product = await findPublicProduct(env, decodeURIComponent(productPath[1]), false);
        if (!product) return new Response("Producto no encontrado", { status:404, headers:{"Content-Type":"text/plain; charset=utf-8"} });
        return await renderProductSeo(request, env, url, product);
      }
      if (url.pathname === "/producto.html" && request.method === "GET") {
        const legacyId=url.searchParams.get("id");
        if(legacyId){
          const product=await findPublicProduct(env,legacyId,true);
          if(product) return Response.redirect(`${url.origin}/producto/${encodeURIComponent(product.slug)}`,301);
        }
        return Response.redirect(`${url.origin}/tienda.html`,302);
      }
      return await serveAssetWithSeo(request, env, url);
    } catch (error) {
      console.error("Worker error:", error);
      return json({ ok:false, error:"SERVER_ERROR", message:String(error?.message || error) }, { status:500, headers:{"Cache-Control":"no-store"} });
    }
  }
};
