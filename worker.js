const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

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

async function handleAdminApi(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const base = "/api/admin/products";
  const suffix = url.pathname.slice(base.length).replace(/^\//, "");
  const id = suffix ? decodeURIComponent(suffix) : "";

  if (url.pathname === "/api/admin/session" && request.method === "GET") {
    return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  if (url.pathname === base && request.method === "GET") {
    const { results } = await env.DB.prepare(`${ADMIN_LIST_SQL} ORDER BY p.sort_order ASC, p.name ASC`).all();
    return json(
      { ok: true, products: (results || []).map(mapAdminProduct) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (url.pathname === base && request.method === "POST") {
    const body = await readJson(request);
    const p = productPayload(body);
    const source = sourcePayload(body);

    const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ? OR slug = ? LIMIT 1")
      .bind(p.id, p.slug)
      .first();
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

  if (id && request.method === "PUT") {
    const current = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
    if (!current) return json({ ok: false, error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });

    const body = await readJson(request);
    const p = productPayload({ ...body, id }, id);
    const source = sourcePayload(body);

    const duplicate = await env.DB.prepare("SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1")
      .bind(p.slug, id)
      .first();
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
    const result = await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    const changed = Number(result?.meta?.changes || 0);
    if (!changed) return json({ ok: false, error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
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
        { ok: true, database: "connected", products: Number(row?.total || 0) },
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
        { ok: true, products: (results || []).map(mapPublicProduct) },
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

  return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/admin/session" || url.pathname.startsWith("/api/admin/products")) {
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
