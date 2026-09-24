PRAGMA foreign_keys = ON;

-- Catálogo público
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_desc TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🐾',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  stock_mode TEXT NOT NULL DEFAULT 'supplier' CHECK (stock_mode IN ('supplier','finite','unlimited')),
  stock_qty INTEGER,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_public ON products (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category, published);

-- Fuentes/proveedores: nunca se devuelve desde la API pública.
CREATE TABLE IF NOT EXISTS product_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  supplier TEXT NOT NULL,
  supplier_sku TEXT,
  supplier_url TEXT,
  product_cost_cents INTEGER,
  shipping_cost_cents INTEGER,
  cost_currency TEXT NOT NULL DEFAULT 'EUR',
  warehouse TEXT,
  stock_status TEXT NOT NULL DEFAULT 'unknown',
  shipping_days_min INTEGER,
  shipping_days_max INTEGER,
  compliance_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  checked_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sources_product ON product_sources (product_id);

-- Variantes por producto: longitud, color, talla, etc.
-- Coste/SKU/logística pueden variar por variante.
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  supplier_sku TEXT,
  product_cost_cents INTEGER,
  shipping_cost_cents INTEGER,
  cost_currency TEXT NOT NULL DEFAULT 'EUR',
  weight_grams INTEGER,
  warehouse TEXT,
  stock_status TEXT NOT NULL DEFAULT 'unknown',
  supplier_stock_qty INTEGER,
  shipping_days_min INTEGER,
  shipping_days_max INTEGER,
  homologation_status TEXT NOT NULL DEFAULT 'pending',
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants (product_id, published, sort_order);
CREATE INDEX IF NOT EXISTS idx_variants_default ON product_variants (product_id, is_default);

-- Imágenes: preparadas para R2.
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_product ON product_images (product_id, sort_order);

-- Pedidos: se usará cuando integremos Stripe.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  public_code TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  tracking_code TEXT,
  tracking_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  variant_id TEXT,
  variant_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  supplier TEXT,
  supplier_sku TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- Semilla de la demo actual. Luego sustituiremos estos registros por los SKU homologados.
