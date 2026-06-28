-- ============================================================================
-- ARIE TECH — Schema principal
-- Ejecutar PRIMERO en Supabase SQL Editor
-- ============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ADMINS — quiénes tienen acceso al panel administrativo
-- ============================================================================
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

COMMENT ON TABLE public.admins IS 'Usuarios con acceso al panel de administración';

-- ============================================================================
-- PRODUCTS — catálogo base (style + color = un producto)
-- ============================================================================
CREATE TABLE public.products (
  id TEXT PRIMARY KEY,                         -- ej: 'tcomadcneg'
  style TEXT NOT NULL,                         -- 'redondo', 'polo', 'oversized'
  gender TEXT NOT NULL,                        -- 'hombre', 'mujer', 'unisex', 'kids'
  label TEXT NOT NULL,                         -- 'Clásica Redondo'
  color_code TEXT NOT NULL,                    -- 'NEG'
  color_name TEXT NOT NULL,                    -- 'Negro'
  color_hex TEXT NOT NULL,                     -- '#0A0A0A'
  image_url TEXT,                              -- URL en Supabase Storage
  base_price NUMERIC(10,2) NOT NULL,           -- precio base de este SKU
  available_sizes TEXT[] DEFAULT ARRAY['XS','S','M','L','XL','XXL']::TEXT[],
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.products IS 'Catálogo de productos base. Cada combinación style+color es una fila.';
COMMENT ON COLUMN public.products.image_url IS 'URL pública del bucket "products" de Supabase Storage';

-- ============================================================================
-- GALLERY_DESIGNS — diseños pre-cargados para el personalizador
-- ============================================================================
CREATE TABLE public.gallery_designs (
  id TEXT PRIMARY KEY,                         -- ej: 'arie_logo', 'lightning'
  name TEXT NOT NULL,                          -- 'Logo Arie Tech'
  svg_content TEXT,                            -- SVG inline (rápido para preview)
  image_url TEXT,                              -- imagen alternativa si no es SVG
  category TEXT DEFAULT 'general',             -- 'logo', 'icon', 'pattern', etc.
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.gallery_designs IS 'Diseños listos para usar en el personalizador';

-- ============================================================================
-- COLLECTION_DESIGNS — los diseños pre-armados de la sección "Colección"
-- ============================================================================
CREATE TABLE public.collection_designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                          -- 'Logo Clásico'
  description TEXT,
  tag TEXT,                                    -- 'BEST SELLER', 'NUEVO', etc.
  gallery_design_id TEXT REFERENCES public.gallery_designs(id),
  base_style TEXT NOT NULL,                    -- 'redondo', 'polo', 'oversized'
  base_gender TEXT NOT NULL,
  available_color_codes TEXT[] NOT NULL,       -- ['NEG', 'BLA', 'TUR']
  available_sizes TEXT[] DEFAULT ARRAY['S','M','L','XL']::TEXT[],
  preview_image_url TEXT,                      -- mockup precalculado
  price NUMERIC(10,2),                         -- precio especial (si null, usa el del producto base)
  side TEXT DEFAULT 'front' CHECK (side IN ('front', 'back', 'both')),
  available BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.collection_designs IS 'Diseños ya armados que aparecen en la sección Colección';

-- ============================================================================
-- USER_UPLOADS — imágenes que suben los clientes para personalizar
-- ============================================================================
CREATE TABLE public.user_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,                             -- para usuarios invitados
  storage_path TEXT NOT NULL,                  -- path en bucket 'uploads'
  public_url TEXT,                             -- URL firmada si es accesible
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  used_in_order_id UUID                        -- se llena cuando se compromete a un pedido
);

COMMENT ON TABLE public.user_uploads IS 'Imágenes que suben los clientes. Las no usadas se pueden limpiar después de 30 días.';

-- ============================================================================
-- CARTS — carritos de compra (persisten para invitados via session_id)
-- ============================================================================
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,                             -- para invitados, generamos UUID en cliente
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cart_owner_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id),
  collection_design_id UUID REFERENCES public.collection_designs(id),
  -- Snapshot completo del diseño en el momento de agregar al carrito
  custom_design_data JSONB,                    -- { text, image_url, position, side, scale, font }
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  preview_image_url TEXT,                      -- mockup generado del item
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN public.cart_items.custom_design_data IS 'JSON con texto, posición, imagen, lado. Snapshot del momento de añadir.';

