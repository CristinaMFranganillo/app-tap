# AppTap — Campo de Tiro San Isidro
**Spec de diseño · 2026-04-06**

---

## 1. Visión general

Aplicación móvil Angular 19 para el **Campo de Tiro San Isidro**. Permite a los socios consultar noticias y sus resultados en competiciones, y a administradores/moderadores gestionar socios, noticias y puntuaciones.

**Stack:**
- Angular 19 (Standalone Components + lazy loading por ruta)
- Tailwind CSS (paleta personalizada)
- Bootstrap Icons
- Tipografía: Montserrat (Google Fonts)
- Sin backend — preparado para integrar API REST futura (servicios con interfaces TypeScript)

---

## 2. Roles y permisos

| Capacidad | Socio | Moderador | Admin |
|---|---|---|---|
| Ver noticias | ✅ | ✅ | ✅ |
| Ver ranking/scores | ✅ | ✅ | ✅ |
| Ver y editar perfil propio | ✅ | ✅ | ✅ |
| Crear/editar noticias | ❌ | ✅ | ✅ |
| Registrar scores de competición | ❌ | ✅ | ✅ |
| Crear/editar competiciones | ❌ | ✅ | ✅ |
| Gestionar socios (CRUD) | ❌ | ❌ | ✅ |
| Asignar roles | ❌ | ❌ | ✅ |

---

## 3. Modelos de datos (TypeScript)

```typescript
// core/models/user.model.ts
export type UserRole = 'socio' | 'moderador' | 'admin';

export interface User {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  numeroSocio: string;
  avatarUrl?: string;        // opcional; si ausente se usan iniciales
  rol: UserRole;
  fechaAlta: Date;
  activo: boolean;
}

// core/models/competicion.model.ts
export interface Competicion {
  id: string;
  nombre: string;
  modalidad: string;         // texto libre: "Foso Olímpico", "Skeet", etc.
  totalPlatos: number;       // máximo de platos para esta competición
  fecha: Date;
  activa: boolean;
  creadaPor: string;         // userId
}

// core/models/score.model.ts
export interface Score {
  id: string;
  userId: string;
  competicionId: string;
  platosRotos: number;
  fecha: Date;
  registradoPor: string;     // userId del admin/mod
}

// core/models/news.model.ts
export interface News {
  id: string;
  titulo: string;
  contenido: string;
  autorId: string;
  fecha: Date;
  imagenUrl?: string;
  publicada: boolean;
}
```

---

## 4. Arquitectura de carpetas

```
src/app/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts         # login, logout, token, usuario actual
│   │   ├── auth.guard.ts           # redirige a /login si no autenticado
│   │   └── role.guard.ts           # redirige si no tiene rol requerido
│   ├── interceptors/
│   │   └── auth.interceptor.ts     # añade Authorization header
│   └── models/
│       ├── user.model.ts
│       ├── competicion.model.ts
│       ├── score.model.ts
│       └── news.model.ts
│
├── features/
│   ├── auth/
│   │   ├── login/
│   │   │   ├── login.component.ts
│   │   │   └── login.component.html
│   │   └── auth.routes.ts
│   │
│   ├── home/
│   │   ├── home.component.ts
│   │   └── home.component.html
│   │
│   ├── noticias/
│   │   ├── lista/
│   │   ├── detalle/
│   │   └── noticias.routes.ts
│   │
│   ├── scores/
│   │   ├── ranking/
│   │   ├── historial/
│   │   └── scores.routes.ts
│   │
│   ├── perfil/
│   │   ├── perfil.component.ts
│   │   └── perfil.component.html
│   │
│   └── admin/
│       ├── socios/
│       │   ├── lista-socios/
│       │   ├── detalle-socio/
│       │   └── form-socio/
│       ├── noticias/
│       │   ├── lista-noticias/
│       │   └── form-noticia/
│       ├── scores/
│       │   └── form-score/
│       ├── competiciones/
│       │   └── form-competicion/
│       └── admin.routes.ts
│
└── shared/
    ├── components/
    │   ├── bottom-nav/
    │   ├── header/
    │   ├── avatar/            # muestra foto o iniciales (nombre + apellido)
    │   ├── card-noticia/
    │   └── card-score/
    └── pipes/
        └── iniciales.pipe.ts  # "Juan García" → "JG"
```

---

## 5. Routing

