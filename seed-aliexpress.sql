-- ==============================================================================
-- NÓMA PET · CATÁLOGO DE PRODUCTOS GANADORES DE ALIEXPRESS (CHOICE ESPAÑA)
-- ==============================================================================
-- Ejecutar en Cloudflare D1:
-- Dashboard Cloudflare > Workers & Pages > D1 SQL Database > nomapet-db > Console
-- ==============================================================================

-- 1. Insertar / Actualizar Productos de AliExpress en el catálogo público
INSERT OR REPLACE INTO products (
  id, slug, name, short_desc, description, category, tag, emoji, price_cents, currency, published, sort_order, stock_mode, image_url
) VALUES
(
  'cortaunas_led',
  'cortaunas-seguro-luz-led-lupa',
  'Cortauñas seguro con luz LED y lupa de precisión',
  'Ilumina la línea viva de la uña para evitar cortes dolorosos y sangrado. Con lima oculta y recogedor.',
  'El accesorio indispensable para el cuidado en casa sin miedo ni estrés. Equipado con luz LED frontal de alta intensidad que ilumina la vena viva de la uña (quick) para garantizar un corte 100% seguro. Cuchillas de acero inoxidable quirúrgico, lupa de 5x para máxima precisión y depósito transparente que recoge las uñas cortadas para no manchar.',
  'limpieza',
  'ALIEXPRESS TOP',
  '✂️',
  1890,
  'EUR',
  1,
  10,
  'supplier',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80'
),
(
  'alfombra_olfativa',
  'alfombra-olfativa-estimulacion-antiestres',
  'Alfombra olfativa de estimulación mental y antiestrés',
  '10 minutos de olfateo equivalen a 1 hora de ejercicio. Reduce la hiperactividad y el aburrimiento.',
  'Recomendada por veterinarios y adiestradores caninos. Permite esconder premios y pienso entre sus pliegues de fieltro ecológico suave y lavable. Estimula el instinto natural de rastreo, reduce la ansiedad por separación y frena a los perros que comen demasiado rápido.',
  'hogar',
  'CHOICE 7 DÍAS',
  '🧩',
  2490,
  'EUR',
  1,
  20,
  'supplier',
  'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&q=80'
),
(
  'comedero_laberinto',
  'comedero-antivoracidad-laberinto-3d',
  'Comedero antivoracidad interactivo con laberinto 3D',
  'Multiplica por 5 el tiempo de comida. Previene atragantamientos, gases y torsión de estómago.',
  'Diseñado con crestas y obstáculos curvados que obligan a tu perro a comer despacio y masticar de forma adecuada. Base con gomas antideslizantes para que no se desplace por el suelo. Fabricado en polipropileno libre de BPA y apto para lavavajillas.',
  'hogar',
  'SALUD DIGESTIVA',
  '🥣',
  1890,
  'EUR',
  1,
  30,
  'supplier',
  'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&q=80'
),
(
  'dispensador_linterna',
  'dispensador-bolsas-paseo-linterna-led',
  'Dispensador de bolsas de paseo con linterna LED nocturna',
  'Luz LED de alta potencia para ver en la oscuridad durante los paseos nocturnos de invierno.',
  'Combina un dispensador hermético para rollos de bolsas higiénicas con una linterna LED de largo alcance. Incluye mosquetón metálico para fijar a cualquier correa y 3 rollos de bolsas biodegradables. Olvídate de buscar con el móvil en la oscuridad.',
  'paseo',
  'NOCTURNO',
  '🔦',
  1490,
  'EUR',
  1,
  40,
  'supplier',
  'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=800&q=80'
),
(
  'cinturon_elastico',
  'cinturon-seguridad-coche-amortiguacion',
  'Cinturón de seguridad con amortiguación elástica para coche',
  'Cumple la normativa DGT. El tramo elástico absorbe los frenazos bruscos protegiendo a tu perro.',
  'Anclaje universal de acero inoxidable compatible con todos los vehículos. Cuenta con un tramo amortiguador de nylon elástico de alta tenacidad que absorbe la fuerza de frenado repentino y mosquetón giratorio 360° que evita que la correa se enrede.',
  'viaje',
  'SEGURIDAD DGT',
  '🚗',
  1590,
  'EUR',
  1,
  50,
  'supplier',
  'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=800&q=80'
),
(
  'garantia_envio',
  'garantia-envio-protegido',
  'Garantía de Envío Protegido y Prioritario',
  'Protección total contra pérdida, rotura o extravío en transporte con reemplazo prioritario express.',
  'Garantiza la entrega segura de tu pedido. Si tu paquete sufre cualquier percance durante el transporte (rotura, extravío, robo o retraso excesivo), te enviamos un reemplazo inmediato prioritario sin esperas ni trámites burocráticos.',
  'servicios',
  'GARANTÍA VIP',
  '🛡️',
  199,
  'EUR',
  1,
  998,
  'unlimited',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80'
),
(
  'cepillo_quitapelos',
  'rodillo-quitapelos-reutilizable',
  'Rodillo Quitapelos Lavable Reutilizable NÓMA',
  'Elimina pelos y pelusas al 100% de sofás, ropa, mantas y alfombras en una sola pasada.',
  'El compañero imprescindible en cualquier hogar con mascotas. Atrapa el pelo muerto incrustado en tejidos mediante atracción estática sin recambios adhesivos desechables. Fácil de vaciar y lavar con agua. Duradero y ecológico.',
  'limpieza',
  'OFERTA FLASH',
  '✨',
  499,
  'EUR',
  1,
  999,
  'supplier',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80'
);

