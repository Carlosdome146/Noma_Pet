export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT id, slug, name, short_desc, description, category, tag, emoji,
             price_cents, currency, stock_mode, stock_qty, image_url
      FROM products
      WHERE published = 1
      ORDER BY sort_order ASC, name ASC
    `).all();

    const products = (results || []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      desc: p.short_desc,
      description: p.description,
      cat: p.category,
      tag: p.tag,
      emoji: p.emoji,
      price: p.price_cents / 100,
      currency: p.currency,
      stockMode: p.stock_mode,
      stockQty: p.stock_qty,
      imageUrl: p.image_url
    }));

    return Response.json(
      { ok: true, products },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: 'DATABASE_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' }
    });
  }
  return onRequestGet(context);
}
