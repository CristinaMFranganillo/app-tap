# Contabilidad — Vista financiera completa del club

## Resumen

Componente independiente en `/admin/contabilidad` que muestra la contabilidad completa del club combinando todas las fuentes de dinero (escuadras, torneos, cuotas, movimientos manuales). Sigue el patrón de tabs día/mes/año de Caja pero con datos financieros globales. Incluye CRUD de gastos/ingresos manuales (solo admin).

## Decisiones de diseño

- **Componente único con tabs** (como `CajaComponent`) — no sub-componentes ni rutas separadas
- **Convive con Caja** — Caja es operativa (detalle de escuadras/tiradores), Contabilidad es financiera (balance global)
- **Drill-down completo**: año → mes → día, sin cambio de ruta (signals internos)
- **Admin + moderador** pueden ver; solo **admin** puede registrar/eliminar movimientos manuales
- **No se necesitan tablas nuevas** — usa `movimientos_caja`, `movimientos_manuales` y `cuotas` existentes

## Modelo de datos

### Interface unificada

```typescript
export type CategoriaContable =
  'escuadra' | 'torneo' | 'cuota' | 'ingreso_manual' | 'gasto_manual';

export interface MovimientoContable {
  id: string;
  categoria: CategoriaContable;
  concepto: string;        // "Juan Pérez", "Cuota — Ana López", "Material de tiro"
  importe: number;         // siempre positivo
  esGasto: boolean;        // true solo para gasto_manual
  fecha: string;           // 'YYYY-MM-DD'
}
```

### Fuentes de datos combinadas

| Fuente | Tabla | Campo fecha | Categoría |
|--------|-------|-------------|-----------|
| Escuadras entrenamiento | `movimientos_caja` (donde `torneo_id IS NULL`) | `fecha` | `escuadra` |
| Inscripciones torneo | `movimientos_caja` (donde `torneo_id IS NOT NULL`) | `fecha` | `torneo` |
| Cuotas pagadas | `cuotas` (donde `pagada = true`) | `fecha_pago` | `cuota` |
| Ingresos manuales | `movimientos_manuales` (donde `tipo = 'ingreso'`) | `fecha` | `ingreso_manual` |
| Gastos manuales | `movimientos_manuales` (donde `tipo = 'gasto'`) | `fecha` | `gasto_manual` |

Para cuotas se necesita join con `profiles` (nombre) y `temporadas` (importe según tipo_cuota).

## Servicio — ContabilidadService

Extender el servicio existente (`contabilidad.service.ts`) con 3 métodos nuevos:

### `getMovimientosContables(desde: string, hasta: string): Promise<MovimientoContable[]>`

Método privado base. Hace 3 queries en paralelo con `Promise.all`:

1. `movimientos_caja` filtrado por rango de `fecha`
2. `movimientos_manuales` filtrado por rango de `fecha`
3. `cuotas` con `pagada = true` filtrado por rango de `fecha_pago::date` (cast de timestamptz a date para comparar con YYYY-MM-DD), join con `profiles(nombre, apellidos, tipo_cuota)` y `temporadas(importe_socio, importe_directivo, importe_honor)`

Unifica los 3 resultados en `MovimientoContable[]` ordenados por fecha descendente.

### Métodos públicos

- `getContabilidadDia(fecha: string)` → llama a `getMovimientosContables(fecha, fecha)`
- `getContabilidadMes(mes: string)` → calcula primer y último día del mes, llama al base
- `getContabilidadAnio(anio: number)` → `getMovimientosContables('YYYY-01-01', 'YYYY-12-31')`

## Componente — ContabilidadComponent

### Ubicación

`src/app/features/admin/contabilidad/contabilidad.component.ts`

### Signals

```typescript
vista = signal<'dia' | 'mes' | 'anio'>('dia');
cargando = signal(true);
movimientos = signal<MovimientoContable[]>([]);

fechaDia = signal(hoy);
mesFiltro = signal(mesActual);
anioFiltro = signal(anioActual);

// Drill-down: guarda la vista de origen para el botón atrás
origenDrillDown = signal<'mes' | 'anio' | null>(null);

// CRUD
mostrarFormMovimiento = signal(false);
tipoMovimiento = signal<'gasto' | 'ingreso'>('gasto');
guardando = signal(false);
```

### Computed

```typescript
// Balance del período
resumen = computed(() => {
  ingresos: sum de movimientos donde !esGasto
  gastos: sum de movimientos donde esGasto
  balance: ingresos - gastos
  countIngresos, countGastos
});

// Vista día: lista plana de movimientos
// (sin agrupación extra, se muestra directamente)

// Vista mes: agrupado por fecha
agrupadoPorDia = computed<GrupoDiaContable[]>();
// Cada grupo: { fecha, movimientos[], ingresos, gastos, balance, countIngresos, countGastos }

// Vista año: agrupado por mes
agrupadoPorMes = computed<GrupoMesContable[]>();
// Cada grupo: { mes (YYYY-MM), label, ingresos, gastos, balance, countIngresos, countGastos }

// Vista año: desglose por categoría
desgloseCategoria = computed(() => {
  escuadras: sum, torneos: sum, cuotas: sum, ingresosVarios: sum, gastos: sum
});

esAdmin = computed(() => rol === 'admin');
```

### Drill-down

