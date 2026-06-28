// ============================================================================
// ARIE TECH — main.js
// Orquestador. Importa cada módulo y los inicializa cuando el DOM está listo.
// ============================================================================

import { initState } from './state.js';
import { initCatalog } from './modules/catalog.js';
import { initCollection } from './modules/collection.js';
import { initCustomizer } from './modules/customizer.js';
import { initCart } from './modules/cart.js';
import { initAdmin } from './modules/admin.js';
import { initFAQ } from './modules/faq.js';
import { initHero } from './modules/hero.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Año en footer
  document.getElementById('footerYear').textContent = new Date().getFullYear();

  // Inicializar estado global (carga config desde DB)
  await initState();

  // Inicializar módulos en paralelo donde sea posible
  await Promise.all([
    initHero(),
    initCatalog(),
    initCollection(),
    initCustomizer(),
    initCart(),
    initFAQ()
  ]);

  // Admin se inicializa después (no es crítico para el primer render)
  initAdmin();
});

// Toast global accesible desde cualquier módulo
export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show toast-${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

window.showToast = showToast;  // por si algún módulo no-import lo necesita
