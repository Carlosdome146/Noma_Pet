# NÓMA PET — Fase 6 completa · Stripe TEST

Esta versión conserva D1, R2, admin, pedidos y seguimiento, y añade Stripe Checkout en modo TEST.

## Importante

Esta fase **rechaza claves live**. `STRIPE_SECRET_KEY` debe empezar por `sk_test_`. Los pedidos creados con Stripe TEST usan IDs `stripe_test_...` y códigos públicos `SNP-...`, por lo que se pueden borrar desde el admin.

## Cloudflare

Mantén:

- D1: `nomapet-db` → binding `DB`
- R2: `nomapet-images` → binding `PRODUCT_IMAGES`
- Secret: `ADMIN_TOKEN`
- Deploy command: `npx wrangler deploy`

Añade como **Secrets de runtime** al Worker `noma-pet`:

- `STRIPE_SECRET_KEY` = tu clave secreta TEST `sk_test_...`
- `STRIPE_WEBHOOK_SECRET` = el signing secret del endpoint `whsec_...`

Nunca subas estas claves a GitHub.

## Webhook Stripe

Endpoint:

`https://TU-WORKER.workers.dev/api/stripe/webhook`

Eventos recomendados para esta fase:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Aunque Checkout está limitado a tarjeta en esta fase, el Worker soporta también los dos eventos async.

## Flujo

1. Cliente rellena `/checkout.html`.
2. `/api/checkout/create` vuelve a leer productos/precios desde D1.
3. Se crea pedido pendiente en D1.
4. Worker crea Checkout Session TEST en Stripe.
5. Cliente paga en la página alojada por Stripe.
6. Stripe llama a `/api/stripe/webhook`.
7. El Worker verifica `Stripe-Signature` sobre el body RAW con HMAC-SHA256 y tolerancia de 5 minutos.
8. Solo entonces el pedido pasa de `pending` a `paid`.
9. La página de éxito consulta D1 y espera unos segundos si el webhook aún no ha llegado.

## Prueba

Cuando `/api/health` muestre:

```json
{
  "stripe": true,
  "stripeMode": "test"
}
```

añade un producto al carrito, abre checkout y usa una tarjeta TEST de Stripe, por ejemplo `4242 4242 4242 4242`, fecha futura y cualquier CVC de 3 cifras. No uses una tarjeta real.

## No ejecutar schema.sql de nuevo

El Worker crea automáticamente `stripe_webhook_events` si falta. El `schema.sql` se incluye actualizado solo como referencia para instalaciones nuevas.