-- Semilla de productos ganadores de alta rentabilidad (NÓMA PET)
INSERT OR IGNORE INTO products
(id, slug, name, short_desc, description, category, tag, emoji, price_cents, published, sort_order)
VALUES
('cama_calmante','cama-calmante-antiansiedad','Cama calmante antiansiedad ''Donut''','Borde elevado y felpa ultrasuave para aliviar el estrés y mejorar el descanso de perros y gatos.','Diseño envolvente con borde elevado que aporta sensación de protección y reduce la ansiedad por separación. Relleno ergonómico de alta densidad y tejido de felpa ultrasuave lavable en lavadora.','hogar','TOP VENTAS','🛏️',3490,1,10),
('cepillo_vapor','cepillo-aseo-nanovapor-3-en-1','Cepillo de aseo a nanovapor 3 en 1','Elimina el 99% del pelo muerto con tecnología de vapor suave sin tirones ni electricidad estática.','La solución definitiva contra el exceso de pelo en casa. Su difusor de nanovapor atrapa el pelo suelto mientras desenreda y masajea la piel de tu mascota. Batería recargable USB.','limpieza','VIRAL TIKTOK','💨',2190,1,20),
('arnes_antitirones','arnes-antitirones-ergonomico-reflectante','Arnés antitirones ergonómico reflectante','Distribuye la presión en el torso sin dañar el cuello. Costuras reflectantes y asa de agarre rápido.','Evita ahogos y lesiones en el cuello gracias a su diseño ergonómico que reparte la fuerza de tracción sobre el pecho. Equipado con anilla frontal antitirones y bandas reflectantes.','paseo','RECOMENDADO','🐕',2690,1,30),
('pelota_inteligente','pelota-interactiva-inteligente-led','Pelota interactiva inteligente con sensor y LED','Giro 360° autónomo con sensor de obstáculos para mantener a tu mascota activa y entretenida.','Juguete interactivo con sensor de movimiento inteligente que esquiva paredes y obstáculos de forma autónoma. Silicona suave no tóxica y recarga rápida mediante USB-C.','juguetes','DIVERSIÓN','🎾',1990,1,40),
('hammock','protector-asiento-hamaca','Protector de asiento tipo hamaca para coche','Capa impermeable 600D resistente a arañazos, pelo y suciedad con ventana de rejilla transpirable.','Mantén la tapicería de tu vehículo intacta durante cualquier viaje. Fabricado con tela Oxford impermeable y antideslizante, con solapas laterales protectoras y ventana de malla.','viaje','VIAJE TOP','🚗',4490,1,50),
('bottle','botella-3-en-1-paseo','Botella de paseo portátil 3 en 1','Bebedero hermético de 500ml, contenedor de snacks y dispensador de bolsas en un solo dispositivo.','El todo en uno imprescindible para paseos y excursiones. Con botón dosificador de flujo y bloqueo antifugas que permite recuperar el agua no consumida. Incluye dispensador de bolsas.','paseo','ESENCIAL','💧',2290,1,60),
('cortaunas_led','cortaunas-seguro-luz-led-lupa','Cortauñas seguro con luz LED y lupa','Ilumina la línea viva de la uña para evitar cortes dolorosos y sangrado. Con lima oculta y recogedor.','Corte de uñas seguro sin miedo ni sangrado gracias a la luz LED integrada que ilumina la vena viva. Cuchillas de acero quirúrgico y lupa de precisión.','limpieza','ALIEXPRESS TOP','✂️',1890,1,70),
('alfombra_olfativa','alfombra-olfativa-estimulacion-antiestres','Alfombra olfativa de estimulación mental','10 minutos de olfateo equivalen a 1 hora de ejercicio. Reduce la hiperactividad y el aburrimiento.','Fieltro ecológico multicapa lavable. Estimula el olfato natural, calma la ansiedad por separación y fomenta una alimentación pausada.','hogar','CHOICE 7 DÍAS','🧩',2490,1,80),
('comedero_laberinto','comedero-antivoracidad-laberinto-3d','Comedero antivoracidad laberinto 3D','Multiplica por 5 el tiempo de comida. Previene atragantamientos, gases y torsión gástrica.','Obstáculos y laberinto curvado que frena a los perros que comen con ansiedad. Base con gomas antideslizantes. Libre de BPA.','hogar','SALUD DIGESTIVA','🥣',1890,1,90),
('dispensador_linterna','dispensador-bolsas-paseo-linterna-led','Dispensador de bolsas con linterna LED','Luz LED de alta potencia para ver en la oscuridad durante los paseos nocturnos de invierno.','Dispensador hermético con linterna LED integrada y mosquetón metálico. Incluye 3 rollos de bolsas biodegradables.','paseo','NOCTURNO','🔦',1490,1,100),
('cinturon_elastico','cinturon-seguridad-coche-amortiguacion','Cinturón de seguridad con amortiguación para coche','Cumple la normativa DGT. El tramo elástico absorbe los frenazos bruscos protegiendo a tu perro.','Anclaje universal de acero compatible con todos los coches. Tramo elástico de alta resistencia que absorbe frenazos bruscos.','viaje','SEGURIDAD DGT','🚗',1590,1,110),
('garantia_envio','garantia-envio-protegido','Garantía de Envío Protegido y Prioritario','Protección total contra pérdida, rotura o extravío en transporte con reemplazo prioritario.','Garantiza la entrega segura de tu pedido. Si tu paquete sufre cualquier percance durante el transporte (rotura, extravío, robo o retraso excesivo), te enviamos un reemplazo inmediato prioritario sin esperas.','servicios','GARANTÍA VIP','🛡️',199,1,998),
('cepillo_quitapelos','rodillo-quitapelos-reutilizable','Rodillo Quitapelos Lavable Reutilizable NÓMA','Elimina pelos y pelusas al 100% de sofás, ropa, mantas y alfombras en una sola pasada.','El compañero imprescindible en cualquier hogar con mascotas. Atrapa el pelo incrustado en tejidos mediante atracción estática sin recambios adhesivos desechables. Fácil de vaciar y lavar con agua.','limpieza','OFERTA FLASH','✨',499,1,999);

-- Proveedores y costes homologados (CJ Dropshipping)
INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'cama_calmante','CJdropshipping','CJGY112879401AZ','https://cjdropshipping.com',680,590,'EUR','Almacén CJ Europa / Central','in_stock',8,12,'approved','Embalaje comprimido al vacío para optimizar transporte.','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='cama_calmante');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'cepillo_vapor','CJdropshipping','CJYD234850101AZ','https://cjdropshipping.com',240,320,'EUR','Almacén CJ Europa / Central','in_stock',7,11,'approved','Producto viral ligero (<150g). Alta rotación.','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='cepillo_vapor');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'arnes_antitirones','CJdropshipping','CJJT189234001AZ','https://cjdropshipping.com',370,390,'EUR','Almacén CJ Europa / Central','in_stock',8,12,'approved','Arnés ergonómico Oxford reflectante transpirable.','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='arnes_antitirones');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'pelota_inteligente','CJdropshipping','CJWJ154782901AZ','https://cjdropshipping.com',280,290,'EUR','Almacén CJ Europa / Central','in_stock',7,12,'approved','Pelota inteligente con batería USB-C y sensor de proximidad.','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='pelota_inteligente');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'hammock','CJdropshipping','CJGY111663901AZ','https://cjdropshipping.com',630,920,'EUR','Almacén CJ Europa / Central','in_stock',8,14,'approved','Protector de asiento 600D. Envío gratis al comprador (>39.90€).','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='hammock');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'bottle','CJdropshipping','CJJT171012401AZ','https://cjdropshipping.com',360,380,'EUR','Almacén CJ Europa / Central','in_stock',8,12,'approved','Botella 3 en 1 con dispensador y depósito de snacks.','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='bottle');

