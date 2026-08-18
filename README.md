# NÓMA PET · Fase 8

Repositorio completo actual de NÓMA PET.

## Incluye

- Cloudflare Worker + Static Assets
- D1 (`nomapet-db`)
- R2 (`nomapet-images`)
- Admin de productos y variantes
- Pedidos y seguimiento
- Stripe Checkout TEST + webhook firmado
- Emails transaccionales con Resend
- Historial de emails por pedido

## Emails

Variables/runtime disponibles:

- `RESEND_API_KEY` — Secret
- `EMAIL_TEST_RECIPIENT` — modo prueba sin dominio
- `EMAIL_FROM` — remitente con dominio verificado para producción
- `EMAIL_REPLY_TO` — opcional

Si existe `RESEND_API_KEY` + `EMAIL_TEST_RECIPIENT` y no existe `EMAIL_FROM`, se activa `emailMode: test` y se usa `onboarding@resend.dev`.

Si existe `RESEND_API_KEY` + `EMAIL_FROM`, se activa `emailMode: domain` y se envía al cliente real. Los pedidos de prueba pueden seguir redirigiéndose a `EMAIL_TEST_RECIPIENT` si está configurado.

## Emails automáticos

1. Pago confirmado por webhook de Stripe → `confirmation`
2. Pedido marcado como enviado → `shipped`
3. Pedido marcado como entregado → `delivered`

El admin permite reenviar manualmente el email correspondiente al estado actual.

## Migraciones

No hay que volver a ejecutar `schema.sql` sobre una D1 ya existente. El Worker crea automáticamente `order_emails`.

## Despliegue

El proyecto mantiene:

```text
npx wrangler deploy
```

Consulta `INSTRUCCIONES-FASE8.txt` para configurar Resend paso a paso.
