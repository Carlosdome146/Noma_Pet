export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    // ============================================================
    // API HEALTH
    // ============================================================

    if (url.pathname === "/api/health") {

      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            "Allow": "GET"
          }
        });
      }

      try {

        const row = await env.DB
          .prepare("SELECT COUNT(*) AS total FROM products")
          .first();

        return Response.json(
          {
            ok: true,
            database: "connected",
            products: Number(row?.total || 0)
          },
          {
            headers: {
              "Cache-Control": "no-store"
            }
          }
        );

      } catch (error) {

        console.error("D1 health error:", error);

        return Response.json(
          {
            ok: false,
            database: "disconnected",
            error: String(error)
          },
          {
            status: 503,
            headers: {
              "Cache-Control": "no-store"
            }
          }
        );
      }
    }


    // ============================================================
    // API PRODUCTOS
    // ============================================================

    if (url.pathname === "/api/products") {

      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            "Allow": "GET"
          }
        });
      }

      try {

        const { results } = await env.DB.prepare(`
          SELECT
            id,
            slug,
            name,
            short_desc,
            description,
            category,
            tag,
            emoji,
            price_cents,
            currency,
            stock_mode,
            stock_qty,
            image_url
          FROM products
          WHERE published = 1
          ORDER BY sort_order ASC, name ASC
        `).all();


        const products = (results || []).map(product => ({

          id: product.id,

          slug: product.slug,

          name: product.name,

          desc: product.short_desc,

          description: product.description,

          cat: product.category,

          tag: product.tag,

          emoji: product.emoji,

          price: product.price_cents / 100,

          currency: product.currency,

          stockMode: product.stock_mode,

          stockQty: product.stock_qty,

          imageUrl: product.image_url

        }));


        return Response.json(
          {
            ok: true,
            products
          },
          {
            headers: {
              "Cache-Control": "public, max-age=60"
            }
          }
        );


      } catch (error) {

        console.error("D1 products error:", error);

        return Response.json(
          {
            ok: false,
            error: "DATABASE_UNAVAILABLE",
            detail: String(error)
          },
          {
            status: 503,
            headers: {
              "Cache-Control": "no-store"
            }
          }
        );
      }
    }


    // ============================================================
    // API NO ENCONTRADA
    // ============================================================

    if (url.pathname.startsWith("/api/")) {

      return Response.json(
        {
          ok: false,
          error: "NOT_FOUND"
        },
        {
          status: 404
        }
      );
    }


    // ============================================================
    // WEB ESTÁTICA
    // ============================================================

    return env.ASSETS.fetch(request);

  }

};