```
/login                          → LoginComponent (público)
/                               → HomeComponent (auth guard)
  /noticias                     → NoticiasListaComponent
  /noticias/:id                 → NoticiasDetalleComponent
  /scores                       → ScoresRankingComponent
  /scores/historial             → ScoresHistorialComponent
  /perfil                       → PerfilComponent
  /admin                        → AdminComponent (role guard: moderador|admin)
    /admin/socios               → ListaSociosComponent (role guard: admin)
    /admin/socios/nuevo         → FormSocioComponent
    /admin/socios/:id           → DetalleSocioComponent
    /admin/noticias             → ListaNoticiasAdminComponent
    /admin/noticias/nueva       → FormNoticiaComponent
    /admin/noticias/:id/editar  → FormNoticiaComponent
    /admin/scores/nuevo         → FormScoreComponent
    /admin/competiciones/nueva  → FormCompeticionComponent
```

---

## 6. Diseño visual

### Paleta (tailwind.config.js)
```js
colors: {
  brand: {
    yellow: '#D4E600',   // CTA, iconos activos, acentos
    dark:   '#1A1A1A',   // header, fondos oscuros, textos primarios
  },
  surface: '#F5F5F5',    // fondo de pantallas
  success: '#22C55E',
  danger:  '#EF4444',
}
```

### Tipografía
- **Montserrat** exclusivamente (400, 500, 600, 700, 800, 900)
- Títulos de sección: 9px uppercase, weight 800, letter-spacing .8px
- Body cards: 9–10px, weight 600–700
- Meta/secundario: 7.5–8px, weight 500, color #888

### Layout
- Mobile-first, diseñado para 375px de ancho
- Header fijo: 54px, fondo `brand.dark`
- Bottom navigation fija: 4 ítems, icono + label
  - Socios (admin): `people`, Noticias, Scores/Trofeo, Perfil/Config
  - Icono activo: `brand.yellow`; inactivo: `#d0d0d0`
- FAB (botón flotante amarillo): para acciones de creación en vistas admin

### Avatar
- Si el usuario tiene `avatarUrl`: mostrar imagen circular
- Si no: mostrar iniciales (primera letra de nombre + primera letra de primer apellido), fondo `brand.dark`, texto `brand.yellow`
- `InicalesPipe`: `"Juan García Ruiz" → "JG"`

### Logo
- Siempre sobre fondo blanco (`background: #fff`) para que los textos del PNG sean legibles
- En header: 32×32px circular con borde `brand.yellow` de 2px
- En login: 72×72px circular con borde oscuro de 3px

---

## 7. Autenticación

- `AuthService` gestiona el estado del usuario autenticado con un `BehaviorSubject<User | null>`
- Token JWT almacenado en `localStorage`
- `AuthGuard`: si no hay token, redirige a `/login`
- `RoleGuard`: recibe `data.roles: UserRole[]` en la ruta; si el usuario no tiene el rol, redirige a `/`
- `AuthInterceptor`: añade `Authorization: Bearer <token>` a todas las peticiones HTTP

---

## 8. Pantallas — resumen

### Vista Socio
| Pantalla | Descripción |
|---|---|
| Login | Logo grande, fondo oscuro arriba, card blanca abajo con form |
| Inicio / Noticias | Feed de cards con imagen, título, tag "Nuevo", fecha y autor |
| Scores / Ranking | Selector de competición (pill oscuro), tabla ranking con medallas oro/plata/bronce + iniciales |
| Perfil | Hero con avatar (iniciales), stats (competiciones, media, podios), historial de resultados |

### Vista Admin / Moderador
| Pantalla | Descripción |
|---|---|
| Gestión Socios | Lista con buscador, avatar iniciales, punto estado activo/inactivo, FAB para crear |
| Formulario Socio | Campos nombre, email, nº socio, rol; botones guardar / cancelar |
| Gestión Noticias | Lista separada publicadas / borradores, acciones editar y borrar, FAB crear |
| Registrar Score | Selector de competición, lista de participantes con campo platos rotos / total |
| Crear Competición | Nombre, modalidad (texto libre), total de platos, fecha |

---

## 9. Servicios

```
core/auth/auth.service.ts          → login(), logout(), currentUser$, hasRole()
features/noticias/news.service.ts  → getAll(), getById(), create(), update(), delete()
features/scores/score.service.ts   → getByCompeticion(), getByUser(), create()
features/admin/user.service.ts     → getAll(), getById(), create(), update(), toggleActivo()
features/scores/competicion.service.ts → getAll(), getActiva(), create(), update()
```

Todos los servicios usan `HttpClient` y retornan `Observable<T>`. Los datos mock se proveen con un `MockDataService` durante el desarrollo (sin backend real).

---

## 10. Configuración Tailwind

Tailwind CSS instalado como dependencia de desarrollo. Configurado en `tailwind.config.js` con paleta personalizada. `styles.scss` importa las directivas base de Tailwind y la fuente Montserrat via Google Fonts.

Bootstrap Icons instalado via npm (`bootstrap-icons`) e importado en `styles.scss`.
