# NÓMA PET — repositorio completo actual

Este ZIP es una reconstrucción limpia del proyecto en el estado actual.

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
