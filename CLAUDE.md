# CLAUDE.md — AppTap

Contexto del proyecto para Claude Code. Lee este archivo al inicio de cada sesión.

## Descripción del proyecto

**AppTap** es una aplicación web PWA para la gestión de un club de tiro al plato (foso olímpico).
Permite gestionar socios, entrenamientos, competiciones, scores y noticias.

- **Frontend**: Angular 19 (standalone components, lazy loading)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Estilos**: Tailwind CSS 3 + Bootstrap Icons + SCSS por componente
- **Deploy**: Vercel
- **Idioma del proyecto**: Español (código, nombres de variables, UI)

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Angular 19.2 |
| UI | Tailwind CSS 3.4, Bootstrap Icons 1.13 |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| State | Signals + RxJS 7.8 |
| Deploy | Vercel |

---

## Estructura del proyecto

```
src/app/
├── core/
│   ├── auth/           # authGuard, roleGuard, AuthService
│   ├── interceptors/   # auth.interceptor
│   ├── models/         # interfaces TypeScript (User, Entrenamiento, Escuadra, Score...)
│   ├── services/       # avatar-upload.service
│   └── supabase/       # supabase.client.ts (cliente singleton)
├── features/
│   ├── admin/          # rutas protegidas por rol admin/moderador
│   │   ├── socios/     # lista-socios, form-socio
│   │   ├── temporadas/ # lista-temporadas
│   │   ├── noticias/   # lista-noticias-admin, form-noticia
│   │   ├── scores/     # admin-scores, form-score, form-escuadra, registrar-resultado
│   │   ├── entrenamientos/ # form-entrenamiento, detalle-entrenamiento, form-escuadra-entrenamiento,
│   │   │                   # registrar-resultado-entrenamiento, resumen-escuadra-entrenamiento,
│   │   │                   # detalle-dia-entrenamiento
│   │   ├── competiciones/  # form-competicion
│   │   └── admin.routes.ts
│   ├── auth/           # login, reset-password
│   ├── home/           # página principal
│   ├── juego-platos/   # simulador juego platos
│   ├── noticias/       # lista, detalle + news.service
│   ├── perfil/         # perfil del socio
│   ├── scores/         # historial, ranking + servicios
│   └── shell/          # layout con bottom-nav y header
└── shared/
    ├── components/     # avatar, avatar-editor, bottom-nav, header, card-noticia,
    │                   # confirm-dialog, empty-state, cambiar-password
    └── pipes/          # iniciales.pipe
```

---

## Modelo de datos (Supabase)

### Tablas principales

- **profiles** — usuarios del club (extiende auth.users)
  - `id`, `nombre`, `apellidos`, `numero_socio`, `avatar_url`, `rol`, `fecha_alta`, `activo`, `first_login`, `dni`, `telefono`, `direccion`, `localidad`

- **noticias** — artículos del club
- **competiciones** — eventos de tiro (foso olímpico)
- **scores** — resultados por socio y competición
- **escuadras** — grupos de socios en una competición
- **resultados** — platos rotos por socio en una escuadra
- **entrenamientos** — sesiones de entrenamiento
- **escuadras_entrenamiento** — grupos de socios en un entrenamiento
- **cuotas** — registro de pago de cuota anual por temporada
- **temporadas** — años/temporadas del club

### Roles de usuario
```
socio < moderador < admin
```
- **socio**: solo lectura de su propio perfil, noticias, scores
- **moderador**: gestión de noticias, scores, entrenamientos
- **admin**: acceso total, gestión de socios y temporadas

### RLS
Todas las tablas tienen RLS activado. Helper: `get_my_rol()` devuelve el rol del usuario autenticado.

---

## Rutas de la aplicación

```
/login
/auth/reset-password
/ (shell con authGuard)
  / → home
  /noticias → lista noticias
  /noticias/:id → detalle noticia
  /scores → ranking/historial
  /perfil → perfil del socio
  /juego → juego platos
  /admin/socios → lista socios [admin]
  /admin/socios/nuevo → crear socio [admin]
  /admin/socios/:id → editar socio [admin]
  /admin/temporadas → gestión temporadas [admin]
  /admin/noticias → lista noticias admin [admin, moderador]
  /admin/entrenamientos/nuevo → crear entrenamiento [admin, moderador]
  /admin/entrenamientos/:id → detalle entrenamiento [admin, moderador]
  /admin/entrenamientos/dia/:fecha → entrenamientos del día [admin, moderador]
  /admin/scores → panel scores [admin, moderador]
  /admin/competiciones/nueva → crear competición [admin, moderador]
```

---

## Convenciones del proyecto

### Naming
- Componentes: `kebab-case` en carpetas, `PascalCase` en clase
- Servicios: `nombre.service.ts`
- Modelos: `nombre.model.ts`
- Español para todo: variables, métodos, nombres de componentes, comentarios

### Angular
- Todos los componentes son **standalone**
- **Lazy loading** en todas las rutas
- Imports directos en cada componente (sin módulos)
- Signals para estado reactivo cuando sea posible
- `inject()` en lugar de constructor para inyección de dependencias

### Supabase
- Cliente singleton en `src/app/core/supabase/supabase.client.ts`
- Variables de entorno en `src/environments/environment.ts`
- Edge Functions en `supabase/functions/`
- Migraciones en `supabase/migrations/`

### Estilos
- **Tailwind** para layout y utilidades
- **SCSS** por componente para estilos específicos
- **Bootstrap Icons** (`bi bi-*`) para iconos
- Diseño mobile-first (es una PWA)
- Bottom navigation para socios; menú lateral/superior para admin

---

## Comandos útiles

```bash
npm start          # ng serve (dev en localhost:4200)
npm run build      # build producción
```

### Supabase Edge Functions (desde raíz del proyecto)
```bash
supabase functions serve crear-usuario   # probar localmente
supabase functions deploy crear-usuario  # desplegar
```

---

## Archivos importantes

| Archivo | Propósito |
|---|---|
| `src/app/core/supabase/supabase.client.ts` | Cliente Supabase singleton |
| `src/app/core/auth/auth.service.ts` | Autenticación, usuario activo |
| `src/app/core/models/user.model.ts` | Interface User, UserRole |
| `src/environments/environment.ts` | URL y anon key de Supabase |
| `docs/supabase-schema.sql` | Schema completo de la BD |
| `supabase/migrations/` | Migraciones incrementales |
| `docs/superpowers/plans/` | Planes de implementación por feature |
| `docs/superpowers/specs/` | Specs de diseño por feature |

---

## Notas importantes

- El proyecto **no usa Angular modules** — todo standalone
- La navegación principal es un **bottom-nav** (mobile-first)
- Los socios no se auto-registran: el admin los crea manualmente
- `first_login: true` indica que el socio debe cambiar contraseña en su primer acceso
- Las cuotas se gestionan por temporada; `cuotaPagada` en el modelo User es calculado
- Los planes en `docs/superpowers/plans/` documentan decisiones técnicas tomadas
