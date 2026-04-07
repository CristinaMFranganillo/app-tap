# Diseño: Registro de posición de fallos en entrenamientos

**Fecha:** 2026-04-07  
**Estado:** Aprobado

---

## Resumen

Guardar qué platos exactos (1–25) falló cada tirador en cada sesión de entrenamiento, no solo el total. Mostrar los platos fallados en el resumen inmediato y acumularlos para estadísticas históricas por tirador.

---

## Problema actual

En `registrar-resultado-entrenamiento`, la cuadrícula de 25 botones ya captura visualmente qué platos fallaron (`t.platos[i] = false`), pero al guardar solo se envía el total:

```typescript
platosRotos: t.platos.filter(Boolean).length  // ← se pierde la posición
```

El número de plato (posición) se conoce pero no se persiste.

---

## Base de datos

### Nueva tabla `entrenamiento_fallos`

```sql
CREATE TABLE IF NOT EXISTS entrenamiento_fallos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id    uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  numero_plato   int NOT NULL CHECK (numero_plato BETWEEN 1 AND 25),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escuadra_id, user_id, numero_plato)
);
```

- Una fila por cada plato fallado (solo los fallos, no los rotos)
- El UNIQUE permite hacer upsert seguro al re-guardar
- `ON DELETE CASCADE` desde escuadras limpia automáticamente al borrar escuadra

### RLS

```sql
ALTER TABLE entrenamiento_fallos ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer
CREATE POLICY "entrenamiento_fallos_select"
  ON entrenamiento_fallos FOR SELECT TO authenticated USING (true);

-- Solo admin/moderador pueden escribir
CREATE POLICY "entrenamiento_fallos_insert"
  ON entrenamiento_fallos FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "entrenamiento_fallos_delete"
  ON entrenamiento_fallos FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
```

---

## Modelo de datos

### Nuevo modelo `FalloEntrenamiento`

```typescript
// src/app/core/models/entrenamiento.model.ts — añadir al fichero existente

export interface FalloEntrenamiento {
  escuadraId: string;
  userId: string;
  numeroPlato: number;  // 1..25
}
```

### Cambio en `TiradorSession` (registrar-resultado-entrenamiento)

Sin cambios en la interfaz — `platos: boolean[]` ya representa los fallos correctamente.

---

## Cambios en `EntrenamientoService`

### Nuevo método `upsertFallos`

```typescript
async upsertFallos(
  fallos: FalloEntrenamiento[],
  escuadraId: string,
  userIds: string[]
): Promise<void>
```

Lógica:
1. Borrar los fallos anteriores de esta escuadra + estos usuarios (para manejar re-guardados)
2. Insertar los nuevos fallos (solo los platos donde `platos[i] === false`)

### Nuevo método `getFallosByEscuadra`

```typescript
getFallosByEscuadra(escuadraId: string): Observable<FalloEntrenamiento[]>
```

### Nuevo método `getFallosByUser`

```typescript
getFallosByUser(userId: string): Observable<{ numeroPlato: number; veces: number }[]>
```

Devuelve los 25 platos con su frecuencia de fallo acumulada en todos los entrenamientos.

---

## Cambios en `registrar-resultado-entrenamiento`

### Método `guardar()` actualizado

Enviar en paralelo los totales (como ahora) Y los fallos individuales:

```typescript
async guardar(): Promise<void> {
  // 1. Totales (igual que ahora)
  await this.entrenamientoService.upsertResultados(...)

  // 2. Fallos individuales (nuevo)
  const fallos: FalloEntrenamiento[] = [];
  for (const t of this.session()) {
    for (let i = 0; i < t.platos.length; i++) {
      if (!t.platos[i]) {
        fallos.push({ escuadraId: this.escuadraId, userId: t.userId, numeroPlato: i + 1 });
      }
    }
  }
  const userIds = this.session().map(t => t.userId);
  await this.entrenamientoService.upsertFallos(fallos, this.escuadraId, userIds);
}
```

---

## Cambios en `resumen-escuadra-entrenamiento`

### Modelo `FilaResumen` actualizado

```typescript
interface FilaResumen {
  puesto: number;
  nombre: string;
  platosRotos: number;
  fallos: number;
  numerosFallos: number[];  // nuevo: ej. [3, 11, 19]
}
```

### `ngOnInit` actualizado

Cargar en paralelo resultados + fallos, cruzar por userId para añadir `numerosFallos`.

### Template: mostrar platos fallados

Bajo cada fila de tirador, si hay fallos, mostrar los números:

```
Fallos en platos: 3 · 11 · 19
```

---

## Estadísticas por tirador (mapa de calor)

En el perfil del tirador (o sección de stats), añadir una cuadrícula de 25 celdas coloreada por frecuencia de fallo:
- Verde claro: nunca falla ese plato
- Amarillo: falla ocasionalmente  
- Rojo: falla frecuentemente

Usa `getFallosByUser(userId)` que devuelve `{ numeroPlato, veces }[]`.

**Ubicación:** Dentro de la vista de perfil del socio en admin, sección "Estadísticas de entrenamiento", junto al gráfico anual que ya existe.

---

## Migración SQL (fichero a crear)

`supabase/migrations/009_entrenamiento_fallos.sql`

---

## Ficheros modificados

| Fichero | Acción |
|---------|--------|
| `supabase/migrations/009_entrenamiento_fallos.sql` | Crear |
| `src/app/core/models/entrenamiento.model.ts` | Añadir `FalloEntrenamiento` |
| `src/app/features/admin/entrenamientos/entrenamiento.service.ts` | Añadir `upsertFallos`, `getFallosByEscuadra`, `getFallosByUser` |
| `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts` | Actualizar `guardar()` |
| `src/app/features/admin/entrenamientos/resumen-escuadra-entrenamiento/resumen-escuadra-entrenamiento.component.ts` | Cargar y mostrar `numerosFallos` |
| `src/app/features/admin/entrenamientos/resumen-escuadra-entrenamiento/resumen-escuadra-entrenamiento.component.html` | Mostrar platos fallados |

---

## Fuera de alcance

- Fallos en competiciones (ocultas por ahora)
- Notificaciones o alertas automáticas por patrón de fallos
- Exportación de datos de fallos
