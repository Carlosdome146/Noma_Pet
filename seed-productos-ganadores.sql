-- ==============================================================================
-- NÓMA PET · CATÁLOGO DE PRODUCTOS GANADORES (DROPSHIPPING HIGH-MARGIN)
-- ==============================================================================
-- Ejecutar en Cloudflare D1 mediante:
-- npx wrangler d1 execute nomapet-db --file=./seed-productos-ganadores.sql --remote
-- ==============================================================================

-- 1. Insertar / Actualizar Productos Ganadores
INSERT OR REPLACE INTO products (
  id, slug, name, short_desc, description, category, tag, emoji, price_cents, currency, published, sort_order, stock_mode, image_url
) VALUES
(
  'cama_calmante',
  'cama-calmante-antiansiedad',
  'Cama calmante antiansiedad ''Donut''',
  'Borde elevado y felpa ultrasuave para aliviar el estrés y mejorar el descanso de perros y gatos.',
  'Diseño envolvente con borde elevado que aporta sensación de protección y reduce la ansiedad por separación. Relleno ergonómico de alta densidad y tejido de felpa ultrasuave lavable en lavadora. Ideal para mejorar la calidad del sueño de perros y gatos.',
  'hogar',
  'TOP VENTAS',
  '🛏️',
  3490,
  'EUR',
  1,
  10,
  'supplier',
  NULL
),
(
  'cepillo_vapor',
  'cepillo-aseo-nanovapor-3-en-1',
  'Cepillo de aseo a nanovapor 3 en 1',
  'Elimina el 99% del pelo muerto con tecnología de vapor suave sin tirones ni electricidad estática.',
  'La solución definitiva contra el exceso de pelo en casa. Su difusor de nanovapor atrapa el pelo suelto mientras desenreda y masajea la piel de tu mascota. Batería recargable USB y depósito para agua o loción desenredante.',
  'limpieza',
  'VIRAL TIKTOK',
  '💨',
  2190,
  'EUR',
  1,
  20,
  'supplier',
  NULL
),
(
  'arnes_antitirones',
  'arnes-antitirones-ergonomico-reflectante',
  'Arnés antitirones ergonómico reflectante',
  'Distribuye la presión en el torso sin dañar el cuello. Costuras reflectantes y asa de agarre rápido.',
  'Evita ahogos y lesiones en el cuello gracias a su diseño ergonómico que reparte la fuerza de tracción sobre el pecho. Equipado con anilla frontal antitirones, tejido transpirable acolchado, bandas reflectantes de alta visibilidad y asa superior para control inmediato.',
  'paseo',
  'RECOMENDADO',
  '🐕',
  2690,
  'EUR',
  1,
  30,
  'supplier',
  NULL
),
(
  'pelota_inteligente',
  'pelota-interactiva-inteligente-led',
  'Pelota interactiva inteligente con sensor y LED',
  'Giro 360° autónomo con sensor de obstáculos para mantener a tu mascota activa y entretenida.',
  'Juguete interactivo con sensor de movimiento inteligente que esquiva paredes y obstáculos de forma autónoma. Silicona suave no tóxica de grado alimentario, dos modos de velocidad y recarga rápida mediante USB-C. Previene el sedentarismo y la ansiedad por soledad.',
  'juguetes',
  'DIVERSIÓN',
  '🎾',
  1990,
  'EUR',
  1,
  40,
  'supplier',
  NULL
),
(
  'hammock',
  'protector-asiento-hamaca',
  'Protector de asiento tipo hamaca para coche',
  'Capa impermeable 600D resistente a arañazos, pelo y suciedad con ventana de rejilla transpirable.',
  'Mantén la tapicería de tu vehículo intacta durante cualquier viaje. Fabricado con tela Oxford impermeable y antideslizante, solapas laterales protectoras y ventana central de malla para que tu mascota no pierda el contacto visual contigo. Instalación en 60 segundos.',
  'viaje',
  'VIAJE TOP',
  '🚗',
  4490,
  'EUR',
  1,
  50,
  'supplier',
  NULL
),
(
  'bottle',
  'botella-3-en-1-paseo',
  'Botella de paseo portátil 3 en 1',
  'Bebedero hermético de 500ml, contenedor de snacks y dispensador de bolsas en un solo dispositivo.',
  'El todo en uno imprescindible para paseos y excursiones. Con botón dosificador de flujo y bloqueo antifugas que permite recuperar el agua no consumida. Incluye compartimento para premios o pienso y dispensador inferior para rollos de bolsas higiénicas.',
  'paseo',
  'ESENCIAL',
  '💧',
  2290,
  'EUR',
  1,
  60,
  'supplier',
  NULL
);

-- 2. Vincular proveedores (CJ Dropshipping) y logística de cada producto
DELETE FROM product_sources WHERE product_id IN (
  'cama_calmante', 'cepillo_vapor', 'arnes_antitirones', 'pelota_inteligente', 'hammock', 'bottle'
);

INSERT INTO product_sources (
  product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at
) VALUES
(
  'cama_calmante',
  'CJdropshipping',
  'CJGY112879401AZ',
  'https://cjdropshipping.com',
  680,
  590,
  'EUR',
  'Almacén CJ Europa / Central',
  'in_stock',
  8,
  12,
  'approved',
  'Embalaje comprimido al vacío para optimizar costes de transporte a España.',
  '2026-09-15'
),
(
  'cepillo_vapor',
  'CJdropshipping',
  'CJYD234850101AZ',
  'https://cjdropshipping.com',
  240,
  320,
  'EUR',
  'Almacén CJ Europa / Central',
  'in_stock',
  7,
  11,
  'approved',
  'Producto viral de alta rotación. Paquete ultra ligero (<150g).',
  '2026-09-15'
),
(
  'arnes_antitirones',
  'CJdropshipping',
  'CJJT189234001AZ',
  'https://cjdropshipping.com',
  370,
  390,
  'EUR',
  'Almacén CJ Europa / Central',
  'in_stock',
  8,
  12,
  'approved',
  'Arnés ergonómico reflectante de Oxford transpirable.',
  '2026-09-15'
),
(
  'pelota_inteligente',
  'CJdropshipping',
  'CJWJ154782901AZ',
  'https://cjdropshipping.com',
  280,
  290,
  'EUR',
  'Almacén CJ Europa / Central',
  'in_stock',
  7,
  12,
  'approved',
  'Batería recargable USB-C incluida. Certificación CE.',
  '2026-09-15'
),
(
  'hammock',
  'CJdropshipping',
  'CJGY111663901AZ',
  'https://cjdropshipping.com',
  630,
  920,
  'EUR',
  'Almacén CJ Europa / Central',
  'in_stock',
  8,
  14,
  'approved',
  'Protector de asiento completo para coche (~1 kg). Envío gratuito al cliente por superar 39,90 €.',
  '2026-09-15'
),
(
  'bottle',
  'CJdropshipping',
  'CJJT171012401AZ',
  'https://cjdropshipping.com',
  360,
  380,
  'EUR',
  'Almacén CJ Europa / Central',
  'in_stock',
  8,
  12,
  'approved',
  'Botella 3 en 1 con dispensador y depósito de snacks.',
  '2026-09-15'
);
