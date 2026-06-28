# Arquitectura — Arie Tech

Documento técnico que explica cómo está organizado el código y por qué.

## Visión general

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR (cliente)                  │
│  HTML  +  CSS modular  +  JS modules (ES6)              │
│           │                                             │
│           │ HTTPS (REST + Realtime)                     │
│           ▼                                             │
├─────────────────────────────────────────────────────────┤
│                       SUPABASE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │   Storage    │  │     Auth     │   │
│  │  + RLS       │  │  (imágenes)  │  │  (admins)    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Principios de diseño

1. **Sin build step.** Todo es HTML/CSS/JS estático. Cualquier hosting funciona (Vercel, Netlify, GitHub Pages, hosting compartido). Cero `npm run build`.
2. **Módulos ES6 nativos.** Cada sección de la página es un archivo `.js` independiente con `export`/`import`. Sin React, sin Vue, sin frameworks.
3. **Una sola fuente de verdad.** Todos los datos (productos, pedidos, diseños) viven en Postgres. El frontend no almacena estado persistente — solo cache temporal en memoria.
4. **Trazabilidad por defecto.** Cada cambio importante (pedidos, productos, colección) deja huella en tablas `*_events` o `admin_logs` mediante *triggers* de SQL. Imposible perder el rastro.
5. **Seguridad por capas (RLS).** Los permisos viven en la base de datos, no en el frontend. Aunque alguien manipule el JS, no puede leer ni escribir lo que no debe.

## Estructura de carpetas

```
arie-tech-modular/
├── public/                    ← lo que se sube al hosting
│   ├── index.html             ← HTML semántico, sin lógica
│   ├── css/                   ← 5 archivos por área de responsabilidad
│   │   ├── base.css           tokens (colores, fuentes), reset
│   │   ├── layout.css         logo, header, hero, secciones, filtros
│   │   ├── components.css     tarjetas, customizer, modales, toast
│   │   ├── sections.css       admin, colección, FAQ, "quiénes somos"
│   │   └── responsive.css     media queries globales
│   ├── js/
│   │   ├── config.js          claves de Supabase y constantes
│   │   ├── api.js             cliente único de Supabase (todas las llamadas)
│   │   ├── state.js           estado global con patrón subscribe
│   │   ├── main.js            orquestador: arranca todos los módulos
│   │   └── modules/           un archivo por sección de la página
│   │       ├── hero.js
│   │       ├── catalog.js
│   │       ├── collection.js
│   │       ├── customizer.js
│   │       ├── cart.js
│   │       ├── admin.js
│   │       └── faq.js
│   └── assets/                imágenes estáticas (logo, favicon)
│
├── db/                        ← scripts SQL para Supabase
│   ├── 01_schema.sql          tablas
│   ├── 02_indexes.sql         índices de rendimiento
│   ├── 03_triggers.sql        trazabilidad automática
│   ├── 04_rls.sql             políticas de seguridad
│   ├── 05_functions.sql       funciones SQL (checkout, etc.)
│   └── 06_seeds.sql           datos iniciales
│
├── scripts/                   ← herramientas de migración (Node.js)
│   ├── extract_from_monolith.js
│   ├── upload_images.js
│   ├── package.json
│   └── .env.example
│
└── docs/
    ├── DEPLOYMENT.md          guía paso a paso para publicar
    ├── ARCHITECTURE.md        este archivo
    ├── MIGRATION.md           cómo migrar del HTML monolítico
    └── TROUBLESHOOTING.md     errores comunes y soluciones
```

## Flujo de datos: ejemplo de compra

```
Usuario              Frontend                 Supabase
   │                    │                        │
   │ Click "Agregar"    │                        │
   │───────────────────▶│                        │
   │                    │  cartAPI.addItem()     │
   │                    │───────────────────────▶│
   │                    │                        │ INSERT cart_items
   │                    │                        │ trigger → updated_at
   │                    │◀───────────────────────│
   │                    │                        │
   │ Click "Pagar"      │                        │
   │───────────────────▶│                        │
   │                    │  RPC checkout_cart()   │
   │                    │───────────────────────▶│
   │                    │                        │ 1. snapshot productos
   │                    │                        │ 2. INSERT orders
   │                    │                        │ 3. INSERT order_items
   │                    │                        │ 4. UPDATE cart status
   │                    │                        │ 5. trigger → order_events
   │                    │◀───────────────────────│
   │ Pedido #AT-2026-X  │                        │
   │◀───────────────────│                        │
```

## Trazabilidad: qué se registra y dónde

| Acción                              | Tabla resultado            |
|-------------------------------------|----------------------------|
| Cambio de status de pedido          | `order_events`             |
| Pago confirmado                     | `order_events` + `orders.paid_at` |
| Tracking agregado                   | `order_events` + `orders.tracking_number` |
| Producto editado (admin)            | `admin_logs` (con diff JSONB) |
| Diseño de colección creado/borrado  | `admin_logs`               |
| Upload de imagen del usuario        | `user_uploads`             |
| Imagen usada en pedido              | `user_uploads.used_in_order_id` |

Las tablas `order_events` y `admin_logs` son **append-only**: las políticas RLS bloquean `UPDATE` y `DELETE`. Nadie puede borrar evidencia, ni siquiera un super_admin (a menos que entre al panel de Supabase, lo cual también queda registrado allá).

## Seguridad

| Capa             | Protege contra                                          |
|------------------|---------------------------------------------------------|
| HTTPS            | Intercepción de tráfico                                 |
| Auth (Supabase)  | Usuarios anónimos no autenticados                       |
| RLS              | Frontend manipulado leyendo/escribiendo datos ajenos    |
| Service role     | Solo en scripts del backend, nunca expuesto al cliente  |
| `is_admin()`     | Frontend modificando productos sin ser admin            |
| Triggers         | Borrado de evidencia o cambios sin huella               |

La `anon key` (la que va en `config.js`) está diseñada para ser pública. Lo que protege la base de datos son las políticas RLS, no el secreto de esa llave.

## Decisiones que NO se tomaron y por qué

- **No usamos React/Vue.** El sitio es estático y la complejidad no lo amerita. Cero build step = cero tiempo de espera al desplegar.
- **No usamos Firebase.** Firestore es NoSQL; para pedidos con relaciones (cart → items → product snapshots) un SQL relacional es más natural.
- **No usamos Shopify.** Bloqueaba el personalizador con drag & drop, que es el corazón del producto.
- **No usamos un backend propio (Node/Express).** Supabase ya provee Postgres + Auth + Storage + Edge Functions. Construir un backend separado sería duplicar trabajo.
- **No guardamos imágenes base64 en la BD.** Las imágenes van a Storage; la BD guarda solo la URL pública. Postgres no está optimizado para blobs grandes.
