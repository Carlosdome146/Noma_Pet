# NÓMA PET — repositorio completo actual

Este ZIP contiene el proyecto completo actualizado hasta la Fase 5 (pedidos + checkout de prueba).

## Arquitectura

- Cloudflare Worker + Static Assets
- Cloudflare D1: `nomapet-db`
- D1 binding: `DB`
- Cloudflare R2: `nomapet-images`
- R2 binding: `PRODUCT_IMAGES`
- Admin protegido mediante secret de runtime: `ADMIN_TOKEN`
- Deploy command: `npx wrangler deploy`

## Estructura que debe quedar en GitHub

```text
/
├── index.html
├── tienda.html
├── producto.html
├── carrito.html
├── seguimiento.html
├── contacto.html
├── envios.html
├── aviso-legal.html
├── privacidad.html
├── cookies.html
├── schema.sql
├── worker.js
├── wrangler.jsonc
├── admin/
│   └── index.html
└── assets/
    ├── styles.css
    ├── app.js
    ├── admin.js
    ├── admin-extra.css
    ├── r2-gallery.css
    └── partials.txt
```

## Antes de desplegar

1. Debe existir la D1 `nomapet-db`.
2. Debe existir el bucket R2 `nomapet-images`.
3. El Worker debe tener el secret de runtime `ADMIN_TOKEN`.
4. Mantén el deploy command: `npx wrangler deploy`.

## wrangler.jsonc actual

- Worker: `noma-pet`
- D1 database ID: `dd15a1c4-0a74-4875-b6a7-04a136fa539a`
- D1 binding: `DB`
- R2 bucket: `nomapet-images`
- R2 binding: `PRODUCT_IMAGES`

## Comprobaciones tras el deploy

- `/api/health`
- `/api/products`
- `/admin/`
- `/tienda.html`
- abre un producto y comprueba `/producto.html?id=...`

El endpoint `/api/health` debe indicar D1 conectado y R2 disponible.

## Importante

No subas ningún ADMIN_TOKEN a GitHub. El token solo debe existir como Secret dentro del Worker en Cloudflare.


## Fase 5 — Pedidos + Checkout

Nuevos archivos:
- `checkout.html`
- `pedido-exito.html`
- `admin/pedidos.html`
- `assets/checkout.js`
- `assets/tracking.js`
- `assets/order-success.js`
- `assets/admin-orders.js`
- `assets/orders.css`

El checkout público todavía NO cobra dinero.

Para probar el circuito:
1. Entra en `/admin/`.
2. Abre `/admin/pedidos.html`.
3. Pulsa `+ Crear pedido de prueba`.
4. El enlace abre `/checkout.html?test=1`.
5. El checkout utiliza el ADMIN_TOKEN guardado en `sessionStorage`.
6. El pedido queda guardado en D1 como `test_paid`.
7. Puedes cambiar estado y tracking desde `/admin/pedidos.html`.
8. Puedes consultar el pedido desde `/seguimiento.html` usando código + email.

El Worker crea automáticamente las tablas nuevas `order_addresses` y `order_events`; no es necesario volver a ejecutar `schema.sql` en una base ya existente.
