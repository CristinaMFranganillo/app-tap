# AppTap — Registro con Aprobación de Admin
**Spec de diseño · 2026-04-06**

---

## 1. Visión general

Los aspirantes a socio pueden solicitar acceso desde la pantalla de login. La solicitud queda pendiente hasta que un administrador la revisa. Si es aceptada, se crea el usuario en Supabase Auth y se envía un email de bienvenida. Si es rechazada, se envía un email de rechazo con motivo opcional. El usuario nunca tiene acceso a la app hasta ser aprobado.

---

## 2. Base de datos

### Tabla `solicitudes_registro`

```sql
CREATE TABLE solicitudes_registro (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  apellidos       text NOT NULL,
  email           text NOT NULL UNIQUE,
  password_hash   text NOT NULL,        -- contraseña elegida por el aspirante, se pasa a Edge Function al aceptar
  mensaje         text,                 -- nota opcional del aspirante
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  fecha           timestamptz NOT NULL DEFAULT now(),
  revisada_por    uuid REFERENCES profiles(id),
  fecha_revision  timestamptz,
  motivo_rechazo  text                  -- razón opcional del rechazo
);
```

> **Nota sobre `password_hash`:** La contraseña se almacena temporalmente como texto plano en la solicitud (o cifrada con bcrypt si se prefiere). Al aceptar, la Edge Function la usa para crear el usuario en Supabase Auth. Alternativa más segura: al aceptar, Supabase envía un "magic link" al email del aspirante para que establezca su contraseña — elimina la necesidad de almacenar la contraseña. **Se usa la alternativa segura: no se guarda contraseña, al aceptar se envía magic link.**

### Esquema final (sin password_hash)

```sql
CREATE TABLE solicitudes_registro (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  apellidos       text NOT NULL,
  email           text NOT NULL UNIQUE,
  mensaje         text,
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  fecha           timestamptz NOT NULL DEFAULT now(),
  revisada_por    uuid REFERENCES profiles(id),
  fecha_revision  timestamptz,
  motivo_rechazo  text
);

-- RLS: solo admins pueden leer/modificar solicitudes
ALTER TABLE solicitudes_registro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solicitudes_insert_public" ON solicitudes_registro
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "solicitudes_select_admin" ON solicitudes_registro
  FOR SELECT TO authenticated USING (get_my_rol() = 'admin');

CREATE POLICY "solicitudes_update_admin" ON solicitudes_registro
  FOR UPDATE TO authenticated USING (get_my_rol() = 'admin');
```

---

## 3. Flujo completo

```
Aspirante
  → Pantalla registro (pública)
  → Rellena: nombre, apellidos, email, mensaje?
  → INSERT en solicitudes_registro (estado='pendiente')
  → Pantalla confirmación: "Tu solicitud está pendiente..."

Admin
  → /admin/solicitudes → pestaña Pendientes
  → Ve la solicitud con nombre, email, fecha, mensaje
  → Pulsa Aceptar:
      → Modal: asignar número de socio + rol (default 'socio')
      → Angular llama Edge Function 'aceptar-solicitud'
      → Edge Function:
          1. Crea usuario en auth.users con contraseña aleatoria
          2. Trigger crea profile automáticamente
          3. Actualiza profile: numero_socio, rol, nombre, apellidos
          4. Actualiza solicitud: estado='aceptada', revisada_por, fecha_revision
          5. Envía magic link por email (Supabase Auth) para que el usuario establezca contraseña
          6. Envía email de bienvenida con Resend
  → Pulsa Rechazar:
      → Modal: motivo opcional
      → Angular llama Edge Function 'rechazar-solicitud'
      → Edge Function:
          1. Actualiza solicitud: estado='rechazada', motivo_rechazo, revisada_por, fecha_revision
          2. Envía email de rechazo con Resend
```

---

## 4. Pantallas Angular

### 4.1 Pantalla de registro (`/registro`)
- Ruta pública (sin authGuard)
- Formulario con: nombre (required), apellidos (required), email (required, email), mensaje (opcional, textarea)
- Validación: si el email ya existe en `solicitudes_registro` → error "Ya existe una solicitud con este email"
- Al enviar: INSERT en tabla + navegar a `/registro/confirmacion`
- Enlace desde login: "¿Quieres ser socio? Solicita el acceso"

### 4.2 Pantalla de confirmación (`/registro/confirmacion`)
- Mensaje: "¡Solicitud enviada! Te avisaremos por email cuando tu solicitud sea revisada por la asociación."
- Muestra el email introducido
- Botón "Volver al login"

### 4.3 Panel admin — Solicitudes (`/admin/solicitudes`)
- Solo rol `admin`
- Tres pestañas: Pendientes (badge con número) / Aceptadas / Rechazadas
- Cada fila: nombre, apellidos, email, fecha, mensaje (si existe)
- Acciones en pendientes: botón ✅ Aceptar / ❌ Rechazar

### 4.4 Modal Aceptar
- Campo: Número de socio (text, required)
- Campo: Rol (select: socio / moderador / admin, default socio)
- Botón confirmar → llama Edge Function `aceptar-solicitud`
- Muestra estado de carga y éxito/error

### 4.5 Modal Rechazar
- Campo: Motivo (textarea, opcional)
- Botón confirmar → llama Edge Function `rechazar-solicitud`

