# Spec: Gestión de Usuarios por el Administrador

**Fecha:** 2026-04-06  
**Estado:** Aprobado

---

## Contexto

AppTap es una app para el Club de Tiro San Isidro. Los socios no se registran solos — el administrador los crea directamente desde la app. No existe ninguna ruta pública de registro ni panel de solicitudes. El admin no sabe nada de Supabase; todo ocurre de forma transparente.

---

## Flujo completo

### Crear usuario

El admin accede a `/admin/socios` y pulsa el botón "+". Rellena:

| Campo | Detalle |
|---|---|
| Nombre | texto, obligatorio |
| Apellidos | texto, obligatorio |
| Email | email, obligatorio — se usa como username de login |
| Rol | selector: socio / moderador / admin |

Al guardar:
1. Se llama a una **Edge Function** `crear-usuario` que usa el service role de Supabase para crear el usuario en Auth
2. La contraseña provisional es el prefijo del email (todo lo que va antes de `@`)
3. Se crea el perfil en `profiles` con número de socio automático (máximo actual + 1, formato `0001`)
4. El admin no ve contraseñas ni referencias a Supabase

### Primera vez que el socio entra

Al hacer login, la app detecta si es la primera sesión (`first_login = true` en profiles). Si es así, muestra un modal preguntando si quiere cambiar la contraseña. El socio puede:
- **Cambiar ahora**: introduce nueva contraseña (mínimo 6 caracteres) y confirma
- **Ahora no**: cierra el modal y accede a la app normalmente

El flag `first_login` se pone a `false` en cuanto el socio descarta o completa el modal.

### Editar usuario

Desde la lista de socios, cada tarjeta tiene un botón editar. Se puede cambiar:
- Nombre
- Apellidos  
- Rol

El email y el número de socio **no son editables**.

### Eliminar usuario

Botón eliminar en la lista (solo admin). Llama a la Edge Function `eliminar-usuario` que:
1. Elimina el usuario de Supabase Auth (service role)
2. El perfil en `profiles` se elimina en cascada por FK

Se pide confirmación antes de ejecutar.

### Activar / Desactivar

Toggle en la lista. Cambia `activo` en `profiles`. Un usuario inactivo no puede hacer login (el guard lo redirige al login con mensaje de cuenta inactiva).

---

## Cambios en base de datos

### `profiles` — añadir campo

```sql
first_login  boolean NOT NULL DEFAULT true
```

Se pone a `false` cuando el socio descarta o completa el modal de cambio de contraseña.

---

## Edge Functions

### `crear-usuario`

- **Entrada:** `{ nombre, apellidos, email, rol }`
- **Acción:** `supabase.auth.admin.createUser()` con `email_confirm: true`, `password = email.split('@')[0]`; INSERT en `profiles` con número de socio automático y `first_login = true`
- **Sale:** `{ id, numeroSocio }`

### `eliminar-usuario`

- **Entrada:** `{ userId }`
- **Acción:** `supabase.auth.admin.deleteUser(userId)` — el perfil cae en cascada
- **Sale:** `{}`

---

## Lo que desaparece

- Ruta pública `/registro` y `/registro/confirmacion`
- Componentes `RegistroComponent`, `RegistroConfirmacionComponent`
- Servicio `SolicitudService`
- Panel admin `/admin/solicitudes` y `ListaSolicitudesComponent`
- Modelo `SolicitudRegistro`
- Edge Functions `aceptar-solicitud` y `rechazar-solicitud`
- Tabla `solicitudes_registro` (DROP TABLE)
- Entrada en `admin.routes` para solicitudes
- Entrada en bottom-nav si existiera

---

## Lo que NO cubre este spec

- Recuperación de contraseña olvidada (flujo externo, fuera de scope)
- Foto de perfil / avatar (se mantiene como está)
- Múltiples admins (ya soportado por el rol)
