export async function onRequestGet(context) {
  try {
    const row = await context.env.DB.prepare('SELECT COUNT(*) AS total FROM products').first();
    return Response.json({ ok: true, database: 'connected', products: Number(row?.total || 0) }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    return Response.json({ ok: false, database: 'disconnected' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
