// ============================================================================
// ARIE TECH — hero.js
// Renderiza la playera SVG del hero
// ============================================================================

export async function initHero() {
  const svg = document.getElementById('heroShirt');
  if (!svg) return;

  // SVG de playera básica con gradiente teal
  svg.innerHTML = `
    <defs>
      <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#14B8A6"/>
        <stop offset="100%" stop-color="#0D9488"/>
      </linearGradient>
    </defs>
    <path d="M80 80 L60 130 L100 150 L100 360 Q100 380 120 380 L200 380 Q220 380 220 360 L220 150 L260 130 L240 80 L210 70 Q200 90 160 90 Q120 90 110 70 Z"
          fill="url(#heroGrad)" stroke="#0A2620" stroke-width="2" stroke-linejoin="round"/>
    <text x="160" y="220" text-anchor="middle" font-family="Bricolage Grotesque" font-size="32" font-weight="700" fill="#F0FAF7">ARIE</text>
    <text x="160" y="250" text-anchor="middle" font-family="JetBrains Mono" font-size="14" fill="#F0FAF7" opacity="0.85">TECH</text>
  `;
}
