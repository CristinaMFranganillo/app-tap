# Avatar Personalizado

**Fecha:** 2026-04-06  
**Estado:** Aprobado

## Objetivo

Permitir que cada usuario suba una foto de perfil personalizada. Actualmente el avatar muestra solo las iniciales con fondo amarillo. La infraestructura (`avatar_url` en `profiles`) ya existe — falta el flujo de subida.

## Almacenamiento

- **Supabase Storage**, bucket `avatars` (público)
- Path por usuario: `avatars/{userId}` — un único archivo por usuario
- Al subir nueva foto: sobreescribe el archivo anterior (mismo path → misma URL base, no requiere actualizar BD)
- Al crear usuario: `avatar_url` queda `null`, el componente muestra iniciales
- URL pública: `{SUPABASE_URL}/storage/v1/object/public/avatars/{userId}`

## Flujo 1: Modal de bienvenida (primer login)

El modal `CambiarPasswordComponent` se convierte en un flujo de 2 pasos:

**Paso 1 — Cambiar contraseña** (igual que ahora)
- Usuario introduce nueva contraseña + confirmación, o pulsa "Ahora no"
- Al completar o saltar, avanza al paso 2

**Paso 2 — Subir foto de perfil** (nuevo)
- Muestra avatar actual (iniciales si no tiene foto)
- Botón "Elegir foto" abre `input[type=file][accept="image/*"]`
- Al seleccionar, muestra preview de la imagen
- Botones: "Subir foto" (confirma upload) y "Omitir" (salta sin subir)
- Al completar o saltar: cierra modal y marca `first_login = false`

## Flujo 2: Tap en avatar desde Perfil

- El avatar en `perfil.component.html` se envuelve en un botón
- Al tocarlo, aparece un bottom sheet con opciones:
  - Si no tiene foto: solo "Añadir foto"
  - Si tiene foto: "Cambiar foto" y "Eliminar foto"
- **Cambiar/Añadir foto:** abre selector de archivo → preview → confirma → sube a Storage → actualiza `avatar_url` en BD y en memoria
- **Eliminar foto:** borra archivo de Storage → pone `avatar_url = null` en BD → vuelve a mostrar iniciales

## Arquitectura

### Nuevo: `AvatarService`

```
src/app/shared/services/avatar.service.ts
```

Responsabilidad única: operaciones de Storage y sincronización con BD.

```typescript
upload(userId: string, file: File): Promise<string>  // retorna URL pública
delete(userId: string): Promise<void>
```

### Modificaciones

| Archivo | Cambio |
|---|---|
| `CambiarPasswordComponent` | Añadir paso 2 con selector + preview |
| `PerfilComponent` | Avatar tappable + bottom sheet |
| `AuthService` | Añadir `updateAvatarUrl(url \| null)` para refrescar usuario en memoria |
| `AvatarComponent` | Sin cambios |

### Sin cambios en BD

`profiles.avatar_url` ya existe como columna nullable.

## Supabase Storage — configuración necesaria

- Crear bucket `avatars` con acceso público
- Policy RLS: usuarios autenticados pueden hacer `INSERT`/`UPDATE`/`DELETE` solo en su propio path (`avatars/{auth.uid()}`)

## Comportamiento tras subida

1. `AvatarService.upload()` sube el archivo y obtiene la URL pública
2. Actualiza `profiles.avatar_url` con la URL
3. Llama a `AuthService.updateAvatarUrl(url)` para refrescar el usuario en memoria
4. Todos los componentes que usan `app-avatar` se actualizan automáticamente (header, perfil, lista socios en próxima carga)

## Fuera de alcance

- Recorte/crop de imagen antes de subir
- Límite de tamaño de archivo (se delega al navegador/Storage)
- Avatares en la lista de socios se actualizan en la próxima recarga de la lista (no en tiempo real)
