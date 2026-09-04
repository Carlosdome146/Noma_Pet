# NÓMA PET · Fase 11

Repositorio completo de NÓMA PET con **fulfillment CJ/QKsource en Sandbox**.

Conserva todo lo anterior: Worker + D1 + R2 + variantes + Stripe TEST + pedidos + tracking + Resend + política de envíos + SEO de prelanzamiento.

## Nuevo flujo

```text
Cliente → Stripe TEST → Pedido D1 pagado
                         ↓
                  Admin de pedidos
                         ↓
                  Comprobar CJ
              SKU → VID + logística
                         ↓
              Crear pedido CJ Sandbox
                         ↓
              Simular pago / envío
                         ↓
                    Sincronizar
                         ↓
                Tracking / estado D1
                         ↓
                 Email transaccional
```

## Configuración nueva

Añadir como Secret de runtime en Cloudflare:

`CJ_API_KEY`

`wrangler.jsonc` mantiene:

```json
"CJ_MODE": "sandbox"
```

No se realizan cargos ni fulfillment real en modo sandbox.

Lee `INSTRUCCIONES-FASE11.txt` antes de probar.
