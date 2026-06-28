-- ============================================================================
-- ARIE TECH — Índices de performance
-- ============================================================================

-- Products
CREATE INDEX idx_products_style_gender ON public.products(style, gender) WHERE available = true;
CREATE INDEX idx_products_available ON public.products(available);
CREATE INDEX idx_products_sort ON public.products(sort_order, style, gender);

-- Gallery
CREATE INDEX idx_gallery_available ON public.gallery_designs(available, sort_order) WHERE available = true;
CREATE INDEX idx_gallery_category ON public.gallery_designs(category) WHERE available = true;

-- Collection
CREATE INDEX idx_collection_available ON public.collection_designs(available, featured DESC, sort_order) WHERE available = true;
CREATE INDEX idx_collection_style ON public.collection_designs(base_style, base_gender);

-- Carts
CREATE INDEX idx_carts_user ON public.carts(user_id) WHERE status = 'active';
CREATE INDEX idx_carts_session ON public.carts(session_id) WHERE status = 'active';
CREATE INDEX idx_carts_updated ON public.carts(updated_at DESC);

-- Cart items
CREATE INDEX idx_cart_items_cart ON public.cart_items(cart_id);

-- Orders (la tabla con más volumen y consultas)
CREATE INDEX idx_orders_user ON public.orders(user_id, created_at DESC);
CREATE INDEX idx_orders_email ON public.orders(customer_email, created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(status, created_at DESC);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_orders_tracking ON public.orders(shipping_tracking_number) WHERE shipping_tracking_number IS NOT NULL;

-- Order items
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_product ON public.order_items(product_id);
CREATE INDEX idx_order_items_production ON public.order_items(production_status, order_id) WHERE production_status != 'completed';

-- Order events (trazabilidad — consultas frecuentes)
CREATE INDEX idx_order_events_order ON public.order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_type ON public.order_events(event_type, created_at DESC);

-- Admin logs (auditoría)
CREATE INDEX idx_admin_logs_admin ON public.admin_logs(admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_entity ON public.admin_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_admin_logs_action ON public.admin_logs(action, created_at DESC);
CREATE INDEX idx_admin_logs_created ON public.admin_logs(created_at DESC);

-- User uploads (limpieza periódica de huérfanos)
CREATE INDEX idx_uploads_user ON public.user_uploads(user_id, uploaded_at DESC);
CREATE INDEX idx_uploads_session ON public.user_uploads(session_id, uploaded_at DESC);
CREATE INDEX idx_uploads_orphans ON public.user_uploads(uploaded_at) WHERE used_in_order_id IS NULL;

-- Admins
CREATE INDEX idx_admins_active ON public.admins(active, role) WHERE active = true;

-- Discount codes
CREATE INDEX idx_discount_active ON public.discount_codes(active, valid_until) WHERE active = true;
