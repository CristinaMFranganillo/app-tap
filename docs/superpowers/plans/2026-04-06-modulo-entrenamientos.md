# Módulo de Entrenamientos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introducir el concepto de "entrenamiento" como contenedor jerárquico de escuadras y resultados, con su propio flujo de navegación dentro del panel admin.

**Architecture:** Nueva tabla `entrenamientos` (id, fecha única, creado_por). Las escuadras de entrenamiento pasan a tener `entrenamiento_id` en lugar de `competicion_id = null`. El panel `/admin/scores` se refactoriza para mostrar entrenamientos arriba y competiciones abajo. Nuevas rutas y componentes bajo `/admin/entrenamientos/`.

**Tech Stack:** Angular 19 standalone components, Supabase JS v2, Tailwind CSS, TypeScript, signals + toSignal pattern.

---

## Task 1: Migración SQL en Supabase

**Files:**
- Create: `supabase/migrations/006_entrenamientos.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/006_entrenamientos.sql

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

- [ ] **Step 2: Ejecutar la migración en Supabase**

Ir al dashboard de Supabase → SQL Editor → pegar y ejecutar el contenido del archivo.
Verificar que la tabla `entrenamientos` existe y que `escuadras` tiene la columna `entrenamiento_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_entrenamientos.sql
git commit -m "feat: add entrenamientos migration"
```

---

## Task 2: Modelos TypeScript

**Files:**
- Create: `src/app/core/models/entrenamiento.model.ts`
- Modify: `src/app/core/models/escuadra.model.ts`

- [ ] **Step 1: Crear `entrenamiento.model.ts`**

```typescript
// src/app/core/models/entrenamiento.model.ts
export interface Entrenamiento {
  id: string;
  fecha: string; // YYYY-MM-DD
  creadoPor?: string;
  numEscuadras?: number; // calculado en queries con count
}
```

- [ ] **Step 2: Actualizar `escuadra.model.ts`**

Reemplazar el contenido completo:

```typescript
// src/app/core/models/escuadra.model.ts
export interface Escuadra {
  id: string;
  competicionId?: string;
  entrenamientoId?: string;
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

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/entrenamiento.model.ts src/app/core/models/escuadra.model.ts
git commit -m "feat: add Entrenamiento model, update Escuadra with entrenamientoId"
```

---

## Task 3: EntrenamientoService

**Files:**
- Create: `src/app/features/admin/entrenamientos/entrenamiento.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/features/admin/entrenamientos/entrenamiento.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Entrenamiento } from '../../../core/models/entrenamiento.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toEntrenamiento(row: Record<string, unknown>): Entrenamiento {
  return {
    id: row['id'] as string,
    fecha: row['fecha'] as string,
    creadoPor: row['creado_por'] as string | undefined,
    numEscuadras: row['num_escuadras'] as number | undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class EntrenamientoService {
  getAll(): Observable<Entrenamiento[]> {
    return from(
      supabase
        .from('entrenamientos')
        .select('*, num_escuadras:escuadras(count)')
        .order('fecha', { ascending: false })
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => ({
          ...toEntrenamiento(row as Record<string, unknown>),
          numEscuadras: (row as any).num_escuadras?.[0]?.count ?? 0,
        }))
      )
    );
  }

  getById(id: string): Observable<Entrenamiento | null> {
    return from(
      supabase.from('entrenamientos').select('*').eq('id', id).single()
    ).pipe(
      map(({ data }) => data ? toEntrenamiento(data as Record<string, unknown>) : null)
    );
  }

  async create(fecha: string, creadoPor: string): Promise<string> {
    const { data, error } = await supabase
      .from('entrenamientos')
      .insert({ fecha, creado_por: creadoPor })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un entrenamiento para este día');
      throw new Error('Error creando entrenamiento');
    }
    return (data as Record<string, unknown>)['id'] as string;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/entrenamientos/entrenamiento.service.ts
