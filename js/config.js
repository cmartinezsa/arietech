// ============================================================================
// ARIE TECH — Configuración
// ============================================================================
// IMPORTANTE: Solo usa la "anon public" key aquí. Es segura para exponer.
// La service_role key NUNCA debe ponerse en el frontend.

export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';

// ----------------------------------------------------------------------------
// Configuración de la app
// ----------------------------------------------------------------------------
export const APP_CONFIG = {
  brand: 'ARIE TECH',
  tagline: 'Estudio textil · Querétaro',
  contactEmail: 'hola@arietech.mx',
  whatsappNumber: '524420000000',  // formato sin espacios ni +
  currency: 'MXN',
  locale: 'es-MX'
};

// ----------------------------------------------------------------------------
// Defaults visuales (se sobreescriben por app_config en la DB cuando carga)
// ----------------------------------------------------------------------------
export const DEFAULTS = {
  textColors: ['#FFFFFF', '#0A0A0A', '#14B8A6', '#1E5BFF', '#E25856', '#C49100', '#5C1A23', '#E89AB6'],
  basePrices: { redondo: 349, polo: 489, oversized: 449 },
  styleNames: { redondo: 'Cuello Redondo', polo: 'Polo', oversized: 'Oversized' }
};
