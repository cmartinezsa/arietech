-- ============================================================================
-- ARIE TECH — Datos iniciales (seeds)
-- Las imágenes de productos y galería se insertan con el script Node.js
-- ============================================================================

-- Configuración global
INSERT INTO public.app_config (key, value, description) VALUES
  ('base_prices', '{"redondo": 349, "polo": 489, "oversized": 449}', 'Precios base por estilo'),
  ('style_names', '{"redondo": "Cuello Redondo", "polo": "Polo", "oversized": "Oversized"}', 'Nombres legibles de estilos'),
  ('text_colors', '["#FFFFFF","#0A0A0A","#14B8A6","#1E5BFF","#E25856","#C49100","#5C1A23","#E89AB6"]', 'Paleta de colores para textos en personalizador'),
  ('shipping_methods', '[
    {"id":"local","name":"Entrega local Querétaro","cost":0,"days":"24h"},
    {"id":"estafeta","name":"Estafeta nacional","cost":120,"days":"3-5 días"},
    {"id":"dhl","name":"DHL exprés","cost":250,"days":"1-2 días"}
  ]', 'Métodos de envío disponibles'),
  ('contact_email', '"hola@arietech.mx"', 'Correo de contacto'),
  ('contact_phone', '"+52 442 000 0000"', 'Teléfono de contacto'),
  ('whatsapp_number', '"524420000000"', 'Número de WhatsApp Business'),
  ('faq_enabled', 'true', 'Mostrar sección FAQ'),
  ('low_stock_threshold', '5', 'Cuándo avisar bajo stock')
ON CONFLICT (key) DO NOTHING;

-- Configuración de tallas por estilo
INSERT INTO public.app_config (key, value, description) VALUES
  ('sizes_by_style', '{
    "redondo": ["XS","S","M","L","XL","XXL","2EG"],
    "polo": ["S","M","L","XL","XXL"],
    "oversized": ["S","M","L","XL"],
    "manga_larga": ["S","M","L","XL","XXL"],
    "cuello_v": ["S","M","L","XL"],
    "sin_mangas": ["S","M","L","XL"],
    "sudadera": ["S","M","L","XL","XXL"],
    "camisa": ["S","M","L","XL","XXL"]
  }', 'Tallas disponibles por estilo')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- IMPORTANTE: Los productos y la galería se cargan con el script
-- `scripts/extract_from_monolith.js` que lee el HTML actual y migra las
-- imágenes base64 a Supabase Storage, luego inserta en estas tablas.
--
-- No los insertamos en SQL porque las imágenes son demasiado grandes para
-- mantenerlas en este archivo de seeds.
-- ============================================================================

-- Productos placeholder (para empezar a probar antes de migrar)
INSERT INTO public.products (id, style, gender, label, color_code, color_name, color_hex, base_price, sort_order) VALUES
  ('seed_redondo_neg', 'redondo', 'hombre', 'Clásica Redondo', 'NEG', 'Negro', '#0A0A0A', 349, 1),
  ('seed_redondo_bla', 'redondo', 'hombre', 'Clásica Redondo', 'BLA', 'Blanco', '#F5F5F5', 349, 2),
  ('seed_redondo_tur', 'redondo', 'hombre', 'Clásica Redondo', 'TUR', 'Turquesa', '#14B8A6', 349, 3),
  ('seed_polo_neg', 'polo', 'hombre', 'Polo Premium', 'NEG', 'Negro', '#0A0A0A', 489, 1),
  ('seed_polo_bla', 'polo', 'hombre', 'Polo Premium', 'BLA', 'Blanco', '#F5F5F5', 489, 2)
ON CONFLICT (id) DO NOTHING;

-- Galería placeholder
INSERT INTO public.gallery_designs (id, name, category, sort_order) VALUES
  ('arie_logo', 'Logo Arie Tech', 'logo', 1),
  ('mascot', 'Schnauzer Mascota', 'logo', 2),
  ('dot_minimal', 'Punto Minimalista', 'icon', 3),
  ('lightning', 'Rayo', 'icon', 4),
  ('heart', 'Corazón', 'icon', 5),
  ('star', 'Estrella', 'icon', 6),
  ('mountain', 'Montaña', 'icon', 7),
  ('sun', 'Sol', 'icon', 8),
  ('wave', 'Onda', 'icon', 9),
  ('ok', 'OK Gesto', 'icon', 10),
  ('cassette', 'Cassette', 'icon', 11),
  ('arrow_grid', 'Grid de Flechas', 'pattern', 12)
ON CONFLICT (id) DO NOTHING;

-- Códigos de descuento de ejemplo
INSERT INTO public.discount_codes (code, description, discount_type, discount_value, min_order_amount, max_uses, active) VALUES
  ('BIENVENIDA10', 'Descuento de bienvenida 10%', 'percentage', 10, 500, 100, true),
  ('ENVIOGRATIS', 'Envío gratis en pedidos mayores a $1000', 'free_shipping', 0, 1000, NULL, true)
ON CONFLICT (code) DO NOTHING;
