// ============================================================================
// ARIE TECH — state.js
// Estado global de la app. Carga config desde la DB y la cachea.
// ============================================================================

import { configAPI, productsAPI, galleryAPI } from './api.js';
import { DEFAULTS } from './config.js';

export const state = {
  // Configuración (se llena en initState)
  basePrices: DEFAULTS.basePrices,
  styleNames: DEFAULTS.styleNames,
  textColors: DEFAULTS.textColors,
  sizesByStyle: {},
  shippingMethods: [],

  // Datos
  products: [],
  gallery: [],

  // Estado del personalizador
  customizer: {
    productId: null,
    style: 'redondo',
    gender: 'hombre',
    size: 'M',
    side: 'front',
    front: { type: null, value: null, x: 50, y: 50, scale: 1, color: '#FFFFFF', font: 'Inter' },
    back: { type: null, value: null, x: 50, y: 50, scale: 1, color: '#FFFFFF', font: 'Inter' }
  },

  // Listeners para reactividad
  listeners: new Set()
};

export async function initState() {
  try {
    // Cargar config en paralelo
    const [basePrices, styleNames, textColors, sizesByStyle, shippingMethods] = await Promise.all([
      configAPI.get('base_prices'),
      configAPI.get('style_names'),
      configAPI.get('text_colors'),
      configAPI.get('sizes_by_style'),
      configAPI.get('shipping_methods')
    ]);

    if (basePrices) state.basePrices = basePrices;
    if (styleNames) state.styleNames = styleNames;
    if (textColors) state.textColors = textColors;
    if (sizesByStyle) state.sizesByStyle = sizesByStyle;
    if (shippingMethods) state.shippingMethods = shippingMethods;

    // Cargar productos y galería
    const [products, gallery] = await Promise.all([
      productsAPI.listAll(),
      galleryAPI.listAll()
    ]);
    state.products = products || [];
    state.gallery = gallery || [];

    notifyAll();
  } catch (err) {
    console.error('Error inicializando estado:', err);
    // La app sigue funcionando con DEFAULTS
  }
}

export function setState(patch) {
  Object.assign(state, patch);
  notifyAll();
}

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notifyAll() {
  state.listeners.forEach((fn) => {
    try { fn(state); } catch (e) { console.error(e); }
  });
}