-- 2. Vincular los datos de proveedor de AliExpress, costes, tiempos y URLs directas
DELETE FROM product_sources WHERE product_id IN (
  'cortaunas_led', 'alfombra_olfativa', 'comedero_laberinto', 'dispensador_linterna', 'cinturon_elastico',
  'garantia_envio', 'cepillo_quitapelos'
);

INSERT INTO product_sources (
  product_id, supplier, supplier_sku, supplier_url,
  product_cost_cents, shipping_cost_cents, cost_currency,
  warehouse, stock_status, shipping_days_min, shipping_days_max,
  compliance_status, notes, checked_at
) VALUES
(
  'cortaunas_led',
  'AliExpress',
  'AE-NAIL-LED-01',
  'https://es.aliexpress.com/w/wholesale-cortau%C3%B1as-perro-led.html?SearchText=cortau%C3%B1as+perro+led',
  280,
  190,
  'EUR',
  'AliExpress Choice (España)',
  'in_stock',
  5,
  9,
  'approved',
  'Coste 2.80 € + Envío 1.90 € = 4.70 €. PVP 18.90 € (+3.90 € envío) = 22.80 €. Margen limpio: 17.51 € (76.8%).',
  '2026-09-15'
),
(
  'alfombra_olfativa',
  'AliExpress',
  'AE-SNUFFLE-02',
  'https://es.aliexpress.com/w/wholesale-snuffle-mat-dog.html?SearchText=snuffle+mat+dog',
  420,
  190,
  'EUR',
  'AliExpress Choice (España)',
  'in_stock',
  6,
  10,
  'approved',
  'Coste 4.20 € + Envío 1.90 € = 6.10 €. PVP 24.90 € (+3.90 € envío) = 28.80 €. Margen limpio: 22.02 € (76.4%).',
  '2026-09-15'
),
(
  'comedero_laberinto',
  'AliExpress',
  'AE-SLOWFEED-03',
  'https://es.aliexpress.com/w/wholesale-slow-feeder-bowl-dog.html?SearchText=slow+feeder+bowl+dog',
  250,
  180,
  'EUR',
  'AliExpress Choice (España)',
  'in_stock',
  5,
  9,
  'approved',
  'Coste 2.50 € + Envío 1.80 € = 4.30 €. PVP 18.90 € (+3.90 € envío) = 22.80 €. Margen limpio: 17.91 € (78.5%).',
  '2026-09-15'
),
(
  'dispensador_linterna',
  'AliExpress',
  'AE-TORCH-BAG-04',
  'https://es.aliexpress.com/w/wholesale-dispensador-bolsas-perro-linterna.html?SearchText=dispensador+bolsas+perro+linterna',
  190,
  180,
  'EUR',
  'AliExpress Choice (España)',
  'in_stock',
  5,
  9,
  'approved',
  'Coste 1.90 € + Envío 1.80 € = 3.70 €. PVP 14.90 € (+3.90 € envío) = 18.80 €. Margen limpio: 14.57 € (77.5%).',
  '2026-09-15'
),
(
  'cinturon_elastico',
  'AliExpress',
  'AE-SEATBELT-05',
  'https://es.aliexpress.com/w/wholesale-cinturon-seguridad-perro-coche-elastico.html?SearchText=cinturon+seguridad+perro+coche+elastico',
  180,
  180,
  'EUR',
  'AliExpress Choice (España)',
  'in_stock',
  5,
  8,
  'approved',
  'Coste 1.80 € + Envío 1.80 € = 3.60 €. PVP 15.90 € (+3.90 € envío) = 19.80 €. Margen limpio: 15.65 € (79.0%).',
  '2026-09-15'
),
(
  'garantia_envio',
  'NÓMA Care',
  'NOMA-WAR-VIP',
  'https://nomapet.com',
  10,
  0,
  'EUR',
  'Digital / Inmediato',
  'in_stock',
  0,
  0,
  'approved',
  'Garantía VIP de sustitución prioritaria express sin trámites. Margen 95%.',
  '2026-09-24'
),
(
  'cepillo_quitapelos',
  'AliExpress',
  'AE-ROLLER-HAIR',
  'https://es.aliexpress.com/w/wholesale-rodillo-quitapelos-perro.html?SearchText=rodillo+quitapelos+perro',
  120,
  0,
  'EUR',
  'AliExpress Choice (España)',
  'in_stock',
  5,
  9,
  'approved',
  'Coste 1.20 € + Envío 0 € (conjunto). PVP 4.99 €. Margen limpio: 3.60 € (72.1%).',
  '2026-09-24'
);