---

## 5. Edge Functions Supabase

### `aceptar-solicitud`

**Endpoint:** `POST /functions/v1/aceptar-solicitud`
**Auth:** anon key (la Edge Function usa service role internamente)

**Request body:**
```json
{
  "solicitudId": "uuid",
  "numeroSocio": "0042",
  "rol": "socio"
}
```

**Lógica:**
```typescript
// 1. Leer solicitud
const solicitud = await supabase.from('solicitudes_registro').select('*').eq('id', solicitudId).single()

// 2. Crear usuario en Auth con contraseña aleatoria
const { data: { user } } = await supabaseAdmin.auth.admin.createUser({
  email: solicitud.email,
  email_confirm: true,
  user_metadata: {
    nombre: solicitud.nombre,
    apellidos: solicitud.apellidos,
    numero_socio: numeroSocio,
  }
})

// 3. Actualizar profile (el trigger lo crea, aquí lo actualizamos)
await supabaseAdmin.from('profiles').update({
  nombre: solicitud.nombre,
  apellidos: solicitud.apellidos,
  numero_socio: numeroSocio,
  rol: rol,
}).eq('id', user.id)

// 4. Marcar solicitud como aceptada
await supabaseAdmin.from('solicitudes_registro').update({
  estado: 'aceptada',
  revisada_por: adminUserId,
  fecha_revision: new Date().toISOString(),
}).eq('id', solicitudId)

// 5. Enviar magic link para que establezca contraseña
await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: solicitud.email,
})

// 6. Enviar email de bienvenida con Resend
await resend.emails.send({
  from: 'noreply@campotirosanisidro.es',
  to: solicitud.email,
  subject: '¡Bienvenido/a a Campo de Tiro San Isidro!',
  html: `<p>Hola ${solicitud.nombre}, tu solicitud ha sido aprobada...</p>`
})
```

### `rechazar-solicitud`

**Endpoint:** `POST /functions/v1/rechazar-solicitud`

**Request body:**
```json
{
  "solicitudId": "uuid",
  "motivo": "texto opcional"
}
```

**Lógica:**
```typescript
// 1. Marcar solicitud como rechazada
await supabaseAdmin.from('solicitudes_registro').update({
  estado: 'rechazada',
  motivo_rechazo: motivo ?? null,
  revisada_por: adminUserId,
  fecha_revision: new Date().toISOString(),
}).eq('id', solicitudId)

// 2. Enviar email de rechazo con Resend
await resend.emails.send({
  from: 'noreply@campotirosanisidro.es',
  to: solicitud.email,
  subject: 'Solicitud de acceso — Campo de Tiro San Isidro',
  html: `<p>Hola ${solicitud.nombre}, tras revisar tu solicitud...</p>`
})
```

---

## 6. Servicio Angular — SolicitudService

```typescript
// src/app/features/registro/solicitud.service.ts
getAll(): Observable<SolicitudRegistro[]>       // admin: todas
getPendientes(): Observable<SolicitudRegistro[]> // admin: solo pendientes
create(data): Promise<void>                      // público: enviar solicitud
aceptar(solicitudId, numeroSocio, rol): Promise<void>  // llama Edge Function
rechazar(solicitudId, motivo?): Promise<void>          // llama Edge Function
```

---

## 7. Modelo TypeScript

```typescript
// src/app/core/models/solicitud.model.ts
export type EstadoSolicitud = 'pendiente' | 'aceptada' | 'rechazada';

export interface SolicitudRegistro {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  mensaje?: string;
  estado: EstadoSolicitud;
  fecha: Date;
  revisadaPor?: string;
  fechaRevision?: Date;
  motivoRechazo?: string;
}
```

---

## 8. Routing

```
/registro                → RegistroComponent (público)
/registro/confirmacion   → RegistroConfirmacionComponent (público)
/admin/solicitudes       → ListaSolicitudesComponent (roleGuard: admin)
```

---

## 9. Archivos nuevos / modificados

### Nuevos
- `src/app/core/models/solicitud.model.ts`
- `src/app/features/registro/registro.component.ts`
- `src/app/features/registro/registro.component.html`
- `src/app/features/registro/registro-confirmacion.component.ts`
- `src/app/features/registro/solicitud.service.ts`
- `src/app/features/admin/solicitudes/lista-solicitudes.component.ts`
- `src/app/features/admin/solicitudes/lista-solicitudes.component.html`
- `supabase/functions/aceptar-solicitud/index.ts`
- `supabase/functions/rechazar-solicitud/index.ts`

### Modificados
- `src/app/app.routes.ts` — añadir rutas `/registro` y `/registro/confirmacion`
- `src/app/features/admin/admin.routes.ts` — añadir ruta `/admin/solicitudes`
- `src/app/features/auth/login/login.component.html` — añadir enlace a registro
- `docs/supabase-schema.sql` — añadir tabla `solicitudes_registro` + RLS

---

## 10. Dependencias externas

- **Resend** — servicio de email (resend.com, plan gratuito: 3.000 emails/mes)
  - Requiere cuenta + API key configurada como secret en Supabase Edge Functions
- **Supabase CLI** — para crear y desplegar las Edge Functions localmente
