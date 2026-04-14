# Modelo de Datos Torneos (Foso Universal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el modelo de datos de torneos para soportar Foso Universal: escuadras, tiradores por puesto y resultados plato a plato.

**Architecture:** Migración en Supabase (nuevas tablas + modificar `competiciones`), nuevos modelos TypeScript, nuevos servicios Angular, actualización de UI existente para usar los nuevos datos.

**Tech Stack:** Angular 19 (signals, standalone components), Supabase (PostgreSQL + RLS), Tailwind CSS, Montserrat font.

---

## Mapa de archivos

### Crear
- `supabase/migrations/002_torneos.sql` — DDL completo
- `src/app/core/models/escuadra.model.ts` — interfaces Escuadra, EscuadraTirador
- `src/app/core/models/resultado.model.ts` — interface Resultado
- `src/app/features/scores/escuadra.service.ts` — CRUD escuadras y tiradores
- `src/app/features/scores/resultado.service.ts` — CRUD resultados plato a plato
- `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts` — formulario crear/editar escuadra
- `src/app/features/admin/scores/form-escuadra/form-escuadra.component.html`
- `src/app/features/admin/scores/registrar-resultado/registrar-resultado.component.ts` — UI para anotar platos
- `src/app/features/admin/scores/registrar-resultado/registrar-resultado.component.html`

### Modificar
- `src/app/core/models/competicion.model.ts` — añadir `lugar`, `platosPorSerie`, `numSeries`; eliminar `totalPlatos`
- `src/app/features/scores/competicion.service.ts` — adaptar mapper y create/update
- `src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts` — nuevos campos
- `src/app/features/admin/competiciones/form-competicion/form-competicion.component.html` — nuevos campos
- `src/app/features/scores/ranking/scores-ranking.component.ts` — usar `resultado.service` para ranking
- `src/app/features/scores/ranking/scores-ranking.component.html` — adaptar vista
- `src/app/features/scores/historial/scores-historial.component.ts` — usar `resultado.service`
- `src/app/features/scores/historial/scores-historial.component.html` — adaptar vista
- `docs/supabase-schema.sql` — actualizar con el nuevo esquema completo

---

## Task 1: Migración SQL en Supabase

**Files:**
- Create: `supabase/migrations/002_torneos.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/002_torneos.sql

-- 1. Modificar competiciones: añadir nuevos campos, mantener total_platos por compatibilidad
ALTER TABLE competiciones
  ADD COLUMN IF NOT EXISTS lugar text,
  ADD COLUMN IF NOT EXISTS platos_por_serie int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS num_series int NOT NULL DEFAULT 1;

-- 2. Escuadras
CREATE TABLE escuadras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicion_id  uuid NOT NULL REFERENCES competiciones(id) ON DELETE CASCADE,
  numero          int NOT NULL,
  UNIQUE(competicion_id, numero)
);

-- 3. Tiradores por escuadra
CREATE TABLE escuadra_tiradores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  puesto      int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  UNIQUE(escuadra_id, user_id),
  UNIQUE(escuadra_id, puesto)
);

-- 4. Resultados plato a plato
CREATE TABLE resultados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicion_id  uuid NOT NULL REFERENCES competiciones(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  serie           int NOT NULL,
  plato           int NOT NULL,
  resultado       smallint NOT NULL CHECK (resultado IN (0, 1)),
  registrado_por  uuid REFERENCES profiles(id),
  fecha           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competicion_id, user_id, serie, plato)
);

-- 5. RLS
ALTER TABLE escuadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE escuadra_tiradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escuadras_select" ON escuadras FOR SELECT TO authenticated USING (true);
CREATE POLICY "escuadras_insert" ON escuadras FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "escuadras_update" ON escuadras FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "escuadras_delete" ON escuadras FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "escuadra_tiradores_select" ON escuadra_tiradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "escuadra_tiradores_insert" ON escuadra_tiradores FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "escuadra_tiradores_delete" ON escuadra_tiradores FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "resultados_select" ON resultados FOR SELECT TO authenticated USING (true);
CREATE POLICY "resultados_insert" ON resultados FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "resultados_update" ON resultados FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "resultados_delete" ON resultados FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Usar la herramienta `mcp__supabase__apply_migration` con `name: "torneos_schema"` y el SQL del step anterior.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_torneos.sql
git commit -m "feat: add escuadras, escuadra_tiradores, resultados tables"
```

