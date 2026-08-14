const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
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
    imageUrl: p.image_url
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

function makeStripeTestPublicCode() {
  return datedPublicCode("SNP");
}

function isTestOrderId(orderId) {
  const id = String(orderId || "");
  return id.startsWith("test_") || id.startsWith("stripe_test_");
}

function isStripeTestOrderId(orderId) {
  return String(orderId || "").startsWith("stripe_test_");
}

function stripeTestConfigured(env) {
  return Boolean(
    typeof env.STRIPE_SECRET_KEY === "string" &&
    env.STRIPE_SECRET_KEY.startsWith("sk_test_") &&
    typeof env.STRIPE_WEBHOOK_SECRET === "string" &&
    env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
  );
}

async function ensureOrderSchema(env) {
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
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id, created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_email_code ON orders (customer_email, public_code)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders (stripe_checkout_session_id)`)
  ]);
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
  const normalized = [];
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const id = cleanText(raw?.id, 120);
    const quantity = safeQuantity(raw?.qty);
    if (!id || quantity < 1) continue;
    const hit = normalized.find(x => x.id === id);
    if (hit) hit.quantity = Math.min(20, hit.quantity + quantity);
    else normalized.push({ id, quantity });
  }

  if (!normalized.length) throw new Error("El carrito está vacío.");
  if (normalized.length > 20) throw new Error("El carrito contiene demasiados productos.");

  const statements = normalized.map(item => env.DB.prepare(`
    SELECT
      p.id, p.name, p.price_cents, p.currency, p.published,
      p.stock_mode, p.stock_qty,
      s.supplier, s.supplier_sku
    FROM products p
    LEFT JOIN product_sources s
      ON s.id = (
        SELECT MIN(s2.id)
        FROM product_sources s2
        WHERE s2.product_id = p.id
      )
    WHERE p.id = ?
    LIMIT 1
  `).bind(item.id));

  const results = await env.DB.batch(statements);
  const resolved = [];

  for (let i = 0; i < normalized.length; i++) {
    const item = normalized[i];
    const row = results[i]?.results?.[0];
    if (!row || Number(row.published) !== 1) {
      throw new Error("Uno de los productos ya no está disponible.");
    }
    if (row.stock_mode === "finite" && Number(row.stock_qty || 0) < item.quantity) {
      throw new Error(`No hay suficientes unidades de “${row.name}”.`);
    }
    resolved.push({
      productId: row.id,
      productName: row.name,
      quantity: item.quantity,
      unitPriceCents: Number(row.price_cents || 0),
      currency: row.currency || "EUR",
      supplier: row.supplier || null,
      supplierSku: row.supplier_sku || null
    });
  }

  const currency = resolved[0]?.currency || "EUR";
  if (resolved.some(x => x.currency !== currency)) {
    throw new Error("No se pueden mezclar monedas distintas en un mismo pedido.");
  }

  return {
    items: resolved,
    currency,
    totalCents: resolved.reduce((sum, x) => sum + x.unitPriceCents * x.quantity, 0)
  };
}

function orderInsertStatements(env, { orderId, publicCode, customer, cart, paymentStatus, eventType, eventMessage }) {
  return [
    env.DB.prepare(`
      INSERT INTO orders (
        id, public_code, customer_email, customer_name,
        total_cents, currency, payment_status, fulfillment_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      orderId, publicCode, customer.email, customer.name,
      cart.totalCents, cart.currency, paymentStatus
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
        order_id, product_id, product_name, quantity, unit_price_cents,
        supplier, supplier_sku
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, item.productId, item.productName, item.quantity,
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
      [`line_items[${index}][price_data][product_data][name]`, item.productName],
      [`line_items[${index}][price_data][unit_amount]`, item.unitPriceCents],
      [`line_items[${index}][quantity]`, item.quantity]
    );
  });

  return stripeApiPost(env, "/checkout/sessions", params);
}

async function cleanupFailedStripeOrder(env, orderId) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM order_events WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM order_addresses WHERE order_id = ?").bind(orderId),
    env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(orderId)
  ]);
}

