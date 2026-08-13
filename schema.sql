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
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  supplier TEXT,
  supplier_sku TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- Semilla de la demo actual. Luego sustituiremos estos registros por los SKU homologados.
INSERT OR IGNORE INTO products
(id, slug, name, short_desc, description, category, tag, emoji, price_cents, published, sort_order)
VALUES
('roller','rodillo-reutilizable-quitapelos','Rodillo reutilizable quitapelos','Recoge pelo de sofás, ropa y asientos sin recambios adhesivos.','Recoge pelo de sofás, ropa y asientos sin recambios adhesivos.','limpieza','TOP','🧹',2290,1,10),
('bottle','botella-3-en-1-paseo','Botella 3 en 1 de paseo','Agua, bebedero y espacio auxiliar en un formato compacto.','Agua, bebedero y espacio auxiliar en un formato compacto.','paseo','PASEO','💧',2190,1,20),
('slow','comedero-lento','Comedero lento','Diseño laberinto para alargar el tiempo de comida de forma sencilla.','Diseño laberinto para alargar el tiempo de comida de forma sencilla.','hogar','DIARIO','🥣',1890,1,30),
('hammock','protector-asiento-hamaca','Protector de asiento tipo hamaca','Protección impermeable para el asiento trasero, fácil de colocar y limpiar.','Protección impermeable para el asiento trasero, fácil de colocar y limpiar.','viaje','VIAJE','🚗',4990,1,40),
('glove','guante-cepillado','Guante de cepillado','Cepillado cómodo para retirar pelo suelto durante el cuidado diario.','Cepillado cómodo para retirar pelo suelto durante el cuidado diario.','limpieza','CUIDADO','🧤',1490,1,50),
('bags','kit-bolsas-dispensador','Kit paseo bolsas + dispensador','Un básico ligero y recurrente para los paseos de cada día.','Un básico ligero y recurrente para los paseos de cada día.','paseo','RECURRENTE','♻️',1290,1,60);

-- Candidatos de sourcing encontrados. NO están homologados: falta validar stock UE, transporte a España y documentación.
INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, cost_currency, warehouse, stock_status, compliance_status, notes, checked_at)
SELECT 'roller','CJdropshipping','CJJT174982701AZ','https://cjdropshipping.com/product/portable-washable-hair-remover-with-adhesive-roller-p-1653949161269637120.html',263,'USD',NULL,'unknown','pending','Precio de producto visible; transporte/stock UE pendientes de validar.','2026-08-14'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE supplier='CJdropshipping' AND supplier_sku='CJJT174982701AZ');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, cost_currency, warehouse, stock_status, compliance_status, notes, checked_at)
SELECT 'bottle','CJdropshipping','CJJT171012401AZ','https://cjdropshipping.com/product/800ml-dogs-water-bottle-portable-high-capacity-leakproof-pet-foldable-drinking-bowl-golden-retriever-outdoor-walking-supplies-pet-products-p-1637037130746703872.html',399,'USD',NULL,'unknown','pending','Precio de producto visible; transporte/stock UE pendientes de validar.','2026-08-14'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE supplier='CJdropshipping' AND supplier_sku='CJJT171012401AZ');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, cost_currency, warehouse, stock_status, compliance_status, notes, checked_at)
SELECT 'slow','CJdropshipping','CJGY174846501AZ','https://cjdropshipping.com/product/pet-dog-cat-slow-feeder-bowls-anti-choking-slow-feeder-dish-bowl-home-dog-eating-plate-anti-gulping-bowl-supplies-p-1653041912300969984.html',129,'USD',NULL,'unknown','pending','Rango visible $1.29–2.11; se registra el mínimo solo como referencia.','2026-08-14'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE supplier='CJdropshipping' AND supplier_sku='CJGY174846501AZ');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, cost_currency, warehouse, stock_status, compliance_status, notes, checked_at)
SELECT 'hammock','CJdropshipping','CJGY111663901AZ','https://cjdropshipping.com/product/dog-car-mats-dog-mats-golden-retriever-pet-dog-cushions-rear-car-mats-waterproof-and-dirt-resistant-car-pet-seat-covers-p-1390562609694117888.html',630,'USD',NULL,'unknown','pending','Peso aproximado 1.1 kg: el transporte será decisivo para el margen.','2026-08-14'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE supplier='CJdropshipping' AND supplier_sku='CJGY111663901AZ');

INSERT INTO product_sources
(product_id, supplier, supplier_sku, supplier_url, product_cost_cents, cost_currency, warehouse, stock_status, compliance_status, notes, checked_at)
SELECT 'glove','CJdropshipping','CJYD233200801AZ','https://cjdropshipping.com/product/pet-hair-remover-mitt-pet-hair-remover-gloves-deshedding-brush-glove-for-dog-cat-rabbit-with-long-short-curly-hair-p-2503191148021601200.html',57,'USD',NULL,'unknown','pending','Rango visible $0.57–6.96 según cantidad/variante.','2026-08-14'
WHERE NOT EXISTS (SELECT 1 FROM product_sources WHERE supplier='CJdropshipping' AND supplier_sku='CJYD233200801AZ');
