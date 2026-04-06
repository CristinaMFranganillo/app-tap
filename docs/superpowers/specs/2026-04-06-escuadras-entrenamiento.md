# Escuadras de Entrenamiento

**Fecha:** 2026-04-06  
**Estado:** Aprobado

## Objetivo

Las escuadras de entrenamiento son independientes de las competiciones. Cada escuadra tiene una fecha, un número autonumérico por día (reinicia cada día desde 1), un creador y 6 puestos con tiradores. Los resultados se guardan por usuario para sus estadísticas individuales. Las competiciones son un módulo completamente separado.

---

## Estado actual del código

El modelo existente acopla escuadras a competiciones (`competicion_id` obligatorio en `escuadras`). Hay que desacoplar:

- `escuadras.competicion_id` → hacerlo nullable o eliminarlo (las escuadras de entrenamiento no tienen competición)
- `EscuadraService` → actualmente solo tiene `getByCompeticion()`, hay que añadir métodos para entrenamientos
- `form-escuadra` → actualmente requiere competición, hay que adaptarlo
- `registrar-resultado` → actualmente registra plato a plato en tiempo real por serie; para entrenamientos el flujo es distinto: se registran platos totales por tirador al final

---

## Modelo de datos

### Modificación: tabla `escuadras`

Hacer `competicion_id` nullable. Una escuadra sin `competicion_id` es de entrenamiento.

```sql
ALTER TABLE escuadras ALTER COLUMN competicion_id DROP NOT NULL;
ALTER TABLE escuadras ADD COLUMN fecha date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE escuadras ADD COLUMN creado_por uuid REFERENCES profiles(id);
```

### Nueva tabla: `resultados_entrenamiento`

Resultados de platos totales por tirador en una escuadra de entrenamiento.

```sql
CREATE TABLE resultados_entrenamiento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id    uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id),
  puesto         int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  platos_rotos   int NOT NULL DEFAULT 0,
  registrado_por uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escuadra_id, user_id)
);
```

---

## Modelo Angular

### Actualizar `Escuadra` (escuadra.model.ts)

```typescript
export interface Escuadra {
  id: string;
  competicionId?: string;   // null = entrenamiento
  fecha: string;            // YYYY-MM-DD
  numero: number;
  creadoPor?: string;
  tiradores?: EscuadraTirador[];
}

export interface ResultadoEntrenamiento {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
  platosRotos: number;
}
```

---

## Flujo de la app

### Lista de escuadras (`/admin/escuadras`)

- Muestra escuadras de entrenamiento (sin `competicion_id`), ordenadas por fecha descendente
- Agrupadas por fecha: "Hoy", "Ayer", fechas anteriores
- Cada fila: número de escuadra, fecha, puestos ocupados (ej. "4/6"), botón registrar resultados
- FAB "+" → `/admin/escuadras/nueva`

### Crear escuadra (`/admin/escuadras/nueva`)

- Selector de fecha (por defecto hoy)
- 6 selectores de tirador por puesto (nullable — puesto vacío permitido)
- Al guardar: número = count de escuadras del día + 1
- Guarda `creado_por` = usuario autenticado

### Registrar resultados (`/admin/escuadras/:id/resultados`)

- Lista los 6 puestos con nombre del tirador (puestos vacíos se muestran como "—")
- Solo puestos ocupados tienen input numérico de platos rotos
- Al guardar: upsert en `resultados_entrenamiento` por cada puesto ocupado
- Navegación: vuelve a `/admin/escuadras`

### Perfil del usuario

- Historial muestra resultados de `resultados_entrenamiento` (no de competiciones)
- Estadísticas: total escuadras participadas, media de platos rotos

---

## Arquitectura de componentes

| Archivo | Acción |
|---|---|
| `src/app/core/models/escuadra.model.ts` | Actualizar `Escuadra`, añadir `ResultadoEntrenamiento` |
| `src/app/features/scores/escuadra.service.ts` | Añadir `getAllEntrenamientos()`, `getByFecha()`, `createEntrenamiento()` |
| `src/app/features/scores/escuadra.service.ts` | Añadir `getResultados()`, `upsertResultado()` |
| `src/app/features/admin/scores/form-escuadra/` | Adaptar: quitar `competicionId`, añadir `fecha`, usar `creado_por` |
| `src/app/features/admin/scores/lista-escuadras/` | Nuevo componente (lista agrupada por fecha) |
| `src/app/features/admin/scores/registrar-resultado-entrenamiento/` | Nuevo componente (inputs platos totales por puesto) |
| `src/app/features/admin/admin.routes.ts` | Añadir rutas `/admin/escuadras`, `/admin/escuadras/nueva`, `/admin/escuadras/:id/resultados` |
| `src/app/features/perfil/perfil.component.ts` | Usar `resultados_entrenamiento` en lugar de `scores`/`resultados` |
| `supabase/migrations/005_escuadras_entrenamiento.sql` | Migración con los cambios de BD |

---

## Migraciones necesarias

```sql
-- 005_escuadras_entrenamiento.sql

-- 1. Desacoplar escuadras de competiciones
ALTER TABLE escuadras ALTER COLUMN competicion_id DROP NOT NULL;
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS fecha date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES profiles(id);

-- 2. Tabla de resultados de entrenamiento
CREATE TABLE IF NOT EXISTS resultados_entrenamiento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id    uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id),
  puesto         int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  platos_rotos   int NOT NULL DEFAULT 0,
  registrado_por uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escuadra_id, user_id)
);
```

---

## Fuera de alcance

- Editar escuadra una vez creada (solo crear y registrar resultados)
- Eliminar escuadra desde la UI (puede hacerse directamente en BD si es necesario)
- Resultados de competiciones — módulo independiente, no se toca aquí
- Ranking global de entrenamientos (solo historial personal en Perfil)