-- ============================================================================
-- ORDERS — pedidos confirmados
-- ============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,           -- 'AT-2026-0001' (autogenerado)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cart_id UUID REFERENCES public.carts(id),

  -- Datos del cliente (snapshot al momento del pedido)
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,

  -- Envío
  shipping_address JSONB NOT NULL,             -- { street, number, neighborhood, city, state, zip, references }
  shipping_method TEXT,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  shipping_tracking_number TEXT,
  shipping_carrier TEXT,

  -- Totales
  subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_code TEXT,
  total NUMERIC(10,2) NOT NULL,

  -- Estados
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment',  -- recién creado, esperando pago
    'paid',             -- pago confirmado
    'in_production',    -- en producción
    'ready',            -- listo para enviar
    'shipped',          -- enviado
    'delivered',        -- entregado
    'cancelled',        -- cancelado
    'refunded'          -- reembolsado
  )),
  payment_method TEXT,                         -- 'transfer', 'card', 'oxxo', 'cash', etc.
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_reference TEXT,                      -- ID de transacción de la pasarela
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  notes TEXT,                                  -- notas internas del admin
  customer_notes TEXT,                         -- notas que dejó el cliente al comprar

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS 'Pedidos. order_number se genera automáticamente con trigger.';

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id),
  collection_design_id UUID REFERENCES public.collection_designs(id),

  -- Snapshot del producto al momento de la compra
  product_label TEXT NOT NULL,                 -- ej. 'Clásica Redondo Negro'
  product_style TEXT NOT NULL,
  product_color_code TEXT NOT NULL,
  product_color_name TEXT NOT NULL,

  -- Snapshot completo del diseño
  custom_design_data JSONB,
  preview_image_url TEXT,
  print_file_url TEXT,                         -- archivo de alta resolución para producción

  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,

  production_status TEXT DEFAULT 'pending' CHECK (production_status IN (
    'pending', 'printing', 'quality_check', 'completed', 'rework'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.order_items IS 'Items del pedido con SNAPSHOT completo del diseño';

-- ============================================================================
-- ORDER_EVENTS — trazabilidad de cambios en pedidos
-- ============================================================================
CREATE TABLE public.order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                    -- 'created', 'status_changed', 'payment_received', 'shipped', 'note_added', etc.
  from_value TEXT,                             -- estado/valor anterior
  to_value TEXT,                               -- estado/valor nuevo
  notes TEXT,
  actor_type TEXT DEFAULT 'system',            -- 'system', 'admin', 'customer'
  actor_id UUID,                               -- user_id si aplica
  actor_email TEXT,
  metadata JSONB,                              -- datos extra (ej. número de guía, monto del pago)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.order_events IS 'Bitácora completa de cada cambio en un pedido. Append-only, nunca se borra ni edita.';

-- ============================================================================
-- ADMIN_LOGS — trazabilidad de acciones administrativas
-- ============================================================================
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,                        -- 'create', 'update', 'delete', 'login', 'logout', 'export', etc.
  entity_type TEXT,                            -- 'product', 'collection_design', 'order', 'user', etc.
  entity_id TEXT,
  changes JSONB,                               -- { field: { from, to } }
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.admin_logs IS 'Auditoría de todas las acciones del panel admin. Append-only.';

-- ============================================================================
-- APP_CONFIG — configuración global
-- ============================================================================
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.app_config IS 'Configuración key-value: precios base, mensajes, banners, etc.';

-- ============================================================================
-- DISCOUNT_CODES — códigos de descuento
-- ============================================================================
CREATE TABLE public.discount_codes (
  code TEXT PRIMARY KEY,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER,                            -- null = ilimitado
  uses_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
