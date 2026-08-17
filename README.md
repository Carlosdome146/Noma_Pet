# NÓMA PET — Fase 7: variantes

Repositorio completo actualizado sobre la Fase 6.

## Incluye

- Cloudflare Worker + Static Assets
- D1 (`nomapet-db`)
- R2 (`nomapet-images`)
- `/admin` protegido con `ADMIN_TOKEN`
- Catálogo, imágenes y proveedores
- Pedidos + seguimiento
- Stripe TEST + webhook firmado
- **Variantes por producto**

## Variantes

La tabla `product_variants` permite guardar PVP, SKU, costes, peso, almacén, stock, plazo de envío, homologación y publicación por variante.

La tienda, carrito, checkout, Stripe y pedidos entienden ahora `product + variant` como una línea de compra independiente.

## Migración

No hace falta ejecutar `schema.sql` sobre la D1 existente. El Worker ejecuta una migración idempotente al arrancar las rutas de API:

- `CREATE TABLE IF NOT EXISTS product_variants ...`
- añade `variant_id` y `variant_name` a `order_items` únicamente si faltan.

Para una instalación desde cero, `schema.sql` ya contiene el esquema actualizado.

## Cloudflare

Se mantiene la configuración ya operativa:

- Deploy: `npx wrangler deploy`
- D1 binding: `DB`
- R2 binding: `PRODUCT_IMAGES`
- Secrets: `ADMIN_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Comprobación

Tras desplegar:

1. `/api/health` debe seguir mostrando D1/R2/Stripe correctos y añade `variants`.
2. `/admin/` debe mostrar la sección **Variantes** en el formulario de producto.
3. Crea dos variantes de prueba y verifica carrito + Stripe TEST + pedido.

Después ya podemos homologar NÓMA Walk 10 ft y 16 ft.