git commit -m "feat: add EntrenamientoService"
```

---

## Task 4: Actualizar EscuadraService para entrenamientos

**Files:**
- Modify: `src/app/features/scores/escuadra.service.ts`

- [ ] **Step 1: Actualizar `toEscuadra` y añadir métodos para entrenamiento**

Reemplazar el contenido completo del archivo:

```typescript
// src/app/features/scores/escuadra.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Escuadra, EscuadraTirador } from '../../core/models/escuadra.model';
import { supabase } from '../../core/supabase/supabase.client';

function toEscuadra(row: Record<string, unknown>): Escuadra {
  return {
    id: row['id'] as string,
    competicionId: row['competicion_id'] as string | undefined,
    entrenamientoId: row['entrenamiento_id'] as string | undefined,
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
  getByCompeticion(competicionId: string | null): Observable<Escuadra[]> {
    const query = competicionId === null
      ? supabase.from('escuadras').select('*').is('competicion_id', null).order('numero')
      : supabase.from('escuadras').select('*').eq('competicion_id', competicionId).order('numero');
    return from(query).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
  }

  getByEntrenamiento(entrenamientoId: string): Observable<Escuadra[]> {
    return from(
      supabase.from('escuadras').select('*').eq('entrenamiento_id', entrenamientoId).order('numero')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
  }

  getTiradoresByEscuadra(escuadraId: string): Observable<EscuadraTirador[]> {
    return from(
      supabase.from('escuadra_tiradores').select('*').eq('escuadra_id', escuadraId).order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadraTirador)));
  }

  async createEscuadra(competicionId: string | null, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ competicion_id: competicionId, numero })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  async createEscuadraEntrenamiento(entrenamientoId: string, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ entrenamiento_id: entrenamientoId, numero })
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
git commit -m "feat: add getByEntrenamiento and createEscuadraEntrenamiento to EscuadraService"
```

---

## Task 5: Form Entrenamiento

**Files:**
- Create: `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.html`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntrenamientoService } from '../entrenamiento.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-entrenamiento.component.html',
})
export class FormEntrenamientoComponent {
  private entrenamientoService = inject(EntrenamientoService);
  private auth = inject(AuthService);
  private router = inject(Router);

  fecha: string = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const userId = this.auth.currentUser?.id ?? '';
      const id = await this.entrenamientoService.create(this.fecha, userId);
      this.router.navigate(['/admin/entrenamientos', id]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al crear entrenamiento';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-300">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Nuevo Entrenamiento</h2>
  </div>

  <label class="block text-[7.5px] font-bold text-brand-dark uppercase tracking-wide mb-1">Fecha</label>
  <input
    type="date"
    [(ngModel)]="fecha"
    class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm mb-4"
  />

  @if (error) {
    <p class="text-danger text-[9px] font-semibold mt-1 mb-3">{{ error }}</p>
  }

  <div class="flex gap-2 mt-4">
    <button (click)="cancel()" class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-300">
      Cancelar
    </button>
    <button
      (click)="onSubmit()"
      [disabled]="loading"
      class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
    >
      {{ loading ? 'Creando...' : 'Crear entrenamiento' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/form-entrenamiento/
git commit -m "feat: add FormEntrenamientoComponent"
```

---

## Task 6: Form Escuadra de Entrenamiento

