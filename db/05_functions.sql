-- ============================================================================
-- ARIE TECH — Funciones SQL helper
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Obtener o crear el carrito activo del usuario (autenticado o invitado)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_cart(p_session_id TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  cart_id_val UUID;
  user_id_val UUID;
BEGIN
  user_id_val := auth.uid();

  -- Buscar carrito existente
  IF user_id_val IS NOT NULL THEN
    SELECT id INTO cart_id_val
    FROM public.carts
    WHERE user_id = user_id_val AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1;
  ELSIF p_session_id IS NOT NULL THEN
    SELECT id INTO cart_id_val
    FROM public.carts
    WHERE session_id = p_session_id AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  -- Si no existe, crear uno
  IF cart_id_val IS NULL THEN
    INSERT INTO public.carts (user_id, session_id)
    VALUES (user_id_val, p_session_id)
    RETURNING id INTO cart_id_val;
  END IF;

  RETURN cart_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Calcular total de un carrito
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cart_total(p_cart_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(unit_price * quantity), 0)
  FROM public.cart_items
  WHERE cart_id = p_cart_id;
$$ LANGUAGE sql STABLE;


-- ----------------------------------------------------------------------------
-- Convertir carrito en pedido (transacción)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_cart(
  p_cart_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_shipping_address JSONB,
  p_shipping_cost NUMERIC DEFAULT 0,
  p_discount_code TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_order_id UUID;
  subtotal_val NUMERIC;
  discount_amount_val NUMERIC := 0;
  total_val NUMERIC;
  discount_record RECORD;
BEGIN
  -- Calcular subtotal
  subtotal_val := public.cart_total(p_cart_id);

  IF subtotal_val = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío';
  END IF;

  -- Aplicar descuento si lo hay
  IF p_discount_code IS NOT NULL THEN
    SELECT * INTO discount_record
    FROM public.discount_codes
    WHERE code = p_discount_code
      AND active = true
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (max_uses IS NULL OR uses_count < max_uses)
      AND subtotal_val >= min_order_amount;

    IF discount_record IS NOT NULL THEN
      IF discount_record.discount_type = 'percentage' THEN
        discount_amount_val := subtotal_val * (discount_record.discount_value / 100);
      ELSIF discount_record.discount_type = 'fixed' THEN
        discount_amount_val := LEAST(discount_record.discount_value, subtotal_val);
      END IF;
      -- Incrementar uso del código
      UPDATE public.discount_codes SET uses_count = uses_count + 1 WHERE code = p_discount_code;
    END IF;
  END IF;

  total_val := subtotal_val - discount_amount_val + p_shipping_cost;

  -- Crear el pedido
  INSERT INTO public.orders (
    user_id, cart_id, customer_email, customer_name, customer_phone,
    shipping_address, shipping_cost, subtotal, discount_amount, discount_code,
    total, customer_notes
  )
  VALUES (
    auth.uid(), p_cart_id, p_customer_email, p_customer_name, p_customer_phone,
    p_shipping_address, p_shipping_cost, subtotal_val, discount_amount_val, p_discount_code,
    total_val, p_customer_notes
  )
  RETURNING id INTO new_order_id;

  -- Copiar items del carrito al pedido (con snapshot completo)
  INSERT INTO public.order_items (
    order_id, product_id, collection_design_id,
    product_label, product_style, product_color_code, product_color_name,
    custom_design_data, preview_image_url,
    size, quantity, unit_price, line_total
  )
  SELECT
    new_order_id,
    ci.product_id,
    ci.collection_design_id,
    p.label || ' ' || p.color_name,
    p.style,
    p.color_code,
    p.color_name,
    ci.custom_design_data,
    ci.preview_image_url,
    ci.size,
    ci.quantity,
    ci.unit_price,
    ci.unit_price * ci.quantity
  FROM public.cart_items ci
  LEFT JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = p_cart_id;

  -- Marcar carrito como convertido
  UPDATE public.carts SET status = 'converted' WHERE id = p_cart_id;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Reportes: ventas por periodo
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_summary(
  p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_orders BIGINT,
  total_revenue NUMERIC,
  avg_order_value NUMERIC,
  pending_orders BIGINT,
  paid_orders BIGINT,
  shipped_orders BIGINT,
  delivered_orders BIGINT
) AS $$
  SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(total), 0) AS total_revenue,
    COALESCE(AVG(total), 0) AS avg_order_value,
    COUNT(*) FILTER (WHERE status = 'pending_payment') AS pending_orders,
    COUNT(*) FILTER (WHERE status = 'paid') AS paid_orders,
    COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders
  FROM public.orders
  WHERE created_at >= p_from AND created_at <= p_to;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Limpieza: carritos abandonados
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_abandoned_carts(p_hours INTEGER DEFAULT 48)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.carts
  SET status = 'abandoned'
  WHERE status = 'active'
    AND updated_at < NOW() - (p_hours || ' hours')::INTERVAL
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci WHERE ci.cart_id = carts.id
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- Limpieza: uploads huérfanos (no usados en ningún pedido)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_orphan_uploads(p_days INTEGER DEFAULT 30)
RETURNS TABLE (id UUID, storage_path TEXT, uploaded_at TIMESTAMPTZ) AS $$
  SELECT id, storage_path, uploaded_at
  FROM public.user_uploads
  WHERE used_in_order_id IS NULL
    AND uploaded_at < NOW() - (p_days || ' days')::INTERVAL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
