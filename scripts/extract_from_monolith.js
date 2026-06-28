// extract_from_monolith.js
// Lee el HTML monolítico de Arie Tech y extrae los arrays PRODUCTS y GALLERY
// hacia archivos JSON locales que luego serán subidos a Supabase.
//
// Uso:
//   npm run extract
//
// Salida:
//   ./extracted/products.json   ← array de productos con imágenes base64
//   ./extracted/gallery.json    ← array de diseños de galería
//   ./extracted/colors.json     ← paleta de colores
//   ./extracted/prices.json     ← precios por defecto

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_HTML = path.resolve(__dirname, process.env.SOURCE_HTML || '../../arie-tech.html');
const OUT_DIR = path.resolve(__dirname, 'extracted');

console.log('📂 Leyendo HTML monolítico:', SOURCE_HTML);

if (!fs.existsSync(SOURCE_HTML)) {
  console.error('❌ No encontré el archivo. Verifica SOURCE_HTML en .env');
  process.exit(1);
}

const html = fs.readFileSync(SOURCE_HTML, 'utf8');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ===== Extraer arrays con regex tolerante =====
// Buscamos: const PRODUCTS = [ ... ];
function extractArray(name) {
  // El array puede contener cadenas con `[]` (data URIs), así que rastreamos brackets balanceados.
  const startMatch = html.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[`));
  if (!startMatch) return null;

  const startIdx = startMatch.index + startMatch[0].length - 1; // posición del '['
  let depth = 0;
  let inStr = false;
  let strChar = null;
  let escape = false;

  for (let i = startIdx; i < html.length; i++) {
    const ch = html[i];

    if (escape) { escape = false; continue; }
    if (inStr) {
      if (ch === '\\') { escape = true; continue; }
      if (ch === strChar) { inStr = false; strChar = null; }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true;
      strChar = ch;
      continue;
    }

    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        const raw = html.slice(startIdx, i + 1);
        try {
          // El array está en JS, pero usa JSON estricto en este HTML (comillas dobles).
          // Si fallara, hacer un eval seguro: new Function('return ' + raw)()
          return JSON.parse(raw);
        } catch (err) {
          try {
            // eslint-disable-next-line no-new-func
            return Function('"use strict";return (' + raw + ')')();
          } catch (err2) {
            console.error(`⚠️ No pude parsear ${name}:`, err2.message);
            return null;
          }
        }
      }
    }
  }
  return null;
}

const products = extractArray('PRODUCTS');
const gallery  = extractArray('GALLERY');
const colors   = extractArray('COLORS');
const sizes    = extractArray('SIZES');

if (!products) {
  console.error('❌ No encontré const PRODUCTS = [...] en el HTML.');
  process.exit(1);
}

// Algunos arrays/objetos extra (precios) los buscamos por separado
function extractObject(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\});`);
  const m = html.match(re);
  if (!m) return null;
  try {
    // eslint-disable-next-line no-new-func
    return Function('"use strict";return (' + m[1] + ')')();
  } catch (err) {
    return null;
  }
}

const prices = extractObject('PRICES') || extractObject('PRICE_BY_STYLE');

// ===== Estadísticas =====
console.log('\n📊 Resumen de extracción:');
console.log(`   • Productos:  ${products.length}`);
console.log(`   • Galería:    ${gallery ? gallery.length : 0}`);
console.log(`   • Colores:    ${colors ? colors.length : 0}`);
console.log(`   • Tallas:     ${sizes ? sizes.length : 0}`);
console.log(`   • Precios:    ${prices ? Object.keys(prices).length + ' entradas' : 'no encontrados'}`);

// Verificar que los productos tengan imagen base64
const withImages = products.filter(p => p.img && p.img.startsWith('data:image/')).length;
console.log(`   • Productos con imagen base64: ${withImages}/${products.length}`);

// ===== Guardar a disco =====
function write(name, data) {
  if (!data) return;
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`   ✓ ${name} (${sizeKB} KB)`);
}

console.log('\n💾 Guardando archivos JSON...');
write('products.json', products);
write('gallery.json',  gallery);
write('colors.json',   colors);
write('sizes.json',    sizes);
write('prices.json',   prices);

console.log('\n✅ Extracción completa. Ejecuta `npm run upload` para subir a Supabase.');