---

## Task 2: Actualizar modelos TypeScript

**Files:**
- Modify: `src/app/core/models/competicion.model.ts`
- Create: `src/app/core/models/escuadra.model.ts`
- Create: `src/app/core/models/resultado.model.ts`

- [ ] **Step 1: Actualizar `competicion.model.ts`**

```typescript
// src/app/core/models/competicion.model.ts
export interface Competicion {
  id: string;
  nombre: string;
  modalidad: string;
  platosPorSerie: number;
  numSeries: number;
  lugar?: string;
  fecha: Date;
  activa: boolean;
  creadaPor: string;
}
```

- [ ] **Step 2: Crear `escuadra.model.ts`**

```typescript
// src/app/core/models/escuadra.model.ts
export interface Escuadra {
  id: string;
  competicionId: string;
  numero: number;
  tiradores?: EscuadraTirador[];
}

export interface EscuadraTirador {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
}
```

- [ ] **Step 3: Crear `resultado.model.ts`**

```typescript
// src/app/core/models/resultado.model.ts
export interface Resultado {
  id: string;
  competicionId: string;
  userId: string;
  serie: number;
  plato: number;
  resultado: 0 | 1;
  registradoPor?: string;
  fecha: Date;
}

export interface ResumenTirador {
  userId: string;
  totalRotos: number;
  totalPlatos: number;
  porSerie: { serie: number; rotos: number }[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/core/models/
git commit -m "feat: update competicion model, add escuadra and resultado models"
```

---

## Task 3: Actualizar CompeticionService

**Files:**
- Modify: `src/app/features/scores/competicion.service.ts`

- [ ] **Step 1: Actualizar mapper y métodos**

```typescript
// src/app/features/scores/competicion.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map, tap, BehaviorSubject } from 'rxjs';
import { Competicion } from '../../core/models/competicion.model';
import { supabase } from '../../core/supabase/supabase.client';

function toCompeticion(row: Record<string, unknown>): Competicion {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    modalidad: row['modalidad'] as string,
    platosPorSerie: (row['platos_por_serie'] as number) ?? 25,
    numSeries: (row['num_series'] as number) ?? 1,
    lugar: (row['lugar'] as string) ?? undefined,
    fecha: new Date(row['fecha'] as string),
    activa: row['activa'] as boolean,
    creadaPor: row['creada_por'] as string,
  };
}

@Injectable({ providedIn: 'root' })
export class CompeticionService {
  private cache = new BehaviorSubject<Competicion[]>([]);

  getAll(): Observable<Competicion[]> {
    return from(
      supabase.from('competiciones').select('*').order('fecha', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(toCompeticion)),
      tap(items => this.cache.next(items))
    );
  }

  getActiva(): Observable<Competicion | undefined> {
    return from(
      supabase.from('competiciones').select('*').eq('activa', true).limit(1)
    ).pipe(
      map(({ data }) =>
        data && data.length > 0 ? toCompeticion(data[0] as Record<string, unknown>) : undefined
      )
    );
  }

  getById(id: string): Competicion | undefined {
    return this.cache.getValue().find(c => c.id === id);
  }

  async create(data: Omit<Competicion, 'id'>): Promise<void> {
    await supabase.from('competiciones').insert({
      nombre: data.nombre,
      modalidad: data.modalidad,
      platos_por_serie: data.platosPorSerie,
      num_series: data.numSeries,
      lugar: data.lugar ?? null,
      fecha: data.fecha.toISOString(),
      activa: data.activa,
      creada_por: data.creadaPor,
    });
  }

  async update(id: string, data: Partial<Competicion>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.modalidad !== undefined) payload['modalidad'] = data.modalidad;
    if (data.platosPorSerie !== undefined) payload['platos_por_serie'] = data.platosPorSerie;
    if (data.numSeries !== undefined) payload['num_series'] = data.numSeries;
    if (data.lugar !== undefined) payload['lugar'] = data.lugar;
    if (data.fecha !== undefined) payload['fecha'] = data.fecha.toISOString();
    if (data.activa !== undefined) payload['activa'] = data.activa;
    await supabase.from('competiciones').update(payload).eq('id', id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/scores/competicion.service.ts
git commit -m "feat: update CompeticionService for new schema"
```