**Files:**
- Create: `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.html`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-escuadra-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra-entrenamiento.component.html',
})
export class FormEscuadraEntrenamientoComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private entrenamientoId = this.route.snapshot.paramMap.get('id') ?? '';

  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  puestos: (string | null)[] = [null, null, null, null, null, null];
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    const asignados = this.puestos.filter(p => p !== null);
    if (asignados.length === 0) { this.error = 'Asigna al menos un tirador'; return; }
    this.loading = true;
    this.error = '';
    try {
      const escuadras = await firstValueFrom(this.escuadraService.getByEntrenamiento(this.entrenamientoId));
      const siguienteNumero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadraEntrenamiento(this.entrenamientoId, siguienteNumero);
      for (let i = 0; i < this.puestos.length; i++) {
        const userId = this.puestos[i];
        if (userId) {
          await this.escuadraService.addTirador(escuadraId, userId, i + 1);
        }
      }
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-300">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Nueva Escuadra</h2>
  </div>

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
    <button (click)="cancel()" class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-300">
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

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/
git commit -m "feat: add FormEscuadraEntrenamientoComponent"
```

---

## Task 7: Registrar Resultado de Entrenamiento

**Files:**
- Create: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { EscuadraTirador } from '../../../../core/models/escuadra.model';
import { supabase } from '../../../../core/supabase/supabase.client';

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
})
export class RegistrarResultadoEntrenamientoComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private entrenamientoId = this.route.snapshot.paramMap.get('id') ?? '';
  private escuadraId = this.route.snapshot.paramMap.get('escuadraId') ?? '';

  // Asegurar cache de socios
  private _socios = toSignal(this.userService.getAll(), { initialValue: [] });

  tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] as EscuadraTirador[] }
  );

  // mapa userId → platos rotos (0-25)
  platosRotos: Record<string, number> = {};

  loading = signal(false);
  error = '';

  getUserNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : userId;
  }

  getPlatosRotos(userId: string): number {
    return this.platosRotos[userId] ?? 0;
  }

  setPlatosRotos(userId: string, value: number): void {
    this.platosRotos[userId] = Math.min(25, Math.max(0, value));
  }

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.error = '';
    const adminId = this.auth.currentUser?.id ?? '';
    try {
      const tiradores = this.tiradores();
      for (const t of tiradores) {
        const platos = this.platosRotos[t.userId] ?? 0;
        const { error } = await supabase
          .from('resultados_entrenamiento')
          .upsert({
            escuadra_id: this.escuadraId,
            user_id: t.userId,
            puesto: t.puesto,
            platos_rotos: platos,
            registrado_por: adminId,
          }, { onConflict: 'escuadra_id,user_id' });
        if (error) throw new Error('Error guardando resultados');
      }
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-300">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Registrar Resultados</h2>
  </div>

  <p class="text-[7.5px] font-bold text-brand-dark uppercase tracking-wide mb-3">Platos rotos (máx. 25)</p>

  @for (t of tiradores(); track t.id) {
    <div class="flex items-center justify-between bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm">
      <div>
        <p class="text-[9.5px] font-bold text-brand-dark">{{ getUserNombre(t.userId) }}</p>
        <p class="text-[7.5px] text-gray-300 font-medium">Puesto {{ t.puesto }}</p>
      </div>
      <input
        type="number"
        min="0"
        max="25"
        [value]="getPlatosRotos(t.userId)"
        (input)="setPlatosRotos(t.userId, +$any($event.target).value)"
        class="w-14 bg-surface rounded-[8px] px-2 py-1.5 text-[12px] font-black text-brand-dark text-center outline-none"
      />
    </div>
  }

  @if (tiradores().length === 0) {
    <p class="text-[9px] text-gray-300 text-center py-6">Sin tiradores en esta escuadra</p>
  }

  @if (error) {
    <p class="text-danger text-[9px] font-semibold mt-3">{{ error }}</p>
  }

  <div class="flex gap-2 mt-4">
    <button (click)="cancel()" class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-300">
      Cancelar
    </button>
    <button
      (click)="onSubmit()"
      [disabled]="loading()"
      class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
    >
      {{ loading() ? 'Guardando...' : 'Guardar resultados' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/
git commit -m "feat: add RegistrarResultadoEntrenamientoComponent"
```

---

## Task 8: Detalle Entrenamiento

**Files:**
- Create: `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.html`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts
import { Component, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { Escuadra, EscuadraTirador } from '../../../../core/models/escuadra.model';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';

interface EscuadraConTiradores extends Escuadra {
  numTiradores: number;
}

@Component({
  selector: 'app-detalle-entrenamiento',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './detalle-entrenamiento.component.html',
})
export class DetalleEntrenamientoComponent {
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly entrenamientoId = this.route.snapshot.paramMap.get('id') ?? '';

  entrenamiento = toSignal(
    this.entrenamientoService.getById(this.entrenamientoId),
    { initialValue: null as Entrenamiento | null }
  );

  escuadras = toSignal(
    this.escuadraService.getByEntrenamiento(this.entrenamientoId),
    { initialValue: [] as Escuadra[] }
  );

  nuevaEscuadra(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId, 'escuadra', 'nueva']);
  }

  verResultados(escuadraId: string): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId, 'escuadra', escuadraId, 'resultados']);
  }

  volver(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

- [ ] **Step 2: Necesitamos el número de tiradores por escuadra. Actualizar el TS para cargar tiradores**

Reemplazar el contenido del TS con la versión que carga tiradores por escuadra:

```typescript
// src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts
import { Component, inject, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../scores/escuadra.service';
import { Escuadra } from '../../../../core/models/escuadra.model';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-detalle-entrenamiento',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './detalle-entrenamiento.component.html',
})
export class DetalleEntrenamientoComponent {
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly entrenamientoId = this.route.snapshot.paramMap.get('id') ?? '';

  entrenamiento = toSignal(
    this.entrenamientoService.getById(this.entrenamientoId),
    { initialValue: null as Entrenamiento | null }
  );

  // Escuadras con conteo de tiradores
  escuadrasConTiradores = toSignal(
    this.escuadraService.getByEntrenamiento(this.entrenamientoId).pipe(
      switchMap(escuadras =>
        escuadras.length === 0
          ? of([])
          : combineLatest(
              escuadras.map(e =>
                this.escuadraService.getTiradoresByEscuadra(e.id).pipe(
                  map(tiradores => ({ ...e, numTiradores: tiradores.filter(t => t.userId).length }))
                )
              )
            )
      )
    ),
    { initialValue: [] as (Escuadra & { numTiradores: number })[] }
  );

  nuevaEscuadra(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId, 'escuadra', 'nueva']);
  }

  verResultados(escuadraId: string): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId, 'escuadra', escuadraId, 'resultados']);
  }

  volver(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

- [ ] **Step 3: Crear el template HTML**

```html
<!-- src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="volver()" class="text-gray-300">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    @if (entrenamiento()) {
      <h2 class="text-[11px] font-bold text-brand-dark">
        {{ entrenamiento()!.fecha | date:'EEEE d \'de\' MMMM':'':'es' | titlecase }}
      </h2>
    }
  </div>

  <button
    (click)="nuevaEscuadra()"
    class="w-full flex items-center gap-3 bg-brand-yellow rounded-[12px] px-4 py-3 mb-4"
  >
    <i class="bi bi-plus-circle text-brand-dark text-[16px]"></i>
    <span class="text-[10px] font-bold text-brand-dark">Nueva escuadra</span>
  </button>

  @if (escuadrasConTiradores().length === 0) {
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <i class="bi bi-people text-[36px] text-gray-200 mb-2"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Sin escuadras</p>
      <p class="text-[8px] text-gray-300 mt-1">Crea la primera usando el botón de arriba</p>
    </div>
  } @else {
    @for (e of escuadrasConTiradores(); track e.id) {
      <div
        (click)="verResultados(e.id)"
        class="flex items-center justify-between bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm cursor-pointer"
      >
        <div>
          <p class="text-[9.5px] font-bold text-brand-dark">Escuadra {{ e.numero }}</p>
          <p class="text-[7.5px] text-gray-300 font-medium">{{ e.numTiradores }} tirador{{ e.numTiradores !== 1 ? 'es' : '' }}</p>
        </div>
        <i class="bi bi-chevron-right text-gray-300 text-[12px]"></i>
      </div>
    }
  }
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/entrenamientos/detalle-entrenamiento/
git commit -m "feat: add DetalleEntrenamientoComponent"
```

---

## Task 9: Rutas admin

**Files:**
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Añadir las nuevas rutas de entrenamientos**

Reemplazar el contenido completo del archivo:

```typescript
// src/app/features/admin/admin.routes.ts
import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  // Socios
  {
    path: 'socios',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/lista-socios/lista-socios.component').then(m => m.ListaSociosComponent),
  },
  {
    path: 'socios/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  {
    path: 'socios/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  // Noticias
  {
    path: 'noticias',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/lista-noticias-admin/lista-noticias-admin.component').then(m => m.ListaNoticiasAdminComponent),
  },
  {
    path: 'noticias/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  {
    path: 'noticias/:id/editar',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  // Panel scores (entrenamientos + competiciones)
  {
    path: 'scores',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/admin-scores/admin-scores.component').then(m => m.AdminScoresComponent),
  },
  {
    path: 'scores/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-score/form-score.component').then(m => m.FormScoreComponent),
  },
  // Competiciones
  {
    path: 'competiciones/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./competiciones/form-competicion/form-competicion.component').then(m => m.FormCompeticionComponent),
  },
  // Entrenamientos
  {
    path: 'entrenamientos/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/form-entrenamiento/form-entrenamiento.component').then(m => m.FormEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component').then(m => m.DetalleEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id/escuadra/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component').then(m => m.FormEscuadraEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id/escuadra/:escuadraId/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component').then(m => m.RegistrarResultadoEntrenamientoComponent),
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/admin.routes.ts
git commit -m "feat: add entrenamientos routes to admin"
```

---

## Task 10: Refactorizar panel AdminScores

**Files:**
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.ts`
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.html`

- [ ] **Step 1: Actualizar el TS para incluir entrenamientos**

```typescript
// src/app/features/admin/scores/admin-scores/admin-scores.component.ts
import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CompeticionService } from '../../../scores/competicion.service';
import { EntrenamientoService } from '../../entrenamientos/entrenamiento.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-scores.component.html',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  entrenamientos = toSignal(this.entrenamientoService.getAll(), { initialValue: [] as Entrenamiento[] });

  nuevoEntrenamiento(): void {
    this.router.navigate(['/admin/entrenamientos/nuevo']);
  }

  verEntrenamiento(id: string): void {
    this.router.navigate(['/admin/entrenamientos', id]);
  }

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
```

- [ ] **Step 2: Actualizar el HTML con dos secciones**

```html
<!-- src/app/features/admin/scores/admin-scores/admin-scores.component.html -->
<div class="p-3">

  <!-- SECCIÓN ENTRENAMIENTOS -->
  <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-3">Entrenamientos</h2>

  <button
    (click)="nuevoEntrenamiento()"
    class="w-full flex items-center gap-3 bg-brand-yellow rounded-[12px] px-4 py-3 mb-4"
  >
    <i class="bi bi-plus-circle text-brand-dark text-[16px]"></i>
    <span class="text-[10px] font-bold text-brand-dark">Nuevo entrenamiento</span>
  </button>

  @if (entrenamientos().length === 0) {
    <div class="flex flex-col items-center justify-center py-6 text-center mb-4">
      <i class="bi bi-bullseye text-[32px] text-gray-200 mb-2"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Sin entrenamientos</p>
      <p class="text-[8px] text-gray-300 mt-1">Crea el primero usando el botón de arriba</p>
    </div>
  } @else {
    @for (e of entrenamientos(); track e.id) {
      <div
        (click)="verEntrenamiento(e.id)"
        class="flex items-center justify-between bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm cursor-pointer"
      >
        <div>
          <p class="text-[9.5px] font-bold text-brand-dark">{{ e.fecha | date:'EEEE d \'de\' MMMM':'':'es' | titlecase }}</p>
          <p class="text-[7.5px] text-gray-300 font-medium">{{ e.numEscuadras }} escuadra{{ e.numEscuadras !== 1 ? 's' : '' }}</p>
        </div>
        <i class="bi bi-chevron-right text-gray-300 text-[12px]"></i>
      </div>
    }
  }

  <!-- SEPARADOR -->
  <div class="border-t border-gray-100 my-4"></div>

  <!-- SECCIÓN COMPETICIONES -->
  <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-3">Competiciones</h2>

  <button
    (click)="nuevaCompeticion()"
    class="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-[12px] px-4 py-3 mb-4"
  >
    <i class="bi bi-trophy text-brand-dark text-[16px]"></i>
    <span class="text-[10px] font-bold text-brand-dark">Nueva competición</span>
  </button>

  @if (competiciones().length === 0) {
    <div class="flex flex-col items-center justify-center py-6 text-center">
      <i class="bi bi-trophy text-[32px] text-gray-200 mb-2"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Sin competiciones</p>
      <p class="text-[8px] text-gray-300 mt-1">Crea la primera usando el botón de arriba</p>
    </div>
  } @else {
    @for (c of competiciones(); track c.id) {
      <div class="bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ c.nombre }}</p>
              @if (c.activa) {
                <span class="flex-shrink-0 px-1.5 py-0.5 bg-brand-yellow rounded-full text-[6.5px] font-black text-brand-dark uppercase">Activa</span>
              }
            </div>
            <p class="text-[7.5px] text-gray-300 font-medium mt-0.5">{{ c.modalidad }}</p>
          </div>
          <div class="text-right ml-2">
            <p class="text-[9px] font-black text-brand-dark">{{ totalPlatos(c) }}<span class="text-[7px] text-gray-300 font-medium"> platos</span></p>
            <p class="text-[7px] text-gray-300">{{ c.numSeries }} serie(s) · {{ c.platosPorSerie }}/serie</p>
          </div>
        </div>
        @if (c.lugar) {
          <p class="text-[7px] text-gray-300 mt-1"><i class="bi bi-geo-alt"></i> {{ c.lugar }}</p>
        }
        <p class="text-[7px] text-gray-300 mt-0.5">{{ c.fecha | date:'dd/MM/yyyy' }}</p>
      </div>
    }
  }
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/scores/admin-scores/
git commit -m "feat: refactor AdminScores panel with entrenamientos section"
```

---

## Task 11: Actualizar bottom-nav

**Files:**
- Modify: `src/app/shared/components/bottom-nav/bottom-nav.component.ts`

- [ ] **Step 1: Cambiar "Torneos" por "Entrena" en ADMIN_NAV**

Cambiar en el array `ADMIN_NAV`:

```typescript
{ route: '/admin/scores', icon: 'bi-bullseye', label: 'Entrena' },
```

El archivo completo queda:

```typescript
// src/app/shared/components/bottom-nav/bottom-nav.component.ts
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  route: string;
  icon: string;
  label: string;
}

