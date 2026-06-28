// ============================================================================
// ARIE TECH — Cliente de API (Supabase)
// Reemplaza el uso de localStorage por persistencia real en base de datos
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Cargar Supabase desde CDN (sin bundler)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: {
    headers: { 'x-session-id': getOrCreateSessionId() }
  }
});

// ----------------------------------------------------------------------------
// Session ID para usuarios invitados (persiste en localStorage del navegador)
// ----------------------------------------------------------------------------
function getOrCreateSessionId() {
  let sid = localStorage.getItem('arie_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem('arie_session_id', sid);
  }
  return sid;
}

// ============================================================================
// PRODUCTOS
// ============================================================================
export const productsAPI = {
  async listAll({ onlyAvailable = true } = {}) {
    const q = supabase.from('products').select('*').order('sort_order');
    if (onlyAvailable) q.eq('available', true);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async byStyleGender(style, gender) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('style', style)
      .eq('gender', gender)
      .eq('available', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  },

  async updateAvailability(productId, available) {
    const { error } = await supabase
      .from('products')
      .update({ available })
      .eq('id', productId);
    if (error) throw error;
  },

  async updatePrice(productId, basePrice) {
    const { error } = await supabase
      .from('products')
      .update({ base_price: basePrice })
      .eq('id', productId);
    if (error) throw error;
  }
};

// ============================================================================
// GALERÍA
// ============================================================================
export const galleryAPI = {
  async listAll() {
    const { data, error } = await supabase
      .from('gallery_designs')
      .select('*')
      .eq('available', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  }
};

// ============================================================================
// COLECCIÓN
// ============================================================================
export const collectionAPI = {
  async listAll({ adminMode = false } = {}) {
    const q = supabase
      .from('collection_designs')
      .select('*, gallery_designs(name, svg_content, image_url)')
      .order('featured', { ascending: false })
      .order('sort_order');
    if (!adminMode) q.eq('available', true);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async create(design) {
    const { data, error } = await supabase
      .from('collection_designs')
      .insert(design)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, changes) {
    const { data, error } = await supabase
      .from('collection_designs')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase
      .from('collection_designs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============================================================================
// UPLOADS DE USUARIO
// ============================================================================
export const uploadsAPI = {
  /**
   * Sube un archivo del cliente a Supabase Storage y registra en DB
   */
  async upload(file) {
    const sessionId = getOrCreateSessionId();
    const ext = file.name.split('.').pop();
    const path = `${sessionId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    // 1. Subir a Storage
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    // 2. Generar URL firmada (válida 7 días)
    const { data: signed } = await supabase.storage
      .from('uploads')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    // 3. Obtener dimensiones leyendo el archivo
    const dims = await getImageDimensions(file);

    // 4. Registrar en tabla user_uploads
    const { data, error } = await supabase
      .from('user_uploads')
      .insert({
        session_id: sessionId,
        user_id: (await supabase.auth.getUser()).data.user?.id || null,
        storage_path: path,
        public_url: signed?.signedUrl,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        width: dims.width,
        height: dims.height
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================================
// CARRITO
// ============================================================================
export const cartAPI = {
  async getOrCreate() {
    const sessionId = getOrCreateSessionId();
    const { data, error } = await supabase.rpc('get_or_create_cart', { p_session_id: sessionId });
    if (error) throw error;
    return data;
  },

  async addItem({ productId, collectionDesignId, customDesignData, size, quantity, unitPrice, previewImageUrl }) {
    const cartId = await this.getOrCreate();
    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cartId,
        product_id: productId,
        collection_design_id: collectionDesignId,
        custom_design_data: customDesignData,
        size,
        quantity: quantity || 1,
        unit_price: unitPrice,
        preview_image_url: previewImageUrl
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listItems() {
    const cartId = await this.getOrCreate();
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, products(*)')
      .eq('cart_id', cartId)
      .order('created_at');
    if (error) throw error;
    return data;
  },

  async updateQuantity(itemId, quantity) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId);
    if (error) throw error;
  },

  async removeItem(itemId) {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) throw error;
  },

  async total() {
    const items = await this.listItems();
    return items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
  }
};

// ============================================================================
// CHECKOUT — convierte carrito en pedido
// ============================================================================
export const checkoutAPI = {
  async createOrder({ customerEmail, customerName, customerPhone, shippingAddress, shippingCost, discountCode, customerNotes }) {
    const cartId = await cartAPI.getOrCreate();
    const { data, error } = await supabase.rpc('checkout_cart', {
      p_cart_id: cartId,
      p_customer_email: customerEmail,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_shipping_address: shippingAddress,
      p_shipping_cost: shippingCost || 0,
      p_discount_code: discountCode || null,
      p_customer_notes: customerNotes || null
    });
    if (error) throw error;
    return data;  // order_id
  },

  async validateDiscount(code) {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code)
      .eq('active', true)
      .single();
    if (error) return null;
    if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
    if (data.max_uses && data.uses_count >= data.max_uses) return null;
    return data;
  }
};

// ============================================================================
// PEDIDOS (vista de cliente y admin)
// ============================================================================
export const ordersAPI = {
  async byId(orderId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), order_events(*)')
      .eq('id', orderId)
      .order('created_at', { foreignTable: 'order_events', ascending: true })
      .single();
    if (error) throw error;
    return data;
  },

  async listMine() {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ADMIN ONLY
  async listAll({ status, fromDate, toDate, limit = 50, offset = 0 } = {}) {
    const q = supabase
      .from('orders')
      .select('*, order_items(quantity)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) q.eq('status', status);
    if (fromDate) q.gte('created_at', fromDate);
    if (toDate) q.lte('created_at', toDate);
    const { data, error, count } = await q;
    if (error) throw error;
    return { orders: data, total: count };
  },

  // ADMIN ONLY
  async updateStatus(orderId, newStatus, notes) {
    const updates = { status: newStatus };
    if (notes) updates.notes = notes;
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ADMIN ONLY
  async addTracking(orderId, trackingNumber, carrier) {
    const { error } = await supabase
      .from('orders')
      .update({
        shipping_tracking_number: trackingNumber,
        shipping_carrier: carrier,
        status: 'shipped'
      })
      .eq('id', orderId);
    if (error) throw error;
  }
};

// ============================================================================
// AUTH (admin)
// ============================================================================
export const authAPI = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async isAdmin() {
    const user = await this.getCurrentUser();
    if (!user) return false;
    const { data } = await supabase
      .from('admins')
      .select('role, active')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();
    return !!data;
  }
};

// ============================================================================
// LOGS / TRAZABILIDAD (admin)
// ============================================================================
export const auditAPI = {
  async orderEvents(orderId) {
    const { data, error } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async adminLogs({ entityType, entityId, action, limit = 100 } = {}) {
    let q = supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (entityType) q = q.eq('entity_type', entityType);
    if (entityId) q = q.eq('entity_id', entityId);
    if (action) q = q.eq('action', action);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async salesSummary(fromDate, toDate) {
    const { data, error } = await supabase.rpc('sales_summary', {
      p_from: fromDate,
      p_to: toDate
    });
    if (error) throw error;
    return data[0];
  }
};

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
export const configAPI = {
  async get(key) {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single();
    if (error) return null;
    return data.value;
  },

  async set(key, value) {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key, value });
    if (error) throw error;
  }
};