- Click en un mes (vista año): `origenDrillDown.set('anio')`, `vista.set('mes')`, `mesFiltro.set(mes)`, `cargarMes()`
- Click en un día (vista mes): `origenDrillDown.set('mes')`, `vista.set('dia')`, `fechaDia.set(fecha)`, `cargarDia()`
- Botón atrás: si `origenDrillDown` → volver a la vista origen; si no → `router.navigate(['/perfil'])`

### CRUD movimientos manuales

- Botones "+Ingreso" / "-Gasto" visibles solo si `esAdmin()`
- Formulario inline (card) con: concepto, importe, fecha
- Al guardar: `contabilidadService.crearMovimiento()` + recargar datos
- Icono eliminar en movimientos manuales, visible solo si `esAdmin()`
- Confirm dialog antes de eliminar

## UI — Layout por vista

### Header (común)

- Botón atrás (← perfil o vista origen del drill-down)
- Título "Contabilidad"
- Sin botón de config (a diferencia de Caja con tarifas)

### Tabs (común)

Tabs Día / Mes / Año — mismo estilo que `caja-tabs`

### Filtros (según vista)

- Día: input date
- Mes: select con últimos 12 meses
- Año: select con 3 años

### Cards resumen (común)

- Card balance del período (ingresos - gastos), color verde si positivo, rojo si negativo
- Dos mini-cards: total ingresos (verde) + total gastos (rojo)

### Vista Día

- Lista de movimientos individuales
- Cada fila: badge de categoría (ESCUADRA, TORNEO, CUOTA, INGRESO, GASTO) + concepto + importe
- Colores de badges:
  - ESCUADRA: azul (#dbeafe / #1d4ed8)
  - TORNEO: ámbar (#fef3c7 / #92400e)
  - CUOTA: verde (#d1fae5 / #065f46)
  - INGRESO: índigo (#e0e7ff / #3730a3)
  - GASTO: rojo (#fee2e2 / #991b1b)
- Importe verde (+) para ingresos, rojo (-) para gastos
- Icono eliminar solo en movimientos manuales, solo admin
- Botones "+Ingreso" / "-Gasto" al final (solo admin)

### Vista Mes

- Desglose por día (como `caja-dia-fila`)
- Cada fila: fecha formateada, count ingresos/gastos, balance del día
- Chevron `›` indicando clickable → drill-down a día
- Botones "+Ingreso" / "-Gasto" al final (solo admin)

### Vista Año

- Card "Desglose por categoría": escuadras, torneos, cuotas, otros ingresos, gastos (con dot de color)
- Desglose por mes (12 filas máx)
- Cada fila: nombre del mes, count ingresos/gastos, balance mensual
- Chevron `›` indicando clickable → drill-down a mes
- Botones "+Ingreso" / "-Gasto" al final (solo admin)

### Empty state

Icono + "Sin movimientos para este periodo" (como Caja)

### Skeleton

Misma estructura de skeleton que Caja durante carga

## Estilos

SCSS propio (`contabilidad.component.scss`) reutilizando el patrón de Caja:
- Mismas clases de tabs, filtros, skeleton, empty
- Clases nuevas para badges de categoría y card de desglose por categoría
- Tailwind para layout, SCSS BEM para componente

## Rutas

### Nueva ruta en `admin.routes.ts`

```typescript
{
  path: 'contabilidad',
  canActivate: [roleGuard],
  data: { roles: ['admin', 'moderador'] },
  loadComponent: () =>
    import('./contabilidad/contabilidad.component').then(m => m.ContabilidadComponent),
}
```

### Enlace en perfil — tab Estadísticas

Añadir card de navegación:
```
📊 Contabilidad — Balance financiero del club
```

### Simplificar perfil — tab Administración

Quitar:
- Botones "Registrar ingreso" / "Registrar gasto"
- Formulario de nuevo movimiento
- Lista de movimientos manuales

Añadir:
- Botón/enlace "Ver contabilidad completa →" bajo el resumen financiero

## Migración SQL

### `026_movimientos_manuales_solo_admin.sql`

Restringir insert y delete de `movimientos_manuales` a solo admin:

```sql
DROP POLICY "movimientos_manuales_insert" ON public.movimientos_manuales;
DROP POLICY "movimientos_manuales_delete" ON public.movimientos_manuales;

CREATE POLICY "movimientos_manuales_insert_admin"
  ON public.movimientos_manuales FOR INSERT
  WITH CHECK (public.get_my_rol() = 'admin');

CREATE POLICY "movimientos_manuales_delete_admin"
  ON public.movimientos_manuales FOR DELETE
  USING (public.get_my_rol() = 'admin');
```

La policy de SELECT se mantiene para admin + moderador.

## Cambios en archivos existentes

| Archivo | Cambio |
|---------|--------|
| `admin.routes.ts` | Añadir ruta `/contabilidad` |
| `contabilidad.service.ts` | Añadir métodos `getContabilidadDia/Mes/Anio` |
| `perfil.component.html` | Simplificar tab admin + añadir card contabilidad en estadísticas |
| `perfil.component.ts` | Añadir método `irContabilidad()`, quitar lógica CRUD de movimientos |

## Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/app/features/admin/contabilidad/contabilidad.component.ts` | Componente principal |
| `src/app/features/admin/contabilidad/contabilidad.component.html` | Template |
| `src/app/features/admin/contabilidad/contabilidad.component.scss` | Estilos |
| `src/app/core/models/movimiento-contable.model.ts` | Interface `MovimientoContable` |
| `supabase/migrations/026_movimientos_manuales_solo_admin.sql` | Migración RLS |