const SOCIO_NAV: NavItem[] = [
  { route: '/',          icon: 'bi-house-fill',  label: 'Inicio'   },
  { route: '/noticias',  icon: 'bi-newspaper',   label: 'Noticias' },
  { route: '/scores',    icon: 'bi-trophy',      label: 'Torneos'  },
  { route: '/perfil',    icon: 'bi-person',      label: 'Perfil'   },
];

const ADMIN_NAV: NavItem[] = [
  { route: '/admin/socios',   icon: 'bi-people-fill', label: 'Socios'   },
  { route: '/admin/noticias', icon: 'bi-newspaper',   label: 'Noticias' },
  { route: '/admin/scores',   icon: 'bi-bullseye',    label: 'Entrena'  },
  { route: '/perfil',         icon: 'bi-gear',        label: 'Config'   },
];

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  private auth = inject(AuthService);

  get navItems(): NavItem[] {
    return this.auth.hasRole(['admin', 'moderador']) ? ADMIN_NAV : SOCIO_NAV;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shared/components/bottom-nav/bottom-nav.component.ts
git commit -m "feat: rename Torneos to Entrena in admin nav"
```

---

## Task 12: Push final y verificación

- [ ] **Step 1: Push a origin**

```bash
git push origin master
```

- [ ] **Step 2: Verificar en Vercel que el build pasa**

El deploy se dispara automáticamente. Confirmar en el dashboard de Vercel que el build es `Ready`.

- [ ] **Step 3: Verificar flujo completo en la app desplegada**

1. Login como admin → nav muestra "Entrena" con icono de diana
2. Tap "Entrena" → panel con sección Entrenamientos arriba, Competiciones abajo
3. "Nuevo entrenamiento" → form con fecha → crear → navega al detalle
4. En detalle → "Nueva escuadra" → form con 6 puestos → asignar tiradores → crear → vuelve al detalle
5. Tap en escuadra → registrar resultados → ingresar platos 0-25 por tirador → guardar → vuelve al detalle
