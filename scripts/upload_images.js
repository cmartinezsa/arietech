// upload_images.js
// Lee los JSON generados por extract_from_monolith.js, sube las imágenes
// (data URIs base64) a Supabase Storage y crea las filas en la base de datos.
//
// Uso:
//   npm run upload
//
// Requiere variables en .env:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, BUCKET_PRODUCTS, BUCKET_GALLERY

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACTED_DIR = path.resolve(__dirname, 'extracted');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BUCKET_PRODUCTS = process.env.BUCKET_PRODUCTS || 'products';
const BUCKET_GALLERY  = process.env.BUCKET_GALLERY  || 'gallery';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ===== Utilidades =====
function dataUriToBuffer(dataUri) {
  // data:image/jpeg;base64,/9j/4AA...
  const match = dataUri.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error('Data URI inválido');
  return {
    mime: match[1],
    ext:  match[1].split('/')[1].replace('jpeg', 'jpg'),
    buf:  Buffer.from(match[2], 'base64')
  };
}

async function ensureBucket(name, isPublic = true) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets.some(b => b.name === name)) return;
  console.log(`   → Creando bucket "${name}"...`);
  const { error } = await supabase.storage.createBucket(name, { public: isPublic });
  if (error && !error.message.includes('already exists')) throw error;
}

async function uploadDataUri(bucket, key, dataUri) {
  const { mime, buf } = dataUriToBuffer(dataUri);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, buf, { contentType: mime, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

// ===== Subir productos =====
async function uploadProducts() {
  const file = path.join(EXTRACTED_DIR, 'products.json');
  if (!fs.existsSync(file)) {
    console.log('⚠️  No hay products.json. Saltando productos.');
    return;
  }
  const products = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n📦 Subiendo ${products.length} productos...`);
  await ensureBucket(BUCKET_PRODUCTS, true);

  let ok = 0, errors = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      let imageUrl = p.img;

      // Si la imagen es un data URI, súbela a Storage
      if (p.img && p.img.startsWith('data:image/')) {
        const ext = p.img.match(/^data:image\/([a-z]+)/)[1].replace('jpeg', 'jpg');
        const key = `${p.style}/${p.gender}/${p.id}.${ext}`;
        imageUrl = await uploadDataUri(BUCKET_PRODUCTS, key, p.img);
      }

      // Insertar (o actualizar) la fila
      const { error } = await supabase.from('products').upsert({
        id:               p.id,
        style:            p.style,
        gender:           p.gender,
        label:            p.label,
        color_code:       p.colorCode,
        color_name:       p.colorName,
        color_hex:        p.colorHex,
        image_url:        imageUrl,
        available_sizes:  p.sizes || ['CH', 'M', 'G', 'EG'],
        sort_order:       i
      }, { onConflict: 'id' });

      if (error) throw error;

      ok++;
      process.stdout.write(`\r   ✓ ${ok}/${products.length}`);
    } catch (err) {
      errors++;
      console.error(`\n   ✗ Error en ${p.id}:`, err.message);
    }
  }
  console.log(`\n   Resultado: ${ok} OK, ${errors} errores`);
}

// ===== Subir galería =====
async function uploadGallery() {
  const file = path.join(EXTRACTED_DIR, 'gallery.json');
  if (!fs.existsSync(file)) {
    console.log('⚠️  No hay gallery.json. Saltando galería.');
    return;
  }
  const gallery = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n🎨 Subiendo ${gallery.length} diseños de galería...`);
  await ensureBucket(BUCKET_GALLERY, true);

  let ok = 0, errors = 0;
  for (const g of gallery) {
    try {
      let imageUrl = g.image_url || g.img || null;

      // Si la galería trae SVG embebido como string, súbela como archivo .svg
      if (g.svg && typeof g.svg === 'string') {
        const key = `${g.id || g.name.toLowerCase().replace(/\s+/g, '-')}.svg`;
        const { error } = await supabase.storage
          .from(BUCKET_GALLERY)
          .upload(key, Buffer.from(g.svg, 'utf8'), { contentType: 'image/svg+xml', upsert: true });
        if (error && !error.message.includes('already exists')) throw error;
        const { data } = supabase.storage.from(BUCKET_GALLERY).getPublicUrl(key);
        imageUrl = data.publicUrl;
      } else if (g.img && g.img.startsWith('data:image/')) {
        const ext = g.img.match(/^data:image\/([a-z]+)/)[1].replace('jpeg', 'jpg');
        const key = `${g.id || g.name.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
        imageUrl = await uploadDataUri(BUCKET_GALLERY, key, g.img);
      }

      const { error } = await supabase.from('gallery_designs').upsert({
        id:           g.id,
        name:         g.name,
        svg_content:  g.svg || null,
        image_url:    imageUrl,
        category:     g.category || 'general'
      }, { onConflict: 'id' });

      if (error) throw error;
      ok++;
      process.stdout.write(`\r   ✓ ${ok}/${gallery.length}`);
    } catch (err) {
      errors++;
      console.error(`\n   ✗ Error en ${g.id || g.name}:`, err.message);
    }
  }
  console.log(`\n   Resultado: ${ok} OK, ${errors} errores`);
}

// ===== Subir configuración (precios, etc.) =====
async function uploadConfig() {
  const file = path.join(EXTRACTED_DIR, 'prices.json');
  if (!fs.existsSync(file)) return;
  const prices = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('\n⚙️  Guardando precios en app_config...');
  const { error } = await supabase.from('app_config').upsert({
    key:   'prices',
    value: prices
  }, { onConflict: 'key' });
  if (error) console.error('   ✗', error.message);
  else console.log('   ✓ Precios cargados');
}

// ===== Main =====
(async () => {
  console.log('🚀 Iniciando migración a Supabase');
  console.log('   URL:', SUPABASE_URL);

  try {
    await uploadProducts();
    await uploadGallery();
    await uploadConfig();
    console.log('\n✅ Migración completa.');
    console.log('   Verifica en el panel de Supabase: Table Editor → products, gallery_designs');
  } catch (err) {
    console.error('\n❌ Falló la migración:', err);
    process.exit(1);
  }
})();