---

## Task 4: Crear EscuadraService

**Files:**
- Create: `src/app/features/scores/escuadra.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/features/scores/escuadra.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Escuadra, EscuadraTirador } from '../../core/models/escuadra.model';
import { supabase } from '../../core/supabase/supabase.client';

function toEscuadra(row: Record<string, unknown>): Escuadra {
  return {
    id: row['id'] as string,
    competicionId: row['competicion_id'] as string,
    numero: row['numero'] as number,
  };
}

function toEscuadraTirador(row: Record<string, unknown>): EscuadraTirador {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string,
    puesto: row['puesto'] as number,
  };
}

@Injectable({ providedIn: 'root' })
export class EscuadraService {
  getByCompeticion(competicionId: string): Observable<Escuadra[]> {
    return from(
      supabase.from('escuadras').select('*').eq('competicion_id', competicionId).order('numero')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
  }

  getTiradoresByEscuadra(escuadraId: string): Observable<EscuadraTirador[]> {
    return from(
      supabase.from('escuadra_tiradores').select('*').eq('escuadra_id', escuadraId).order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadraTirador)));
  }

  async createEscuadra(competicionId: string, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ competicion_id: competicionId, numero })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  async addTirador(escuadraId: string, userId: string, puesto: number): Promise<void> {
    const { error } = await supabase
      .from('escuadra_tiradores')
      .insert({ escuadra_id: escuadraId, user_id: userId, puesto });
    if (error) throw new Error('Error añadiendo tirador');
  }

  async removeTirador(id: string): Promise<void> {
    await supabase.from('escuadra_tiradores').delete().eq('id', id);
  }

  async deleteEscuadra(id: string): Promise<void> {
    await supabase.from('escuadras').delete().eq('id', id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/scores/escuadra.service.ts
git commit -m "feat: add EscuadraService"
```

---

## Task 5: Crear ResultadoService

**Files:**
- Create: `src/app/features/scores/resultado.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/features/scores/resultado.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Resultado, ResumenTirador } from '../../core/models/resultado.model';
import { supabase } from '../../core/supabase/supabase.client';

function toResultado(row: Record<string, unknown>): Resultado {
  return {
    id: row['id'] as string,
    competicionId: row['competicion_id'] as string,
    userId: row['user_id'] as string,
    serie: row['serie'] as number,
    plato: row['plato'] as number,
    resultado: row['resultado'] as 0 | 1,
    registradoPor: (row['registrado_por'] as string) ?? undefined,
    fecha: new Date(row['fecha'] as string),
  };
}

@Injectable({ providedIn: 'root' })
export class ResultadoService {
  getByCompeticion(competicionId: string): Observable<Resultado[]> {
    return from(
      supabase
        .from('resultados')
        .select('*')
        .eq('competicion_id', competicionId)
        .order('serie')
        .order('plato')
    ).pipe(map(({ data }) => (data ?? []).map(toResultado)));
  }

  getByUser(userId: string): Observable<Resultado[]> {
    return from(
      supabase
        .from('resultados')
        .select('*')
        .eq('user_id', userId)
        .order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toResultado)));
  }

  getRanking(competicionId: string, totalPlatos: number): Observable<ResumenTirador[]> {
    return this.getByCompeticion(competicionId).pipe(
      map(resultados => {
        const byUser = new Map<string, Resultado[]>();
        for (const r of resultados) {
          if (!byUser.has(r.userId)) byUser.set(r.userId, []);
          byUser.get(r.userId)!.push(r);
        }
        return Array.from(byUser.entries())
          .map(([userId, lista]) => {
            const totalRotos = lista.reduce((s, r) => s + r.resultado, 0);
            const series = new Map<number, number>();
            for (const r of lista) {
              series.set(r.serie, (series.get(r.serie) ?? 0) + r.resultado);
            }
            return {
              userId,
              totalRotos,
              totalPlatos,
              porSerie: Array.from(series.entries()).map(([serie, rotos]) => ({ serie, rotos })),
            };
          })
          .sort((a, b) => b.totalRotos - a.totalRotos);
      })
    );
  }

  async upsert(data: Omit<Resultado, 'id' | 'fecha'>, registradoPorId: string): Promise<void> {
    const { error } = await supabase.from('resultados').upsert({
      competicion_id: data.competicionId,
      user_id: data.userId,
      serie: data.serie,
      plato: data.plato,
      resultado: data.resultado,
      registrado_por: registradoPorId,
    }, { onConflict: 'competicion_id,user_id,serie,plato' });
    if (error) throw new Error('Error guardando resultado');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/scores/resultado.service.ts
git commit -m "feat: add ResultadoService with ranking and upsert"
```

