# Spec: Sistema de Notificaciones Internas

**Fecha:** 2026-04-18  
**Estado:** Aprobado

## Objetivo

Permitir al administrador enviar notificaciones internas a todos los socios o a socios específicos (torneos, cuotas, avisos...). Los socios ven una campana en el header con contador de no leídas, y pueden marcarlas como leídas desde un drawer lateral.

---

## Base de datos

### Tabla `notificaciones`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK DEFAULT gen_random_uuid() | |
| `titulo` | text NOT NULL | Título corto descriptivo |
| `cuerpo` | text NOT NULL | Texto completo del aviso |
| `tipo` | enum NOT NULL | `torneo`, `cuota`, `aviso`, `resultado`, `otro` |
| `destinatarios` | uuid[] nullable | Array de profile IDs. NULL = todos los socios activos |
| `fecha_expiracion` | date nullable | La notificación se oculta automáticamente tras esta fecha |
| `created_by` | uuid FK profiles NOT NULL | Admin que la creó |
| `created_at` | timestamptz DEFAULT now() | |

### Tabla `notificaciones_leidas`

| Campo | Tipo | Descripción |
|---|---|---|
| `notificacion_id` | uuid FK notificaciones NOT NULL | |
| `user_id` | uuid FK profiles NOT NULL | |
| `leida_at` | timestamptz DEFAULT now() | |
| PK compuesta | (notificacion_id, user_id) | |

### ENUM `tipo_notificacion`
```sql
CREATE TYPE tipo_notificacion AS ENUM ('torneo', 'cuota', 'aviso', 'resultado', 'otro');
```

### RLS

**`notificaciones`:**
- SELECT: usuario autenticado cuyo id está en `destinatarios` OR `destinatarios IS NULL`, Y (`fecha_expiracion IS NULL OR fecha_expiracion >= CURRENT_DATE`)
- INSERT / UPDATE / DELETE: solo `admin` (via `get_my_rol()`)

**`notificaciones_leidas`:**
- SELECT: solo el propio usuario (`user_id = auth.uid()`)
- INSERT: solo el propio usuario (`user_id = auth.uid()`)
- DELETE: solo el propio usuario (`user_id = auth.uid()`)

### Migración
Nueva migración `030_notificaciones.sql`.

---

## Frontend — Servicio

### `NotificacionesService` (`src/app/core/services/notificaciones.service.ts`)

Servicio `providedIn: 'root'` con:

**Signals:**
- `notificaciones = signal<Notificacion[]>([])` — todas las notificaciones activas y no expiradas del usuario
- `noLeidas = computed(() => notificaciones().filter(n => !n.leida).length)` — contador para la campana

**Métodos:**
- `cargar()` — carga inicial: obtiene notificaciones activas + join con `notificaciones_leidas` para saber cuáles están leídas. Llamado al iniciar sesión.
- `suscribirRealtime()` — suscripción a Supabase Realtime en `notificaciones` (INSERT). Cuando llega una nueva que aplica al usuario, la añade al signal. Devuelve la suscripción para poder cancelarla al hacer logout.
- `marcarLeida(id: string)` — inserta en `notificaciones_leidas`. Actualiza el signal localmente sin refetch.
- `marcarTodasLeidas()` — inserta en `notificaciones_leidas` todos los ids no leídos. Actualiza el signal localmente.
- `limpiar()` — resetea signals y cancela suscripción Realtime. Llamado en logout.

---

## Frontend — Modelos

### `src/app/core/models/notificacion.model.ts`

```typescript
export type TipoNotificacion = 'torneo' | 'cuota' | 'aviso' | 'resultado' | 'otro';

export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: TipoNotificacion;
  destinatarios: string[] | null;
  fechaExpiracion: string | null;
  createdAt: string;
  leida: boolean; // calculado en frontend via join con notificaciones_leidas
}

export interface NotificacionForm {
  titulo: string;
  cuerpo: string;
  tipo: TipoNotificacion;
  destinatarios: string[] | null; // null = todos
  fechaExpiracion: string | null;
}
```

---

## Frontend — Header

### Cambios en `header.component.html`

Añadir botón campana entre el logo y el avatar:

```html
<button (click)="abrirNotificaciones()" class="header-bell">
  <i class="bi bi-bell-fill"></i>
  @if (notificacionesService.noLeidas() > 0) {
    <span class="header-bell__badge">
      {{ notificacionesService.noLeidas() > 9 ? '9+' : notificacionesService.noLeidas() }}
    </span>
  }
</button>
```

### Cambios en `header.component.ts`

