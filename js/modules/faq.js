// ============================================================================
// ARIE TECH — faq.js
// Acordeón de FAQ. Lee preguntas del array hardcoded o desde app_config.
// ============================================================================

const FAQ_ITEMS = [
  {
    q: '¿Qué material usan en sus playeras?',
    a: '<p>Nuestra línea principal es <strong>100% algodón peinado de 180 g/m²</strong>. También manejamos mezclas (algodón/poliéster) para polos, sudaderas y deportivas.</p>'
  },
  {
    q: '¿Qué tallas manejan?',
    a: '<p>Desde <strong>XS hasta 2EG (3XL)</strong> en caballero y dama. La línea infantil cubre edades 2–14 años. Corte regular fit; dama es ligeramente silueteado.</p>'
  },
  {
    q: '¿Cómo funciona el personalizador?',
    a: '<p>Eliges modelo, color y talla. Agregas texto o subes una imagen y la arrastras donde quieras. Puedes diseñar frente y espalda. Antes de imprimir te enviamos mockup para confirmar.</p>'
  },
  {
    q: '¿Cuál es el mínimo de compra?',
    a: '<p>No hay mínimo. Puedes pedir una sola pieza. Para pedidos corporativos o eventos hay precios escalonados.</p>'
  },
  {
    q: '¿Qué técnica de impresión utilizan?',
    a: '<p><strong>Serigrafía</strong> para diseños con pocos colores y volúmenes mayores. <strong>DTF</strong> para full color, fotografías y unitarios.</p>'
  },
  {
    q: '¿Cuánto tarda mi pedido?',
    a: '<p><strong>3 a 5 días hábiles</strong> de producción más envío (1–3 días adicionales). Pedidos urgentes consultar.</p>'
  },
  {
    q: '¿Hacen envíos a todo México?',
    a: '<p>Sí, vía Estafeta, DHL, FedEx y Paquetexpress. Recibirás guía de rastreo. En Querétaro hacemos entrega directa.</p>'
  },
  {
    q: '¿Qué archivos acepta el personalizador?',
    a: '<p><strong>PNG, JPG, SVG y WEBP</strong>. PNG con fondo transparente para logos; resolución 300 DPI mínimo; SVG para vectores.</p>'
  },
  {
    q: '¿Puedo devolver o cambiar mi playera?',
    a: '<p>Las personalizadas no aplican cambio. Si hay defecto de fabricación lo reponemos sin costo. Las de Colección sin personalizar admiten cambio de talla en 5 días.</p>'
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: '<p>Transferencia, depósito, tarjeta (Visa, MC, AMEX), OXXO. Para corporativos manejamos facturación y crédito previo acuerdo.</p>'
  }
];

export function initFAQ() {
  const list = document.getElementById('faqList');
  if (!list) return;

  list.innerHTML = FAQ_ITEMS.map((item, i) => `
    <div class="faq-item">
      <button class="faq-question" type="button" aria-expanded="false" aria-controls="faq-${i}">
        <span>${item.q}</span>
        <span class="faq-icon">+</span>
      </button>
      <div class="faq-answer" id="faq-${i}">
        <div class="faq-answer-inner">${item.a}</div>
      </div>
    </div>
  `).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq-question');
    if (!btn) return;
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    list.querySelectorAll('.faq-item').forEach(it => {
      it.classList.remove('open');
      it.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
}
