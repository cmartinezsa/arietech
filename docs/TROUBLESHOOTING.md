# Solución de problemas comunes

## El sitio no carga nada (pantalla vacía)

1. Abre la consola del navegador (F12 → Console).
2. Si ves `Failed to fetch` o `CORS error`:
   - Revisa que `SUPABASE_URL` en `config.js` no tenga espacios ni `/` al final.
   - Verifica en Supabase: Authentication → URL Configuration → agrega tu dominio (Vercel/Netlify) a "Site URL" y "Redirect URLs".
3. Si ves `Invalid API key`:
   - La `SUPABASE_ANON_KEY` está mal copiada. Re-cópiala desde Settings → API.
4. Si ves `Module not found`:
   - Estás abriendo el HTML con `file://` en lugar de un servidor. Los módulos ES6 requieren protocolo `http://`. Usa `python3 -m http.server 8080` o `npx serve`.

## Los productos no aparecen, pero no hay error

- En Supabase → SQL Editor, ejecuta:
  ```sql
  SELECT count(*) FROM products WHERE available = true;
  ```
  Si devuelve 0, los productos no se migraron o están todos marcados como `available = false`.
- Revisa RLS: ejecuta `db/04_rls.sql` otra vez.
- Verifica que el bucket `products` sea **público** (Storage → buckets → ⋮ → Edit bucket).

## Las imágenes salen rotas (404)

- En Supabase → Storage → bucket `products` → cualquier imagen → "Get URL". Pégala en el navegador. Si da 404, el bucket no es público.
- Si la URL en la BD apunta a `localhost` o a un proyecto Supabase distinto, re-corre la migración con la `SUPABASE_URL` correcta.

## No puedo entrar al panel admin

- Verifica que tu usuario exista: Authentication → Users.
- Verifica que esté marcado como admin:
  ```sql
  SELECT * FROM admins WHERE user_id = 'tu-uuid-aquí';
  ```
- Si no aparece, agrégalo:
  ```sql
  INSERT INTO admins (user_id, email, role)
  VALUES ('tu-uuid', 'tu@email.com', 'super_admin');
  ```

## "new row violates row-level security policy"

Significa que estás intentando escribir desde una sesión que la política RLS no permite.

- Desde el frontend: confirma que el usuario esté autenticado para acciones admin.
- Desde scripts: confirma que estás usando `SUPABASE_SERVICE_KEY` (no la `anon`).

## El customizer no renderiza la playera

El módulo `customizer.js` viene como esqueleto y necesita el código completo de drag & drop que está en el HTML monolítico (funciones `renderFrontShirt`, `renderBackShirt`, etc.).

Mientras tanto, la sección sigue funcional con la colección pre-diseñada y el catálogo.

## El carrito se "pierde" al recargar

El carrito de usuarios anónimos se ata a un `session_id` guardado en `localStorage.arie_session_id`. Si el usuario:
- Borra cookies / localStorage → el carrito se pierde (esperado).
- Cambia de navegador → carrito nuevo (esperado).

Para usuarios autenticados, el carrito se ata al `user_id` y persiste entre dispositivos.

## Los pedidos no llegan por email

El sistema actual NO envía emails. Las opciones son:

1. **Webhook + Supabase Edge Function** → ver `DEPLOYMENT.md` sección de notificaciones.
2. **Integración con servicio externo** (Resend, SendGrid, EmailJS).
3. **WhatsApp Business API** (alternativa común en México).

Mientras tanto, la dueña debe revisar el panel admin diariamente. La tabla `orders` tiene un campo `notified_at` para llevar control.

## Quiero exportar los pedidos a Excel

En Supabase → SQL Editor:

```sql
SELECT
  order_number,
  customer_name,
  customer_email,
  total,
  status,
  created_at
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

Luego "Download CSV" desde el botón de arriba a la derecha del resultado.

## Quiero hacer respaldo completo de la base de datos

```bash
npx supabase db dump --db-url 'postgresql://postgres:[PASSWORD]@db.[PROYECTO].supabase.co:5432/postgres' > backup-$(date +%F).sql
```

(El password lo encuentras en Settings → Database → Connection string.)

Recomendación: hacerlo mínimo una vez por semana en una carpeta de Google Drive o Dropbox.

## Necesito agregar / borrar columnas a una tabla

1. Anota qué quieres cambiar.
2. Crea un nuevo archivo `db/07_migration_YYYYMMDD.sql` con el `ALTER TABLE`.
3. Ejecútalo en SQL Editor.
4. Si afecta al frontend, actualiza `api.js` y el módulo correspondiente.
5. Sube los cambios a Git con un commit descriptivo.

**Nunca** modifiques los archivos `01_schema.sql` directamente después de tener datos en producción — siempre crea migraciones nuevas.

## El admin ve diseños/pedidos de hace mucho tiempo y quiere limpiar

- Para marcar carritos abandonados (no borra, solo cambia status):
  ```sql
  SELECT mark_abandoned_carts(72); -- carritos sin actividad por 72 horas
  ```
- Para listar uploads huérfanos (no se usaron en ningún pedido):
  ```sql
  SELECT * FROM list_orphan_uploads(30); -- huérfanos hace más de 30 días
  ```
- Borrar pedidos viejos: **NO HACERLO.** Mejor usar status `archived` (agregar al enum si hace falta).

## Si nada de esto resuelve

1. Reproduce el error en modo incógnito (descarta caché).
2. Captura la consola del navegador (F12 → Console y Network).
3. Anota la hora exacta y busca en Supabase → Logs → API logs.
4. Si vas a pedir ayuda, comparte: navegador + sistema operativo + paso a paso + captura de consola.