- Inyectar `NotificacionesService`
- Signal `drawerAbierto = signal(false)`
- Método `abrirNotificaciones()` que pone `drawerAbierto.set(true)`

### Estilos `.header-bell`

- Botón circular de 30×30px, fondo transparente
- Icono `bi-bell-fill` en gris (color neutral), ámbar si hay no leídas
- `.header-bell__badge`: círculo rojo 16×16px, texto blanco 10px, posición absoluta arriba-derecha del botón

---

## Frontend — Drawer

### `NotificacionesDrawerComponent` (`src/app/shared/components/notificaciones-drawer/`)

Componente standalone. Recibe `@Input() abierto: boolean` y emite `@Output() cerrar`.

**Template:**
- Overlay oscuro (`fixed inset-0 bg-black/40 z-40`) que emite `cerrar` al click
- Panel lateral (`fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50`) con animación slide-in desde la derecha
- **Cabecera del drawer:** "Notificaciones" (título) + botón "Marcar todas leídas" (texto ámbar, solo si hay no leídas) + botón × cerrar
- **Lista:** `@for` sobre `notificaciones()`. Cada item:
  - Punto naranja a la izquierda si no leída
  - Icono por tipo (ver tabla de iconos)
  - Título en negrita + cuerpo en gris
  - Fecha relativa (ayer, hace 2 días...) abajo a la derecha
  - Al tocar el item: llama `marcarLeida(id)`
- **Estado vacío:** icono `bi-bell-slash` + "No tienes notificaciones nuevas"

**Iconos y colores por tipo:**

| Tipo | Icono Bootstrap | Color |
|---|---|---|
| `torneo` | `bi-trophy-fill` | #FFAE00 |
| `cuota` | `bi-credit-card-fill` | #3B82F6 |
| `aviso` | `bi-exclamation-triangle-fill` | #F59E0B |
| `resultado` | `bi-bullseye` | #10B981 |
| `otro` | `bi-info-circle-fill` | #6B7280 |

El drawer se añade al template de `ShellComponent` (que ya contiene header + bottom-nav), pasando `drawerAbierto` como input y escuchando el output `cerrar`.

---

## Frontend — Panel Admin

### Rutas nuevas en `admin.routes.ts`

```
/admin/notificaciones        → ListaNotificacionesAdminComponent (admin)
/admin/notificaciones/nueva  → FormNotificacionComponent (admin)
/admin/notificaciones/:id    → FormNotificacionComponent (admin)
```

Protegidas con `roleGuard(['admin'])`.

### `ListaNotificacionesAdminComponent` (`src/app/features/admin/notificaciones/lista-notificaciones-admin/`)

- Tabla/lista con columnas: título, tipo (badge coloreado), destinatarios ("Todos" o "N socios"), fecha expiración, fecha creación, acciones
- Acciones por fila: editar (navega a `/:id`), eliminar (confirm dialog)
- Botón "Nueva notificación" en cabecera

### `FormNotificacionComponent` (`src/app/features/admin/notificaciones/form-notificacion/`)

Reactive form. Detecta si hay `:id` en la ruta para modo editar.

**Campos:**
- **Título** (input text, requerido)
- **Tipo** (select: torneo / cuota / aviso / resultado / otro, requerido)
- **Cuerpo** (textarea, requerido)
- **Destinatarios** — toggle radio: "Todos los socios" / "Socios específicos". Si es específico, muestra lista de socios activos con checkboxes o búsqueda por nombre
- **Fecha de expiración** (date input, opcional)

### `NotificacionesAdminService` (`src/app/features/admin/notificaciones/notificaciones-admin.service.ts`)

Métodos:
- `getAll()` — todas las notificaciones (sin filtro de expiración ni destinatarios)
- `crear(data: NotificacionForm)` — INSERT
- `actualizar(id: string, data: NotificacionForm)` — UPDATE
- `eliminar(id: string)` — DELETE
- `getById(id: string)` — para prellenar el formulario de edición

### Card en Home Admin

Añadir en `home.component.html` dentro del bloque `@if (esAdmin())`:

- Icono: `bi-bell-fill`
- Texto: "Notificaciones"
- Subtexto: "Envía avisos a los socios"
- Navega a `/admin/notificaciones`

---

## Integración en AuthService / Shell

- Al completar login y cargar perfil, llamar `notificacionesService.cargar()` y `notificacionesService.suscribirRealtime()`
- En logout, llamar `notificacionesService.limpiar()`

---

## Lo que NO incluye este spec

- Push notifications (web push / FCM)
- Notificaciones por email o SMS
- Historial de notificaciones leídas archivadas
- Notificaciones por rol (solo por usuario individual o todos)
