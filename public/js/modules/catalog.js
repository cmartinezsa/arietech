// ============================================================================
// ARIE TECH — catalog.js
// Renderiza el catálogo principal desde la DB
// ============================================================================

import { state, subscribe } from '../state.js';

export async function initCatalog() {
  render();
  subscribe(render);
}

function render() {
  const grid = document.getElementById('catalogGrid');
  if (!grid || !state.products.length) return;

  // Agrupar por style + gender para mostrar 1 card por modelo (con sus colores)
  const groups = new Map();
  for (const p of state.products) {
    const key = `${p.style}|${p.gender}`;
    if (!groups.has(key)) {
      groups.set(key, {
        style: p.style,
        gender: p.gender,
        label: p.label,
        colors: [],
        firstImage: p.image_url
      });
    }
    groups.get(key).colors.push({
      id: p.id,
      code: p.color_code,
      name: p.color_name,
      hex: p.color_hex,
      image_url: p.image_url
    });
  }

  grid.innerHTML = '';
  for (const group of groups.values()) {
    grid.appendChild(buildCard(group));
  }
}

function buildCard(group) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.style = group.style;
  card.dataset.gender = group.gender;

  const priceFromState = state.basePrices[group.style] || 349;
  const styleName = state.styleNames[group.style] || group.style;
  const initial = group.colors[0];

  card.innerHTML = `
    <div class="product-image" data-img>
      <img src="${initial.image_url || ''}" alt="${group.label} ${initial.name}" loading="lazy" />
    </div>
    <div class="product-info">
      <div class="product-meta">
        <span class="product-style">${styleName}</span>
        <span class="product-gender">${group.gender}</span>
      </div>
      <h3 class="product-name">${group.label}</h3>
      <div class="product-colors" data-colors>
        ${group.colors.map((c, i) => `
          <button class="product-color ${i === 0 ? 'active' : ''}"
                  style="background:${c.hex}"
                  data-product-id="${c.id}"
                  data-image="${c.image_url || ''}"
                  title="${c.name}"
                  type="button"></button>
        `).join('')}
      </div>
      <div class="product-price">$${priceFromState}</div>
      <a href="#personalizar" class="btn btn-primary btn-sm" data-personalize>Personalizar</a>
    </div>
  `;

  // Cambio de color
  card.querySelector('[data-colors]').addEventListener('click', (e) => {
    const btn = e.target.closest('.product-color');
    if (!btn) return;
    card.querySelectorAll('.product-color').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const img = card.querySelector('[data-img] img');
    if (img && btn.dataset.image) img.src = btn.dataset.image;
  });

  return card;
}
