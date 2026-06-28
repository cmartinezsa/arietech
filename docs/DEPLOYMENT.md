# Guía de publicación paso a paso

Sigue este orden. Cada paso depende del anterior.

## Pre-requisitos

- Cuenta en GitHub (gratis) — para guardar el código.
- Cuenta en Supabase (gratis) — para la base de datos y storage.
- Cuenta en Vercel o Netlify (gratis) — para hospedar el sitio.
- Node.js instalado localmente (solo para los scripts de migración).
- Editor de código (VS Code recomendado).

Si no tienes alguna, créala antes de continuar. Todas son gratuitas para empezar.

---

## Parte 1 — Configurar Supabase

### 1.1 Crear el proyecto

1. Ve a https://supabase.com y haz clic en **New Project**.
2. Nombre: `arie-tech-prod` (o el que prefieras).
3. Contraseña de la base: **guárdala bien**, la necesitarás para conexiones administrativas.
4. Región: la más cercana a México (us-east-1 o us-west-1 funcionan bien).
5. Plan: Free (suficiente para empezar).
6. Espera ~2 minutos a que se aprovisione.

### 1.2 Ejecutar los SQL

En el dashboard de Supabase, ve a **SQL Editor → New Query**.

Ejecuta los archivos de `db/` en este orden, copiando el contenido completo de cada uno:

1. `db/01_schema.sql` — crea las tablas
2. `db/02_indexes.sql` — crea los índices
3. `db/03_triggers.sql` — crea los triggers de trazabilidad
4. `db/04_rls.sql` — activa Row Level Security
5. `db/05_functions.sql` — crea funciones helper
6. `db/06_seeds.sql` — inserta datos iniciales (productos base, galería, etc.)

Tras cada ejecución debe aparecer "Success. No rows returned" (excepto en seeds, que insertará filas).

### 1.3 Crear los buckets de Storage

En **Storage → Create bucket**, crea tres buckets:

| Nombre | Public bucket | File size limit | Allowed MIME types |
|---|---|---|---|
| `products` | ✅ Sí | 5 MB | image/jpeg, image/png, image/webp |
| `gallery` | ✅ Sí | 2 MB | image/svg+xml, image/png |
| `uploads` | ❌ No | 10 MB | image/jpeg, image/png, image/svg+xml, image/webp |

### 1.4 Crear usuario admin

En **Authentication → Users → Add user**, crea tu cuenta de admin:
- Email: tu correo
- Password: una contraseña fuerte
- Auto Confirm User: ✅ (para no esperar verificación por email en producción usa tu propio correo verificado)

Luego, en SQL Editor, marca a ese usuario como admin:

```sql
INSERT INTO public.admins (user_id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email = 'tu@correo.com';
```

### 1.5 Obtener las credenciales

Ve a **Project Settings → API** y copia:
- `Project URL` (algo como `https://xxxxx.supabase.co`)
- `anon public` key (la pública, segura para usar en frontend)
- `service_role` key (NUNCA la pongas en frontend, es para scripts de admin)

Guarda estos valores. Los usarás en el siguiente paso.

---

## Parte 2 — Migrar imágenes del HTML actual

Tu HTML monolítico actual tiene ~30 imágenes en base64 embebidas. Hay que sacarlas y subirlas a Supabase Storage.

### 2.1 Preparar el script

En tu computadora, abre una terminal en la carpeta `arie-tech-modular/`:

```bash
cd scripts/
npm init -y
npm install @supabase/supabase-js
```

Crea un archivo `.env` en la raíz del proyecto (NO lo subas a Git):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
SOURCE_HTML=/ruta/absoluta/al/arie-tech.html
```

### 2.2 Extraer e importar

```bash
cd scripts/
node extract_from_monolith.js   # Lee el HTML y extrae PRODUCTS + GALLERY
node upload_images.js           # Sube las imágenes a Supabase Storage e inserta en DB
```

Al terminar, en Supabase Storage deberías ver las imágenes en `products/` y `gallery/`. En SQL Editor verifica:

```sql
SELECT count(*) FROM products;        -- esperado: ~30
SELECT count(*) FROM gallery_designs; -- esperado: ~12
```

---

## Parte 3 — Configurar el frontend

### 3.1 Configurar credenciales públicas

Edita `public/js/config.js`:

```js
export const SUPABASE_URL = 'https://xxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJh...';  // ← la "anon public", no la service_role
```

⚠️ Solo usa la `anon` key aquí. La `service_role` no debe salir nunca del servidor/scripts.

### 3.2 Probar en local

Sirve la carpeta `public/` con un servidor estático cualquiera. Opciones:

```bash
# Opción 1: si tienes Python
cd public/
python3 -m http.server 8000

# Opción 2: si tienes Node
cd public/
npx serve

