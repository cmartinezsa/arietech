// ============================================================================
// ARIE TECH — admin.js
// Panel administrativo conectado a Supabase con auth real
// ============================================================================

import { authAPI, collectionAPI, productsAPI, ordersAPI, auditAPI } from '../api.js';
import { showToast } from '../main.js';

export function initAdmin() {
  const trigger = document.getElementById('adminTrigger');
  const backdrop = document.getElementById('adminBackdrop');

  trigger?.addEventListener('click', openAdmin);

  // Atajo Ctrl/Cmd+Shift+A
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      openAdmin();
    }
  });

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeAdmin();
  });
}

async function openAdmin() {
  const backdrop = document.getElementById('adminBackdrop');
  const isAdmin = await authAPI.isAdmin();

  if (!isAdmin) {
    backdrop.innerHTML = buildLoginForm();
    bindLogin();
  } else {
    backdrop.innerHTML = await buildDashboard();
    bindDashboard();
  }
  backdrop.classList.add('show');
}

function closeAdmin() {
  document.getElementById('adminBackdrop').classList.remove('show');
}

function buildLoginForm() {
  return `
    <div class="admin-modal">
      <div class="admin-header">
        <h3>Administración</h3>
        <button class="admin-close" id="adminClose" type="button">×</button>
      </div>
      <div class="admin-login">
        <p>Inicia sesión para acceder al panel.</p>
        <input type="email" id="adminEmail" placeholder="email@arietech.mx" autocomplete="username" />
        <input type="password" id="adminPwd" placeholder="Contraseña" autocomplete="current-password" />
        <div class="admin-login-error" id="adminLoginErr" style="display:none;"></div>
        <button class="btn btn-primary" id="adminLoginBtn" type="button">Entrar</button>
      </div>
    </div>
  `;
}

function bindLogin() {
  document.getElementById('adminClose')?.addEventListener('click', closeAdmin);
  document.getElementById('adminLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('adminEmail').value.trim();
    const pwd = document.getElementById('adminPwd').value;
    const errBox = document.getElementById('adminLoginErr');
    errBox.style.display = 'none';
    try {
      await authAPI.signIn(email, pwd);
      const isAdmin = await authAPI.isAdmin();
      if (!isAdmin) {
        await authAPI.signOut();
        throw new Error('Tu cuenta no tiene permisos de administrador');
      }
      await openAdmin();  // re-renderiza con dashboard
    } catch (err) {
      errBox.textContent = err.message || 'Credenciales incorrectas';
      errBox.style.display = 'block';
    }
  });
}

async function buildDashboard() {
  return `
    <div class="admin-modal admin-modal-wide">
      <div class="admin-header">
        <h3>Panel Arie Tech</h3>
        <div class="admin-actions">
          <button class="btn btn-ghost btn-sm" id="adminLogoutBtn" type="button">Cerrar sesión</button>
          <button class="admin-close" id="adminClose" type="button">×</button>
        </div>
      </div>
      <div class="admin-tabs">
        <button class="admin-tab active" data-tab="orders" type="button">Pedidos</button>
        <button class="admin-tab" data-tab="collection" type="button">Colección</button>
        <button class="admin-tab" data-tab="products" type="button">Productos</button>
        <button class="admin-tab" data-tab="audit" type="button">Trazabilidad</button>
      </div>
      <div class="admin-content" id="adminContent">
        <div class="loading">Cargando...</div>
      </div>
    </div>
  `;
}

function bindDashboard() {
  document.getElementById('adminClose')?.addEventListener('click', closeAdmin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await authAPI.signOut();
    showToast('Sesión cerrada');
    closeAdmin();
  });

  const content = document.getElementById('adminContent');
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      content.innerHTML = '<div class="loading">Cargando...</div>';
      try {
        const tabName = tab.dataset.tab;
        if (tabName === 'orders') await renderOrdersTab(content);
        if (tabName === 'collection') await renderCollectionTab(content);
        if (tabName === 'products') await renderProductsTab(content);
        if (tabName === 'audit') await renderAuditTab(content);
      } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="error">Error: ${err.message}</div>`;
      }
    });
  });

  // Tab inicial: pedidos
  document.querySelector('.admin-tab[data-tab="orders"]')?.click();
}

async function renderOrdersTab(container) {
  const { orders, total } = await ordersAPI.listAll({ limit: 50 });
  container.innerHTML = `
    <div class="admin-section-header">
      <h4>Pedidos recientes (${total})</h4>
    </div>
    <table class="admin-table">
      <thead>
        <tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr>
      </thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td><strong>${o.order_number}</strong></td>
            <td>${o.customer_name}<br/><small>${o.customer_email}</small></td>
            <td>$${parseFloat(o.total).toFixed(2)}</td>
            <td><span class="status-badge status-${o.status}">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString('es-MX')}</td>
            <td><button class="btn btn-sm" data-order="${o.id}" type="button">Ver</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderCollectionTab(container) {
  const designs = await collectionAPI.listAll({ adminMode: true });
  container.innerHTML = `
    <div class="admin-section-header">
      <h4>Diseños de colección (${designs.length})</h4>
      <button class="btn btn-primary btn-sm" id="newDesignBtn" type="button">+ Nuevo</button>
    </div>
    <table class="admin-table">
      <thead><tr><th>Nombre</th><th>Tag</th><th>Precio</th><th>Disponible</th><th></th></tr></thead>
      <tbody>
        ${designs.map(d => `
          <tr>
            <td>${d.name}</td>
            <td>${d.tag || '—'}</td>
            <td>$${d.price || '—'}</td>
            <td>${d.available ? '✓' : '✗'}</td>
            <td>
              <button class="btn btn-sm" data-edit="${d.id}" type="button">Editar</button>
              <button class="btn btn-sm btn-danger" data-del="${d.id}" type="button">Borrar</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderProductsTab(container) {
  const products = await productsAPI.listAll({ onlyAvailable: false });
  container.innerHTML = `
    <div class="admin-section-header"><h4>Productos base (${products.length})</h4></div>
    <table class="admin-table">
      <thead><tr><th>ID</th><th>Modelo</th><th>Color</th><th>Precio</th><th>Disponible</th></tr></thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td><code>${p.id}</code></td>
            <td>${p.label} · ${p.style}/${p.gender}</td>
            <td><span class="color-dot" style="background:${p.color_hex}"></span> ${p.color_name}</td>
            <td><input type="number" class="price-input" value="${p.base_price}" data-product="${p.id}" /></td>
            <td><input type="checkbox" ${p.available ? 'checked' : ''} data-avail="${p.id}" /></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderAuditTab(container) {
  const logs = await auditAPI.adminLogs({ limit: 100 });
  container.innerHTML = `
    <div class="admin-section-header"><h4>Bitácora de actividad (${logs.length})</h4></div>
    <table class="admin-table">
      <thead><tr><th>Fecha</th><th>Admin</th><th>Acción</th><th>Entidad</th><th>Cambios</th></tr></thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td>${new Date(l.created_at).toLocaleString('es-MX')}</td>
            <td>${l.admin_email}</td>
            <td><span class="status-badge">${l.action}</span></td>
            <td>${l.entity_type}<br/><small>${l.entity_id}</small></td>
            <td><pre class="changes-preview">${JSON.stringify(l.changes, null, 2).slice(0, 200)}</pre></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
