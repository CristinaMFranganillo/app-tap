# Módulo de Entrenamientos

**Fecha:** 2026-04-06
**Estado:** Aprobado

## Objetivo

Introducir el concepto de "entrenamiento" como contenedor de escuadras. Un entrenamiento representa una sesión de tiro al plato en una fecha concreta. Dentro de un entrenamiento se crean escuadras (grupos de hasta 6 tiradores) y se registran los platos rotos por cada tirador (siempre 25 platos por sesión). Las competiciones son infrecuentes (2 veces al año) y siguen siendo un módulo separado dentro del mismo panel.

---

## Modelo de datos

### Nueva tabla: `entrenamientos`

```sql
CREATE TABLE entrenamientos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha      date NOT NULL DEFAULT CURRENT_DATE,
  creado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fecha)
);
```

Un entrenamiento por día. Si ya existe uno para esa fecha, no se puede crear otro.

### Modificar tabla: `escuadras`

```sql
ALTER TABLE escuadras ADD COLUMN entrenamiento_id uuid REFERENCES entrenamientos(id) ON DELETE CASCADE;
```

Las escuadras de entrenamiento tienen `entrenamiento_id` relleno y `competicion_id = null`. Las escuadras de competición tienen `competicion_id` relleno y `entrenamiento_id = null`.

### Tabla existente: `resultados_entrenamiento`

Se mantiene igual (del spec anterior). Guarda platos rotos por tirador por escuadra.

### Numeración de escuadras

Autonumérica dentro del entrenamiento: 1, 2, 3... Los 25 platos son fijos y no se guardan en BD.

---

## Rutas

```
/admin/scores                                          → panel unificado (entrenamientos + competiciones)
/admin/entrenamientos/nuevo                            → form crear entrenamiento
/admin/entrenamientos/:id                              → detalle entrenamiento (lista escuadras)
/admin/entrenamientos/:id/escuadra/nueva               → form crear escuadra
/admin/entrenamientos/:id/escuadra/:escuadraId/resultados → registrar platos rotos
```

---

## Pantallas

### Panel `/admin/scores` (refactorizado)

Dos secciones:

**Sección superior — Entrenamientos:**
- Botón "Nuevo entrenamiento" (acción principal, estilo brand-yellow)
- Lista de entrenamientos ordenada por fecha desc
- Cada tarjeta: fecha formateada (ej. "Lunes 6 de abril") + contador de escuadras (ej. "3 escuadras")
- Tap en tarjeta → `/admin/entrenamientos/:id`

**Sección inferior — Competiciones:**
- Botón "Nueva competición"
- Lista de competiciones (igual que ahora)

### Form entrenamiento (`/admin/entrenamientos/nuevo`)

- Un campo: fecha (date picker, por defecto hoy)
- Si ya existe un entrenamiento para esa fecha, mostrar error "Ya existe un entrenamiento para este día"
- Botones: Cancelar / Crear entrenamiento
- Al crear → navega a `/admin/entrenamientos/:id`

### Detalle entrenamiento (`/admin/entrenamientos/:id`)

- Cabecera: flecha atrás + fecha del entrenamiento
- Lista de escuadras: "Escuadra 1 — 4 tiradores", "Escuadra 2 — 6 tiradores"...
- Tap en escuadra → `/admin/entrenamientos/:id/escuadra/:escuadraId/resultados`
- Botón "Nueva escuadra" → `/admin/entrenamientos/:id/escuadra/nueva`
- Si no hay escuadras: estado vacío con mensaje

### Form escuadra (`/admin/entrenamientos/:id/escuadra/nueva`)

- Igual que el componente actual `form-escuadra`
- Recibe `entrenamientoId` desde el parámetro de ruta (no desde select)
- Sin select de competición
- Al guardar → vuelve a `/admin/entrenamientos/:id`

### Registrar resultados (`/admin/entrenamientos/:id/escuadra/:escuadraId/resultados`)

- Cabecera: flecha atrás + "Escuadra N"
- Lista de los 6 puestos; puestos vacíos muestran "— Sin asignar —" (sin input)
- Puestos ocupados: nombre del tirador + input numérico 0–25 para platos rotos
- Botón "Guardar resultados" → upsert en `resultados_entrenamiento`
- Al guardar → vuelve a `/admin/entrenamientos/:id`

---

## Navegación (bottom-nav admin)

Cambio en `ADMIN_NAV`:
- "Torneos" con `bi-trophy` → "Entrena" con `bi-bullseye`
- La ruta sigue siendo `/admin/scores`

---

## Arquitectura de componentes

| Acción | Archivo |
|---|---|
| Nuevo | `src/app/core/models/entrenamiento.model.ts` |
| Modificar | `src/app/core/models/escuadra.model.ts` — añadir `entrenamientoId?: string` |
| Nuevo | `src/app/features/admin/entrenamientos/entrenamiento.service.ts` |
| Modificar | `src/app/features/scores/escuadra.service.ts` — añadir `getByEntrenamiento()`, `createEscuadraEntrenamiento()` |
| Nuevo | `src/app/features/admin/entrenamientos/lista-entrenamientos/lista-entrenamientos.component.ts` |
| Nuevo | `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.ts` |
| Nuevo | `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts` |
| Nuevo | `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts` |
| Nuevo | `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts` |
| Modificar | `src/app/features/admin/scores/admin-scores/admin-scores.component` — añadir sección entrenamientos arriba |
| Modificar | `src/app/features/admin/admin.routes.ts` — añadir rutas nuevas |
| Modificar | `src/app/shared/components/bottom-nav/bottom-nav.component.ts` — "Torneos" → "Entrena" |

---

## Migración SQL

```sql
-- 006_entrenamientos.sql

-- 1. Tabla entrenamientos
CREATE TABLE IF NOT EXISTS entrenamientos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha      date NOT NULL DEFAULT CURRENT_DATE,
  creado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fecha)
);

-- 2. RLS entrenamientos
ALTER TABLE entrenamientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ent_select" ON entrenamientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "ent_insert" ON entrenamientos FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "ent_delete" ON entrenamientos FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

-- 3. Añadir entrenamiento_id a escuadras
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS entrenamiento_id uuid REFERENCES entrenamientos(id) ON DELETE CASCADE;
```

---

## Fuera de alcance

- Editar entrenamiento (solo crear)
- Eliminar entrenamiento desde la UI
- Múltiples entrenamientos por día
- Resultados de competiciones — módulo independiente, no se toca
- Historial de entrenamientos en perfil de socio — spec separado