---

## Task 6: Actualizar formulario de competición (admin)

**Files:**
- Modify: `src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts`
- Modify: `src/app/features/admin/competiciones/form-competicion/form-competicion.component.html`

- [ ] **Step 1: Leer el archivo actual**

Leer `src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts` para ver el FormGroup actual.

- [ ] **Step 2: Actualizar el componente**

Reemplazar los campos del FormGroup. Cambiar `totalPlatos` por `platosPorSerie` y añadir `numSeries` y `lugar`:

```typescript
this.form = this.fb.group({
  nombre: ['', Validators.required],
  modalidad: ['foso-universal', Validators.required],
  lugar: [''],
  platosPorSerie: [25, [Validators.required, Validators.min(1)]],
  numSeries: [1, [Validators.required, Validators.min(1)]],
  fecha: ['', Validators.required],
  activa: [false],
});
```

En `onSubmit`, cambiar la llamada a `competicionService.create`:

```typescript
await this.competicionService.create({
  nombre: v.nombre,
  modalidad: v.modalidad,
  lugar: v.lugar || undefined,
  platosPorSerie: v.platosPorSerie,
  numSeries: v.numSeries,
  fecha: new Date(v.fecha),
  activa: v.activa,
  creadaPor: this.auth.currentUser$.value?.id ?? '',
});
```

- [ ] **Step 3: Actualizar el HTML**

Reemplazar el campo `totalPlatos` por `platosPorSerie`, `numSeries` y `lugar`:

```html
<label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Lugar</label>
<input
  formControlName="lugar"
  type="text"
  placeholder="Campo de Tiro San Isidro"
  class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm mb-3"
/>

<div class="flex gap-2 mb-3">
  <div class="flex-1">
    <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Platos por serie</label>
    <input
      formControlName="platosPorSerie"
      type="number"
      min="1"
      class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
    />
  </div>
  <div class="flex-1">
    <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Nº series</label>
    <input
      formControlName="numSeries"
      type="number"
      min="1"
      class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
    />
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/competiciones/
git commit -m "feat: update form-competicion with new fields"
```

---

## Task 7: Formulario de escuadras (admin)

