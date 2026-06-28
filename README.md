# Arie Tech — Arquitectura modular

Este proyecto convierte el HTML monolítico actual en una aplicación web modular con backend real, base de datos y almacenamiento persistente de imágenes.

## Decisiones de arquitectura

### Stack elegido

| Capa | Tecnología | Por qué |
|---|---|---|
| **Frontend** | HTML + CSS + JS vanilla (módulos ES6) | Mantiene la simplicidad del proyecto actual, sin frameworks pesados. Migración gradual desde el HTML monolítico. |
| **Backend / DB** | Supabase (Postgres + Storage + Auth) | Free tier generoso, sin servidor que mantener, incluye autenticación, storage de archivos y API REST/GraphQL autogenerada. Documentación en español. |
| **Hosting** | Vercel o Netlify | Deploy desde Git, certificado SSL automático, dominio personalizado, CDN global. Free tier suficiente. |
| **Imágenes** | Supabase Storage (S3-compatible) | URLs públicas, control de acceso por carpeta, optimización on-demand. |

### Por qué Supabase y no otra cosa

- **Vs. Firebase**: Postgres > Firestore para datos relacionales como pedidos/items. SQL estándar = no quedas atrapado en un vendor.
- **Vs. backend propio (Node + Postgres)**: ahorras 80% del trabajo. No necesitas escribir endpoints CRUD ni manejar despliegues de backend.
- **Vs. Shopify/Wix**: no permiten el personalizador con drag-and-drop ni el módulo admin que ya tienes.

Si después quieres migrar a un backend propio, el SQL es estándar Postgres — se exporta tal cual.

---

## Estructura del proyecto

```
arie-tech-modular/
├── README.md                    ← Este archivo
├── docs/
│   ├── DEPLOYMENT.md            ← Pasos para publicar (léelo después)
│   ├── ARCHITECTURE.md          ← Detalle técnico
│   └── MIGRATION.md             ← Cómo migrar del HTML actual
├── public/                      ← Lo que se sube al hosting
│   ├── index.html               ← Estructura HTML limpia (sin JS/CSS inline)
│   ├── css/
│   │   ├── base.css             ← Variables, reset, tipografía
│   │   ├── layout.css           ← Header, footer, grid principal
│   │   ├── components.css       ← Botones, inputs, cards
│   │   ├── sections.css         ← Hero, catálogo, colección, etc.
│   │   └── responsive.css       ← Media queries
│   ├── js/
│   │   ├── config.js            ← Constantes y configuración
│   │   ├── api.js               ← Cliente Supabase (reemplaza localStorage)
│   │   ├── state.js             ← Estado global de la app
│   │   ├── main.js              ← Orquestador, inicialización
│   │   └── modules/
│   │       ├── hero.js
│   │       ├── catalog.js
│   │       ├── collection.js
│   │       ├── customizer.js
│   │       ├── cart.js
│   │       ├── admin.js
│   │       └── faq.js
│   └── assets/
│       └── (logo, favicon, fotos opcionales)
├── db/
│   ├── 01_schema.sql            ← Tablas
│   ├── 02_indexes.sql           ← Índices de performance
│   ├── 03_triggers.sql          ← Trazabilidad automática
│   ├── 04_rls.sql               ← Row Level Security (seguridad)
│   ├── 05_functions.sql         ← Funciones SQL helper
│   └── 06_seeds.sql             ← Datos iniciales
└── scripts/
    ├── extract_from_monolith.js ← Extrae datos del HTML actual
    └── upload_images.js         ← Sube imágenes base64 a Supabase Storage
```

---

## Modelo de datos (resumen)

Las tablas principales son:

- **`products`** — catálogo base (cada combinación style + color es un producto).
- **`collection_designs`** — los diseños pre-armados de la sección "Colección".
- **`gallery_designs`** — diseños de la galería del personalizador.
- **`user_uploads`** — imágenes que suben los clientes para personalizar.
- **`carts` + `cart_items`** — carritos de compra (con sesión para invitados).
- **`orders` + `order_items`** — pedidos confirmados.
- **`order_events`** — historial de cambios de cada pedido (trazabilidad).
- **`admin_logs`** — quién hizo qué y cuándo en el admin (trazabilidad).
- **`app_config`** — configuración global (precios base, mensajes, etc).

Todas las tablas tienen `created_at` y `updated_at`. Las tablas con datos críticos llevan triggers que registran cada cambio en `*_events` para auditoría completa.

---

## Trazabilidad (lo que pediste explícitamente)

La trazabilidad está implementada en tres capas:

### 1. Trazabilidad de pedidos
Cada cambio de estado de un pedido (pendiente → confirmado → en producción → enviado → entregado) se guarda en `order_events` con:
- Estado anterior y nuevo
- Quién hizo el cambio (admin, sistema, cliente)
- Cuándo
- Notas opcionales
- Metadata (ej: número de guía cuando se envía)

### 2. Trazabilidad de administración
Cada acción del panel admin se registra en `admin_logs`:
- Crear/editar/borrar diseños de colección
- Modificar precios
- Cambiar disponibilidad de productos
- IP y user agent del admin
- Diff de los cambios (qué cambió exactamente)

### 3. Trazabilidad de productos/diseños
Los campos `updated_at` + triggers de Postgres mantienen la historia. Para diseños que se venden, además guardamos un snapshot del diseño dentro del `order_items.custom_design_data` (JSONB), de manera que aunque después modifiques el diseño en la colección, el pedido conserva exactamente lo que el cliente pidió.

---

## Almacenamiento de imágenes

Tres buckets en Supabase Storage:

| Bucket | Acceso | Contenido |
|---|---|---|
| `products` | Público | Fotos de catálogo (las que actualmente son base64) |
| `gallery` | Público | Diseños de galería del personalizador |
| `uploads` | Privado (URL firmada) | Imágenes que suben los clientes |

Las imágenes de pedidos (mockups generados) se guardan en `uploads` con prefijo `orders/{order_number}/`.

**Cero base64 en la base de datos.** Las tablas guardan solo URLs. El archivo HTML actual de 650KB se reducirá a ~50KB porque las imágenes ya no van inline.

---

## Próximos pasos

1. **Lee** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — la guía completa de publicación.
2. **Lee** [`docs/MIGRATION.md`](docs/MIGRATION.md) — cómo trasladar los datos del HTML actual.
3. **Revisa** los SQL en `db/` — están comentados, se ejecutan en orden numérico.
4. **Examina** `public/js/api.js` — verás cómo se reemplaza `localStorage` con llamadas a Supabase.

Si vas a contratar a alguien para implementarlo, este repo es lo que le entregas. Un dev junior con experiencia en JavaScript debería poder dejarlo en producción en 3–5 días de trabajo. Un dev intermedio en 1–2 días.
