# Spec: Panel Admin "Contexto del Coach"

**Fecha:** 2026-04-18  
**Estado:** Aprobado

## Objetivo

Permitir a admin y moderador añadir contenido contextual (noticias, consejos técnicos, avisos de torneos, equipamiento) que el coach inyecta automáticamente en cada informe y conversación, sin necesidad de redesplegar la edge function.

---

## Base de datos

### Tabla `coach_contexto`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `titulo` | text NOT NULL | Título corto descriptivo |
| `contenido` | text NOT NULL | Texto libre que se inyecta en el prompt |
| `categoria` | enum NOT NULL | `noticia`, `consejo_tecnico`, `aviso_torneo`, `equipamiento` |
| `activo` | boolean DEFAULT true | El admin puede desactivar sin borrar |
| `fecha_expiracion` | date nullable | Si se establece, expira automáticamente ese día |
| `created_by` | uuid FK profiles | Quién lo creó |
| `created_at` | timestamptz DEFAULT now() | |

### RLS
- SELECT: cualquier usuario autenticado
- INSERT / UPDATE / DELETE: solo `admin` y `moderador` (via `get_my_rol()`)

### Migración
Nueva migración `029_coach_contexto.sql`.

---

## Edge function (`gemini-coach`)

### Cambio en `construirPromptInforme` y modo `chat`

Al inicio de cada llamada, la edge function consulta `coach_contexto` con:
- `activo = true`
- `fecha_expiracion IS NULL OR fecha_expiracion >= today`
- Máximo 3 entradas por categoría (ordenadas por `created_at DESC`)

El resultado se inyecta en el prompt como sección:

```
## CONTEXTO ACTUALIZADO DEL CLUB
[categoria]: [titulo]
[contenido]
...
```

Si no hay entradas activas, la sección se omite.

---

## Frontend — Panel admin `/admin/coach`

### Acceso
- Ruta protegida por `roleGuard` con roles `['admin', 'moderador']`
- Enlace desde la home de admin/moderador como card de acceso rápido

### Lista de entradas (`admin-coach-contexto`)

- Tabla/lista de todas las entradas (activas e inactivas)
- Columnas: título, categoría (badge con color), activo (toggle), fecha expiración, acciones
- Colores de categoría:
  - `noticia` → azul
  - `consejo_tecnico` → verde
  - `aviso_torneo` → naranja (amber)
  - `equipamiento` → morado
- Acciones por fila: editar, activar/desactivar, eliminar (con confirm dialog)
- Botón "Nueva entrada" en cabecera

### Formulario (`form-coach-contexto`)

Campos:
- **Título** (input text, requerido)
- **Categoría** (select, requerido)
- **Contenido** (textarea, requerido) — lo que se inyectará literalmente en el prompt
- **Fecha de expiración** (date picker, opcional)
- **Activo** (toggle, default true)

Usado para crear y editar (mismo componente, detecta si hay id en la ruta).

### Servicio (`coach-contexto.service.ts`)

Métodos:
- `getAll()` — todas las entradas para el panel admin
- `getActivas()` — solo las activas y no expiradas (para la edge function vía Supabase)
- `crear(data)`, `actualizar(id, data)`, `eliminar(id)`

---

## Home admin/moderador

Añadir una card de acceso rápido en la sección admin de `home.component.html`:
- Icono: `bi-robot`
- Texto: "Contexto del Coach"
- Subtexto: "Gestiona el conocimiento del asistente"
- Navega a `/admin/coach`
- Visible solo si `esAdmin()` o `esModerador()`

---

## Rutas nuevas

```
/admin/coach           → lista de entradas (admin, moderador)
/admin/coach/nueva     → formulario crear (admin, moderador)
/admin/coach/:id       → formulario editar (admin, moderador)
```

---

## Lo que NO incluye este spec

- Versionado de entradas
- Historial de cambios
- Aprobación de entradas por un rol superior