# Opción 3: VS Code con extensión "Live Server"
```

Abre http://localhost:8000 y verifica que:
- El catálogo carga las imágenes desde Supabase Storage.
- La colección muestra los diseños desde la base de datos.
- El admin funciona con el login real (ya no contraseña hardcoded).

Si algo falla, abre la consola del navegador (F12) — el error te dirá si es CORS, credenciales o RLS.

---

## Parte 4 — Subir a Git y hospedar

### 4.1 Inicializar repositorio

```bash
cd arie-tech-modular/
git init
git add .
git commit -m "Initial commit"
```

Crea un repositorio en GitHub (privado preferiblemente) y sube:

```bash
git remote add origin https://github.com/tu-usuario/arie-tech.git
git branch -M main
git push -u origin main
```

### 4.2 Deploy en Vercel

1. Ve a https://vercel.com → **New Project**.
2. Importa tu repositorio de GitHub.
3. En "Root Directory" elige `public/`.
4. En "Build Command" deja vacío (es estático).
5. En "Output Directory" pon `.` (un punto).
6. Click **Deploy**.

En 30 segundos tendrás un sitio en `https://arie-tech-xxx.vercel.app`.

### 4.3 Conectar dominio propio

En Vercel → **Settings → Domains**:
1. Añade tu dominio (ej. `arietech.mx`).
2. Sigue las instrucciones para actualizar los registros DNS en tu proveedor de dominio (Namecheap, GoDaddy, Cloudflare, etc.).
3. Espera 5–60 minutos a que se propague el DNS.

### 4.4 Configurar variables de entorno en Vercel

Si tu `config.js` lee variables de entorno (recomendado para no exponer las keys en Git):

En Vercel → **Settings → Environment Variables**:
- `SUPABASE_URL` → tu URL
- `SUPABASE_ANON_KEY` → tu anon key

Luego haz redeploy.

---

## Parte 5 — Configurar el admin en producción

### 5.1 Verificar acceso

Visita `https://tu-dominio.com` y abre el modal admin (Ctrl/Cmd+Shift+A o el botón flotante).

Ahora pide email + contraseña en lugar de solo contraseña. Usa las credenciales que creaste en el paso 1.4.

### 5.2 Auditar logs

En Supabase → **Table Editor → admin_logs** verás cada acción que hagas en el admin. Esto es la trazabilidad: quién, qué, cuándo, desde qué IP.

### 5.3 Configurar backups

Supabase hace backups automáticos diarios en el plan Pro. En el plan Free los backups son manuales:

```bash
# Desde tu terminal
npx supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres" > backup-$(date +%Y%m%d).sql
```

Configúralo como cron job semanal en tu computadora o en GitHub Actions.

---

## Parte 6 — Recibir pedidos

Por ahora el carrito guarda los items pero no procesa pagos. Para recibir pedidos reales tienes dos opciones:

### Opción A — Sin pasarela de pago (más simple, MVP)

El botón "Continuar al pago" genera un pedido en la tabla `orders` con status `pending_payment` y muestra al cliente:
- Datos para transferencia bancaria
- Botón "Enviar por WhatsApp" con resumen del pedido

El admin recibe notificación por email cuando entra un pedido. Una vez confirmado el pago, cambia el status manualmente.

### Opción B — Con pasarela de pago

Integra **Stripe** (recomendado), **Mercado Pago** o **Conekta**. Cada uno tiene SDK de JavaScript. El flujo:

1. Cliente hace clic en "Continuar al pago".
2. Se crea el pedido en estado `pending_payment`.
3. Se redirige a checkout de la pasarela.
4. Webhook actualiza el pedido a `confirmed` cuando se completa el pago.

La integración de pasarela está fuera del alcance de este repo pero el modelo de datos ya está preparado (campo `payment_method`, `payment_status`, `order_events` registra el webhook).

---

## Checklist final

Antes de promocionar el sitio:

- [ ] SQL ejecutado completo, sin errores.
- [ ] Imágenes migradas a Storage (verificar en `products/` y `gallery/`).
- [ ] Catálogo se ve correctamente en producción.
- [ ] Personalizador carga la galería desde la DB.
- [ ] Admin login funciona con credenciales reales.
- [ ] Carrito persiste en localStorage del cliente (UX) Y en la tabla `carts` (server).
- [ ] Email transaccional configurado (Supabase Auth → Email Templates).
- [ ] HTTPS activo (lo da Vercel automático).
- [ ] Dominio personalizado apunta correctamente.
- [ ] Política de privacidad y términos publicados (requisito legal en MX).
- [ ] Backup manual probado: pudiste restaurar la DB desde el dump.

---

## Soporte

Errores comunes y soluciones en [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

Si rompes algo en producción y no sabes cómo arreglarlo:
1. Haz rollback en Vercel (cada deploy es atómico, hay botón "Rollback").
2. En Supabase no hay rollback automático — por eso los backups importan.
