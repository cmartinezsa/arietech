-- ============================================================================
-- ARIE TECH — Triggers de trazabilidad automática
-- ============================================================================

-- ----------------------------------------------------------------------------
-- HELPER: updated_at automático
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER set_updated_at_products       BEFORE UPDATE ON public.products            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_gallery        BEFORE UPDATE ON public.gallery_designs     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_collection     BEFORE UPDATE ON public.collection_designs  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_carts          BEFORE UPDATE ON public.carts               FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_orders         BEFORE UPDATE ON public.orders              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_config         BEFORE UPDATE ON public.app_config          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- AUTOGENERAR order_number con formato AT-YYYY-NNNN
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  next_num INTEGER;
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  year_part := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(SUBSTRING(order_number FROM '\d+$')::INTEGER), 0) + 1
  INTO next_num
  FROM public.orders
  WHERE order_number LIKE 'AT-' || year_part || '-%';

  NEW.order_number := 'AT-' || year_part || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


-- ----------------------------------------------------------------------------
-- TRAZABILIDAD: log automático de cambios en ORDERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_order_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Pedido nuevo
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.order_events (order_id, event_type, to_value, actor_type, metadata)
    VALUES (
      NEW.id,
      'created',
      NEW.status,
      'system',
      jsonb_build_object(
        'total', NEW.total,
        'customer_email', NEW.customer_email,
        'items_count', (SELECT COUNT(*) FROM public.order_items WHERE order_id = NEW.id)
      )
    );
    RETURN NEW;
  END IF;

  -- Cambio de status
  IF (NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.order_events (order_id, event_type, from_value, to_value, actor_type)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, 'system');
  END IF;

  -- Cambio de payment_status
  IF (NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN
    INSERT INTO public.order_events (order_id, event_type, from_value, to_value, actor_type, metadata)
    VALUES (
      NEW.id,
      'payment_status_changed',
      OLD.payment_status,
      NEW.payment_status,
      'system',
      jsonb_build_object('payment_method', NEW.payment_method, 'payment_reference', NEW.payment_reference)
    );
  END IF;

  -- Cambio de tracking
  IF (NEW.shipping_tracking_number IS DISTINCT FROM OLD.shipping_tracking_number)
     AND NEW.shipping_tracking_number IS NOT NULL THEN
    INSERT INTO public.order_events (order_id, event_type, to_value, actor_type, metadata)
    VALUES (
      NEW.id,
      'tracking_added',
      NEW.shipping_tracking_number,
      'system',
      jsonb_build_object('carrier', NEW.shipping_carrier)
    );
  END IF;

  -- Notas internas modificadas
  IF (NEW.notes IS DISTINCT FROM OLD.notes) THEN
    INSERT INTO public.order_events (order_id, event_type, from_value, to_value, actor_type)
    VALUES (NEW.id, 'note_updated', OLD.notes, NEW.notes, 'admin');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_order_changes
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_change();


-- ----------------------------------------------------------------------------
-- TRAZABILIDAD: auto-fecha cuando un pedido pasa a estado terminal
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_order_terminal_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- paid_at se setea cuando payment_status pasa a 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    NEW.paid_at = NOW();
  END IF;

  -- shipped_at cuando status pasa a 'shipped'
  IF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
    NEW.shipped_at = NOW();
  END IF;

  -- delivered_at cuando status pasa a 'delivered'
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_dates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_terminal_dates();


-- ----------------------------------------------------------------------------
-- TRAZABILIDAD: log de cambios en collection_designs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_collection_change()
RETURNS TRIGGER AS $$
DECLARE
  admin_email_val TEXT;
  changes_json JSONB;
BEGIN
  -- Obtener email del admin (auth.uid() es null en triggers a menos que vengan de cliente autenticado)
  SELECT email INTO admin_email_val
  FROM auth.users
  WHERE id = COALESCE(NEW.updated_by, NEW.created_by, auth.uid())
  LIMIT 1;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.admin_logs (admin_id, admin_email, action, entity_type, entity_id, changes)
    VALUES (
      NEW.created_by,
      COALESCE(admin_email_val, 'system'),
      'create',
      'collection_design',
      NEW.id::TEXT,
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Construir diff entre OLD y NEW
    changes_json := jsonb_build_object();
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      changes_json := changes_json || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    IF OLD.price IS DISTINCT FROM NEW.price THEN
      changes_json := changes_json || jsonb_build_object('price', jsonb_build_object('from', OLD.price, 'to', NEW.price));
    END IF;
    IF OLD.available IS DISTINCT FROM NEW.available THEN
      changes_json := changes_json || jsonb_build_object('available', jsonb_build_object('from', OLD.available, 'to', NEW.available));
    END IF;
    IF OLD.featured IS DISTINCT FROM NEW.featured THEN
      changes_json := changes_json || jsonb_build_object('featured', jsonb_build_object('from', OLD.featured, 'to', NEW.featured));
    END IF;
    IF OLD.tag IS DISTINCT FROM NEW.tag THEN
      changes_json := changes_json || jsonb_build_object('tag', jsonb_build_object('from', OLD.tag, 'to', NEW.tag));
    END IF;

    IF changes_json != '{}'::JSONB THEN
      INSERT INTO public.admin_logs (admin_id, admin_email, action, entity_type, entity_id, changes)
      VALUES (
        NEW.updated_by,
        COALESCE(admin_email_val, 'system'),
        'update',
        'collection_design',
        NEW.id::TEXT,
        changes_json
      );
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.admin_logs (admin_email, action, entity_type, entity_id, changes)
    VALUES (
      'system',
      'delete',
      'collection_design',
      OLD.id::TEXT,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_collection_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.collection_designs
  FOR EACH ROW EXECUTE FUNCTION public.log_collection_change();


-- ----------------------------------------------------------------------------
-- TRAZABILIDAD: log de cambios en products (precios y disponibilidad)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_product_change()
RETURNS TRIGGER AS $$
DECLARE
  changes_json JSONB;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    changes_json := jsonb_build_object();

    IF OLD.base_price IS DISTINCT FROM NEW.base_price THEN
      changes_json := changes_json || jsonb_build_object('base_price', jsonb_build_object('from', OLD.base_price, 'to', NEW.base_price));
    END IF;
    IF OLD.available IS DISTINCT FROM NEW.available THEN
      changes_json := changes_json || jsonb_build_object('available', jsonb_build_object('from', OLD.available, 'to', NEW.available));
    END IF;

    IF changes_json != '{}'::JSONB THEN
      INSERT INTO public.admin_logs (admin_email, action, entity_type, entity_id, changes)
      VALUES ('system', 'update', 'product', NEW.id, changes_json);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_product_changes
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_change();


-- ----------------------------------------------------------------------------
-- TRAZABILIDAD: marcar uploads como usados cuando se crea un order_item
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_upload_used()
RETURNS TRIGGER AS $$
DECLARE
  upload_url TEXT;
BEGIN
  -- Si el item incluye una imagen subida, marcarla como usada
  IF NEW.custom_design_data IS NOT NULL THEN
    upload_url := NEW.custom_design_data->>'image_url';
    IF upload_url IS NOT NULL THEN
      UPDATE public.user_uploads
      SET used_in_order_id = NEW.order_id
      WHERE public_url = upload_url AND used_in_order_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mark_upload_used_on_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.mark_upload_used();
