# Torneos — Spec de diseño

**Fecha**: 2026-04-09
**Estado**: Aprobado

## Resumen

Nuevo módulo de torneos que funciona con la misma mecánica que entrenamientos (escuadras de 6 puestos, grid 5x5, fallos) pero con datos completamente separados, un nombre identificativo y un ranking público visible por todos los socios.

Se oculta el sistema de competiciones antiguo (rutas, navegación) sin borrar código.

---

## Modelo de datos

### Nueva tabla `torneos`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| nombre | text NOT NULL | Ej: "Torneo San Isidro 2026" |
| fecha | date NOT NULL | |
| creado_por | uuid FK → profiles | |
| created_at | timestamptz | default now() |

### Nueva tabla `resultados_torneo`

Misma estructura que `resultados_entrenamiento`.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| escuadra_id | uuid FK → escuadras ON DELETE CASCADE | |
| user_id | uuid FK → profiles (nullable) | null si es no socio |
| nombre_externo | text (nullable) | nombre del no socio |
| es_no_socio | boolean default false | |
| puesto | int CHECK 1-6 | |
| platos_rotos | int | total de platos rotos |
| registrado_por | uuid FK → profiles | |
| created_at | timestamptz default now() | |
| UNIQUE(escuadra_id, user_id) | | socios |
| UNIQUE(escuadra_id, nombre_externo) | | no socios |

### Nueva tabla `torneo_fallos`

Misma estructura que `entrenamiento_fallos`.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| escuadra_id | uuid FK → escuadras ON DELETE CASCADE | |
| user_id | uuid FK → profiles ON DELETE CASCADE | |
| numero_plato | int CHECK 1-25 | solo se registran los fallos |
| created_at | timestamptz default now() | |
| UNIQUE(escuadra_id, user_id, numero_plato) | | |

### Modificación tabla `escuadras`

Nuevo campo: `torneo_id uuid FK → torneos ON DELETE CASCADE` (nullable).

Una escuadra pertenece a competición, entrenamiento o torneo (solo uno de los tres).

### RLS

Mismas políticas que entrenamientos:
- SELECT: todos los autenticados
- INSERT/UPDATE/DELETE: admin y moderador

---

## Componentes Admin

### ListaTorneosComponent (`/admin/torneos`)
- Lista de torneos ordenados por fecha DESC
- Cada card muestra: nombre, fecha, nº escuadras, nº tiradores
- FAB (+) para crear nuevo torneo
- Click en torneo → DetalleTorneoComponent
- Acciones: editar nombre/fecha, eliminar torneo

### FormTorneoComponent (`/admin/torneos/nuevo`)
- Campos: nombre (text, requerido), fecha (date, requerida)
- Al crear → redirige a DetalleTorneoComponent

### DetalleTorneoComponent (`/admin/torneos/:id`)
- Mismo layout que DetalleEntrenamientoComponent
- Muestra: nombre torneo, fecha, escuadras con resultados
- Ranking del torneo (ordenado por platos_rotos DESC)
- Total de caja por escuadra y general
- Botón "Nueva escuadra"
- Por cada escuadra: registrar resultados, resumen, eliminar

### FormEscuadraTorneoComponent (`/admin/torneos/:id/escuadra/nueva`)
- Misma UI que FormEscuadraEntrenamientoComponent
- 6 puestos (socio/no-socio), tarifas, caja
- Al crear → redirige a registrar resultados

### RegistrarResultadoTorneoComponent (`/admin/torneos/:torneoId/escuadra/:escuadraId/resultados`)
- Misma UI que RegistrarResultadoEntrenamientoComponent
- Acordeón por tirador, grid 5x5 clickeable
- Guarda en `resultados_torneo` y `torneo_fallos`

---

## Componentes Socio

### Tab "Torneos" en `/scores`
Nueva tab junto a Ranking, Historial, Entrenamientos.

### TorneoSocioListaComponent (`/scores/torneos`)
- Lista de todos los torneos (no filtrado por usuario — son públicos)
- Card por torneo: nombre, fecha
- Click → TorneoSocioDetalleComponent

### TorneoSocioDetalleComponent (`/scores/torneos/:id`)
- Ranking completo del torneo
- Posición, nombre del tirador, platos rotos
- Medallas para top 3 (🥇🥈🥉)
- Visible por TODOS los socios

---

## Servicio

### TorneoService

Operaciones sobre `torneos`:
- `getAll()`: Observable<Torneo[]>
- `getById(id)`: Observable<Torneo>
- `create(nombre, fecha, creadoPor)`: Promise<string>
- `update(id, nombre, fecha)`: Promise<void>
- `delete(id)`: Promise<void> (cascada: fallos → resultados → caja → tiradores → escuadras → torneo)

Escuadras (reutiliza EscuadraService con nuevo método):
- `createEscuadraTorneo(torneoId, numero)`: Promise<string>
- `deleteEscuadraTorneo(id)`: Promise<void>

Resultados (en TorneoService):
- `getResultadosByEscuadra(escuadraId)`: Observable<ResultadoTorneo[]>
- `upsertResultados(resultados, registrador)`: Promise<void>
- `getRanking(torneoId)`: Observable<RankingTorneo[]>

Fallos (en TorneoService):
- `upsertFallos(fallos, escuadraId, userIds)`: Promise<void>
- `getFallosByEscuadra(escuadraId)`: Observable<FalloTorneo[]>

---

## Navegación

### Bottom-nav socio
Sin cambios en el bottom-nav. "Entrena" sigue llevando a `/scores`. Dentro se añade tab "Torneos".

### Admin
- Se ocultan las rutas de competiciones antiguas (`/admin/competiciones/nueva`, `/admin/scores/resultados`, `/admin/scores/nuevo`)
- Se añade acceso a torneos desde AdminScoresComponent (botón "Nuevo Torneo" y lista de torneos)
- O bien ruta directa `/admin/torneos` accesible desde AdminScoresComponent

---

## Lo que se oculta

- Rutas de competiciones en `admin.routes.ts` (comentar/eliminar)
- Botones de "Nueva Competición", "Nuevo Score", "Registrar Resultados" en AdminScoresComponent
- Tab "Ranking" de competiciones en scores socio (se sustituye por "Torneos")
- No se borran los servicios ni componentes de competiciones — solo se desconectan

---

## Modelos TypeScript

```typescript
interface Torneo {
  id: string;
  nombre: string;
  fecha: string; // 'YYYY-MM-DD'
  creadoPor: string;
  createdAt?: string;
  numEscuadras?: number;
  numTiradores?: number;
}

interface ResultadoTorneo {
  id: string;
  escuadraId: string;
  userId?: string;
  nombreExterno?: string;
  esNoSocio: boolean;
  puesto: number;
  platosRotos: number;
}

interface FalloTorneo {
  escuadraId: string;
  userId: string;
  numeroPlato: number;
}

interface RankingTorneo {
  userId: string;
  nombre: string;
  apellidos: string;
  platosRotos: number;
  posicion: number;
}
```
