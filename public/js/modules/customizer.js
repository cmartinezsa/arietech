// ============================================================================
// ARIE TECH — customizer.js
// Personalizador de playeras con drag-positioning.
//
// ⚠️ Este módulo es complejo. La versión completa debe portarse desde el
// HTML monolítico original (arie-tech.html) — específicamente las funciones:
//   renderPreview, renderFrontShirt, renderBackShirt, renderColorGrid,
//   renderTextColors, renderGallery, updatePrice, addToCart, y los handlers
//   de drag.
//
// Esta versión es un stub funcional que renderiza la estructura básica.
// ============================================================================

import { state } from '../state.js';
import { uploadsAPI, cartAPI } from '../api.js';
import { showToast } from '../main.js';

export async function initCustomizer() {
  const root = document.getElementById('customizerRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="customizer-preview">
      <div class="preview-grid">
        <div class="preview active-side" data-side="front">
          <div class="preview-label">Frente</div>
          <svg id="previewFront" viewBox="0 0 320 410" xmlns="http://www.w3.org/2000/svg"></svg>
        </div>
        <div class="preview" data-side="back">
          <div class="preview-label">Atrás</div>
          <svg id="previewBack" viewBox="0 0 320 410" xmlns="http://www.w3.org/2000/svg"></svg>
        </div>
      </div>
      <div class="preview-info">
        <strong id="previewModelName">Clásica Redondo</strong>
        · <span id="previewColorName">Negro</span>
        · Talla <span id="previewSize">M</span>
      </div>
    </div>

    <div class="customizer-controls">
      <div class="control-block">
        <div class="control-label">Modelo</div>
        <div class="inline-controls">
          <select class="mini-select" id="genderSelect">
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
            <option value="unisex">Unisex</option>
          </select>
          <select class="mini-select" id="styleSelect">
            <option value="redondo">Cuello Redondo</option>
            <option value="polo">Polo</option>
            <option value="oversized">Oversized</option>
          </select>
        </div>
      </div>

      <div class="control-block">
        <div class="control-label">Color</div>
        <div class="color-grid" id="colorGrid"></div>
      </div>

      <div class="control-block">
        <div class="control-label">Talla</div>
        <div class="size-row" id="sizeRow"></div>
      </div>

      <div class="control-block">
        <div class="control-label">Tu diseño</div>
        <div class="design-source-tabs">
          <button class="source-tab active" data-source="text" type="button">Texto</button>
          <button class="source-tab" data-source="gallery" type="button">Galería</button>
          <button class="source-tab" data-source="upload" type="button">Subir imagen</button>
        </div>
        <div class="source-panel active" data-panel="text">
          <input type="text" class="text-input" id="textInput" placeholder="Tu texto aquí" maxlength="20" />
        </div>
        <div class="source-panel" data-panel="gallery">
          <div class="gallery-grid" id="galleryGrid"></div>
        </div>
        <div class="source-panel" data-panel="upload">
          <label class="upload-area">
            <input type="file" id="imageInput" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden />
            <span>Click para subir o arrastra aquí</span>
          </label>
        </div>
      </div>

      <div class="customizer-footer">
        <div class="total">
          <span class="total-label">Total</span>
          <span class="total-value">$<span id="totalPrice">349</span></span>
        </div>
        <button class="btn btn-primary" id="addToCartBtn" type="button">Agregar al carrito</button>
      </div>
    </div>
  `;

  renderColorGrid();
  renderSizes();
  renderGallery();
  bindEvents();
  updatePrice();
}

function renderColorGrid() {
  const grid = document.getElementById('colorGrid');
  const style = document.getElementById('styleSelect').value;
  const gender = document.getElementById('genderSelect').value;

  const colors = state.products.filter(p => p.style === style && p.gender === gender);
  grid.innerHTML = colors.map((c, i) => `
    <button class="color-swatch ${i === 0 ? 'active' : ''}"
            style="background:${c.color_hex}"
            data-product-id="${c.id}"
            title="${c.color_name}" type="button"></button>
  `).join('');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-swatch');
    if (!btn) return;
    grid.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.customizer.productId = btn.dataset.productId;
  }, { once: true });

  if (colors.length) state.customizer.productId = colors[0].id;
}

function renderSizes() {
  const row = document.getElementById('sizeRow');
  const style = document.getElementById('styleSelect').value;
  const sizes = state.sizesByStyle[style] || ['XS','S','M','L','XL','XXL'];
  row.innerHTML = sizes.map(s => `
    <button class="size-btn ${s === 'M' ? 'active' : ''}" data-size="${s}" type="button">${s}</button>
  `).join('');
  row.addEventListener('click', (e) => {
    const btn = e.target.closest('.size-btn');
    if (!btn) return;
    row.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.customizer.size = btn.dataset.size;
  });
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid || !state.gallery.length) return;
  grid.innerHTML = state.gallery.map(g => `
    <button class="gallery-item" data-id="${g.id}" title="${g.name}" type="button">
      ${g.svg_content || (g.image_url ? `<img src="${g.image_url}" alt="${g.name}" />` : g.name)}
    </button>
  `).join('');
}

function bindEvents() {
  document.getElementById('styleSelect').addEventListener('change', () => {
    renderColorGrid();
    renderSizes();
    updatePrice();
  });
  document.getElementById('genderSelect').addEventListener('change', renderColorGrid);

  document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const upload = await uploadsAPI.upload(file);
      showToast('Imagen subida', 'success');
      // Asociar al diseño activo
      const side = state.customizer.side;
      state.customizer[side].type = 'image';
      state.customizer[side].value = upload.public_url;
    } catch (err) {
      console.error(err);
      showToast('Error al subir imagen', 'error');
    }
  });

  document.getElementById('addToCartBtn').addEventListener('click', async () => {
    if (!state.customizer.productId) return showToast('Selecciona un color', 'error');
    try {
      await cartAPI.addItem({
        productId: state.customizer.productId,
        customDesignData: {
          type: 'custom',
          front: state.customizer.front,
          back: state.customizer.back
        },
        size: state.customizer.size,
        quantity: 1,
        unitPrice: state.basePrices[document.getElementById('styleSelect').value] || 349
      });
      showToast('Agregado al carrito', 'success');
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (err) {
      console.error(err);
      showToast('No se pudo agregar', 'error');
    }
  });

  // Tabs de fuente de diseño
  document.querySelectorAll('.source-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.source-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-panel="${tab.dataset.source}"]`).classList.add('active');
    });
  });
}

function updatePrice() {
  const style = document.getElementById('styleSelect').value;
  document.getElementById('totalPrice').textContent = state.basePrices[style] || 349;
}
