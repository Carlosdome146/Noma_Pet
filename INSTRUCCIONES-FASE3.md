# NÓMA PET — Fase 3: Admin real conectado a D1

## Archivos
Sustituye/añade estos archivos en el repositorio:

- `worker.js` → sustituir
- `wrangler.jsonc` → sustituir (mantiene tu D1 actual)
- `admin/index.html` → sustituir
- `assets/admin.js` → nuevo
- `assets/admin-extra.css` → nuevo

## Un único cambio manual en `assets/styles.css`
Al final del archivo añade esta línea:

```css
@import url('./admin-extra.css');
```

También puedes copiar todo el contenido de `admin-extra.css` al final de `styles.css` si prefieres no usar `@import`.

## Seguridad obligatoria antes de usar el panel
El Worker NO permite escribir en D1 si no existe `ADMIN_TOKEN`.

En Cloudflare, abre el Worker `nomapet` y añade un **Secret** llamado:

`ADMIN_TOKEN`

El valor debe ser una contraseña/token largo y difícil de adivinar. No lo metas en `wrangler.jsonc` ni en GitHub.

Los secretos de Workers llegan al código como `env.ADMIN_TOKEN` y su valor queda oculto después de guardarlo.

## Uso
1. Haz commit/push de los archivos.
2. Espera al deployment con `npx wrangler deploy`.
3. Entra en `/admin/`.
4. Introduce el mismo valor de `ADMIN_TOKEN`.
5. Ya puedes crear, editar, publicar/despublicar y eliminar productos.

El token se guarda solo en `sessionStorage`: al cerrar la pestaña/sesión del navegador se elimina.

## API añadida
- `GET /api/admin/session`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`

Todas requieren `Authorization: Bearer <ADMIN_TOKEN>`.

## Base de datos
No hay que ejecutar ninguna migración SQL en esta fase: las tablas de tu `schema.sql` actual ya contienen todos los campos necesarios.
