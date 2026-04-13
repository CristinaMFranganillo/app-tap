# Inscripciones de Torneo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formalizar el flujo de inscripción a un torneo (socios + invitados no socios) como paso previo y bloqueante a la asignación de escuadras, con precio snapshot por inscripción.

**Architecture:** Se introduce una única tabla nueva `inscripciones_torneo` que cubre tanto socios como invitados (`user_id` nullable + `nombre` / `apellidos` para invitados). La caja (`movimientos_caja`) se deja intacta: sigue registrándose al crear la escuadra como hoy. El ranking del torneo pasa a incluir a los invitados. Se añade una pantalla admin "Inscritos" como paso intermedio entre crear torneo y armar escuadras, y se valida que solo los inscritos puedan entrar en escuadras.

**Tech Stack:** Angular 19 (standalone + signals), Supabase (PostgreSQL + RLS), SCSS por componente, Tailwind.

---

## Contexto del estado actual (verificado en código)

- `torneos` ya tiene `precio_inscripcion_socio` y `precio_inscripcion_no_socio` (migración 021).
- `movimientos_caja` columnas reales: `id, escuadra_id, entrenamiento_id, torneo_id, user_id, nombre_tirador, es_no_socio, importe, fecha, registrado_por, created_at`. **No tiene columna `concepto`.** Los movimientos **siempre van asociados a una `escuadra_id`** y se crean desde `EscuadraService.registrarCajaEscuadra()` (`src/app/features/scores/escuadra.service.ts:165-187`). Este flujo no se toca.
- `TorneoService.getSociosInscritos()` (`src/app/features/admin/torneos/torneo.service.ts:103-112`) lee `movimientos_caja` para saber qué socios ya están en una escuadra del torneo. Se mantiene porque sigue siendo útil, pero deja de ser "fuente de verdad de inscripción" — pasa a ser "fuente de verdad de socios ya asignados a escuadra".
- `EscuadraService.createEscuadraTorneo(torneoId, numero)` (`src/app/features/scores/escuadra.service.ts:90-95`) solo crea la fila en `escuadras`. Los tiradores se añaden luego con `addTirador(escuadraId, userId, puesto)` y `addNoSocio(escuadraId, nombreExterno, puesto)` (líneas 116-126).
- `escuadra_tiradores` ya admite invitados (`user_id` nullable + `nombre_externo` + `es_no_socio`, migración 018).
- `resultados_torneo` ya soporta no-socios con `user_id` nullable + `nombre_externo` + `es_no_socio` (migración 016).
- `TorneoService.getRanking()` (`torneo.service.ts:191-226`) **filtra `es_no_socio = false`**. Hay que quitar ese filtro.
- `FormEscuadraTorneoComponent` (`src/app/features/admin/torneos/form-escuadra-torneo/form-escuadra-torneo.component.ts`) hoy permite elegir cualquier socio activo de todo el club, o introducir cualquier nombre de invitado. Hay que cambiar la fuente a "inscritos del torneo".

## Decisiones fijadas durante el brainstorming

1. **Invitados sueltos**: se guardan por `(nombre, apellidos)` sin crear `profiles`.
2. **Pago**: inscribir = pagado. Se guarda el precio snapshot en `inscripciones_torneo.precio_pagado` para que editar `torneos.precio_inscripcion_*` no retoque inscripciones previas.
3. **Caja intacta**: el cobro real (`movimientos_caja`) se sigue generando al crear escuadra, como hoy. `inscripciones_torneo` es lista de participantes autorizados + precio snapshot, no sustituye a caja.
4. **Modelo único**: una sola tabla `inscripciones_torneo` con `user_id` nullable. Socios tienen `user_id` y `nombre`/`apellidos = NULL`; invitados tienen `user_id = NULL` y `nombre`/`apellidos` rellenos.
5. **Bloqueante**: solo inscritos pueden entrar en escuadras del torneo.
6. **Borrado**: una inscripción no se puede eliminar si el inscrito ya está asignado a una escuadra; si no lo está, sí.
7. **Ranking del torneo**: incluye socios e invitados. Ranking global del club (fuera de este plan) sigue mostrando solo socios.
8. **Visibilidad**:
   - Admin/moderador: ven inscripciones, precios, recaudación estimada y armado de escuadras.
   - Socios: ven ranking del torneo (con socios + invitados).
   - Invitados: no son usuarios del sistema.
9. **Unicidad**: un socio no puede estar inscrito dos veces en un torneo; un invitado tampoco (mismo nombre+apellidos normalizado).

## Mapa de ficheros que se crean o modifican

**Crear:**
- `supabase/migrations/022_inscripciones_torneo.sql`
- `src/app/core/models/inscripcion-torneo.model.ts`
- `src/app/features/admin/torneos/inscripcion-torneo.service.ts`
- `src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts`
- `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.ts`
- `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.html`
- `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.scss`
- `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.spec.ts`
- `src/app/features/admin/torneos/torneo.service.spec.ts` (si no existe)

