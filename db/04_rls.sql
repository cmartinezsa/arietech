-- ============================================================================
-- ARIE TECH — Row Level Security (RLS)
-- Define quién puede leer/escribir qué desde el frontend con la anon key
-- ============================================================================

-- Helper: ¿el usuario actual es admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid() AND active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- PRODUCTS — lectura pública, escritura solo admins
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select_public ON public.products
  FOR SELECT USING (true);  -- cualquiera puede leer el catálogo

CREATE POLICY products_modify_admins ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ----------------------------------------------------------------------------
-- GALLERY — lectura pública, escritura solo admins
-- ----------------------------------------------------------------------------
ALTER TABLE public.gallery_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY gallery_select_public ON public.gallery_designs FOR SELECT USING (true);
CREATE POLICY gallery_modify_admins ON public.gallery_designs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ----------------------------------------------------------------------------
-- COLLECTION — lectura pública solo si available=true, escritura solo admins
-- ----------------------------------------------------------------------------
ALTER TABLE public.collection_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_select_public ON public.collection_designs
  FOR SELECT USING (available = true OR public.is_admin());

CREATE POLICY collection_modify_admins ON public.collection_designs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ----------------------------------------------------------------------------
-- USER_UPLOADS — cada quien ve y crea sus propios uploads
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY uploads_select_own ON public.user_uploads
  FOR SELECT USING (
    user_id = auth.uid()
    OR session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR public.is_admin()
  );

CREATE POLICY uploads_insert_own ON public.user_uploads
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR session_id IS NOT NULL  -- invitado debe enviar session_id
  );


-- ----------------------------------------------------------------------------
-- CARTS — cada quien ve su propio carrito (autenticado o por sesión)
-- ----------------------------------------------------------------------------
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY carts_select_own ON public.carts
  FOR SELECT USING (
    user_id = auth.uid()
    OR session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR public.is_admin()
  );

CREATE POLICY carts_insert_own ON public.carts
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR session_id IS NOT NULL
  );

CREATE POLICY carts_update_own ON public.carts
  FOR UPDATE USING (
    user_id = auth.uid()
    OR session_id = current_setting('request.headers', true)::json->>'x-session-id'
  );


-- ----------------------------------------------------------------------------
-- CART_ITEMS — visible si el carrito padre lo es
-- ----------------------------------------------------------------------------
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_items_select ON public.cart_items
  FOR SELECT USING (
    cart_id IN (SELECT id FROM public.carts)
    OR public.is_admin()
  );

CREATE POLICY cart_items_insert ON public.cart_items
  FOR INSERT WITH CHECK (cart_id IN (SELECT id FROM public.carts));

CREATE POLICY cart_items_update ON public.cart_items
  FOR UPDATE USING (cart_id IN (SELECT id FROM public.carts));

CREATE POLICY cart_items_delete ON public.cart_items
  FOR DELETE USING (cart_id IN (SELECT id FROM public.carts));


-- ----------------------------------------------------------------------------
-- ORDERS — clientes ven sus pedidos, admins ven todo
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select ON public.orders
  FOR SELECT USING (
    user_id = auth.uid()
    OR customer_email = auth.jwt()->>'email'
    OR public.is_admin()
  );

CREATE POLICY orders_insert ON public.orders
  FOR INSERT WITH CHECK (true);  -- cualquiera puede crear un pedido

CREATE POLICY orders_update_admins ON public.orders
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ----------------------------------------------------------------------------
-- ORDER_ITEMS — visible si el order padre lo es
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_select ON public.order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders)
    OR public.is_admin()
  );

CREATE POLICY order_items_insert ON public.order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY order_items_update_admins ON public.order_items
  FOR UPDATE USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- ORDER_EVENTS — append-only, lectura solo del propio pedido
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_events_select ON public.order_events
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders)
    OR public.is_admin()
  );

CREATE POLICY order_events_insert_system ON public.order_events
  FOR INSERT WITH CHECK (true);  -- los triggers necesitan poder insertar

-- NO se permite UPDATE ni DELETE en order_events (es append-only)


-- ----------------------------------------------------------------------------
-- ADMIN_LOGS — solo admins ven, append-only
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_logs_select ON public.admin_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY admin_logs_insert ON public.admin_logs
  FOR INSERT WITH CHECK (true);  -- triggers necesitan insertar


-- ----------------------------------------------------------------------------
-- APP_CONFIG — lectura pública, escritura solo admins
-- ----------------------------------------------------------------------------
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_select_public ON public.app_config FOR SELECT USING (true);
CREATE POLICY config_modify_admins ON public.app_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ----------------------------------------------------------------------------
-- ADMINS — solo super_admins ven y modifican la tabla
-- ----------------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_select ON public.admins
  FOR SELECT USING (
    user_id = auth.uid()  -- cada admin se ve a sí mismo
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY admins_modify_super ON public.admins
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND role = 'super_admin')
  );


-- ----------------------------------------------------------------------------
-- DISCOUNT_CODES — clientes verifican código (lectura limitada), admins gestionan
-- ----------------------------------------------------------------------------
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY discount_select ON public.discount_codes
  FOR SELECT USING (active = true AND (valid_until IS NULL OR valid_until > NOW()));

CREATE POLICY discount_modify_admins ON public.discount_codes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