**Files:**
- Create: `src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts`
- Create: `src/app/features/admin/scores/form-escuadra/form-escuadra.component.html`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/scores/form-escuadra/form-escuadra.component.ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EscuadraService } from '../../../scores/escuadra.service';
import { CompeticionService } from '../../../scores/competicion.service';
import { UserService } from '../../socios/user.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { UserProfile } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-escuadra',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra.component.html',
})
export class FormEscuadraComponent {
  private escuadraService = inject(EscuadraService);
  private competicionService = inject(CompeticionService);
  private userService = inject(UserService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  socios = toSignal(this.userService.getAll(), { initialValue: [] as UserProfile[] });

  competicionId = '';
  puestos: (string | null)[] = [null, null, null, null, null]; // índice 0=puesto1
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    if (!this.competicionId) { this.error = 'Selecciona una competición'; return; }
    const asignados = this.puestos.filter(p => p !== null);
    if (asignados.length === 0) { this.error = 'Asigna al menos un tirador'; return; }

    this.loading = true;
    this.error = '';
    try {
      // Calcular siguiente número de escuadra
      const escuadras = await this.escuadraService.getByCompeticion(this.competicionId).toPromise() ?? [];
      const siguienteNumero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadra(this.competicionId, siguienteNumero);
      for (let i = 0; i < this.puestos.length; i++) {
        const userId = this.puestos[i];
        if (userId) {
          await this.escuadraService.addTirador(escuadraId, userId, i + 1);
        }
      }
      this.router.navigate(['/admin/scores']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

- [ ] **Step 2: Crear el HTML**

```html
<!-- src/app/features/admin/scores/form-escuadra/form-escuadra.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Nueva Escuadra</h2>
  </div>

  <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Competición</label>
  <select
    [(ngModel)]="competicionId"
    class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm mb-4"
  >
    <option value="">Selecciona una competición</option>
    @for (c of competiciones(); track c.id) {
      <option [value]="c.id">{{ c.nombre }} — {{ c.fecha | date:'d MMM yyyy':'' }}</option>
    }
  </select>

  <p class="text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-2">Tiradores por puesto</p>

  @for (puesto of puestos; track $index) {
    <div class="mb-2">
      <label class="block text-[7.5px] text-gray-300 font-medium mb-1">Puesto {{ $index + 1 }}</label>
      <select
        [(ngModel)]="puestos[$index]"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      >
        <option [value]="null">— Sin asignar —</option>
        @for (s of socios(); track s.id) {
          <option [value]="s.id">{{ s.nombre }} {{ s.apellidos }} (#{{ s.numeroSocio }})</option>
        }
      </select>
    </div>
  }

  @if (error) {
    <p class="text-danger text-[9px] font-semibold mt-3">{{ error }}</p>
  }

  <div class="flex gap-2 mt-4">
    <button (click)="cancel()" class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400">
      Cancelar
    </button>
    <button
      (click)="onSubmit()"
      [disabled]="loading"
      class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
    >
      {{ loading ? 'Guardando...' : 'Crear escuadra' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Registrar ruta en admin.routes.ts**

Añadir al array de rutas de admin:

```typescript
{
  path: 'scores/escuadra/nueva',
  loadComponent: () =>
    import('./scores/form-escuadra/form-escuadra.component').then(m => m.FormEscuadraComponent),
},
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/scores/form-escuadra/ src/app/features/admin/admin.routes.ts
git commit -m "feat: add form-escuadra component and route"
```

---

## Task 8: UI de registro de resultados plato a plato (admin)

**Files:**
- Create: `src/app/features/admin/scores/registrar-resultado/registrar-resultado.component.ts`
- Create: `src/app/features/admin/scores/registrar-resultado/registrar-resultado.component.html`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/scores/registrar-resultado/registrar-resultado.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ResultadoService } from '../../../scores/resultado.service';
import { EscuadraService } from '../../../scores/escuadra.service';
import { CompeticionService } from '../../../scores/competicion.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { EscuadraTirador } from '../../../../core/models/escuadra.model';

@Component({
  selector: 'app-registrar-resultado',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar-resultado.component.html',
})
export class RegistrarResultadoComponent {
  private resultadoService = inject(ResultadoService);
  private escuadraService = inject(EscuadraService);
  private competicionService = inject(CompeticionService);
  private userService = inject(UserService);
  private auth = inject(AuthService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });

  competicionId = signal('');
  serieActual = signal(1);
  platoActual = signal(1);

  escuadras = toSignal(
    toObservable(this.competicionId).pipe(
      switchMap(id => id ? this.escuadraService.getByCompeticion(id) : [])
    ),
    { initialValue: [] }
  );

  escuadraId = signal('');

  tiradores = toSignal(
    toObservable(this.escuadraId).pipe(
      switchMap(id => id ? this.escuadraService.getTiradoresByEscuadra(id) : [])
    ),
    { initialValue: [] as EscuadraTirador[] }
  );

  competicionActual = computed(() =>
    this.competiciones().find(c => c.id === this.competicionId())
  );

  saving = signal(false);

  getUserNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : userId;
  }

  async registrar(userId: string, resultado: 0 | 1): Promise<void> {
    const adminId = this.auth.currentUser$.value?.id ?? '';
    this.saving.set(true);
    try {
      await this.resultadoService.upsert({
        competicionId: this.competicionId(),
        userId,
        serie: this.serieActual(),
        plato: this.platoActual(),
        resultado,
      }, adminId);
      // Avanzar al siguiente plato
      const comp = this.competicionActual();
      const maxPlatos = comp?.platosPorSerie ?? 25;
      if (this.platoActual() < maxPlatos) {
        this.platoActual.update(p => p + 1);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
```

Añadir el import que falta al principio:

```typescript
import { toObservable } from '@angular/core/rxjs-interop';
```

- [ ] **Step 2: Crear el HTML**

```html
<!-- src/app/features/admin/scores/registrar-resultado/registrar-resultado.component.html -->
<div class="p-3">
  <h2 class="text-[11px] font-bold text-brand-dark mb-4">Registrar resultados</h2>

  <!-- Selector competición -->
  <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Competición</label>
  <select
    [value]="competicionId()"
    (change)="competicionId.set($any($event.target).value)"
    class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm mb-3"
  >
    <option value="">Selecciona</option>
    @for (c of competiciones(); track c.id) {
      <option [value]="c.id">{{ c.nombre }}</option>
    }
  </select>

  @if (competicionId()) {
    <!-- Selector escuadra -->
    <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Escuadra</label>
    <select
      [value]="escuadraId()"
      (change)="escuadraId.set($any($event.target).value)"
      class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm mb-3"
    >
      <option value="">Selecciona escuadra</option>
      @for (e of escuadras(); track e.id) {
        <option [value]="e.id">Escuadra {{ e.numero }}</option>
      }
    </select>
  }

  @if (escuadraId()) {
    <!-- Serie y plato -->
    <div class="flex gap-3 mb-4">
      <div class="flex-1 bg-surface rounded-[10px] px-3 py-2 text-center">
        <p class="text-[7px] text-gray-300 font-bold uppercase tracking-wide">Serie</p>
        <div class="flex items-center justify-center gap-2 mt-1">
          <button (click)="serieActual.update(s => Math.max(1, s-1))" class="text-gray-300 font-bold text-[14px] leading-none">−</button>
          <span class="text-[16px] font-black text-brand-dark">{{ serieActual() }}</span>
          <button (click)="serieActual.update(s => s+1)" class="text-gray-300 font-bold text-[14px] leading-none">+</button>
        </div>
      </div>
      <div class="flex-1 bg-surface rounded-[10px] px-3 py-2 text-center">
        <p class="text-[7px] text-gray-300 font-bold uppercase tracking-wide">Plato</p>
        <div class="flex items-center justify-center gap-2 mt-1">
          <button (click)="platoActual.update(p => Math.max(1, p-1))" class="text-gray-300 font-bold text-[14px] leading-none">−</button>
          <span class="text-[16px] font-black text-brand-dark">{{ platoActual() }}</span>
          <button (click)="platoActual.update(p => p+1)" class="text-gray-300 font-bold text-[14px] leading-none">+</button>
        </div>
      </div>
    </div>

    <!-- Tiradores -->
    @for (t of tiradores(); track t.id) {
      <div class="flex items-center justify-between bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm">
        <div>
          <p class="text-[9.5px] font-bold text-brand-dark">{{ getUserNombre(t.userId) }}</p>
          <p class="text-[7.5px] text-gray-300 font-medium">Puesto {{ t.puesto }}</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="registrar(t.userId, 1)"
            [disabled]="saving()"
            class="px-3 py-1.5 rounded-[8px] bg-success text-white text-[9px] font-bold disabled:opacity-50"
          >
            ROTO
          </button>
          <button
            (click)="registrar(t.userId, 0)"
            [disabled]="saving()"
            class="px-3 py-1.5 rounded-[8px] bg-danger text-white text-[9px] font-bold disabled:opacity-50"
          >
            FALLO
          </button>
        </div>
      </div>
    }
  }
</div>
```

- [ ] **Step 3: Registrar ruta en admin.routes.ts**

Añadir al array de rutas de admin:

```typescript
{
  path: 'scores/resultados',
  loadComponent: () =>
    import('./scores/registrar-resultado/registrar-resultado.component').then(m => m.RegistrarResultadoComponent),
},
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/scores/registrar-resultado/ src/app/features/admin/admin.routes.ts
git commit -m "feat: add registrar-resultado component and route"
```

---

## Task 9: Actualizar ranking e historial para usar ResultadoService

**Files:**
- Modify: `src/app/features/scores/ranking/scores-ranking.component.ts`
- Modify: `src/app/features/scores/ranking/scores-ranking.component.html`
- Modify: `src/app/features/scores/historial/scores-historial.component.ts`
- Modify: `src/app/features/scores/historial/scores-historial.component.html`

- [ ] **Step 1: Actualizar scores-ranking.component.ts**

```typescript
// src/app/features/scores/ranking/scores-ranking.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ResultadoService } from '../resultado.service';
import { CompeticionService } from '../competicion.service';
import { UserService } from '../../admin/socios/user.service';
import { Competicion } from '../../../core/models/competicion.model';
import { ResumenTirador } from '../../../core/models/resultado.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-scores-ranking',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './scores-ranking.component.html',
})
export class ScoresRankingComponent {
  private competicionService = inject(CompeticionService);
  private resultadoService = inject(ResultadoService);
  private userService = inject(UserService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  selectedId = signal<string>('');

  competicionActual = computed(() => this.competiciones().find(c => c.id === this.selectedId()));

  ranking = toSignal(
    toObservable(this.selectedId).pipe(
      switchMap(id => {
        const comp = this.competicionService.getById(id);
        const total = comp ? comp.platosPorSerie * comp.numSeries : 25;
        return this.resultadoService.getRanking(id, total);
      })
    ),
    { initialValue: [] as ResumenTirador[] }
  );

  selectCompeticion(id: string): void {
    this.selectedId.set(id);
  }

  getUserNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : 'Desconocido';
  }

  getUserApellidos(userId: string): string {
    return this.userService.getById(userId)?.apellidos ?? '';
  }

  getMedalIcon(posicion: number): string {
    if (posicion === 1) return '🥇';
    if (posicion === 2) return '🥈';
    if (posicion === 3) return '🥉';
    return `${posicion}º`;
  }
}
```

- [ ] **Step 2: Actualizar scores-ranking.component.html**

Leer el HTML actual y reemplazar las referencias a `entry.platosRotos` por `entry.totalRotos` y `entry.totalPlatos`.

- [ ] **Step 3: Actualizar scores-historial.component.ts**

```typescript
// src/app/features/scores/historial/scores-historial.component.ts
import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ResultadoService } from '../resultado.service';
import { CompeticionService } from '../competicion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Resultado } from '../../../core/models/resultado.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-scores-historial',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './scores-historial.component.html',
})
export class ScoresHistorialComponent {
  private auth = inject(AuthService);
  private resultadoService = inject(ResultadoService);
  private competicionService = inject(CompeticionService);

  resultados = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user => this.resultadoService.getByUser(user?.id ?? ''))
    ),
    { initialValue: [] as Resultado[] }
  );

  // Agrupa resultados por competición para mostrar totales
  resumenPorCompeticion = computed(() => {
    const map = new Map<string, { rotos: number; total: number; fecha: Date }>();
    for (const r of this.resultados()) {
      const comp = this.competicionService.getById(r.competicionId);
      const total = comp ? comp.platosPorSerie * comp.numSeries : 25;
      if (!map.has(r.competicionId)) {
        map.set(r.competicionId, { rotos: 0, total, fecha: r.fecha });
      }
      map.get(r.competicionId)!.rotos += r.resultado;
    }
    return Array.from(map.entries()).map(([competicionId, v]) => ({ competicionId, ...v }));
  });

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getPorcentaje(rotos: number, total: number): number {
    return total > 0 ? Math.round((rotos / total) * 100) : 0;
  }
}
```

- [ ] **Step 4: Actualizar scores-historial.component.html**

Leer el HTML actual y reemplazar el `@for (score of scores()` por `@for (item of resumenPorCompeticion()` actualizando las referencias a `item.rotos`, `item.total`, `item.fecha`.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scores/ranking/ src/app/features/scores/historial/
git commit -m "feat: use ResultadoService in ranking and historial"
```

---

## Task 10: Aplicar migración SQL a Supabase

- [ ] **Step 1: Aplicar migración con MCP**

Ejecutar la herramienta `mcp__supabase__apply_migration` con el SQL del Task 1 Step 1 y nombre `"torneos_schema"`.

- [ ] **Step 2: Verificar tablas**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

Resultado esperado: `competiciones`, `escuadra_tiradores`, `escuadras`, `noticias`, `perfiles`, `resultados`, `scores`, `solicitudes_registro`.

- [ ] **Step 3: Commit final**

```bash
git add docs/
git commit -m "feat: complete torneos data model migration"
```