**Modificar:**
- `src/app/features/admin/torneos/torneo.service.ts` — quitar filtro `es_no_socio=false` en `getRanking`, extraer función pura `agruparRanking`.
- `src/app/features/admin/admin.routes.ts` — añadir ruta `torneos/:id/inscripciones`.
- `src/app/features/admin/torneos/detalle-torneo/detalle-torneo.component.ts` + `.html` — CTA "Gestionar inscritos" y resumen.
- `src/app/features/admin/torneos/form-escuadra-torneo/form-escuadra-torneo.component.ts` + `.html` — fuente de selectores pasa a ser inscritos del torneo no asignados aún.

---

## Task 1: Migración `inscripciones_torneo`

**Files:**
- Create: `supabase/migrations/022_inscripciones_torneo.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:

```sql
-- Inscripciones a un torneo: socios (user_id) e invitados (nombre + apellidos).
-- No sustituye a movimientos_caja; es la lista de participantes autorizados
-- con el precio snapshot en el momento de la inscripción.

CREATE TABLE inscripciones_torneo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id       uuid NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE RESTRICT,
  nombre          text,
  apellidos       text,
  es_no_socio     boolean NOT NULL,
  precio_pagado   numeric(8,2) NOT NULL CHECK (precio_pagado >= 0),
  creado_por      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (es_no_socio = false AND user_id IS NOT NULL AND nombre IS NULL AND apellidos IS NULL)
    OR
    (es_no_socio = true  AND user_id IS NULL AND nombre IS NOT NULL AND apellidos IS NOT NULL)
  )
);

-- Un socio solo puede inscribirse una vez a un torneo
CREATE UNIQUE INDEX inscripciones_torneo_socio_unico
  ON inscripciones_torneo (torneo_id, user_id)
  WHERE user_id IS NOT NULL;

-- Un invitado (normalizado) solo una vez
CREATE UNIQUE INDEX inscripciones_torneo_invitado_unico
  ON inscripciones_torneo (torneo_id, lower(trim(nombre)), lower(trim(apellidos)))
  WHERE user_id IS NULL;

CREATE INDEX idx_inscripciones_torneo_torneo ON inscripciones_torneo(torneo_id);

ALTER TABLE inscripciones_torneo ENABLE ROW LEVEL SECURITY;

-- Lectura: admin y moderador ven todo. Los socios pueden leer inscripciones
-- (SELECT abierto a authenticated) para que el ranking del torneo pueda
-- mostrar nombres de invitados sin exponer precio vía queries directas.
-- Los clientes socio solo consumen ranking y resultados_torneo; no leen
-- esta tabla directamente.
CREATE POLICY "inscripciones_torneo_select" ON inscripciones_torneo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inscripciones_torneo_insert_admin" ON inscripciones_torneo
  FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "inscripciones_torneo_update_admin" ON inscripciones_torneo
  FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "inscripciones_torneo_delete_admin" ON inscripciones_torneo
  FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
```

- [ ] **Step 2: Aplicar migración**

Con Supabase CLI:

```bash
rtk supabase db push
```

O pegar el SQL en el editor del dashboard. Validar:

```sql
SELECT * FROM inscripciones_torneo LIMIT 1;
```

Debe devolver vacío sin error.

- [ ] **Step 3: Commit**

```bash
rtk git add supabase/migrations/022_inscripciones_torneo.sql
rtk git commit -m "feat(db): tabla inscripciones_torneo"
```

---

## Task 2: Modelos TypeScript

**Files:**
- Create: `src/app/core/models/inscripcion-torneo.model.ts`

- [ ] **Step 1: Crear fichero**

```ts
export interface InscripcionTorneo {
  id: string;
  torneoId: string;
  userId?: string;
  nombre?: string;
  apellidos?: string;
  esNoSocio: boolean;
  precioPagado: number;
  creadoPor?: string;
  createdAt: string;
}

