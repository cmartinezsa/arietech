// ============================================================================
// ARIE TECH — cart.js
// Carrito persistido en Supabase (en lugar de localStorage)
// ============================================================================

import { cartAPI } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../main.js';

export async function initCart() {
  const btn = document.getElementById('cartBtn');
  const backdrop = document.getElementById('cartBackdrop');
  const drawer = document.getElementById('cartDrawer');
  const close = document.getElementById('cartClose');

  btn?.addEventListener('click', toggle);
  backdrop?.addEventListener('click', toggle);
  close?.addEventListener('click', toggle);

  window.addEventListener('cart:updated', render);
  await render();
}

function toggle() {
  document.getElementById('cartBackdrop').classList.toggle('show');
  document.getElementById('cartDrawer').classList.toggle('show');
}

async function render() {
  try {
    const items = await cartAPI.listItems();
    const list = document.getElementById('cartItems');
    const total = items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);

    document.getElementById('cartCount').textContent = items.reduce((s, it) => s + it.quantity, 0);
    document.getElementById('cartTotal').textContent = total.toFixed(2);
    document.getElementById('checkoutBtn').disabled = items.length === 0;

    if (!items.length) {
      list.innerHTML = '<div class="empty">Tu carrito está vacío.</div>';
      return;
    }

    list.innerHTML = items.map(it => `
      <div class="cart-item" data-id="${it.id}">
        <div class="cart-item-img">
          ${it.preview_image_url ? `<img src="${it.preview_image_url}" alt="" />` : '<div class="placeholder"></div>'}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${it.products?.label || 'Producto'} ${it.products?.color_name || ''}</div>
          <div class="cart-item-meta">Talla ${it.size}</div>
          <div class="cart-item-qty">
            <button data-action="dec" type="button">−</button>
            <span>${it.quantity}</span>
            <button data-action="inc" type="button">+</button>
          </div>
        </div>
        <div class="cart-item-side">
          <div class="cart-item-price">$${(it.unit_price * it.quantity).toFixed(2)}</div>
          <button class="cart-item-remove" data-action="remove" type="button">Quitar</button>
        </div>
      </div>
    `).join('');

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const row = btn.closest('[data-id]');
      const itemId = row.dataset.id;
      const item = items.find(i => i.id === itemId);
      try {
        if (btn.dataset.action === 'inc') await cartAPI.updateQuantity(itemId, item.quantity + 1);
        if (btn.dataset.action === 'dec' && item.quantity > 1) await cartAPI.updateQuantity(itemId, item.quantity - 1);
        if (btn.dataset.action === 'remove') await cartAPI.removeItem(itemId);
        await render();
      } catch (err) {
        console.error(err);
        showToast('Error al actualizar carrito', 'error');
      }
    }, { once: true });

  } catch (err) {
    console.error('Error renderizando carrito:', err);
  }
}