async function createStripeCheckout(request, env, url) {
  if (!stripeTestConfigured(env)) {
    return json({
      ok: false,
      error: "STRIPE_TEST_NOT_CONFIGURED",
      message: "Stripe TEST no está completamente configurado. Faltan STRIPE_SECRET_KEY y/o STRIPE_WEBHOOK_SECRET."
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  await ensureOrderSchema(env);
  const body = await readJson(request);
  const customer = cleanCustomer(body);
  const cart = await resolveOrderItems(env, body.items);
  const orderId = `stripe_test_${crypto.randomUUID()}`;
  const publicCode = makeStripeTestPublicCode();

  await env.DB.batch(orderInsertStatements(env, {
    orderId,
    publicCode,
    customer,
    cart,
    paymentStatus: "pending",
    eventType: "stripe_checkout_requested",
    eventMessage: "Checkout Stripe TEST solicitado. Pendiente de pago y confirmación por webhook."
  }));

  try {
    const session = await createStripeSession(env, url.origin, customer, cart, orderId, publicCode);
    if (!session?.id || !session?.url || session.livemode !== false) {
      throw new Error("Stripe no devolvió una sesión TEST válida.");
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
      `).bind(orderId, `Sesión Stripe TEST creada: ${session.id}`)
    ]);

    return json({
      ok: true,
      checkoutUrl: session.url,
      order: {
        id: orderId,
        publicCode,
        total: cart.totalCents / 100,
        currency: cart.currency,
        paymentStatus: "pending",
        fulfillmentStatus: "pending",
        test: true,
        stripeTest: true
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

async function applyStripeSessionEvent(env, eventType, session) {
  const orderId = cleanText(session?.metadata?.order_id || session?.client_reference_id, 160);
  if (!orderId) return;

  const order = await env.DB.prepare(`
    SELECT id, total_cents, currency, payment_status
    FROM orders
    WHERE id = ?
    LIMIT 1
  `).bind(orderId).first();
  if (!order) return;

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
      await addOrderEvent(env, orderId, "stripe_paid", "Pago confirmado por webhook firmado de Stripe TEST.");
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
    await addOrderEvent(env, orderId, "stripe_expired", "La sesión Stripe TEST expiró sin pago confirmado.");
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
  if (event.livemode !== false) {
    return json({ ok: false, error: "LIVE_EVENT_REJECTED", message: "Esta fase solo acepta eventos Stripe TEST." }, { status: 400 });
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
    await applyStripeSessionEvent(env, event.type, event.data?.object || {});
  }

  await env.DB.prepare(`
    INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type)
    VALUES (?, ?)
  `).bind(event.id, event.type).run();

  return json({ ok: true, received: event.type });
}

async function listAdminOrders(env) {
  await ensureOrderSchema(env);
  const { results } = await env.DB.prepare(`
    SELECT
      o.id, o.public_code, o.customer_email, o.customer_name,
      o.total_cents, o.currency, o.payment_status, o.fulfillment_status,
      o.tracking_code, o.tracking_url, o.stripe_checkout_session_id,
      o.created_at, o.updated_at,
      a.city, a.province, a.country,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
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

  const [itemsResult, eventsResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT id, product_id, product_name, quantity, unit_price_cents,
             supplier, supplier_sku
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `).bind(orderId),
    env.DB.prepare(`
      SELECT id, event_type, message, created_at
      FROM order_events
      WHERE order_id = ?
      ORDER BY created_at DESC, id DESC
    `).bind(orderId)
  ]);

  return {
    id: order.id,
    publicCode: order.public_code,
    customerEmail: order.customer_email || "",
    customerName: order.customer_name || "",
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
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price_cents || 0) / 100,
      supplier: item.supplier || "",
      supplierSku: item.supplier_sku || ""
    })),
    events: (eventsResult.results || []).map(event => ({
      id: Number(event.id),
      type: event.event_type,
      message: event.message || "",
      createdAt: event.created_at
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

  const current = await env.DB.prepare(`
    SELECT id, fulfillment_status FROM orders WHERE id = ? LIMIT 1
  `).bind(orderId).first();
  if (!current) {
    return json({ ok: false, error: "NOT_FOUND", message: "Pedido no encontrado." }, { status: 404 });
  }

  const statements = [
    env.DB.prepare(`
      UPDATE orders
      SET fulfillment_status = ?, tracking_code = ?, tracking_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(fulfillmentStatus, trackingCode, trackingUrl, orderId)
  ];

  if (current.fulfillment_status !== fulfillmentStatus) {
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
  return json({ ok: true, order: await getAdminOrder(env, orderId) }, { headers: { "Cache-Control": "no-store" } });
}

async function deleteTestOrder(env, orderId) {
  await ensureOrderSchema(env);
  if (!isTestOrderId(orderId)) {
    return json({ ok: false, error: "FORBIDDEN", message: "Solo se pueden borrar pedidos de prueba." }, { status: 403 });
  }
  await env.DB.batch([
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
    SELECT product_name, quantity, unit_price_cents
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
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price_cents || 0) / 100
      }))
    }
  }, { headers: { "Cache-Control": "no-store" } });
}


async function handleAdminApi(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (url.pathname === "/api/admin/session" && request.method === "GET") {
    return json({ ok: true, r2: Boolean(env.PRODUCT_IMAGES) }, { headers: { "Cache-Control": "no-store" } });
  }

  if (url.pathname === "/api/admin/orders/test" && request.method === "POST") {
    return createTestOrder(request, env);
  }

  if (url.pathname === "/api/admin/orders" && request.method === "GET") {
    return json({ ok: true, orders: await listAdminOrders(env) }, { headers: { "Cache-Control": "no-store" } });
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
      { ok: true, products: await attachImages(env, results || [], mapAdminProduct) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (url.pathname === base && request.method === "POST") {
    const body = await readJson(request);
    const p = productPayload(body);
    const source = sourcePayload(body);

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

async function handlePublicApi(request, env, url) {
  if (url.pathname === "/api/health") {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
    try {
      const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM products").first();
      return json(
        { ok: true, database: "connected", products: Number(row?.total || 0), r2: Boolean(env.PRODUCT_IMAGES), orders: true, stripe: stripeTestConfigured(env), stripeMode: stripeTestConfigured(env) ? "test" : "disabled" },
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
          id, slug, name, short_desc, description, category, tag, emoji,
          price_cents, currency, stock_mode, stock_qty, image_url
        FROM products
        WHERE published = 1
        ORDER BY sort_order ASC, name ASC
      `).all();
      return json(
        { ok: true, products: await attachImages(env, results || [], mapPublicProduct) },
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
      if (url.pathname.startsWith("/media/")) {
        return await handleMedia(request, env, url);
      }

      if (url.pathname.startsWith("/api/admin/")) {
        return await handleAdminApi(request, env, url);
      }

      if (url.pathname.startsWith("/api/")) {
        return await handlePublicApi(request, env, url);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker error:", error);
      return json(
        { ok: false, error: "SERVER_ERROR", message: String(error?.message || error) },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
  }
};
