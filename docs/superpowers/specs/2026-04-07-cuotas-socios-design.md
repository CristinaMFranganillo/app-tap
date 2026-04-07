# Diseño: Cuotas de Socios

**Fecha:** 2026-04-07  
**Estado:** Aprobado

---

## Resumen

Añadir gestión de cuotas anuales a los socios. El administrador marca si un socio ha pagado la cuota de la temporada activa. Se guarda histórico por temporada. Las temporadas van de abril a abril y el admin define la fecha de inicio de cobro.

---

## Base de datos

### Tabla `temporadas`

```sql
CREATE TABLE temporadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,        -- ej: "2025-2026"
  fecha_inicio date NOT NULL,        -- fecha en que el admin arranca el cobro
  activa       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Solo puede haber una temporada con `activa = true` a la vez. Al crear una nueva temporada se desactiva la anterior.

### Tabla `cuotas`

```sql
CREATE TABLE cuotas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  temporada_id uuid NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
  pagada      boolean NOT NULL DEFAULT false,
  fecha_pago  timestamptz,           -- se rellena al marcar como pagada, null si no pagada
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, temporada_id)
);
```

Al crear una nueva temporada, se insertan registros en `cuotas` para **todos los socios activos** con `pagada = false`.

---

## Modelo de datos (frontend)

### Nuevo modelo `Temporada`

```typescript
interface Temporada {
  id: string;
  nombre: string;
  fechaInicio: Date;
  activa: boolean;
}
```

### Nuevo modelo `Cuota`

```typescript
interface Cuota {
  id: string;
  userId: string;
  temporadaId: string;
  temporadaNombre: string;
  pagada: boolean;
  fechaPago?: Date;
}
```

### Cambio en modelo `User`

Añadir campo calculado opcional para la temporada activa:

```typescript
cuotaPagada?: boolean;  // estado en la temporada activa, undefined si no hay temporada
```

---

## Servicios

### `CuotaService`

- `getTemporadaActiva(): Observable<Temporada | null>`
- `getTodasTemporadas(): Observable<Temporada[]>`
- `crearTemporada(nombre: string, fechaInicio: Date): Promise<void>` — crea temporada, la activa, desactiva la anterior, e inserta cuotas para todos los socios
- `getCuotasSocio(userId: string): Observable<Cuota[]>` — histórico completo
- `toggleCuota(cuotaId: string, pagada: boolean): Promise<void>` — marca/desmarca pagado

### `UserService` (cambios)

- En `getAll()`, hacer join con `cuotas` de la temporada activa para incluir `cuotaPagada` en cada usuario

---

## Vistas

### Lista de socios (`lista-socios`)

- Añadir **indicador circular** (16px) junto al nombre/avatar de cada socio:
  - **Verde** (`#10B981`) si `cuotaPagada = true`
  - **Gris** (`#9CA3AF`) si `cuotaPagada = false` o no hay temporada activa
- El admin puede **hacer click en el círculo** para alternar el estado directamente (sin entrar al detalle). Actualización optimista en UI.

### Detalle del socio (panel expandido)

- Añadir fila "Cuota [nombre temporada]" con badge de estado (verde/gris)
- Sección "Historial de cuotas" con tabla de temporadas anteriores y su estado

### Gestión de temporadas (nueva sección en admin)

- Nueva ruta: `/admin/temporadas`
- Muestra la temporada activa y listado de temporadas anteriores
- Botón "Nueva temporada" que abre un diálogo con:
  - Campo: nombre (ej: "2026-2027", sugerido automáticamente)
  - Campo: fecha de inicio de cobro (date picker)
  - Al confirmar: crea temporada, activa, genera cuotas para todos los socios activos
- La nueva ruta se añade al menú de navegación del admin

---

## Indicadores visuales

| Estado | Color | Hex |
|--------|-------|-----|
| Pagada | Verde | `#10B981` |
| No pagada | Gris | `#9CA3AF` |

---

## Flujo principal

1. Admin entra a "Temporadas" y crea la temporada "2026-2027" con fecha de inicio
2. El sistema genera `cuotas` para todos los socios activos con `pagada = false`
3. En la lista de socios, todos aparecen con círculo gris
4. Conforme van pagando, el admin hace click en el círculo → pasa a verde
5. El histórico queda guardado en la tabla `cuotas` para consulta futura

---

## Fuera de alcance

- Notificaciones automáticas al socio cuando se crea temporada
- Importación masiva de pagos
- Integración con pasarela de pago
