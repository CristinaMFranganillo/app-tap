# Spec: Eliminar entrenamiento y escuadra independiente

**Fecha**: 2026-04-08  
**Estado**: Aprobado

---

## Contexto

La app de gestión del club de tiro permite registrar entrenamientos con sus escuadras y resultados. Actualmente no existe forma de eliminar un entrenamiento ni una escuadra una vez creados. Se necesita añadir esta funcionalidad.

---

## Alcance

- Eliminar un entrenamiento completo (con todas sus escuadras, tiradores, resultados y fallos)
- Eliminar una escuadra individual (con sus tiradores, resultados y fallos), sin afectar al entrenamiento padre

Fuera de alcance: soft-delete, historial de borrados, borrado de días completos de golpe.

---

## Modelo de datos

Jerarquía de tablas afectadas:

```
entrenamientos
  └── escuadras (entrenamiento_id)
        ├── escuadra_tiradores (escuadra_id)
        ├── resultados_entrenamiento (escuadra_id)
        └── entrenamiento_fallos (escuadra_id)
```

El borrado se hace en orden explícito (de hijos a padres) sin depender de CASCADE de FK.

---

## Cambios por capa

### 1. `EntrenamientoService` — nuevo método `deleteEntrenamiento(id: string)`

Pasos en orden:
1. Obtener IDs de escuadras del entrenamiento: `escuadras WHERE entrenamiento_id = id`
2. Borrar `entrenamiento_fallos WHERE escuadra_id IN (ids)`
3. Borrar `resultados_entrenamiento WHERE escuadra_id IN (ids)`
4. Borrar `escuadra_tiradores WHERE escuadra_id IN (ids)`
5. Borrar `escuadras WHERE entrenamiento_id = id`
6. Borrar `entrenamientos WHERE id = id`

Si no hay escuadras, saltar los pasos 2–4.

### 2. `EscuadraService` — nuevo método `deleteEscuadraEntrenamiento(id: string)`

Pasos en orden:
1. Borrar `entrenamiento_fallos WHERE escuadra_id = id`
2. Borrar `resultados_entrenamiento WHERE escuadra_id = id`
3. Borrar `escuadra_tiradores WHERE escuadra_id = id`
4. Borrar `escuadras WHERE id = id`

(El método existente `deleteEscuadra` no borra datos relacionados, por eso se crea uno nuevo específico para entrenamientos.)

### 3. `AdminScoresComponent` — eliminar entrenamiento desde la lista

- Añadir botón papelera (`bi-trash`) en cada fila de la tabla de entrenamientos, junto al lápiz existente
- Signal `pendingDeleteFecha: signal<string | null>(null)` para guardar la fecha del día seleccionado
- `confirmarEliminarEntrenamiento(fecha: string)`: setea `pendingDeleteFecha`
- `eliminarEntrenamiento()`: itera los IDs de la fecha (ya disponibles en `entrenamientos()` como `e.ids`), llama `deleteEntrenamiento` por cada uno, luego refresca
- `cancelarEliminarEntrenamiento()`: resetea signal a null
- `ConfirmDialogComponent` con:
  - `titulo`: "Eliminar entrenamiento"
  - `mensaje`: "¿Seguro que quieres eliminar el entrenamiento del día {fecha}? Se borrarán todas las escuadras y resultados. Esta acción no se puede deshacer."
  - `labelConfirmar`: "Eliminar"

### 4. `DetalleDiaEntrenamientoComponent` — eliminar escuadra desde el detalle

- En cada `escuadra-card__header`, añadir botón papelera junto al lápiz (solo visible en `modoEdicion`)
- Signal `pendingDeleteEscuadraId: signal<string | null>(null)`
- `confirmarEliminarEscuadra(id: string)`: setea el signal
- `eliminarEscuadra()`: llama `deleteEscuadraEntrenamiento(id)`, recarga las escuadras del día
- `cancelarEliminarEscuadra()`: resetea signal a null
- Para recargar: el componente actualmente usa `toSignal` con un observable fijo al montar. Habrá que introducir un `Subject` de refresh similar al patrón de `lista-socios` (o usar `effect` + signal de trigger)
- `ConfirmDialogComponent` con:
  - `titulo`: "Eliminar escuadra"
  - `mensaje`: "¿Seguro que quieres eliminar esta escuadra? Se borrarán todos sus resultados y fallos. Esta acción no se puede deshacer."
  - `labelConfirmar`: "Eliminar"

---

## Patrón de refresco

- **AdminScoresComponent**: `entrenamientos` ya usa `toSignal` directo. Cambiar a patrón `refresh$ = new Subject<void>()` + `startWith(null)` + `switchMap` igual que `lista-socios`.
- **DetalleDiaEntrenamientoComponent**: mismo patrón para recargar `entrenamientosDelDia` tras borrar una escuadra.

---

## UX

- El botón papelera usa la clase CSS existente de botones de acción (misma que el lápiz, con color rojo de peligro)
- La modal de confirmación es el `ConfirmDialogComponent` ya existente, sin cambios en ese componente
- Tras eliminar con éxito, la lista se actualiza sin navegación
- Si ocurre un error, se muestra un mensaje inline (igual que en el picker de crear entrenamiento)
