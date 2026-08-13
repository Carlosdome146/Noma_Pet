# NÓMA PET — Fase 2: conectar Cloudflare D1

La web ya está preparada para leer el catálogo desde D1. Si D1 no está disponible, usa automáticamente los datos locales de la demo para no romper la tienda.

## 1. Crear la base de datos

En Cloudflare:

1. **Workers & Pages** → **D1 SQL database**.
2. **Create database**.
3. Nombre recomendado: `nomapet-db`.
4. Abre la base creada → **Console**.
5. Copia y ejecuta todo el contenido de `schema.sql`.

El script crea:

- `products`
- `product_sources`
- `product_images`
- `orders`
- `order_items`

Además carga los seis productos actuales de la demo.

## 2. Vincular D1 al proyecto Pages

1. Cloudflare → **Workers & Pages**.
2. Entra en tu proyecto de NÓMA PET.
3. **Settings** → **Bindings**.
4. **Add binding** → **D1 database**.
5. Variable name: `DB`
6. Selecciona: `nomapet-db`.
7. Guarda.
8. Haz un nuevo deployment (un commit mínimo en GitHub sirve).

El nombre `DB` es importante porque las Pages Functions lo esperan exactamente así.

## 3. Subir los nuevos archivos al repositorio

Añade al root del repositorio:

- `schema.sql`
- carpeta `functions/`
- el nuevo `assets/app.js`
- el nuevo `admin/index.html`

Cloudflare Pages detectará automáticamente `/functions` en el root del proyecto.

## 4. Comprobar que funciona

Tras desplegar abre:

`https://TU-DOMINIO/api/health`

Debe responder aproximadamente:

```json
{"ok":true,"database":"connected","products":6}
```

Después abre:

`https://TU-DOMINIO/api/products`

Debe devolver el catálogo en JSON.

Por último entra en:

`https://TU-DOMINIO/admin/`

El aviso inferior debe indicar que **D1 está conectado**.

## 5. Importante: todavía NO activar edición en /admin

La API pública de esta fase es deliberadamente de solo lectura. No conviene crear endpoints públicos de alta/modificación/borrado sin autenticación.

La siguiente fase será:

1. Proteger `/admin/*` y `/api/admin/*` con Cloudflare Access.
2. Crear CRUD real de productos.
3. Crear bucket R2 para imágenes.
4. Subir fotos desde el panel admin.
5. Homologar proveedor/SKU/coste/envío y publicar productos reales.
6. Integrar Stripe después.
