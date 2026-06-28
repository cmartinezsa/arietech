# Migración desde el HTML monolítico

Esta guía explica cómo pasar los datos del archivo HTML original (`arie-tech.html` de ~650 KB con todo embebido) a Supabase.

## Qué se migra

| Origen (en el HTML)         | Destino (Supabase)                      |
|-----------------------------|-----------------------------------------|
| `const PRODUCTS = [...]`    | Tabla `products` + bucket `products/`   |
| `const GALLERY = [...]`     | Tabla `gallery_designs` + bucket `gallery/` |
| `const COLORS = [...]`      | (referencia, no se migra)               |
| `const SIZES = [...]`       | (referencia, no se migra)               |
| `const PRICES = {...}`      | Tabla `app_config` (key=`prices`)       |
| Datos de localStorage       | **NO se migra** — empezar limpio        |

> **Nota:** los datos de la colección guardados en `localStorage.arie_collection_v1` no se migran automáticamente porque viven en el navegador de cada visitante. Si Arie Pérez (la dueña) quiere conservar los diseños de colección que armó en el HTML viejo, debe re-crearlos desde el nuevo panel admin (es lo más limpio).

## Pasos

### 1) Prepara las llaves de Supabase

Después de seguir `DEPLOYMENT.md` parte 1, tendrás dos llaves:

- **anon key** → va en `public/js/config.js` (segura, pública)
- **service_role key** → va en `scripts/.env` (¡secreta, NUNCA al frontend!)

Encuéntralas en: Settings → API.

### 2) Configura `scripts/.env`

```bash
cd scripts
cp .env.example .env
# edita .env con tus valores reales
```

Contenido mínimo:

```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
SOURCE_HTML=../../arie-tech.html
BUCKET_PRODUCTS=products
BUCKET_GALLERY=gallery
```

`SOURCE_HTML` debe apuntar al HTML monolítico viejo. Si lo tienes en otra carpeta, usa una ruta absoluta.

### 3) Instala dependencias

```bash
cd scripts
npm install
```

### 4) Verifica que los buckets existan

El script `upload_images.js` crea los buckets automáticamente si no existen, pero también puedes crearlos a mano:

- Storage → New bucket → `products` (Public)
- Storage → New bucket → `gallery` (Public)
- Storage → New bucket → `uploads` (Private)

### 5) Ejecuta la migración

Opción A — todo de un golpe:
```bash
npm run migrate
```

Opción B — paso a paso para depurar:
```bash
npm run extract  # genera scripts/extracted/*.json
npm run upload   # sube las imágenes y llena las tablas
```

Salida esperada:

```
📂 Leyendo HTML monolítico: /ruta/a/arie-tech.html

📊 Resumen de extracción:
   • Productos:  30
   • Galería:    12
   • Colores:    9
   • Tallas:     5
   • Precios:    4 entradas
   • Productos con imagen base64: 30/30

💾 Guardando archivos JSON...
   ✓ products.json (487.2 KB)
   ✓ gallery.json (12.4 KB)
   ...

🚀 Iniciando migración a Supabase
   URL: https://abcdefgh.supabase.co

📦 Subiendo 30 productos...
   ✓ 30/30
   Resultado: 30 OK, 0 errores

🎨 Subiendo 12 diseños de galería...
   ✓ 12/12
   Resultado: 12 OK, 0 errores

⚙️  Guardando precios en app_config...
   ✓ Precios cargados

✅ Migración completa.
```

### 6) Verifica en Supabase

- **Table Editor → products:** deben aparecer los ~30 productos con `image_url` apuntando a URLs `https://...supabase.co/storage/v1/object/public/products/...`.
- **Storage → products:** debe haber carpetas por estilo/género.
- **Table Editor → gallery_designs:** los 12 diseños.

### 7) Configura el frontend

Edita `public/js/config.js`:

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...'; // la ANON, no la service_role
```

### 8) Prueba localmente

```bash
cd public
python3 -m http.server 8080
# abre http://localhost:8080
```

Si ves los productos cargando desde Supabase, ¡la migración funcionó!

## Si algo sale mal

| Síntoma                                       | Causa probable                                  |
|-----------------------------------------------|-------------------------------------------------|
| `❌ No encontré el archivo`                   | Ruta `SOURCE_HTML` incorrecta en `.env`         |
| `⚠️ No pude parsear PRODUCTS`                 | El HTML fue modificado; revisa que el array siga sintaxis JS válida |
| `JWT expired` / `Invalid API key`             | Llave incorrecta o expirada en `.env`           |
| `new row violates row-level security policy`  | Estás usando la `anon key` en lugar de la `service_role` |
| `Bucket not found`                            | Crea los buckets manualmente en Storage         |
| Productos sin imagen tras migrar              | RLS bloquea lectura pública; ejecuta `04_rls.sql` |

## ¿Y si quiero re-correr la migración?

Es seguro: los scripts usan `upsert` con `onConflict: 'id'`. Si vuelves a correrlos, las filas existentes se actualizan en lugar de duplicarse, y las imágenes se sobreescriben (`upsert: true`).

## Después de migrar: pasos siguientes

1. Crear tu primer usuario admin (ver `DEPLOYMENT.md` parte 1.6).
2. Iniciar sesión en `/admin` desde el navegador.
3. Crear los diseños de colección que necesites.
4. Probar el flujo de compra completo end-to-end.
5. Conectar el dominio en Vercel/Netlify.

A partir de aquí, **olvídate del HTML monolítico**. Toda la data vive en Supabase y se administra desde el panel.