-- Proveedores y costes homologados (AliExpress Choice)
INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'cortaunas_led','AliExpress','AE-NAIL-LED-01','https://es.aliexpress.com/w/wholesale-cortau%C3%B1as-perro-led.html?SearchText=cortau%C3%B1as+perro+led',280,190,'EUR','AliExpress Choice (España)','in_stock',5,9,'approved','Coste 2.80€ + Envío 1.90€. PVP 18.90€. Margen limpio: 17.51€ (76.8%).','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='cortaunas_led');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'alfombra_olfativa','AliExpress','AE-SNUFFLE-02','https://es.aliexpress.com/w/wholesale-snuffle-mat-dog.html?SearchText=snuffle+mat+dog',420,190,'EUR','AliExpress Choice (España)','in_stock',6,10,'approved','Coste 4.20€ + Envío 1.90€. PVP 24.90€. Margen limpio: 22.02€ (76.4%).','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='alfombra_olfativa');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'comedero_laberinto','AliExpress','AE-SLOWFEED-03','https://es.aliexpress.com/w/wholesale-slow-feeder-bowl-dog.html?SearchText=slow+feeder+bowl+dog',250,180,'EUR','AliExpress Choice (España)','in_stock',5,9,'approved','Coste 2.50€ + Envío 1.80€. PVP 18.90€. Margen limpio: 17.91€ (78.5%).','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='comedero_laberinto');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'dispensador_linterna','AliExpress','AE-TORCH-BAG-04','https://es.aliexpress.com/w/wholesale-dispensador-bolsas-perro-linterna.html?SearchText=dispensador+bolsas+perro+linterna',190,180,'EUR','AliExpress Choice (España)','in_stock',5,9,'approved','Coste 1.90€ + Envío 1.80€. PVP 14.90€. Margen limpio: 14.57€ (77.5%).','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='dispensador_linterna');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'cinturon_elastico','AliExpress','AE-SEATBELT-05','https://es.aliexpress.com/w/wholesale-cinturon-seguridad-perro-coche-elastico.html?SearchText=cinturon+seguridad+perro+coche+elastico',180,180,'EUR','AliExpress Choice (España)','in_stock',5,8,'approved','Coste 1.80€ + Envío 1.80€. PVP 15.90€. Margen limpio: 15.65€ (79.0%).','2026-09-15'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='cinturon_elastico');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'garantia_envio','NÓMA Care','NOMA-WAR-VIP','https://nomapet.com',10,0,'EUR','Digital / Inmediato','in_stock',0,0,'approved','Garantía VIP de sustitución prioritaria express sin trámites. Margen 95%.','2026-09-24'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='garantia_envio');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, shipping_cost_cents, cost_currency, warehouse, stock_status, shipping_days_min, shipping_days_max, compliance_status, notes, checked_at)
SELECT 'cepillo_quitapelos','AliExpress','AE-ROLLER-HAIR','https://es.aliexpress.com/w/wholesale-rodillo-quitapelos-perro.html?SearchText=rodillo+quitapelos+perro',120,0,'EUR','AliExpress Choice (España)','in_stock',5,9,'approved','Coste 1.20€ + Envío 0€ (envío conjunto). PVP 4.99€. Margen limpio: 3.60€ (72%).','2026-09-24'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE product_id='cepillo_quitapelos');


-- FASE 5 · Datos de envío y trazabilidad del pedido.
-- El Worker también crea estas tablas con CREATE TABLE IF NOT EXISTS,
-- por lo que NO hace falta volver a ejecutar schema.sql en una D1 ya creada.
CREATE TABLE IF NOT EXISTS order_addresses (
  order_id TEXT PRIMARY KEY,
  phone TEXT,
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT,
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT,
  country TEXT NOT NULL DEFAULT 'ES',
  customer_notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_email_code ON orders (customer_email, public_code);


-- FASE 6 · Idempotencia de webhooks Stripe.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders (stripe_checkout_session_id);

-- FASE 8 · Registro de emails transaccionales (Resend).
-- El Worker crea esta tabla automáticamente; no hace falta volver a ejecutar schema.sql.
CREATE TABLE IF NOT EXISTS order_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  email_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  original_recipient TEXT,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_emails_order ON order_emails (order_id, created_at);


-- FASE 11 · Fulfillment de proveedor (CJ/QKsource).
CREATE TABLE IF NOT EXISTS supplier_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cj',
  mode TEXT NOT NULL DEFAULT 'sandbox',
  origin_country TEXT NOT NULL DEFAULT 'CN',
  supplier_order_id TEXT,
  supplier_order_code TEXT,
  logistic_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sub_status TEXT,
  tracking_code TEXT,
  tracking_url TEXT,
  product_amount_usd REAL,
  postage_usd REAL,
  total_usd REAL,
  error TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS supplier_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_order_local_id INTEGER NOT NULL,
  order_item_id INTEGER NOT NULL,
  supplier_sku TEXT,
  supplier_variant_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (supplier_order_local_id) REFERENCES supplier_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_order ON supplier_orders (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_parent ON supplier_order_items (supplier_order_local_id);
