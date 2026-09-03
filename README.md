# NÓMA PET — Fase 10 · Prelanzamiento técnico

Repositorio completo basado en la Fase 9 validada.

## Qué incluye

- Cloudflare Worker + Static Assets
- D1 (`nomapet-db`) y variantes
- R2 (`nomapet-images`)
- Admin y pedidos
- Stripe TEST funcionando, con soporte LIVE preparado pero bloqueado por `STRIPE_MODE=test`
- Resend y emails transaccionales
- Formulario de contacto real mediante Resend
- Envío 3,90 € / gratis desde 39,90 €
- SEO técnico y URLs limpias de producto
- Sitemap XML dinámico
- robots.txt dinámico
- Open Graph / Twitter cards
- Datos estructurados `Product` + `Offer` generados en servidor para las fichas
- Favicon, iconos PWA y `manifest.webmanifest`
- `keep_vars: true` y validación de Secrets obligatorios antes de desplegar

## Variables/Secrets que ya deben existir en Cloudflare

Secrets requeridos:
- `ADMIN_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_TEST_RECIPIENT`

Opcionales más adelante:
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `CONTACT_TO`

No escribas ninguno de esos valores en GitHub.

## Stripe

El `wrangler.jsonc` contiene:

```json
"STRIPE_MODE": "test"
```

Por tanto, aunque el código ya soporta LIVE, esta fase continúa en TEST y exige claves `sk_test_...`.

Cuando llegue el lanzamiento real se hará conscientemente:
1. Stripe LIVE + webhook LIVE.
2. Sustituir Secrets por `sk_live_...` y el nuevo `whsec_...`.
3. Cambiar `STRIPE_MODE` a `live`.
4. Desplegar y probar una compra real controlada.

## SEO / dominio

Mientras seguimos usando `workers.dev`, el `wrangler.jsonc` contiene:

```json
"SEO_INDEXING_ENABLED": "false"
```

El Worker devuelve `X-Robots-Tag: noindex, nofollow` a las páginas públicas para evitar que la URL temporal se indexe.

Cuando conectemos el dominio definitivo:
1. Cambiar `SEO_INDEXING_ENABLED` a `true`.
2. Hacer deploy.
3. El sitemap y las canonicals usarán automáticamente el dominio desde el que se recibe la petición.
4. Enviar `/sitemap.xml` a Search Console.

El carrito, checkout, seguimiento, confirmación y `/admin/` permanecen noindex incluso en producción.

## URLs de producto

Ahora las fichas usan:

```text
/producto/slug-del-producto
```

Las antiguas URLs:

```text
/producto.html?id=...
```

se redirigen automáticamente (301) a la URL limpia.

## Contacto

`/contacto.html` ya no es una demo.

En modo Resend TEST, los mensajes llegan a `EMAIL_TEST_RECIPIENT`.
Cuando tengamos dominio, se puede configurar `CONTACT_TO` y un `EMAIL_FROM` verificado.

Existe limitación básica de 3 mensajes por email/hora y honeypot antispam.

## Comprobaciones tras desplegar

1. `/api/health`
   - `database: connected`
   - `r2: true`
   - `stripe: true`
   - `stripeMode: test`
   - `email: true`
   - `seoIndexing: false`

2. `/tienda.html`
   - solo los 4 productos de D1; ya no existe catálogo demo de fallback.

3. Abre un producto.
   - la URL debe ser `/producto/<slug>`.
   - variantes, fotos y carrito siguen funcionando.

4. `/sitemap.xml`
   - debe incluir las URLs de los productos publicados.

5. `/robots.txt`
   - debe apuntar al sitemap.

6. `/contacto.html`
   - envía un mensaje y comprueba que llega vía Resend.

7. Stripe TEST
   - una compra con 4242 debe seguir funcionando como antes.

## Importante antes del lanzamiento

Todavía faltan los datos identificativos reales del vendedor en las páginas legales y el dominio definitivo. No activar Stripe LIVE ni `SEO_INDEXING_ENABLED=true` hasta cerrar esos dos puntos.