// Vista enriquecida usada por la UI de inscritos
export interface InscritoVista {
  id: string;             // inscripciones_torneo.id
  esNoSocio: boolean;
  userId?: string;        // solo socios
  nombre: string;         // siempre relleno (de profile o del invitado)
  apellidos: string;
  precioPagado: number;
  enEscuadra: boolean;    // true si ya está asignado a alguna escuadra del torneo
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/core/models/inscripcion-torneo.model.ts
rtk git commit -m "feat(models): InscripcionTorneo e InscritoVista"
```

---

## Task 3: Servicio `InscripcionTorneoService` — esqueleto

**Files:**
- Create: `src/app/features/admin/torneos/inscripcion-torneo.service.ts`
- Create: `src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts`

- [ ] **Step 1: Escribir test**

```ts
import { TestBed } from '@angular/core/testing';
import { InscripcionTorneoService } from './inscripcion-torneo.service';

describe('InscripcionTorneoService', () => {
  let service: InscripcionTorneoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InscripcionTorneoService);
  });

  it('debe crearse', () => {
    expect(service).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verificar FAIL**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

Expected: FAIL — clase inexistente.

- [ ] **Step 3: Crear servicio mínimo**

```ts
import { Injectable } from '@angular/core';
import { supabase } from '../../../core/supabase/supabase.client';
import { InscripcionTorneo, InscritoVista } from '../../../core/models/inscripcion-torneo.model';

@Injectable({ providedIn: 'root' })
export class InscripcionTorneoService {}
```

- [ ] **Step 4: Verificar PASS**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/torneos/inscripcion-torneo.service.ts src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts
rtk git commit -m "feat(torneos): esqueleto InscripcionTorneoService"
```

---

## Task 4: `listarInscritos(torneoId)`

Combina:
1. Filas de `inscripciones_torneo` del torneo (con join opcional a `profiles` para socios).
2. Tiradores actuales de escuadras del torneo (`escuadras → escuadra_tiradores`) para marcar `enEscuadra`.

Para socios: match por `user_id`. Para invitados: match por nombre normalizado contra `escuadra_tiradores.nombre_externo`.

**Files:**
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.ts`
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts`

- [ ] **Step 1: Test de forma**

```ts
describe('listarInscritos', () => {
  it('debe existir y devolver una promesa de array', async () => {
    const p = service.listarInscritos('00000000-0000-0000-0000-000000000000');
    expect(p).toBeInstanceOf(Promise);
    const arr = await p.catch(() => [] as InscritoVista[]);
    expect(Array.isArray(arr)).toBe(true);
  });
});
```

Añadir `import { InscritoVista } from '../../../core/models/inscripcion-torneo.model';` en el spec.

- [ ] **Step 2: Verificar FAIL**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

Añadir a la clase:

```ts
async listarInscritos(torneoId: string): Promise<InscritoVista[]> {
  const { data: inscripciones, error: insErr } = await supabase
    .from('inscripciones_torneo')
    .select('id, user_id, nombre, apellidos, es_no_socio, precio_pagado, profiles:user_id(nombre, apellidos)')
    .eq('torneo_id', torneoId);
  if (insErr) throw new Error(insErr.message);

  const { data: escuadras, error: escErr } = await supabase
    .from('escuadras')
    .select('id, escuadra_tiradores(user_id, nombre_externo, es_no_socio)')
    .eq('torneo_id', torneoId);
  if (escErr) throw new Error(escErr.message);

  const sociosEnEscuadra = new Set<string>();
  const invitadosEnEscuadra = new Set<string>();
  for (const e of (escuadras ?? []) as any[]) {
    for (const t of e.escuadra_tiradores ?? []) {
      if (t.es_no_socio && t.nombre_externo) {
        invitadosEnEscuadra.add(this.normaliza(t.nombre_externo));
      } else if (t.user_id) {
        sociosEnEscuadra.add(t.user_id);
      }
    }
  }

  const vista: InscritoVista[] = ((inscripciones ?? []) as any[]).map(row => {
    if (row.es_no_socio) {
      const nombre = row.nombre as string;
      const apellidos = row.apellidos as string;
      return {
        id: row.id,
        esNoSocio: true,
        nombre,
        apellidos,
        precioPagado: Number(row.precio_pagado ?? 0),
        enEscuadra: invitadosEnEscuadra.has(this.normaliza(`${nombre} ${apellidos}`)),
      };
    }
    const profile = row.profiles as { nombre?: string; apellidos?: string } | null;
    return {
      id: row.id,
      esNoSocio: false,
      userId: row.user_id,
      nombre: profile?.nombre ?? '',
      apellidos: profile?.apellidos ?? '',
      precioPagado: Number(row.precio_pagado ?? 0),
      enEscuadra: sociosEnEscuadra.has(row.user_id),
    };
  });

  return vista.sort((a, b) =>
    `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es')
  );
}

private normaliza(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
```

- [ ] **Step 4: Verificar PASS**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

Expected: PASS (la petición fallará en BD pero `.catch` devuelve `[]`).

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/torneos/inscripcion-torneo.service.ts src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts
rtk git commit -m "feat(torneos): listarInscritos une inscripciones con estado de escuadra"
```

---

## Task 5: `inscribirSocio`

**Files:**
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.ts`
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts`

- [ ] **Step 1: Test de signatura**

```ts
describe('inscribirSocio', () => {
  it('existe con 3 parámetros', () => {
    expect(typeof service.inscribirSocio).toBe('function');
    expect(service.inscribirSocio.length).toBe(3);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

- [ ] **Step 3: Implementar**

```ts
async inscribirSocio(torneoId: string, userId: string, creadoPor: string): Promise<string> {
  const { data: torneo, error: tErr } = await supabase
    .from('torneos')
    .select('precio_inscripcion_socio')
    .eq('id', torneoId)
    .single();
  if (tErr || !torneo) throw new Error(tErr?.message ?? 'Torneo no encontrado');

  const precio = Number((torneo as any).precio_inscripcion_socio ?? 0);

  const { data, error } = await supabase
    .from('inscripciones_torneo')
    .insert({
      torneo_id: torneoId,
      user_id: userId,
      nombre: null,
      apellidos: null,
      es_no_socio: false,
      precio_pagado: precio,
      creado_por: creadoPor,
    })
    .select('id')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      throw new Error('Este socio ya está inscrito en el torneo');
    }
    throw new Error(error.message);
  }
  return (data as any).id as string;
}
```

- [ ] **Step 4: PASS**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/torneos/inscripcion-torneo.service.ts src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts
rtk git commit -m "feat(torneos): inscribirSocio con precio snapshot"
```

---

## Task 6: `inscribirInvitado`

**Files:**
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.ts`
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts`

- [ ] **Step 1: Test**

```ts
describe('inscribirInvitado', () => {
  it('existe con 4 parámetros', () => {
    expect(typeof service.inscribirInvitado).toBe('function');
    expect(service.inscribirInvitado.length).toBe(4);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

- [ ] **Step 3: Implementar**

```ts
async inscribirInvitado(
  torneoId: string,
  nombre: string,
  apellidos: string,
  creadoPor: string
): Promise<string> {
  const n = nombre.trim();
  const a = apellidos.trim();
  if (!n || !a) throw new Error('Nombre y apellidos son obligatorios');

  const { data: torneo, error: tErr } = await supabase
    .from('torneos')
    .select('precio_inscripcion_no_socio')
    .eq('id', torneoId)
    .single();
  if (tErr || !torneo) throw new Error(tErr?.message ?? 'Torneo no encontrado');

  const precio = Number((torneo as any).precio_inscripcion_no_socio ?? 0);

  const { data, error } = await supabase
    .from('inscripciones_torneo')
    .insert({
      torneo_id: torneoId,
      user_id: null,
      nombre: n,
      apellidos: a,
      es_no_socio: true,
      precio_pagado: precio,
      creado_por: creadoPor,
    })
    .select('id')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      throw new Error('Este invitado ya está inscrito en el torneo');
    }
    throw new Error(error.message);
  }
  return (data as any).id as string;
}
```

- [ ] **Step 4: PASS**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/torneos/inscripcion-torneo.service.ts src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts
rtk git commit -m "feat(torneos): inscribirInvitado con precio snapshot"
```

---

## Task 7: `eliminarInscripcion`

**Files:**
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.ts`
- Modify: `src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts`

- [ ] **Step 1: Test**

```ts
describe('eliminarInscripcion', () => {
  it('existe con 1 parámetro (InscritoVista)', () => {
    expect(typeof service.eliminarInscripcion).toBe('function');
    expect(service.eliminarInscripcion.length).toBe(1);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

- [ ] **Step 3: Implementar**

```ts
async eliminarInscripcion(inscrito: InscritoVista): Promise<void> {
  if (inscrito.enEscuadra) {
    throw new Error('No se puede eliminar: el inscrito ya está asignado a una escuadra');
  }
  const { error } = await supabase
    .from('inscripciones_torneo')
    .delete()
    .eq('id', inscrito.id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: PASS**

```bash
rtk npm test -- --include='**/inscripcion-torneo.service.spec.ts' --watch=false
```

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/torneos/inscripcion-torneo.service.ts src/app/features/admin/torneos/inscripcion-torneo.service.spec.ts
rtk git commit -m "feat(torneos): eliminarInscripcion con bloqueo por escuadra"
```

---

## Task 8: Ranking del torneo incluye invitados

**Files:**
- Modify: `src/app/features/admin/torneos/torneo.service.ts` (líneas 191-226)
- Create: `src/app/features/admin/torneos/torneo.service.spec.ts`

- [ ] **Step 1: Escribir tests de agrupación**

Crear el spec si no existe:

```ts
import { agruparRanking } from './torneo.service';

describe('agruparRanking', () => {
  it('agrupa socios por user_id y suma platos', () => {
    const rows = [
      { user_id: 'u1', nombre_externo: null, es_no_socio: false, platos_rotos: 20,
        profiles: { nombre: 'Ana', apellidos: 'García' } },
      { user_id: 'u1', nombre_externo: null, es_no_socio: false, platos_rotos: 22,
        profiles: { nombre: 'Ana', apellidos: 'García' } },
    ];
    const r = agruparRanking(rows);
    expect(r).toHaveSize(1);
    expect(r[0].platosRotos).toBe(42);
    expect(r[0].nombre).toBe('Ana');
    expect(r[0].posicion).toBe(1);
  });

  it('incluye invitados en el ranking ordenados con socios', () => {
    const rows = [
      { user_id: 'u1', nombre_externo: null, es_no_socio: false, platos_rotos: 20,
        profiles: { nombre: 'Ana', apellidos: 'García' } },
      { user_id: null, nombre_externo: 'Juan Pérez', es_no_socio: true, platos_rotos: 25,
        profiles: null },
    ];
    const r = agruparRanking(rows);
    expect(r).toHaveSize(2);
    expect(r[0].nombre).toBe('Juan');
    expect(r[0].platosRotos).toBe(25);
    expect(r[0].posicion).toBe(1);
    expect(r[1].nombre).toBe('Ana');
    expect(r[1].posicion).toBe(2);
  });

  it('separa invitados distintos por nombre_externo', () => {
    const rows = [
      { user_id: null, nombre_externo: 'Luis A', es_no_socio: true, platos_rotos: 10, profiles: null },
      { user_id: null, nombre_externo: 'Luis B', es_no_socio: true, platos_rotos: 15, profiles: null },
    ];
    expect(agruparRanking(rows)).toHaveSize(2);
  });
});
```

- [ ] **Step 2: FAIL**

```bash
rtk npm test -- --include='**/torneo.service.spec.ts' --watch=false
```

Expected: FAIL — `agruparRanking` no existe.

- [ ] **Step 3: Refactorizar `torneo.service.ts`**

Añadir al inicio del fichero (fuera de la clase) o al final:

```ts
export function agruparRanking(rows: any[]): RankingTorneo[] {
  const agg = new Map<string, { nombre: string; apellidos: string; platos: number; userId: string }>();

  for (const row of rows) {
    const platos = row['platos_rotos'] as number;
    const esNoSocio = row['es_no_socio'] === true;

    let key: string;
    let nombre: string;
    let apellidos: string;
    let userId: string;

    if (esNoSocio) {
      const ext = String(row['nombre_externo'] ?? '').trim();
      key = `inv:${ext}`;
      const partes = ext.split(/\s+/);
      nombre = partes[0] ?? '';
      apellidos = partes.slice(1).join(' ');
      userId = '';
    } else {
      userId = row['user_id'] as string;
      key = `soc:${userId}`;
      const profile = row['profiles'] as { nombre?: string; apellidos?: string } | null;
      nombre = profile?.nombre ?? '';
      apellidos = profile?.apellidos ?? '';
    }

    if (!agg.has(key)) {
      agg.set(key, { nombre, apellidos, platos: 0, userId });
    }
    agg.get(key)!.platos += platos;
  }

  return Array.from(agg.values())
    .map(v => ({
      userId: v.userId,
      nombre: v.nombre,
      apellidos: v.apellidos,
      platosRotos: v.platos,
      posicion: 0,
    }))
    .sort((a, b) => b.platosRotos - a.platosRotos)
    .map((e, i) => ({ ...e, posicion: i + 1 }));
}
```

Reemplazar `getRanking` para usarlo y quitar el filtro `es_no_socio = false`:

```ts
getRanking(torneoId: string): Observable<RankingTorneo[]> {
  return from(
    supabase
      .from('resultados_torneo')
      .select('user_id, nombre_externo, es_no_socio, platos_rotos, escuadras!inner(torneo_id), profiles:user_id(nombre, apellidos)')
      .eq('escuadras.torneo_id', torneoId)
  ).pipe(map(({ data }) => agruparRanking((data ?? []) as any[])));
}
```

Si `RankingTorneo` en `src/app/core/models/torneo.model.ts` define `userId: string` y no permite vacío, verificar el tipo y ajustar (dejar `string` y usar `''` para invitados, o marcar como opcional). Antes de implementar: leer `torneo.model.ts` y decidir.

- [ ] **Step 4: PASS**

```bash
rtk npm test -- --include='**/torneo.service.spec.ts' --watch=false
```

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/features/admin/torneos/torneo.service.ts src/app/features/admin/torneos/torneo.service.spec.ts src/app/core/models/torneo.model.ts
rtk git commit -m "feat(torneos): ranking incluye invitados"
```

---

## Task 9: Pantalla admin `inscripciones-torneo` + ruta

**Files:**
- Create: `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.ts`
- Create: `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.html`
- Create: `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.scss`
- Create: `src/app/features/admin/torneos/inscripciones-torneo/inscripciones-torneo.component.spec.ts`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Test fallido**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InscripcionesTorneoComponent } from './inscripciones-torneo.component';

describe('InscripcionesTorneoComponent', () => {
  let component: InscripcionesTorneoComponent;
  let fixture: ComponentFixture<InscripcionesTorneoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InscripcionesTorneoComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(InscripcionesTorneoComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 2: FAIL**

```bash
rtk npm test -- --include='**/inscripciones-torneo.component.spec.ts' --watch=false
```

- [ ] **Step 3: Componente**

`inscripciones-torneo.component.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { InscripcionTorneoService } from '../inscripcion-torneo.service';
import { TorneoService } from '../torneo.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Torneo } from '../../../../core/models/torneo.model';
import { InscritoVista } from '../../../../core/models/inscripcion-torneo.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-inscripciones-torneo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inscripciones-torneo.component.html',
  styleUrl: './inscripciones-torneo.component.scss',
})
export class InscripcionesTorneoComponent {
  private route         = inject(ActivatedRoute);
  private torneoService = inject(TorneoService);
  private inscService   = inject(InscripcionTorneoService);
  private userService   = inject(UserService);
  private authService   = inject(AuthService);

  torneo             = signal<Torneo | null>(null);
  inscritos          = signal<InscritoVista[]>([]);
  sociosDisponibles  = signal<User[]>([]);

  nuevoSocioId = '';
  nuevoNombre = '';
  nuevoApellidos = '';

  loading = signal(true);
  error   = signal('');

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      this.torneo.set(await firstValueFrom(this.torneoService.getById(id)));
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message ?? 'Error cargando torneo');
    } finally {
      this.loading.set(false);
    }
  }

  async recargar() {
    const id = this.torneo()!.id;
    const [inscritos, users] = await Promise.all([
      this.inscService.listarInscritos(id),
      firstValueFrom(this.userService.getAll()),
    ]);
    this.inscritos.set(inscritos);
    const yaInscritos = new Set(
      inscritos.filter(i => !i.esNoSocio && i.userId).map(i => i.userId!)
    );
    this.sociosDisponibles.set(
      users
        .filter(u => u.activo && u.rol !== 'admin' && !yaInscritos.has(u.id))
        .sort((a, b) =>
          `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es')
        )
    );
  }

  async inscribirSocio() {
    if (!this.nuevoSocioId) return;
    const me = this.authService.user();
    if (!me) return;
    this.error.set('');
    try {
      await this.inscService.inscribirSocio(this.torneo()!.id, this.nuevoSocioId, me.id);
      this.nuevoSocioId = '';
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  async inscribirInvitado() {
    const n = this.nuevoNombre.trim();
    const a = this.nuevoApellidos.trim();
    if (!n || !a) return;
    const me = this.authService.user();
    if (!me) return;
    this.error.set('');
    try {
      await this.inscService.inscribirInvitado(this.torneo()!.id, n, a, me.id);
      this.nuevoNombre = '';
      this.nuevoApellidos = '';
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  async eliminar(i: InscritoVista) {
    if (i.enEscuadra) {
      this.error.set('No se puede eliminar: ya está asignado a una escuadra');
      return;
    }
    if (!confirm(`¿Eliminar la inscripción de ${i.nombre} ${i.apellidos}?`)) return;
    try {
      await this.inscService.eliminarInscripcion(i);
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  get totalRecaudado(): number {
    return this.inscritos().reduce((s, i) => s + i.precioPagado, 0);
  }
}
```

`inscripciones-torneo.component.html`:

```html
@if (loading()) {
  <p class="p-4">Cargando…</p>
} @else if (torneo(); as t) {
  <div class="p-4 max-w-3xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-semibold">{{ t.nombre }} · Inscritos</h1>
        <p class="text-sm text-gray-500">
          Socio: {{ t.precioInscripcionSocio | number:'1.2-2' }} € ·
          No socio: {{ t.precioInscripcionNoSocio | number:'1.2-2' }} €
        </p>
      </div>
      <a [routerLink]="['/admin/torneos', t.id]" class="text-sm text-blue-600">← Volver</a>
    </header>

    @if (error()) {
      <div class="bg-red-50 text-red-700 p-2 mb-3 rounded">{{ error() }}</div>
    }

    <section class="mb-6">
      <h2 class="font-medium mb-2">Añadir socio</h2>
      <div class="flex gap-2">
        <select [(ngModel)]="nuevoSocioId" class="border rounded px-2 py-1 flex-1">
          <option value="">Selecciona socio…</option>
          @for (u of sociosDisponibles(); track u.id) {
            <option [value]="u.id">{{ u.apellidos }}, {{ u.nombre }}</option>
          }
        </select>
        <button (click)="inscribirSocio()"
                class="bg-blue-600 text-white px-3 py-1 rounded"
                [disabled]="!nuevoSocioId">
          Inscribir
        </button>
      </div>
    </section>

    <section class="mb-6">
      <h2 class="font-medium mb-2">Añadir invitado</h2>
      <div class="flex gap-2">
        <input [(ngModel)]="nuevoNombre" placeholder="Nombre"
               class="border rounded px-2 py-1 flex-1" />
        <input [(ngModel)]="nuevoApellidos" placeholder="Apellidos"
               class="border rounded px-2 py-1 flex-1" />
        <button (click)="inscribirInvitado()"
                class="bg-blue-600 text-white px-3 py-1 rounded">
          Inscribir
        </button>
      </div>
    </section>

    <section>
      <h2 class="font-medium mb-2">Inscritos ({{ inscritos().length }})</h2>
      <ul class="divide-y border rounded">
        @for (i of inscritos(); track i.id) {
          <li class="flex items-center justify-between p-2">
            <div>
              <span class="font-medium">{{ i.apellidos }}, {{ i.nombre }}</span>
              <span class="ml-2 text-xs px-2 py-0.5 rounded-full"
                    [class]="i.esNoSocio ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'">
                {{ i.esNoSocio ? 'Invitado' : 'Socio' }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-600">{{ i.precioPagado | number:'1.2-2' }} €</span>
              <button (click)="eliminar(i)"
                      [disabled]="i.enEscuadra"
                      [title]="i.enEscuadra ? 'Ya está en una escuadra' : 'Eliminar inscripción'"
                      class="text-red-600 disabled:text-gray-300">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </li>
        } @empty {
          <li class="p-3 text-center text-gray-500">Aún no hay inscritos.</li>
        }
      </ul>
      <p class="mt-3 text-right text-sm">
        Total recaudado: <strong>{{ totalRecaudado | number:'1.2-2' }} €</strong>
      </p>
    </section>
  </div>
}
```

`inscripciones-torneo.component.scss`:

```scss
:host { display: block; }
```

- [ ] **Step 4: Añadir ruta**

Abrir `src/app/features/admin/admin.routes.ts` y añadir una ruta nueva al array, copiando el patrón exacto que ya usa la ruta hermana `torneos/:id`. Ejemplo orientativo:

```ts
{
  path: 'torneos/:id/inscripciones',
  loadComponent: () =>
    import('./torneos/inscripciones-torneo/inscripciones-torneo.component')
      .then(m => m.InscripcionesTorneoComponent),
},
```

Si el guardado por rol se hace vía `canActivate` o `data.roles`, replicar el mismo mecanismo usado por las rutas hermanas de torneos.

- [ ] **Step 5: Test PASS + build**

```bash
rtk npm test -- --include='**/inscripciones-torneo.component.spec.ts' --watch=false
rtk npm run build
```

- [ ] **Step 6: Commit**

```bash
rtk git add src/app/features/admin/torneos/inscripciones-torneo src/app/features/admin/admin.routes.ts
rtk git commit -m "feat(torneos): pantalla admin gestión de inscritos"
```

---

## Task 10: CTA y resumen en `detalle-torneo`

**Files:**
- Modify: `src/app/features/admin/torneos/detalle-torneo/detalle-torneo.component.ts`
- Modify: `src/app/features/admin/torneos/detalle-torneo/detalle-torneo.component.html`

- [ ] **Step 1: TS**

Añadir import y uso:

```ts
import { InscripcionTorneoService } from '../inscripcion-torneo.service';
```

En la clase:

```ts
private inscService = inject(InscripcionTorneoService);
numInscritos = signal(0);
totalRecaudado = signal(0);
```

En el método de carga (donde hoy se cargan escuadras), después de tener `this.torneo()?.id`:

```ts
const inscritos = await this.inscService.listarInscritos(this.torneo()!.id);
this.numInscritos.set(inscritos.length);
this.totalRecaudado.set(inscritos.reduce((s, i) => s + i.precioPagado, 0));
```

- [ ] **Step 2: HTML**

Añadir cerca del título o del bloque de acciones:

```html
<div class="flex items-center gap-4 mb-3">
  <div class="text-sm">
    <span class="font-medium">{{ numInscritos() }}</span> inscritos ·
    <span class="font-medium">{{ totalRecaudado() | number:'1.2-2' }} €</span> recaudado
  </div>
  <a [routerLink]="['/admin/torneos', torneo()?.id, 'inscripciones']"
     class="text-blue-600 text-sm underline">
    Gestionar inscritos
  </a>
</div>
```

Asegurar que `RouterLink` está en `imports` del componente.

- [ ] **Step 3: Build**

```bash
rtk npm run build
```

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/features/admin/torneos/detalle-torneo
rtk git commit -m "feat(torneos): CTA y resumen de inscritos en detalle-torneo"
```

---

## Task 11: `form-escuadra-torneo` se alimenta de inscritos

Hoy elige de todos los socios del club. Pasa a elegir de inscritos del torneo que todavía no estén asignados a escuadra. El invitado deja de escribirse libremente: ahora se selecciona de la lista de invitados inscritos.

**Files:**
- Modify: `src/app/features/admin/torneos/form-escuadra-torneo/form-escuadra-torneo.component.ts`
- Modify: `src/app/features/admin/torneos/form-escuadra-torneo/form-escuadra-torneo.component.html`

- [ ] **Step 1: Leer el componente actual completo**

Antes de editar, leer el `.ts` y `.html` completos para entender cómo guarda hoy (usa `EscuadraService.createEscuadraTorneo` + `addTirador` / `addNoSocio` por puesto, y probablemente también llama a `registrarCajaEscuadra`).

- [ ] **Step 2: TS — nueva fuente de datos**

Reemplazar la carga de `socios` por:

```ts
import { InscripcionTorneoService } from '../inscripcion-torneo.service';
import { InscritoVista } from '../../../../core/models/inscripcion-torneo.model';

// dentro de la clase
private inscService = inject(InscripcionTorneoService);

inscritosDisponibles = signal<InscritoVista[]>([]);
seleccionados: (InscritoVista | null)[] = [null, null, null, null, null, null];

async ngOnInit() {
  const torneoId = this.route.snapshot.paramMap.get('id')!;
  const [torneo, inscritos] = await Promise.all([
    firstValueFrom(this.torneoService.getById(torneoId)),
    this.inscService.listarInscritos(torneoId),
  ]);
  this.torneo.set(torneo);
  this.inscritosDisponibles.set(inscritos.filter(i => !i.enEscuadra));
}
```

Eliminar los arrays `userIds`, `tipos`, `nombresExternos` y la carga desde `UserService.getAll()`.

- [ ] **Step 3: TS — guardar**

Reescribir el método de guardado (nombre actual del método: inspeccionarlo antes de editar). Llama al servicio existente `EscuadraService.createEscuadraTorneo(torneoId, numero)` para crear la fila, luego a `addTirador` o `addNoSocio` por puesto, y finalmente a `registrarCajaEscuadra` con los importes correspondientes (para mantener el cobro real en caja como hasta ahora):

```ts
async guardar() {
  const torneoId = this.torneo()!.id;
  const me = this.authService.user();
  if (!me) return;

  // validación defensiva
  const disponibles = new Set(this.inscritosDisponibles().map(i => i.id));
  for (const s of this.seleccionados) {
    if (s && !disponibles.has(s.id)) {
      this.error = `${s.nombre} ${s.apellidos} ya no está disponible.`;
      return;
    }
  }

  // calcular siguiente número de escuadra (patrón existente — mantener el del código actual)
  const numero = await this.calcularSiguienteNumero(torneoId);

  try {
    this.loading = true;
    const escuadraId = await this.escuadraService.createEscuadraTorneo(torneoId, numero);

    for (let i = 0; i < this.seleccionados.length; i++) {
      const sel = this.seleccionados[i];
      if (!sel) continue;
      const puesto = i + 1;
      if (sel.esNoSocio) {
        await this.escuadraService.addNoSocio(escuadraId, `${sel.nombre} ${sel.apellidos}`, puesto);
      } else {
        await this.escuadraService.addTirador(escuadraId, sel.userId!, puesto);
      }
    }

    // Registrar caja igual que hoy: una entrada por tirador usando su precio_pagado
    const hoyIso = new Date().toISOString().slice(0, 10);
    const filasCaja = this.seleccionados
      .filter((s): s is InscritoVista => s !== null)
      .map(s => ({
        userId: s.esNoSocio ? undefined : s.userId,
        nombreTirador: `${s.nombre} ${s.apellidos}`,
        esNoSocio: s.esNoSocio,
        importe: s.precioPagado,
      }));
    if (filasCaja.length > 0) {
      await this.escuadraService.registrarCajaEscuadra(
        escuadraId,
        null,          // entrenamientoId
        hoyIso,
        me.id,
        filasCaja,
        torneoId,
      );
    }

    this.router.navigate(['/admin/torneos', torneoId]);
  } catch (e: any) {
    this.error = e.message;
  } finally {
    this.loading = false;
  }
}
```

Si `calcularSiguienteNumero` ya existe en el componente actual, reutilizarla. Si no, inspeccionar cómo calcula el número hoy y replicarlo. **No** introducir una fórmula nueva: imitar exactamente el patrón existente.

- [ ] **Step 4: HTML**

Sustituir los 6 bloques socio/no-socio por 6 selectores únicos:

```html
@for (_ of [0,1,2,3,4,5]; track $index) {
  <div class="mb-2">
    <label class="text-xs text-gray-500">Puesto {{ $index + 1 }}</label>
    <select [(ngModel)]="seleccionados[$index]" class="border rounded px-2 py-1 w-full">
      <option [ngValue]="null">— vacío —</option>
      @for (ins of inscritosDisponibles(); track ins.id) {
        <option [ngValue]="ins">
          {{ ins.apellidos }}, {{ ins.nombre }} ({{ ins.esNoSocio ? 'Invitado' : 'Socio' }})
        </option>
      }
    </select>
  </div>
}
```

El mismo inscrito no debe poder ocupar dos puestos. Añadir un getter:

```ts
get seleccionadosValidos(): boolean {
  const ids = this.seleccionados.filter((s): s is InscritoVista => s !== null).map(s => s.id);
  return new Set(ids).size === ids.length;
}
```

Y deshabilitar el botón guardar si `!seleccionadosValidos`.

- [ ] **Step 5: Build + tests**

```bash
rtk npm run build
rtk npm test -- --watch=false
```

Expected: build OK, todos los tests en verde.

- [ ] **Step 6: Commit**

```bash
rtk git add src/app/features/admin/torneos/form-escuadra-torneo
rtk git commit -m "feat(torneos): escuadras solo admiten inscritos del torneo"
```

---

## Task 12: Prueba manual end-to-end

- [ ] **Step 1: Levantar dev**

```bash
rtk npm start
```

- [ ] **Step 2: Recorrido**

1. Login como admin.
2. Crear torneo con precios 10/15.
3. `/admin/torneos/:id/inscripciones`: inscribir 3 socios + 2 invitados. Total 60 €.
4. Intentar inscribir socio duplicado → error.
5. Intentar invitado duplicado → error.
6. Eliminar invitado libre → OK.
7. Crear escuadra: selector muestra solo inscritos no asignados. Asignar 4.
8. Volver a `/inscripciones`: los 4 tienen eliminar deshabilitado.
9. Registrar resultados, visitar el ranking del torneo: aparecen invitados junto a socios, ordenados por platos.
10. Login como socio: puede ver ranking pero no el enlace `/inscripciones`.

- [ ] **Step 3: Commit final si hay ajustes**

```bash
rtk git add -A
rtk git commit -m "chore(torneos): ajustes finales flujo inscripciones"
```

---

## Notas de riesgo

1. **Precio snapshot divergente**: si el admin cambia los precios del torneo después de tener inscritos, las nuevas inscripciones usan el nuevo precio y las viejas conservan el suyo. Visible y esperado.
2. **Normalización de invitados**: matching invitado ↔ escuadra por `lower(trim(nombre + ' ' + apellidos))`. No permitir renombrar invitados desde UI para evitar desalineaciones.
3. **Caja intacta**: se mantiene el flujo actual de `registrarCajaEscuadra` en el create de escuadra. Los reportes de caja por escuadra (`detalle-torneo`, vistas `caja`) siguen funcionando sin cambios.
4. **Escuadras pre-existentes**: si ya hay torneos con escuadras previas al deploy, los tiradores no aparecerán en `inscripciones_torneo`. Solución: el admin puede inscribirlos manualmente después; el marcado `enEscuadra=true` se recalcula correctamente y bloquea el borrado. No hace falta data migration porque las escuadras viejas no dependen de `inscripciones_torneo` (es el nuevo flujo el que exige estar inscrito para crear escuadras).
5. **Ranking global del club**: fuera del alcance. Si existe, sigue mostrando solo socios.
