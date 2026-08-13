# NÓMA PET — prototipo de e-commerce dropshipping

Marca provisional y catálogo inicial orientado a accesorios funcionales para mascotas.

## Abrir
Abre `index.html` en un navegador. El carrito funciona con `localStorage` y no procesa pagos.

## Páginas incluidas
- Inicio
- Tienda con filtros
- Ficha de producto dinámica
- Carrito local
- Seguimiento demo
- Contacto demo
- Envíos/devoluciones
- Aviso legal, privacidad y cookies (marcadores, no textos definitivos)
- `/admin/` demo

## Fase real prevista
1. Confirmar nombre y dominio.
2. Elegir proveedor y SKU exactos con almacén UE.
3. Pedir/validar muestras de los productos principales.
4. Guardar catálogo y pedidos en Cloudflare D1.
5. Guardar imágenes en R2.
6. Crear Cloudflare Worker/API para productos, pedidos y admin.
7. Integrar Stripe Checkout.
8. Añadir webhook de Stripe para confirmar pagos y crear pedido.
9. Conectar fulfillment del proveedor (API si existe; manual al principio si no).
10. Completar textos legales y banner de cookies con datos reales.

## Importante
Los precios actuales son de diseño. No publicar hasta calcular coste completo puesto en España: producto + envío + IVA/impuestos + comisión de pago + devoluciones + margen.
