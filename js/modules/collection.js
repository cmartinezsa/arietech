// ============================================================================
// ARIE TECH — collection.js
// Muestra los diseños pre-armados de la sección Colección
// ============================================================================

import { collectionAPI, cartAPI } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../main.js';

let designs = [];

export async function initCollection() {
  const grid = document.getElementById('collectionGrid');
  if (!grid) return;

  try {
    designs = await collectionAPI.listAll();
    render(grid);
  } catch (err) {
    console.error('Error cargando colección:', err);
    grid.innerHTML = '<div class="empty">No se pudo cargar la colección.</div>';
  }

  initSizePicker();
}

function render(grid) {
  if (!designs.length) {
    grid.innerHTML = '<div class="empty">Aún no hay diseños en la colección.</div>';
    return;
  }

  grid.innerHTML = designs.map(d => `
    <article class="design-card" data-id="${d.id}">
      ${d.tag ? `<span class="design-tag">${d.tag}</span>` : ''}
      <div class="design-preview" style="background:${getFirstColorHex(d)}">
        ${d.preview_image_url
          ? `<img src="${d.preview_image_url}" alt="${d.name}" loading="lazy" />`
          : `<div class="design-placeholder">${d.name}</div>`}
      </div>
      <div class="design-info">
        <h3 class="design-name">${d.name}</h3>
        ${d.description ? `<p class="design-desc">${d.description}</p>` : ''}
        <div class="design-colors">
          ${d.available_color_codes.slice(0, 5).map(code => {
            const prod = state.products.find(p => p.style === d.base_style && p.color_code === code);
            return prod ? `<span class="color-swatch" style="background:${prod.color_hex}" title="${prod.color_name}"></span>` : '';
          }).join('')}
        </div>
        <div class="design-bottom">
          <span class="design-price">$${d.price || state.basePrices[d.base_style] || 349}</span>
          <button class="btn btn-primary btn-sm" data-add="${d.id}" type="button">Agregar</button>
        </div>
      </div>
    </article>
  `).join('');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (btn) openSizePicker(btn.dataset.add);
  });
}

function getFirstColorHex(design) {
  const code = design.available_color_codes?.[0];
  if (!code) return '#F0FAF7';
  const prod = state.products.find(p => p.style === design.base_style && p.color_code === code);
  return prod?.color_hex || '#F0FAF7';
}

// ============================================================================
// Size picker modal
// ============================================================================
let currentDesign = null;
let pickedColor = null;
let pickedSize = null;

function initSizePicker() {
  const backdrop = document.getElementById('sizePickerBackdrop');
  if (!backdrop) return;
  backdrop.innerHTML = `
    <div class="size-picker">
      <h3 id="spName">Diseño</h3>
      <div class="size-picker-sub">Selecciona color y talla</div>
      <div class="size-picker-preview" id="spPreview"></div>
      <div class="size-picker-section-title">Color</div>
      <div class="size-picker-colors" id="spColors"></div>
      <div class="size-picker-section-title">Talla</div>
      <div class="size-picker-sizes" id="spSizes"></div>
      <div class="size-picker-actions">
        <button class="btn btn-ghost" id="spCancel" type="button">Cancelar</button>
        <button class="btn btn-primary" id="spAdd" type="button">Agregar — $<span id="spPrice">0</span></button>
      </div>
    </div>
  `;

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.id === 'spCancel') closeSizePicker();
    if (e.target.id === 'spAdd') addToCart();
  });
}

function openSizePicker(designId) {
  currentDesign = designs.find(d => d.id === designId);
  if (!currentDesign) return;

  pickedColor = currentDesign.available_color_codes[0];
  pickedSize = currentDesign.available_sizes[Math.floor(currentDesign.available_sizes.length / 2)];

  document.getElementById('spName').textContent = currentDesign.name;
  document.getElementById('spPrice').textContent = currentDesign.price || state.basePrices[currentDesign.base_style] || 349;

  // Colores
  document.getElementById('spColors').innerHTML = currentDesign.available_color_codes.map(code => {
    const p = state.products.find(pr => pr.style === currentDesign.base_style && pr.color_code === code);
    if (!p) return '';
    return `<button class="color-swatch ${code === pickedColor ? 'active' : ''}" data-color="${code}" style="background:${p.color_hex}" title="${p.color_name}" type="button"></button>`;
  }).join('');

  document.getElementById('spColors').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    pickedColor = btn.dataset.color;
    document.querySelectorAll('#spColors .color-swatch').forEach(b => b.classList.toggle('active', b.dataset.color === pickedColor));
  });

  // Tallas
  document.getElementById('spSizes').innerHTML = currentDesign.available_sizes.map(s => `
    <button class="size-btn ${s === pickedSize ? 'active' : ''}" data-size="${s}" type="button">${s}</button>
  `).join('');

  document.getElementById('spSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-size]');
    if (!btn) return;
    pickedSize = btn.dataset.size;
    document.querySelectorAll('#spSizes .size-btn').forEach(b => b.classList.toggle('active', b.dataset.size === pickedSize));
  });

  document.getElementById('sizePickerBackdrop').classList.add('show');
}

function closeSizePicker() {
  document.getElementById('sizePickerBackdrop').classList.remove('show');
}

async function addToCart() {
  try {
    const prod = state.products.find(p => p.style === currentDesign.base_style && p.color_code === pickedColor);
    if (!prod) return showToast('Color no disponible');

    await cartAPI.addItem({
      productId: prod.id,
      collectionDesignId: currentDesign.id,
      customDesignData: {
        type: 'collection',
        design_name: currentDesign.name,
        gallery_design_id: currentDesign.gallery_design_id,
        side: currentDesign.side
      },
      size: pickedSize,
      quantity: 1,
      unitPrice: currentDesign.price || state.basePrices[currentDesign.base_style] || 349,
      previewImageUrl: currentDesign.preview_image_url
    });

    showToast('Agregado al carrito', 'success');
    closeSizePicker();
    window.dispatchEvent(new CustomEvent('cart:updated'));
  } catch (err) {
    console.error(err);
    showToast('No se pudo agregar', 'error');
  }
}
